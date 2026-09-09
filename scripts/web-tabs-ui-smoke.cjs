const { app, BrowserWindow, WebContentsView, session } = require('electron');
const { createServer } = require('node:http');
const { mkdirSync, writeFileSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.cwd(), home = process.argv.find(arg => arg.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
if (!home) throw new Error('Run through the isolated fixture launcher');
app.setPath('userData', home);
// Keep the synthetic page painting even when the automation window is occluded.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('host-resolver-rules', 'MAP aifb-fixture.test 127.0.0.1');
let web, win, server;
const record = { recordedAt: new Date().toISOString(), realWebContentsView: true, simulatedSite: true, realProviderCalls: 0, failures: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 400; i++) { if (await fn()) return; await wait(50); } throw new Error('Web fixture timeout'); }
app.whenReady().then(async () => {
  const { WebTabs } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/web-tabs.mjs')));
  const { isTrustedRendererEvent } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/security-policy.mjs')));
  server = createServer((req, res) => { if (req.url === '/download') { res.writeHead(200, { 'content-disposition': 'attachment; filename=fixture.txt' }); res.end('fixture'); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<title>Trang cùng làm việc</title><h1>Kế hoạch mẫu</h1><p>Ba việc cần làm hôm nay.</p><p hidden>HIDDEN_SECRET</p><textarea>TEXTAREA_SECRET</textarea><input type=password value=PASSWORD_SECRET><button onclick="document.querySelector(\'p\').textContent=\'Người dùng đã cập nhật trang\'">Cập nhật</button><a href="/next">Trang sau</a>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://aifb-fixture.test:${server.address().port}`;
  win = new BrowserWindow({ width: 1100, height: 780, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });

  await win.loadURL('data:text/html,<h1>AI for Boss Web fixture</h1>');
  win.show(); await wait(500);
  web = new WebTabs({ window: win, createView: options => new WebContentsView(options), browserSession: session.fromPartition('web-fixture'),
    validateUrl: async value => { if (!value.startsWith(url + '/') && value !== url) throw new Error('Fixture denies external network'); return value; } });
  await web.run({ action: 'web-bounds', bounds: { x: 600, y: 80, width: 450, height: 560 } });
  const first = (await web.run({ action: 'web-new' })).active;
  await web.run({ action: 'web-navigate', id: first, url });
  const contents = web.tabs.get(first).view.webContents;

  await until(() => contents.getTitle() === 'Trang cùng làm việc' && !contents.isLoading());
  assert.equal(await contents.executeJavaScript('typeof process'), 'undefined');
  assert.equal(await contents.executeJavaScript('typeof window.aiForBoss'), 'undefined');
  assert.equal(contents.getLastWebPreferences().sandbox, true);
  assert.equal(isTrustedRendererEvent({ sender: contents, senderFrame: contents.mainFrame }, win), false);
  await contents.executeJavaScript('document.querySelector("button").click()', true);
  const shared = await web.run({ action: 'web-share', id: first });
  assert.match(shared.text, /Người dùng đã cập nhật/); assert.doesNotMatch(shared.text, /SECRET/);
  const evidence = path.join(root, 'artifacts/shared-web-tabs'); mkdirSync(evidence, { recursive: true });

  record.surface = { bounds: web.tabs.get(first).view.getBounds(), visible: web.tabs.get(first).view.getVisible(), windowVisible: win.isVisible(), viewport: await contents.executeJavaScript('({width:innerWidth,height:innerHeight,visibility:document.visibilityState})') };
  await wait(500);
  writeFileSync(path.join(evidence, 'webcontents-view.png'), (await contents.capturePage(undefined, { stayAwake: true })).toPNG());
  contents.on('will-navigate', (event, destination) => { record.navigationEvent = { destination, eventUrl: event.url }; });
  await contents.executeJavaScript('document.querySelector("a").click()', true);
  await until(() => { record.navigationState = web.state(); return contents.getURL().endsWith('/next') && !contents.isLoading() && contents.navigationHistory.canGoBack(); });
  await web.run({ action: 'web-back', id: first }); await until(() => !contents.getURL().endsWith('/next'));
  await contents.executeJavaScript(`window.open(${JSON.stringify(url + '/popup')}, '_blank'); undefined`, true);
  await until(() => web.state().tabs.some(t => t.url.endsWith('/popup') && !t.loading));
  const second = web.state().active; assert.notEqual(first, second);
  await web.run({ action: 'web-select', id: first }); assert.equal(web.state().active, first);
  await web.run({ action: 'web-bounds', bounds: null }); assert.equal(web.tabs.get(first).view.getVisible(), false);
  await web.run({ action: 'web-bounds', bounds: { x: 600, y: 80, width: 450, height: 560 } });
  await assert.rejects(web.run({ action: 'web-bounds', bounds: { x: 0, y: 0, width: 1100, height: 780 } }));
  await until(() => !contents.isLoading());
  const restored = await contents.capturePage(); assert.equal(restored.isEmpty(), false);
  writeFileSync(path.join(evidence, 'webcontents-restored.png'), restored.toPNG());
  await assert.rejects(web.run({ action: 'web-navigate', id: first, url: 'file:///C:/secret' }));
  await web.run({ action: 'web-navigate', id: first, url: url + '/download' });
  await until(() => web.state().tabs.find(t => t.id === first).error.includes('Tải tệp'));
  await web.run({ action: 'web-close', id: second }); assert.equal(web.tabs.size, 1);
  record.checks = ['real page and user interaction', 'main-frame bounded sharing excludes inputs and hidden text', 'separate sandbox/no Node/no IPC', 'tabs/create/select/close', 'back navigation', 'hide/show surface', 'bounds and local protocol denial', 'download blocked'];
}).catch(e => { record.failures.push(String(e.stack)); }).finally(async () => {
  try { web?.dispose(); win?.destroy(); if (server) await new Promise(resolve => server.close(resolve)); } catch (e) { record.failures.push(String(e)); }
  mkdirSync(path.join(root, 'artifacts/shared-web-tabs'), { recursive: true });
  writeFileSync(path.join(root, 'artifacts/shared-web-tabs/webcontents-fixture.json'), JSON.stringify(record, null, 2)+'\n');
  console.log(JSON.stringify(record));
  app.exit(record.failures.length ? 1 : 0);
});
