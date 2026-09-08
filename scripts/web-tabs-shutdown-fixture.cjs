/** Real Electron lifecycle regression; generated data pages only, no Gateway/account. */
const { app, BrowserWindow, WebContentsView, session, webContents } = require('electron');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const argument = name => process.argv.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
const home = argument('--user-data-dir'), modulePath = argument('--module'), output = argument('--out');
const ownerClosedOnly = process.argv.includes('--owner-closed-callback');
assert.ok(home && modulePath && output, 'Use the isolated shutdown fixture launcher');
app.setPath('userData', home);
app.on('window-all-closed', () => {});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const ownedWindows = [], ownedContents = [];
const record = {
  kind: 'AIFB_NATIVE_WEB_TABS_SHUTDOWN', recordedAt: new Date().toISOString(), electron: process.versions.electron,
  sourceModule: modulePath, sourceSha256: createHash('sha256').update(readFileSync(modulePath)).digest('hex'),
  realBrowserWindow: true, realWebContentsView: true, pages: 'generated data URLs only',
  gatewayStarted: false, realAccountUsed: false, externalNetworkAttempts: 0,
  cases: [], failures: [], cleanup: {},
  suite: ownerClosedOnly ? 'synchronous-owner-closed-callback' : 'native-shutdown-orders',
};
let finishing = false;
async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!predicate()) { if (Date.now() >= deadline) throw new Error(`Timed out: ${label}`); await wait(20); }
}
async function cleanupOwned() {
  for (const contents of ownedContents) if (!contents.isDestroyed()) contents.close({ waitForBeforeUnload: false });
  for (const win of ownedWindows) if (!win.isDestroyed()) win.destroy();
  await until(() => ownedContents.every(contents => contents.isDestroyed()), 'owned page destruction');
  record.cleanup.ownedContentsDestroyed = ownedContents.every(contents => contents.isDestroyed());
  record.cleanup.ownedWindowsDestroyed = ownedWindows.every(win => win.isDestroyed());
  record.cleanup.remainingAppWebContents = webContents.getAllWebContents().length;
}
async function finish() {
  if (finishing) return; finishing = true; clearTimeout(deadline);
  try { await cleanupOwned(); } catch (error) { record.failures.push(`Fixture cleanup: ${error.message}`); }
  record.pass = record.failures.length === 0 && record.cases.every(item => item.pass)
    && record.cleanup.ownedContentsDestroyed && record.cleanup.ownedWindowsDestroyed && record.cleanup.remainingAppWebContents === 0;
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify({ pass: record.pass, cases: record.cases.map(item => ({ name: item.name, pass: item.pass, errors: item.errors })), output }));
  app.exit(record.pass ? 0 : 1);
}
const deadline = setTimeout(() => { record.failures.push('Native shutdown fixture deadline reached'); void finish(); }, 60000);

app.whenReady().then(async () => {
  const { WebTabs } = await import(pathToFileURL(modulePath));
  async function scenario(name, { noManager = false, count = 0, hidden = false, destroyTab = false, destroyWindowFirst = true, closeWindowFirst = false, nativeQuit = false, repeatAfterWindow = false, disposeInClosedCallback = false, nativeQuitClosesWindow = false } = {}) {
    const result = { name, pass: false, errors: [] }; record.cases.push(result);
    const win = new BrowserWindow({ width: 1100, height: 780, show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    ownedWindows.push(win); ownedContents.push(win.webContents);
    await win.loadURL('data:text/html,<title>Generated shutdown fixture</title>');
    let web = null; const tabs = [];
    try {
      if (!noManager) web = new WebTabs({ window: win, browserSession: session.fromPartition(`shutdown-${name}`),
        createView: options => { const view = new WebContentsView(options); ownedContents.push(view.webContents); return view; },
        validateUrl: async () => { record.externalNetworkAttempts++; throw new Error('Fixture rejects every external address'); } });
      if (web) {
        await web.run({ action: 'web-bounds', bounds: { x: 600, y: 80, width: 450, height: 560 } });
        for (let index = 0; index < count; index++) {
          const id = web.add(), view = web.tabs.get(id).view;
          await view.webContents.loadURL(`data:text/html,<title>Generated tab ${index}</title><p>Local fixture page</p>`);
          const preferences = view.webContents.getLastWebPreferences();
          assert.equal(preferences.sandbox, true); assert.equal(preferences.contextIsolation, true); assert.equal(preferences.nodeIntegration, false);
          tabs.push(view.webContents);
        }
        if (hidden) await web.run({ action: 'web-bounds', bounds: null });
        if (destroyTab) { tabs[0].close({ waitForBeforeUnload: false }); await until(() => tabs[0].isDestroyed(), 'pre-destroyed tab'); }
      }
      result.tabCount = count; result.hidden = hidden;
      result.liveTabsBeforeWindowClose = tabs.filter(contents => !contents.isDestroyed()).length;
      if (disposeInClosedCallback) win.once('closed', () => {
        result.ownerClosedCallback = { observed: true, windowDestroyedAtEntry: win.isDestroyed(),
          liveTabsAtEntry: tabs.filter(contents => !contents.isDestroyed()).length, disposeReturned: false };
        try { web?.dispose(); result.ownerClosedCallback.disposeReturned = true; }
        catch (error) { result.errors.push({ phase: 'synchronous-owner-closed-callback', name: error.name, message: error.message }); }
      });
      if (destroyWindowFirst) { if (closeWindowFirst) win.close(); else win.destroy(); await until(() => win.isDestroyed(), 'native window destruction'); }
      result.windowDestroyedBeforeDispose = win.isDestroyed();
      result.liveTabsBeforeDispose = tabs.filter(contents => !contents.isDestroyed()).length;
      if (nativeQuit) {
        // Exercise Electron's real before-quit event, but keep this test process
        // alive for receipt/cleanup; the product Gateway chain is tested separately.
        app.once('before-quit', event => {
          result.nativeBeforeQuitObserved = true;
          if (!nativeQuitClosesWindow) {
            event.preventDefault();
            try { web?.dispose(); } catch (error) { result.errors.push({ phase: 'native-before-quit', name: error.name, message: error.message }); }
          }
        });
        // Let Electron close the actual native window in this supplementary
        // case. Retain only the final application exit so evidence can be saved.
        if (nativeQuitClosesWindow) app.once('will-quit', event => { event.preventDefault(); result.nativeWillQuitObserved = true; });
        app.quit(); assert.equal(result.nativeBeforeQuitObserved, true);
        if (nativeQuitClosesWindow) await until(() => result.nativeWillQuitObserved && win.isDestroyed(), 'native quit closes owner');
      }
      for (let attempt = 1; attempt <= 2; attempt++) {
        try { web?.dispose(); }
        catch (error) { result.errors.push({ attempt, name: error.name, message: error.message, stack: String(error.stack).split('\n').slice(0, 5) }); }
      }
      if (repeatAfterWindow) {
        win.destroy(); await until(() => win.isDestroyed(), 'post-dispose window destruction');
        try { web?.dispose(); } catch (error) { result.errors.push({ attempt: 3, name: error.name, message: error.message }); }
      }
      result.tabsRemainingInManager = web?.tabs.size ?? 0;
      if (disposeInClosedCallback) {
        assert.equal(result.ownerClosedCallback?.observed, true);
        assert.ok(result.ownerClosedCallback.liveTabsAtEntry > 0, 'The actual closed callback must receive a live child WebContents');
        assert.equal(result.ownerClosedCallback.disposeReturned, true);
      }
      if (!result.errors.length) {
        await until(() => tabs.every(contents => contents.isDestroyed()), 'tab disposal');
        assert.equal(web?.tabs.size ?? 0, 0);
        if (web) assert.equal(web.disposed, true);
        result.pass = true;
      }
    } catch (error) { result.errors.push({ phase: 'setup-or-assertion', name: error.name, message: error.message }); }
    finally {
      // Test-only cleanup also runs when the old implementation throws, so its
      // failure does not leave live pages or prevent subsequent independent cases.
      for (const contents of tabs) if (!contents.isDestroyed()) contents.close({ waitForBeforeUnload: false });
      if (!win.isDestroyed()) win.destroy();
      await until(() => tabs.every(contents => contents.isDestroyed()), 'case cleanup');
    }
  }
  if (ownerClosedOnly) {
    await scenario('owner-closed-synchronously-disposes-live-tabs', { count: 2, closeWindowFirst: true, disposeInClosedCallback: true });
    await scenario('native-app-quit-owner-closed-synchronously-disposes-live-tabs', { count: 2, destroyWindowFirst: false,
      nativeQuit: true, nativeQuitClosesWindow: true, disposeInClosedCallback: true });
    return;
  }
  await scenario('no-web-manager', { noManager: true });
  await scenario('empty-web-manager');
  await scenario('active-tab-window-destroyed-first', { count: 1 });
  await scenario('active-tab-window-close-event-first', { count: 1, closeWindowFirst: true });
  await scenario('hidden-tabs-window-destroyed-first', { count: 2, hidden: true });
  await scenario('mixed-destroyed-tabs-window-destroyed-first', { count: 3, destroyTab: true });
  await scenario('destroyed-tab-live-window', { count: 2, destroyTab: true, destroyWindowFirst: false });
  await scenario('live-window-normal-dispose', { count: 2, destroyWindowFirst: false });
  await scenario('native-app-before-quit-live-tabs', { count: 2, destroyWindowFirst: false, nativeQuit: true });
  await scenario('repeat-dispose-after-window-destroyed', { count: 1, destroyWindowFirst: false, repeatAfterWindow: true });
}).catch(error => { record.failures.push(String(error.stack)); }).finally(finish);
