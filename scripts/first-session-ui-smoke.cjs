/* Real production renderer/preload; every backend response below is a fixture.
 * No Gateway, provider, browser login or real user profile is opened. */
/* global __dirname */
const { app, BrowserWindow, WebContentsView, ipcMain, nativeTheme, session, clipboard, nativeImage, Menu } = require("electron");
const { createServer } = require('node:http');
const { writeFileSync, readFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const interactive = process.argv.includes('--interactive');
// This fixture also runs on Windows hosts without a usable GPU process.
app.disableHardwareAcceleration();
const browserIntegration = process.argv.includes('--browser-workbench') || interactive;
const output = path.join(root, process.argv.includes('--multitasking') ? 'artifacts/session-multitasking' : process.argv.includes('--data-agents') ? 'artifacts/installation-data-agents' : process.argv.includes('--trial-release') ? 'artifacts/trial-release' : 'artifacts/connection-browser-cache-settings', interactive ? 'interactive-renderer.json' : browserIntegration ? 'native-renderer-browser.json' : 'renderer-fixture.json');
let pendingApproval = null;
let updateFixture = { currentVersion: '0.0.5-beta.31', availableVersion: null, readyVersion: null, autoCheck: true, autoDownload: false, busy: false, message: '' };
let dataFixture = { settings: { enabled: true, everyDays: 1, retain: 3, includeWorkspace: false }, records: [], busy: false, message: '', startedAt: null, directory: 'Fixture backups' };
let nativeTabs, browserServer, browserUrl, pointerDiagnostic, motionDiagnostic;
let dragVisibility = null;
const modelPopupDiagnostics = [];
if (browserIntegration) { app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion'); app.commandLine.appendSwitch('host-resolver-rules', 'MAP aifb-fixture.test 127.0.0.1'); }
const checks = [], counts = {};
let window, trusted, networkAttempts = 0, connectedAccount = false, activeWizard = null;
let wizardIndex = 0, sessions = [], sendIndex = 0, latestSend = null;
let detectMode = 'normal', deferDetect = false, pendingDetect = null;
let subscriptionFailed = false, historyFailed = false;
let selectedAvailable = true, unknownSessionModel = false;
let deferCatalogue = false, failCatalogue = false, pendingCatalogue = null;
const preparedModels = () => [
  { id: 'model', name: 'Model mô phỏng', provider: 'fixture', contextWindow: 16000, available: connectedAccount && selectedAvailable },
  { id: 'other', name: 'Model khác', provider: 'fixture', contextWindow: 32000, available: connectedAccount }
];
const longModelName = 'Mô hình thử Beta với tên phiên bản đầy đủ rất dài để kiểm bố cục';
const completeModels = (advisor = false) => [
  ...preparedModels().map(model => ({ ...model, selectable: model.available })),
  { id: 'reasoning', name: 'Mô hình thử Alpha', provider: 'fixture-b', contextWindow: 64000, available: connectedAccount, selectable: connectedAccount },
  { id: 'writing', name: longModelName, provider: 'fixture-b', contextWindow: 48000, available: connectedAccount, selectable: connectedAccount },
  { id: 'not-offered', name: 'Mô hình dùng riêng cho Advisor', provider: 'fixture-b', contextWindow: 64000, available: connectedAccount, selectable: advisor && connectedAccount, ...(!advisor ? { selectionReason: 'not-offered' } : {}) },
  { id: 'unavailable', name: 'Mô hình chưa đăng nhập', provider: 'fixture-c', contextWindow: 24000, available: false, selectable: false, unavailableReason: 'auth-failed' }
];
let advisorMode = "complete", pendingAdvisor = null;
let pendingPatch = null, deferSend = false, pendingSend = null;
let deferPin = false, pendingPin = null, deferDelete = false, pendingDelete = null;
const deletionTickets = new Map(), deletableSessions = new Set(); let deletionSequence = 0;
let deferFile = false, pendingFile = null;
let deferProjectSave = false, pendingProjectSave = null;
const projects = [{ id: "fixture-project", displayName: "Dự án mô phỏng", source: "registered", agentId: "fixture-project-agent" }];
const localProjects = [], projectBindings = {}, fixtureAgents = [];
let supervisionState = null, holdSupervision = false, pendingSupervision = null; const sessionSkillChoices = new Map();
let pluginEnabled = true;
const publicRequests = [];
let skillDisabled = false, telegramConfigured = false, telegramRunning = false, managementWizard = false, managedJob = null;
let pendingChannelRestart = null, pendingChannelPoll = null, pairingAccepted = false;
let channelConfigForm = null, pendingChannelConfigCommit = null;
let pendingWhatsAppQr = null, whatsappQrSequence = 0, whatsappLinked = false;
const channelConfigRequests = [];
const initialChannelConfig = { models: { fixture: 'unchanged' }, channels: { googlechat: { enabled: false, dmPolicy: 'pairing', accounts: { other: { enabled: false, audience: 'preserve-other-account' } } }, whatsapp: { enabled: false, dmPolicy: 'pairing', accounts: { other: { enabled: false } } } } };
let channelConfig = structuredClone(initialChannelConfig), channelConfigHash = 'before-form', channelConfigRevision = 0;
async function startChannelConfigFixture(selected = 'googlechat') {
  const { createChannelConfigForm } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/channel-config-form.mjs')));
  const configPath = path.join(app.getPath('userData'), 'synthetic-config-never-written.json');
  channelConfigForm = await createChannelConfigForm(selected, { configPath, request: async (method, params) => {
    channelConfigRequests.push({ method, params: structuredClone(params) });
    if (method === 'config.schema.lookup') return { path: params.path, children: (params.path === `channels.${selected}` ? ['accounts'] : selected === 'whatsapp' ? ['enabled'] : ['enabled', 'serviceAccount', 'serviceAccountFile', 'audienceType', 'audience', 'appPrincipal', 'webhookUrl']).map(key => ({ key })) };
    if (method === 'config.get') {
      const projection = structuredClone(channelConfig);
      if (projection.channels.googlechat.accounts.default?.serviceAccount) projection.channels.googlechat.accounts.default.serviceAccount = '__OPENCLAW_REDACTED__';
      return { valid: true, path: configPath, hash: channelConfigHash, configRevisionHash: channelConfigHash, appliedConfigHash: channelConfigHash, config: projection };
    }
    if (method === 'config.patch') return new Promise(resolve => { pendingChannelConfigCommit = () => {
      pendingChannelConfigCommit = null;
      const patch = JSON.parse(params.raw).channels[selected];
      channelConfig.channels[selected] = { ...channelConfig.channels[selected], ...patch, accounts: { ...channelConfig.channels[selected].accounts, ...patch.accounts } };
      channelConfigHash = `after-form-${++channelConfigRevision}`; resolve({ ok: true, path: configPath, hash: channelConfigHash });
    }; });
    throw new Error('Unexpected config form fixture request');
  } });
  return { sessionId: 'channel-config-form-fixture', setupRoute: 'native-config', step: channelConfigForm.step };
}
const managementRequests = [];
const webState = { tabs: [], active: null }; let webSequence = 0;
let deferWebPoll = false, pendingWebPoll = null;
const advisorRequests = [];
const advisorResult = content => ({ decision: "revise", pass: false, summary: "Cần bổ sung người phụ trách.",
  confidence: 0.9, evidence: [{ source: "content", quote: content }],
  issues: [{ title: "Chưa phân công", detail: "Chưa nêu người chịu trách nhiệm.", severity: "medium",
    evidence: [{ source: "content", quote: content }], recommended_fix: "Ghi rõ người phụ trách và ngày hoàn thành." }] });
const histories = new Map(), activeRuns = new Map(), modelBySession = new Map();
const runtime = { supervisor: "safe-mode", connected: false, setupReady: false, detail: "startup-timeout",
  lastError: "Fixture: cần thử lại.", serverVersion: "2026.9.1", protocol: 4, nodeRuntime: null, stateDirectory: null,
  attachmentPolicy: null };
if (interactive) {
  connectedAccount = true; subscriptionFailed = true; historyFailed = true;
  Object.assign(runtime, { supervisor: 'ready', connected: true, setupReady: true, detail: null, lastError: null,
    attachmentPolicy: { maxBytes: 20 * 1024 * 1024, maxImageBytes: 6 * 1024 * 1024, maxPayload: 25 * 1024 * 1024 } });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const pushStatus = patch => { Object.assign(runtime, patch); window.webContents.send("aifb:gateway-status-changed", { ...runtime }); };
const count = method => { counts[method] = (counts[method] ?? 0) + 1; };
const handle = (channel, handler) => ipcMain.handle(channel, async (event, ...args) => {
  if (!trusted(event, window)) throw new Error("Unexpected sender in fixture");
  return handler(...args);
});
const text = () => window.webContents.executeJavaScript("document.body.innerText");
const evaluate = code => window.webContents.executeJavaScript(code).catch(error => {
  throw new Error(`Renderer fixture expression failed: ${code.slice(0, 500)}`, { cause: error });
});
async function until(predicate, label, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await wait(40); }
  throw new Error(`Timed out: ${label}`);
}
async function hasText(value) { await until(async () => (await text()).includes(value), value); }
async function click(label) {
  const matches = `b => { const copy = b.cloneNode(true); copy.querySelectorAll('[aria-hidden=true]').forEach(icon => icon.remove()); return (copy.textContent.trim() === ${JSON.stringify(label)} || copy.querySelector("strong")?.textContent === ${JSON.stringify(label)} || b.getAttribute('aria-label') === ${JSON.stringify(label)}) && !b.disabled; }`;
  await until(() => evaluate(`(() => { const button = Array.from((document.querySelector('dialog:modal') || document).querySelectorAll('button')).find(${matches}); if (!button) return false; button.click(); return true; })()`), `button ${label}`);
}
async function openThinkingDock() {
  if (await evaluate("Boolean(document.querySelector('.workspace--right-hidden'))")) await click('Mở bảng bên phải');
  await clickSelector('#thinking-tab');
  await until(() => evaluate("Boolean(document.querySelector('#thinking-panel .thinking-view'))"), 'Thinking in right dock');
  assert.equal(await evaluate("Boolean(document.querySelector('.workspace__main #composer-input')) && !document.querySelector('.workspace__rail [aria-label=Thinking]') && !document.querySelector('.workspace__main .thinking-view')"), true, 'chat remains beside activity');
}
async function clickSelector(selector) {
  await until(() => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled)`), `click ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
const selectSession = index => clickSelector(`.sidebar-session[data-session-key="${sessions[index].key}"] .session-item`);
async function openConversationMenu(key, kind = 'ellipsis') {
  const row = `.sidebar-session[data-session-key="${key}"]`;
  await until(() => evaluate(`Boolean(document.querySelector(${JSON.stringify(`${row} .session-item:not(:disabled)`)}))`), `conversation action ready ${kind}`);
  if (kind === 'ellipsis') await clickSelector(`${row} .sidebar-session__more`);
  else await evaluate(`(() => {
    const row = document.querySelector(${JSON.stringify(row)}), button = row.querySelector('.session-item');
    if (button.disabled) throw new Error('Conversation is busy');
    if (${JSON.stringify(kind)} === 'keyboard') {
      button.focus(); button.dispatchEvent(new KeyboardEvent('keydown', {key:'F10', shiftKey:true, bubbles:true, cancelable:true}));
    } else {
      const bounds = row.getBoundingClientRect();
      row.dispatchEvent(new MouseEvent('contextmenu', {button:2, clientX:bounds.right - 8, clientY:bounds.top + 12, bubbles:true, cancelable:true}));
    }
  })()`);
  await until(() => evaluate("Boolean(document.querySelector('#conversation-menu'))"), `conversation menu ${kind}`);
}
const menuKey = key => evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:${JSON.stringify(key)},bubbles:true,cancelable:true}))`);
async function clickFile(name) {
  await until(() => evaluate(`Array.from(document.querySelectorAll('.workspace__dock .file-entry')).some(button => button.querySelector('span:nth-child(2)')?.textContent === ${JSON.stringify(name)})`), `file ${name}`);
  await evaluate(`Array.from(document.querySelectorAll('.workspace__dock .file-entry')).find(button => button.querySelector('span:nth-child(2)')?.textContent === ${JSON.stringify(name)}).click()`);
}
async function fill(selector, value) {
  await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) throw new Error('Missing input');
    const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
}
async function select(selector, value) {
  await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
}
function emitChat(payload) {
  if (["final", "aborted", "error"].includes(payload.state) && (!payload.runId || payload.runId === latestSend.runId)) activeRuns.delete(latestSend.key);
  window.webContents.send("aifb:gateway-event", { event: "chat", payload: { sessionKey: latestSend.key, runId: latestSend.runId, ...payload }, seq: payload.seq });
}

function emitAgent(stream, seq, data, extra = {}) {
  window.webContents.send('aifb:gateway-event', { event: 'agent', payload: {
    sessionKey: latestSend.key, runId: latestSend.runId, stream, seq, ts: Date.now(), data, ...extra }, seq });
}
async function assertModelPopupFits() {
  const diagnostic = await evaluate(`(() => {
    const popup=document.querySelector('.model-picker__popover'), owner=popup.closest('.settings-body') || popup.closest('.composer') || popup.closest('.workspace__main'),
      bounds=popup.getBoundingClientRect(), region=owner.getBoundingClientRect(), options=popup.querySelector('.model-picker__options');
    const within=(a,b)=>a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;
    const controls=Array.from(popup.children).filter(el=>el.matches('input,select,button:not(:disabled)'));
    const controlFits=controls.every(el=>within(el.getBoundingClientRect(),bounds));
    const luminance=color=>color.match(/[\\d.]+/g).slice(0,3).map(n=>{const c=Number(n)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
    const contrast=controls.filter(el=>el.matches('button')).map(el=>{const s=getComputedStyle(el),a=luminance(s.color),b=luminance(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
    const rows=Array.from(options.querySelectorAll('button:not(:disabled)'));
    const reachable=rows.every(el=>{el.scrollIntoView({block:'nearest'});return within(el.getBoundingClientRect(),options.getBoundingClientRect());});
    options.scrollTop=0;
    return {viewport:innerWidth,left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom,ownerLeft:region.left,ownerRight:region.right,
      fits:bounds.left>=region.left&&bounds.right<=region.right&&bounds.top>=0&&bounds.bottom<=innerHeight
        && (!popup.closest('.settings-body') || bounds.top>=region.top&&bounds.bottom<=region.bottom),controlFits,contrast,reachable};
  })()`);
  modelPopupDiagnostics.push(diagnostic);
  assert.equal(diagnostic.fits, true, JSON.stringify(diagnostic));
  assert.equal(diagnostic.controlFits, true, 'search/filter/refresh stay entirely inside popup');
  assert.ok(diagnostic.contrast.every(value => value >= 4.5), 'enabled popup actions have readable theme contrast');
  assert.equal(diagnostic.reachable, true, 'each enabled model row can be scrolled fully into view');
}

async function composerKey(options) {
  await evaluate(`document.querySelector('#composer-input').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...${JSON.stringify(options)} }))`);
}

async function chooseFile(name, content, hold = false) {
  await evaluate(`(() => {
    const input = document.querySelector('#composer-files');
    if (input.disabled) throw new Error('File picker disabled');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(content)}], ${JSON.stringify(name)}, {type:'text/plain'}));
    input.files = transfer.files;
    if (${JSON.stringify(hold)}) {
      const file = input.files[0], original = file.arrayBuffer.bind(file);
      Object.defineProperty(file, 'arrayBuffer', {value: () => new Promise(resolve => {
        globalThis.__finishFixtureFile = async () => resolve(await original());
      })});
    }
    input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
}

async function capture(filename) {
  // Hidden Electron windows may expose the preceding compositor frame even
  // after React DOM assertions settle. Prime capture and wait for two paints.
  await window.webContents.capturePage();
  await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await wait(250);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(path.join(path.dirname(output), filename), (await window.webContents.capturePage()).toPNG());
}

app.enableSandbox();
app.whenReady().then(async () => {
  if (app.isPackaged) throw new Error("Fixture must never run as a packaged product");
  const policy = await import(pathToFileURL(path.join(root, "apps/desktop/electron/security-policy.mjs")));
  trusted = policy.isTrustedRendererEvent;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const network = /^(https?|wss?):/i.test(details.url);
    if (network) networkAttempts++;
    callback({ cancel: network });
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  handle("aifb:shell-status", () => JSON.parse(readFileSync(path.join(root, "apps/desktop/generated/shell-contract.json"), "utf8")));
  handle("aifb:gateway-status", () => ({ ...runtime }));
  handle("aifb:gateway-retry-startup", async () => {
    count("retry"); pushStatus({ supervisor: "starting", detail: "startup-preparing", lastError: null });
    await wait(60);
    pushStatus({ supervisor: "ready", connected: true, setupReady: false, detail: null });
    await wait(150);
    assert.equal(counts["openclaw.setup.detect"] ?? 0, 0, "setup must wait for its handshake");
    assert.equal(counts['projects.list'] ?? 0, 0, 'projects must wait for the management handshake');
    pushStatus({ setupReady: true, attachmentPolicy: { maxBytes: 20 * 1024 * 1024,
      maxImageBytes: 6 * 1024 * 1024, maxPayload: 25 * 1024 * 1024 } });
    return true;
  });
  handle("aifb:setup-open-page", sessionId => {
    assert.equal(sessionId, activeWizard); count("open-page"); return true;
  });
  handle("aifb:native-management", async packet => {
    if (packet.action === 'data-layout') return { layout: null };
    if (packet.action === 'data-status') return dataFixture;
    if (packet.action === 'data-settings') { dataFixture = { ...dataFixture, settings: packet.settings }; return dataFixture; }
    if (packet.action === 'screen-capture') return { screens: [{ name: 'Màn hình thử', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=' }] };
    if (packet.action === 'update-status') return updateFixture;
    if (packet.action === 'update-settings') { updateFixture = { ...updateFixture, autoCheck: packet.autoCheck, autoDownload: packet.autoDownload }; return updateFixture; }
    if (packet.action === 'update-check') { updateFixture.availableVersion = '0.0.5-beta.32'; updateFixture.message = 'Có bản thử mới mô phỏng'; return updateFixture; }
    if (packet.action === 'update-download') { updateFixture.readyVersion = '0.0.5-beta.32'; return updateFixture; }
    if (packet.action === 'approval-list') return { approvals: pendingApproval ? [pendingApproval] : [] };
    if (packet.action === 'approval-resolve') {
      assert.equal(packet.id, pendingApproval.id); assert.equal(packet.revision, pendingApproval.revision);
      assert.ok(['deny', 'allow-once'].includes(packet.decision)); pendingApproval = null;
      return { status: packet.decision === 'deny' ? 'denied' : 'allowed' };
    }
    count('management.' + packet.action);
    if (packet.action === 'artifact-save' && process.argv.includes('--multitasking')) {
      assert.ok(histories.get(packet.key)?.some(m => m.openclawDisplayContent?.some(p => p.attachment?.artifactId === packet.artifactId)));
      return { saved: true };
    }
    if (packet.action === 'model-settings') return { revision: 'fixture', cacheRetention: 'short', catalogRefresh: true };
    if (packet.action === 'model-settings-save') return { ...packet, revision: 'fixture-saved', applied: true };
    if (packet.action === 'ui-theme') return import('../apps/desktop/electron/ui-theme.mjs').then(({ applyUiTheme }) => applyUiTheme(packet, nativeTheme));
    if (packet.action?.startsWith('web-')) {
      if (browserIntegration) {
        const result = await nativeTabs.run(packet);
        if (dragVisibility && nativeTabs.active) dragVisibility.push(nativeTabs.tabs.get(nativeTabs.active).view.getVisible());
        return result;
      }
      if (packet.action === 'web-state' && deferWebPoll) {
        deferWebPoll = false; const snapshot = JSON.parse(JSON.stringify(webState));
        return new Promise(resolve => { pendingWebPoll = () => resolve(snapshot); });
      }
      if (packet.action === 'web-new') { webState.active = `web-${++webSequence}`; webState.tabs.push({ id: webState.active, title: 'Tab mới', url: '', loading: false }); }
      if (packet.action === 'web-open' && !webState.tabs.length) { webState.active = `web-${++webSequence}`; webState.tabs.push({ id: webState.active, title: 'Google', url: 'https://www.google.com/', loading: false }); }
      if (packet.action === 'web-select') webState.active = packet.id;
      if (packet.action === 'web-close') { webState.tabs = webState.tabs.filter(t => t.id !== packet.id); webState.active = webState.tabs.at(-1)?.id ?? null; }
      if (packet.action === 'web-navigate') Object.assign(webState.tabs.find(t => t.id === packet.id), { url: packet.url, title: 'Trang web mô phỏng' });
      if (packet.action === 'web-share') return { title: 'Trang web mô phỏng', url: 'https://example.com', text: 'Nội dung trang đã chọn để cùng đọc.' };
      return structuredClone(webState);
    }
    if (packet.action?.startsWith('chrome-')) {
      if (packet.action === 'chrome-pair') return { copied: true };
      if (packet.action === 'chrome-store') return { opened: true };
      if (packet.action === 'chrome-share') return { title: 'Chrome được chọn', url: 'https://example.com', text: 'Nội dung Chrome mô phỏng.' };
      return { tabs: [{ id: 'chrome-1', title: 'Chrome được chọn', url: 'https://example.com' }] };
    }
    managementRequests.push(structuredClone(packet));
    if (packet.action === 'model-catalogue') {
      assert.ok(Object.keys(packet).every(key => ['action', 'agentId', 'refresh'].includes(key)));
      if (packet.refresh !== undefined) assert.equal(packet.refresh, true);
      const response = { models: completeModels(!packet.agentId), source: 'openclaw', refreshed: packet.refresh === true,
        connectedProviders: connectedAccount ? ['fixture', 'fixture-b'] : [] };
      if (failCatalogue) throw new Error('Danh mục đầy đủ mô phỏng đang lỗi.');
      if (deferCatalogue) { deferCatalogue = false; return new Promise(resolve => { pendingCatalogue = () => { pendingCatalogue = null; resolve(response); }; }); }
      return response;
    }
    if (packet.action === 'channel-bundle-status') return { channels: ['telegram', 'zalo', 'whatsapp', 'discord', 'googlechat']
      .map(id => ({ id, available: true, version: 'fixture' })) };
    if (packet.action === 'conversation-inspect') {
      const row = sessions.find(session => session.key === packet.key);
      assert.ok(row && histories.has(row.key)); assert.equal(activeRuns.has(row.key), false);
      const ticket = `fixture-delete-${++deletionSequence}`; deletionTickets.set(ticket, row.key);
      return { key: row.key, title: row.label || row.displayName || 'Cuộc trò chuyện thử', ticket };
    }
    if (packet.action === 'conversation-delete') {
      assert.deepEqual(Object.keys(packet).sort(), ['action', 'ticket']);
      const key = deletionTickets.get(packet.ticket);
      assert.ok(key && deletableSessions.has(key), 'only explicitly created synthetic QA sessions may be deleted');
      deletionTickets.delete(packet.ticket);
      const remove = () => {
        sessions = sessions.filter(session => session.key !== key); histories.delete(key); modelBySession.delete(key); activeRuns.delete(key);
        delete projectBindings[key]; return { ok: true, key };
      };
      if (deferDelete) { deferDelete = false; return new Promise(resolve => { pendingDelete = () => { pendingDelete = null; resolve(remove()); }; }); }
      return remove();
    }
    if (packet.action === 'project-list') return { projects: localProjects, sessions: projectBindings, agents: {} };
    if (packet.action === 'project-create') { const project = { id: 'aifb:fixture-project', displayName: packet.name, source: 'aifb', directory: 'C:/Synthetic/Ke hoach' }; localProjects.push(project); return project; }
    if (packet.action === 'project-attachments' && deferProjectSave) {
      deferProjectSave = false;
      return new Promise(resolve => { pendingProjectSave = () => { pendingProjectSave = null; resolve({ saved: true }); }; });
    }
    if (packet.action === 'project-open' || packet.action === 'project-attachments' || packet.action === 'project-sync') return { saved: true };
    if (packet.action === 'document-read') {
      return import(pathToFileURL(path.join(root, 'apps/desktop/electron/docx-extract.mjs')))
        .then(({ extractDocxAttachment }) => extractDocxAttachment(packet.attachment));
    }
    if (packet.action === 'gateway-health') return { healthy: true };
    if (packet.action === 'gateway-stop') { pushStatus({ paused: true, supervisor: 'idle', connected: false, setupReady: false, detail: 'user-paused' }); return { stopped: true }; }
    if (packet.action === 'gateway-resume') { pushStatus({ paused: false, supervisor: 'ready', connected: true, setupReady: true, detail: null }); return { ready: true }; }
    if (packet.action === 'session-skills') { if (packet.skills) sessionSkillChoices.set(packet.sessionKey, packet.skills); return { skills: [{ name: 'Soạn nội dung thử', description: 'Giúp viết nội dung rõ ràng.' }], selected: sessionSkillChoices.get(packet.sessionKey) || [] }; }
    if (packet.action === 'agent-create') { assert.equal(Object.hasOwn(packet, 'skills'), false); const agent = { id: 'fixture-planner', name: packet.name, identity: { emoji: packet.emoji } }; fixtureAgents.push(agent); return agent; }
    if (packet.action === 'project-session' || packet.action === 'agent-session') {
      const key = `agent:${packet.agentId || 'main'}:aifb-${packet.requestId}`;
      if (packet.projectId) projectBindings[key] = packet.projectId;
      sessions.push({ key, displayName: 'Phiên dự án mới' }); histories.set(key, []); modelBySession.set(key, 'model'); return { key };
    }
    if (packet.action === 'plugin-inventory') return { mutationAllowed: true, plugins: [{ id: 'document-extract', label: 'Document Extract', description: 'Extract text from documents', state: pluginEnabled ? 'enabled' : 'disabled', installed: true, enabled: pluginEnabled }] };
    if (packet.action === 'plugin-toggle') { assert.equal(packet.pluginId, 'document-extract'); pluginEnabled = packet.enabled;
      return { plugin: { id: 'document-extract', label: 'Document Extract', description: 'Extract text from documents', state: pluginEnabled ? 'enabled' : 'disabled', installed: true, enabled: pluginEnabled }, restartRequired: true, warnings: [] }; }
    if (packet.action === 'tool-inventory') return { effective: Boolean(packet.sessionKey), profile: 'read-only', notices: [], tools: [
      { id: 'session_status', label: 'Kiểm tra trạng thái phiên', description: 'Read session state and model usage.', source: 'core', deniedBySession: false },
      { id: 'fixture-search', label: 'Tra cứu tài liệu thử', description: 'Search the fixture knowledge base.', source: 'mcp', mcpServer: 'Knowledge Fixture', deniedBySession: true }
    ] };
    if (packet.action === 'mcp-inventory') return { servers: [{ id: 'Knowledge Fixture', transport: 'http', enabled: false }] };
    if (packet.action === "catalog") return JSON.parse(readFileSync(path.join(root, "apps/desktop/electron/native-catalog.json"), "utf8"));
    if (packet.action === "skill-toggle") { assert.equal(packet.skillKey, "fixture-writing"); skillDisabled = !packet.enabled; return { ok: true }; }
    if (packet.action === "channel-setup") {
      assert.ok(['telegram', 'zalo', 'googlechat', 'whatsapp'].includes(packet.channel)); managementWizard = true;
      if (['googlechat', 'whatsapp'].includes(packet.channel)) return startChannelConfigFixture(packet.channel);
      if (packet.channel === 'zalo') {
        pushStatus({ connected: false, setupReady: false, supervisor: 'restarting', detail: 'startup-preparing' });
        return new Promise(resolve => { pendingChannelRestart = () => {
          pendingChannelRestart = null; pushStatus({ connected: true, setupReady: true, supervisor: 'ready', detail: null });
          resolve({ sessionId: 'channel-restart-fixture', step: { id: 'intro', type: 'note', message: 'Hướng dẫn Zalo sau khởi động lại mô phỏng' } });
        }; });
      }
      return { sessionId: "channel-fixture", step: { id: "intro", type: "note", message: "Hướng dẫn Telegram mô phỏng" } };
    }
    if (packet.action === "channel-next") {
      assert.ok(managementWizard);
      if (packet.sessionId === 'channel-config-form-fixture') return channelConfigForm.next(packet.answer, () => {}).then(result => {
        if (result.done) managementWizard = false;
        return { sessionId: packet.sessionId, setupRoute: 'native-config', ...result };
      });
      if (packet.sessionId === 'channel-restart-fixture') {
        if (packet.answer?.stepId === 'intro') return { sessionId: packet.sessionId, step: { id: 'preparing', type: 'progress', message: 'Đang chuẩn bị kênh mô phỏng' }, done: false };
        return new Promise(resolve => { pendingChannelPoll = () => { pendingChannelPoll = null;
          resolve({ sessionId: packet.sessionId, step: { id: 'late', type: 'note', message: 'Phản hồi cũ phải được bỏ qua' }, done: false }); }; });
      }
      assert.equal(packet.sessionId, "channel-fixture");
      if (packet.answer?.stepId === "intro") return { sessionId: "channel-fixture", step: { id: "token", type: "text", sensitive: true, message: "Nhập token bot mô phỏng" } };
      assert.equal(packet.answer?.value, "fixture-not-a-token"); telegramConfigured = true; managementWizard = false;
      return { sessionId: "channel-fixture", done: true };
    }
    if (packet.action === "channel-cancel") {
      if (packet.sessionId === 'channel-config-form-fixture') { const result = channelConfigForm.cancel(); managementWizard = false; return result; }
      managementWizard = false; return { status: "cancelled" };
    }
    if (packet.action === 'channel-qr-start') {
      assert.equal(packet.channel, 'whatsapp'); assert.equal(packet.accountId, 'whatsapp-fixture');
      assert.equal(channelConfig.channels.whatsapp.accounts[packet.accountId]?.enabled, true);
      return { ticket: `whatsapp-qr-${++whatsappQrSequence}`, connected: false,
        qrDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', message: 'Mã mô phỏng, không dùng để liên kết.' };
    }
    if (packet.action === 'channel-qr-wait') return new Promise(resolve => {
      const complete = () => {
        if (pendingWhatsAppQr === complete) pendingWhatsAppQr = null;
        whatsappLinked = true; resolve({ ticket: packet.ticket, connected: true, qrDataUrl: null, message: 'Đã liên kết mô phỏng.' });
      };
      pendingWhatsAppQr = complete;
    });
    if (packet.action === 'channel-qr-clear') return { cleared: true };
    if (["channel-start", "channel-stop"].includes(packet.action)) { assert.equal(packet.accountId, "fixture"); telegramRunning = packet.action === "channel-start"; return { ok: true }; }
    if (packet.action === 'channel-pairing-list') { assert.equal(packet.channel, 'telegram'); assert.equal(packet.accountId, 'fixture');
      return { requests: [{ requestId: 'pairing-fixture', senderId: 'synthetic-123', senderLabel: 'Người thử ghép đôi', expiresAt: '2026-09-09T00:00:00Z' }] }; }
    if (['channel-pairing-approve', 'channel-pairing-dismiss'].includes(packet.action)) {
      assert.equal(packet.channel, 'telegram'); assert.equal(packet.accountId, 'fixture'); assert.equal(packet.requestId, 'pairing-fixture');
      return { ok: pairingAccepted };
    }
    if (packet.action === "cron-create") {
      assert.equal(packet.draft.enabled, false); assert.deepEqual(Object.keys(packet.draft).sort(), ['enabled','frequency','message','name','time','timeZone'].sort());
      managedJob = { id: "managed-fixture", name: packet.draft.name, enabled: packet.draft.enabled, declarationKey: "aifb-schedule:" + packet.requestId,
        payload: { message: packet.draft.message }, schedule: { expr: "0 8 * * 1-5", tz: packet.draft.timeZone } };
      return managedJob;
    }
    if (packet.action === "cron-get") return managedJob;
    if (packet.action === "cron-save") { managedJob.name = packet.draft.name; managedJob.payload.message = packet.draft.message; return managedJob; }
    if (packet.action === "cron-toggle") { managedJob.enabled = packet.enabled; return managedJob; }
    if (packet.action === "cron-remove") { managedJob = null; return { ok: true }; }
    throw new Error("Unexpected management fixture operation");
  });
  handle("aifb:advisor-request", packet => {
    count("advisor." + packet.action);
    if (packet.action === 'supervision-status') return supervisionState;
    if (packet.action === 'supervision-cancel') return { stopped: true };
    if (packet.action === 'supervise') {
      const result = { ...advisorResult(packet.message), decision: 'approve', pass: true, issues: [], summary: 'Đạt tiêu chí kiểm tra mô phỏng.' };
      supervisionState = { id: packet.id, key: packet.key, phase: 'planning', busy: true, modelActive: true, accepted: false, plan: 'Kế hoạch mô phỏng: đọc yêu cầu và lập ba ưu tiên.', planReview: null, finalReview: null, error: null };
      return new Promise(resolve => { const complete = () => {
        histories.get(packet.key).push({ role: 'user', content: packet.message }, { role: 'assistant', content: 'Ba ưu tiên đã được tổng hợp.' });
        supervisionState = { ...supervisionState, phase: 'completed', busy: false, modelActive: false, accepted: true, planReview: result, finalReview: result };
        resolve(supervisionState);
      }; if (holdSupervision) { holdSupervision = false; pendingSupervision = complete; } else setTimeout(complete, 1500); });
    }
    if (packet.action === "cancel") {
      assert.equal(packet.id, pendingAdvisor.packet.id);
      return { id: packet.id, status: "cancelled", message: "Đã dừng lượt kiểm tra." };
    }
    advisorRequests.push(packet);
    const response = { id: packet.id, status: "completed", result: advisorResult(packet.content) };
    if (advisorMode === "error") return { id: packet.id, status: "error", message: "Fixture: kết quả thiếu cấu trúc hoặc căn cứ hợp lệ." };
    if (advisorMode === "defer") return new Promise(resolve => { pendingAdvisor = { packet, resolve, response }; });
    return response;
  });
  handle("aifb:setup-request", async ({ method, params }) => {
    count(method);
    assert.equal(runtime.setupReady, true);
    if (method === "openclaw.setup.detect") {
      if (detectMode === 'error') throw new Error('Không đọc được danh sách mô phỏng.');
      const response = { setupComplete: connectedAccount, candidates: [], manualProviders: [],
        authOptions: detectMode === 'empty' ? [] : [{ id: "fixture-oauth", label: "Tài khoản thử OAuth", kind: "device-code", featured: true, groupLabel: "Mô phỏng" }] };
      if (deferDetect) { deferDetect = false; return new Promise(resolve => { pendingDetect = () => { pendingDetect = null; resolve(response); }; }); }
      return response;
    }
    if (method === "openclaw.setup.auth.start") {
      assert.equal(params.authChoice, "fixture-oauth"); activeWizard = params.sessionId; wizardIndex = 0;
      return { sessionId: activeWizard, status: "running", step: { id: "sign-in", type: "action", title: "Đăng nhập thử",
        message: "Fixture, không đăng nhập tài khoản thật.", externalUrl: "https://example.invalid/authorize", deviceCode: { code: "ABCD-1234" } } };
    }
    if (method === "wizard.next") {
      assert.equal(params.sessionId, activeWizard);
      wizardIndex++;
      if (wizardIndex === 1) return { sessionId: activeWizard, step: { id: "pin", type: "text", title: "Mã thử", sensitive: true, initialValue: "" } };
      if (wizardIndex === 2) {
        assert.equal(params.answer.value, "fixture-value");
        return { sessionId: activeWizard, step: { id: "choices", type: "multiselect", title: "Chọn mục thử", initialValue: ["a"],
          options: [{ value: "a", label: "Mục A" }, { value: "b", label: "Mục B" }] } };
      }
      if (wizardIndex === 3) {
        assert.deepEqual([...params.answer.value].sort(), ["a", "b"]);
        return { sessionId: activeWizard, done: false, status: 'running', step: { id: 'finishing', type: 'progress',
          title: 'Hoàn tất kết nối', message: 'Đang hoàn tất kết nối mô phỏng.' } };
      }
      assert.equal(wizardIndex, 4); assert.equal(params.answer, undefined, 'finishing progress must be polled without a user answer');
      connectedAccount = true; activeWizard = null;
      return { done: true, status: 'done', modelActivation: { modelRef: 'fixture/model' } };
    }
    if (method === "wizard.cancel") { activeWizard = null; return { status: "cancelled" }; }
    if (method === 'models.authStatus') {
      assert.ok(connectedAccount); assert.deepEqual(params, { refresh: false });
      return { providers: [{ provider: 'fixture', status: 'static' }] };
    }
    if (method === "openclaw.setup.verify") { assert.ok(connectedAccount); return { ok: true, latencyMs: 1 }; }
    throw new Error(`Unexpected fixture setup method ${method}`);
  });
  handle("aifb:gateway-request", ({ method, params }) => {
    count(method);
    publicRequests.push({ method, params });
    if (method === "sessions.list") return { sessions };
    if (method === 'sessions.describe') return { session: sessions.find(row => row.key === params.key) ?? null };
    if (method === 'agents.list') return { agents: fixtureAgents, defaultId: '' };
    if (method === "projects.list") return { projects };
    if (method === "sessions.usage") {
      assert.equal(params.range, "7d"); assert.equal(params.includeContextWeight, false);
      return { startDate: "2026-09-01", endDate: "2026-09-07", sessions: sessions.map(({ key }) => ({ key })),
        totals: { totalTokens: 9876, input: 8765, output: 1111, totalCost: 0.0123, missingCostEntries: 0 }, cacheStatus: { status: "fresh" } };
    }
    if (method === "skills.status") return { skills: [
      { skillKey: "fixture-writing", name: "Soạn nội dung thử", description: "Kỹ năng mô phỏng đủ điều kiện.", eligible: !skillDisabled, disabled: skillDisabled, missing: {} },
      { skillKey: "fixture-off", name: "Kỹ năng chưa bật", description: "Mô phỏng chưa được bật.", eligible: false, disabled: true, missing: { bins: ["fixture-only"] } }
    ] };
    if (method === "channels.status") {
      assert.equal(params.probe, false);
      return { channelOrder: ["fixture-channel"], channelLabels: { "fixture-channel": "Kênh mô phỏng" },
        channels: { "fixture-channel": { configured: false } }, channelAccounts: { ...(telegramConfigured ? { telegram: [{ accountId: "fixture", configured: true, running: telegramRunning }] } : {}),
          ...(channelConfig.channels.whatsapp.accounts['whatsapp-fixture'] ? { whatsapp: [{ accountId: 'whatsapp-fixture', configured: whatsappLinked, connected: whatsappLinked, running: false }] } : {}) }, partial: false };
    }
    if (method === "cron.status") return { enabled: true, jobs: 2 };
    if (method === "cron.list") {
      assert.equal(params.compact, true); assert.equal(params.includeDeliveryPreviews, false);
      const first = params.offset === 0;
      return { jobs: [{ id: first ? "fixture-job-1" : "fixture-job-2", displayName: first ? "Lịch mô phỏng trang một" : "Lịch mô phỏng trang hai",
        enabled: true, scheduleKind: "every", nextRunAtMs: 1788742800000, lastRunAtMs: 1788656400000, lastRunStatus: "ok" }, ...(first && managedJob ? [managedJob] : [])],
        total: 2, hasMore: first, nextOffset: first ? 50 : null };
    }
    if (method === "cron.runs") {
      assert.equal(params.scope, "job"); assert.equal(params.id, "fixture-job-1");
      return { entries: [{ runId: "fixture-record-1", status: "ok", ts: 1788656400000, durationMs: 50, summary: "Lượt chạy được ghi nhận mô phỏng." }], hasMore: false };
    }
    if (method === "sessions.files.list") {
      assert.ok(histories.has(params.sessionKey)); assert.ok(["", "thu-muc"].includes(params.path));
      const report = { path: "bao-cao.txt", name: "Báo cáo thử.txt", kind: "file", sessionKind: "modified", size: 80 };
      const nested = { path: "thu-muc/ghi-chu.txt", name: "Ghi chú con.txt", kind: "file", size: 20 };
      let entries = params.path ? [nested] : [
        { path: "thu-muc", name: "Thư mục thử", kind: "directory" }, report,
        { path: "link", name: "Liên kết không mở", kind: "symlink" }, { path: "missing", name: "Tệp đã xóa", kind: "file", missing: true }
      ];
      if (params.search) entries = entries.filter(file => file.name.toLowerCase().includes(params.search.toLowerCase()));
      return { sessionKey: params.sessionKey, files: [{ ...report, kind: "modified" }],
        browser: { path: params.path, parentPath: params.path ? "" : null, entries, truncated: false } };
    }
    if (method === "sessions.files.get") {
      assert.ok(histories.has(params.sessionKey)); assert.ok(["bao-cao.txt", "thu-muc/ghi-chu.txt"].includes(params.path));
      const response = { sessionKey: params.sessionKey, file: { path: params.path, name: params.path === "bao-cao.txt" ? "Báo cáo thử.txt" : "Ghi chú con.txt",
        previewKind: "text", contentEncoding: "utf8", content: `<script>globalThis.fixtureInjected=true</script>\nTệp mô phỏng riêng của ${params.sessionKey}.` } };
      if (deferFile) return new Promise(resolve => { pendingFile = { response, resolve }; });
      return response;
    }
    if (method === "models.list") return { models: preparedModels() };
    if (method === "sessions.messages.subscribe" && params.key === sessions[1]?.key && !subscriptionFailed) {
      subscriptionFailed = true; throw new Error("Fixture: tải cuộc trò chuyện chưa thành công.");
    }
    if (["sessions.subscribe", "sessions.messages.subscribe", "sessions.messages.unsubscribe"].includes(method)) return { ok: true };
    if (method === "chat.history" && params.sessionKey === sessions[1]?.key && !historyFailed) {
      historyFailed = true; throw new Error("Fixture: tải lịch sử chưa thành công.");
    }
    if (method === "chat.history") return { messages: histories.get(params.sessionKey) ?? [],
      sessionInfo: { model: unknownSessionModel ? null : modelBySession.get(params.sessionKey) ?? "model",
        modelProvider: modelBySession.get(params.sessionKey)?.includes('/') ? modelBySession.get(params.sessionKey).split('/')[0] : 'fixture',
        contextTokens: modelBySession.get(params.sessionKey)?.endsWith('other') ? 24000 : 10000,
        totalTokens: 1234, totalTokensFresh: true,
        thinkingLevel: "low", thinkingLevels: [{ id: "low", label: "Thấp" }, { id: "high", label: "Cao" }],
        hasActiveRun: activeRuns.has(params.sessionKey), activeRunIds: activeRuns.has(params.sessionKey) ? [activeRuns.get(params.sessionKey)] : [] },
      defaults: { model: "fixture/model", contextTokens: 10000 } };
    if (method === "sessions.create") {
      assert.ok(connectedAccount); const key = `agent:${params.agentId ?? "main"}:${params.key}`;
      if (params.projectId) { assert.equal(params.projectId, projects[0].id); assert.equal(params.agentId, projects[0].agentId); }
      sessions.push({ key, displayName: `Cuộc trò chuyện thử ${sessions.length + 1}`, pinned: false, ...(params.projectId ? { projectId: params.projectId } : {}) });
      histories.set(key, []); modelBySession.set(key, "model"); return { ok: true, key };
    }
    if (method === "sessions.patch") {
      if (typeof params.label === "string") {
        assert.deepEqual(Object.keys(params).sort(), ["key", "label"]);
        const row = sessions.find(row => row.key === params.key); assert.ok(row); row.label = params.label;
        return { ok: true };
      }
      if (typeof params.pinned === "boolean") {
        assert.deepEqual(Object.keys(params).sort(), ["key", "pinned"]);
        const row = sessions.find(row => row.key === params.key); assert.ok(row);
        const update = () => { row.pinned = params.pinned; return { ok: true, key: row.key }; };
        if (deferPin) { deferPin = false; return new Promise(resolve => { pendingPin = () => { pendingPin = null; resolve(update()); }; }); }
        return update();
      }
      if (Object.hasOwn(params, "thinkingLevel")) {
        throw new Error("Renderer must not patch admin-only thinkingLevel; use per-turn sessions.send thinking");
      }
      assert.ok(histories.has(params.key)); assert.ok(completeModels().some(model => `${model.provider}/${model.id}` === params.model && model.available && model.selectable));
      if (interactive) { modelBySession.set(params.key, params.model); return { ok: true }; }
      assert.equal(pendingPatch, null, "model changes cannot run concurrently");
      return new Promise(resolve => { pendingPatch = { params, resolve }; });
    }
    if (method === "sessions.send") {
      assert.ok(connectedAccount); assert.ok(params.idempotencyKey); assert.ok(histories.has(params.key));
      latestSend = { runId: `fixture-run-${++sendIndex}`, message: params.message, key: params.key, attachments: params.attachments ?? [], thinking: params.thinking };
      activeRuns.set(params.key, latestSend.runId);
      histories.get(params.key).push({ role: "user", content: params.message || "Tệp đính kèm mô phỏng.", __openclaw: { id: `user-${sendIndex}` } });
      if (interactive) {
        const sent = { ...latestSend };
        const stillCurrent = () => !window.isDestroyed() && activeRuns.get(sent.key) === sent.runId;
        setTimeout(() => { if (stillCurrent()) emitAgent('thinking', 1, { text: 'Đây là suy nghĩ mô phỏng để kiểm giao diện. Tôi sẽ đọc yêu cầu và kiểm trạng thái phiên.' }, { sessionKey: sent.key, runId: sent.runId }); }, 400);
        setTimeout(() => { if (stillCurrent()) emitAgent('tool', 2, { toolCallId: 'interactive-status', name: 'session_status', phase: 'start' }, { sessionKey: sent.key, runId: sent.runId }); }, 1500);
        setTimeout(() => { if (stillCurrent()) emitAgent('tool', 3, { toolCallId: 'interactive-status', name: 'session_status', phase: 'result', isError: false }, { sessionKey: sent.key, runId: sent.runId }); }, 2600);
        setTimeout(() => { if (stillCurrent()) { const message = { role: 'assistant', content: '**Kết quả kiểm giao diện**\n\nĐây là phản hồi mô phỏng, không gọi AI hoặc tài khoản thật.\n\n- Ô chat nhận yêu cầu.\n- Tiến trình suy nghĩ và công cụ được hiển thị.\n- Anh có thể thử Dừng ở lượt tiếp theo.', __openclaw: { id: `interactive-${sent.runId}` } };
          histories.get(sent.key).push(message); emitChat({ state: 'final', seq: 4, message, sessionKey: sent.key, runId: sent.runId }); } }, 4200);
      }
      if (deferSend) return new Promise(resolve => { pendingSend = { resolve, runId: latestSend.runId }; });
      return { ok: true, runId: latestSend.runId };
    }
    if (method === "chat.abort") {
      assert.equal(params.sessionKey, latestSend.key); assert.equal(params.runId, latestSend.runId);
      activeRuns.delete(params.sessionKey); return { ok: true, aborted: true };
    }
    throw new Error(`Unexpected fixture Gateway method ${method}`);
  });

  window = new BrowserWindow(policy.createWindowOptions({ preloadPath: path.join(root, "apps/desktop/electron/preload.cjs"), isPackaged: true }));
  if (browserIntegration) {
    const { WebTabs } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/web-tabs.mjs')));
    browserServer = createServer((req, res) => { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end('<title>Trang kiểm trình duyệt</title><style>body{font:18px system-ui;padding:36px;color:#3c3c3c}button,input{padding:12px;margin:6px}</style><h1>Website đang chạy thật</h1><p>Trang tổng hợp riêng để kiểm AI for Boss.</p><input placeholder="Gõ trên website"><button onclick="document.querySelector(\'p\').textContent=\'Người dùng đã cập nhật website\'">Cập nhật trang</button><a href="/second">Trang tiếp</a>'); });
    await new Promise(resolve => browserServer.listen(0, '127.0.0.1', resolve)); browserUrl = `http://aifb-fixture.test:${browserServer.address().port}`;
    nativeTabs = new WebTabs({ window, createView: options => new WebContentsView(options), browserSession: session.fromPartition('browser-workbench-fixture'), validateUrl: async url => {
      if (url === 'https://www.google.com/') return browserUrl + '/';
      if (url.startsWith(browserUrl + '/')) return url;
      throw new Error('Fixture denies external network');
    } });
    window.setContentSize(1600, 950); window.show();
  }
  window.webContents.setBackgroundThrottling(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  await window.loadFile(path.join(root, "apps/desktop/dist/index.html"));
  if (interactive) {
    window.setTitle('AI for Boss — KIỂM THỬ NỘI BỘ · DỮ LIỆU GIẢ'); window.show();
    checks.push('Interactive fixture opened with production renderer/preload and isolated synthetic IPC; no real accounts');
    console.log('[interactive fixture] Ready. All data and AI responses are simulated; close this window to finish.');
    window.on('closed', () => finish(0)); return;
  }
  await until(() => evaluate("Boolean(document.querySelector('[data-workspace-stage]'))"), "honest startup stage");
  assert.notEqual(await evaluate("document.querySelector('[data-workspace-stage]').dataset.workspaceStage"), "ready");
  deferDetect = !browserIntegration;
  await click("Thử khởi động lại");
  if (!browserIntegration) {
    await until(() => Promise.resolve(Boolean(pendingDetect)), 'native detection intentionally delayed');
    await until(() => evaluate("Boolean(document.querySelector('.connect__preview[aria-label=\"Nhà cung cấp trong bộ chạy\"]'))"), 'provider preview is present');
    await until(() => evaluate("document.querySelectorAll('.connect__provider-index button').length > 20"), 'packaged catalogue visible before native detection');
    assert.equal(await evaluate("document.querySelector('.connect__search').getBoundingClientRect().height < 60"), true);
    assert.equal(await evaluate("document.querySelector('.connect__provider-index button').getBoundingClientRect().top < innerHeight"), true, 'catalogue appears in initial viewport');
    const authBefore = counts['openclaw.setup.auth.start'] ?? 0;
    await clickSelector('.connect__preview .connect__provider-index button');
    assert.equal(counts['openclaw.setup.auth.start'] ?? 0, authBefore, 'preview filters without starting authentication');
    await click('Xóa tìm kiếm'); await capture('connect-loading-catalogue.png'); pendingDetect();
  }
  await hasText("Tài khoản thử OAuth");
  assert.equal(counts.retry, 1); checks.push("retry and wait for both channels; unavailable catalogue routes to setup");
  if (!browserIntegration) {
    for (const width of [980, 1440]) {
      window.setContentSize(width, 850); await wait(80);
      const bounds = await evaluate("(() => {const input=document.querySelector('.connect__search').getBoundingClientRect(), option=document.querySelector('.connect__options button').getBoundingClientRect();return {inputHeight:input.height,optionTop:option.top,optionRight:option.right,width:innerWidth,height:innerHeight};})()");
      assert.ok(bounds.inputHeight < 60 && bounds.optionTop < bounds.height && bounds.optionRight <= bounds.width, JSON.stringify(bounds));
      await capture(`connect-ready-${width}px.png`);
    }
    await fill('[aria-label="Tìm nhà cung cấp hoặc mô hình"]', 'missing-fixture'); await hasText('Không tìm thấy');
    assert.equal(await evaluate("document.querySelectorAll('.connect__options button').length"), 0);
    await click('Xóa tìm kiếm'); await hasText('Tài khoản thử OAuth');
    detectMode = 'error'; await click('Tải lại danh sách'); await hasText('Không đọc được danh sách mô phỏng.');
    assert.equal(await evaluate("Boolean(document.querySelector('.connect [role=alert]'))"), true);
    detectMode = 'empty'; await click('Tải lại danh sách'); await hasText('Bộ chạy chưa trả về cách kết nối AI nào');
    assert.equal(await evaluate("document.querySelector('.connect__method-catalogue')?.open"), true, 'empty native methods expand official prerequisites instead of a blank screen');
    assert.ok(await evaluate("(() => { const s=getComputedStyle(document.querySelector('.connect__origin button')); const luminance=color=>color.match(/[\\d.]+/g).slice(0,3).map(n=>{const c=Number(n)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0); const a=luminance(s.color),b=luminance(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); })()") >= 4.5, 'connection documentation action has readable text contrast');
    await capture('connect-empty-expanded-methods-1440px.png');
    detectMode = 'normal'; await click('Tải lại danh sách'); await hasText('Tài khoản thử OAuth');
    checks.push('connect quick packaged catalogue visible while native detection waits; compact search and initial visible options at 980/1440; preview filtering makes no auth call; search/empty/error/retry and real authentication-method labels');
  }
  await click("Tài khoản thử OAuth");
  await hasText("ABCD-1234"); await hasText("https://example.invalid/authorize");
  await click("Mở trang đăng nhập"); assert.equal(counts["open-page"], 1);
  await click("Tiếp tục");
  await until(() => evaluate("Boolean(document.querySelector('input[type=password]'))"), "sensitive input masked");
  await fill("input[type=password]", "fixture-value"); await click("Tiếp tục");
  await hasText("Mục B");
  await evaluate("Array.from(document.querySelectorAll('label')).find(label => label.textContent.includes('Mục B')).click()");
  await click("Tiếp tục");
  await hasText('Đang hoàn tất kết nối mô phỏng.');
  assert.equal(await evaluate("Boolean(document.querySelector('.connect [role=status]'))"), true, 'finishing step shows actual progress status');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.connect button')).some(button => button.textContent.trim() === 'Tiếp tục')"), false, 'finishing progress requires no extra Continue click');
  await hasText('Đã lưu thiết lập fixture/model');
  assert.equal(counts['models.authStatus'], 1); assert.equal(wizardIndex, 4);
  await click("Kiểm tra kết nối");
  await hasText("Phiên mới");
  await until(() => evaluate("document.querySelector('[data-workspace-stage]')?.dataset.workspaceStage === 'ready'"), "connect complete automatically opens usable chat in same window");
  checks.push("native OAuth option, device URL/code, user-click browser bridge, masked sensitive step/multiselect, automatic finishing poll with no answer, done modelActivation and account status readback");

  if (process.argv.includes('--multitasking')) {
    subscriptionFailed = true; historyFailed = true;
    await fill('#composer-input', 'Task A'); await click('Gửi');
    await until(() => Promise.resolve(activeRuns.size === 1), 'A running');
    const a = { ...latestSend };
    await click('Phiên mới');
    await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), 'B ready');
    await fill('#composer-input', 'Task B'); await click('Gửi');
    await until(() => Promise.resolve(activeRuns.size === 2), 'two concurrent tasks');
    const b = { ...latestSend }; assert.notEqual(a.key, b.key);
    pendingApproval = { id:'parallel-approval', revision:'fixture', command:'node fixture.cjs', sessionKey:a.key,
      agentId:'main', host:'gateway', expiresAtMs:Date.now()+60000, canAllow:true };
    window.webContents.send('aifb:gateway-event', {event:'exec.approval.requested',payload:{}});
    await until(() => evaluate("Boolean(document.querySelector('.approval-pending'))"), 'nonblocking approval badge');
    assert.equal(await evaluate("document.querySelectorAll(':modal').length"), 0);
    await clickSelector('.approval-pending'); await click('Thu gọn · tiếp tục công việc khác');
    await fill('#composer-input', 'Next B');
    assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Next B');
    await click('Dừng'); await until(() => Promise.resolve(!activeRuns.has(b.key)), 'only B stopped');
    assert.equal(activeRuns.get(a.key), a.runId);
    await clickSelector('.approval-pending'); await click('Từ chối');
    await until(() => Promise.resolve(pendingApproval === null), 'exact approval resolved');
    await clickSelector('.sidebar-session[data-session-key="' + a.key + '"] button');
    await until(() => evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Dừng')"), 'A remains running');
    histories.get(a.key).push({ role:'assistant', content:'File ready', openclawDisplayContent:[{type:'attachment',attachment:{
      artifactId:'artifact_managed_media_11111111-1111-4111-8111-111111111111',label:'fixture.docx',sizeBytes:3614
    }}] });
    activeRuns.delete(a.key);
    await until(() => evaluate("!Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Dừng')"), 'idle poll reconciles missed final');
    await until(() => evaluate("Boolean(document.querySelector('.delivered-files button'))"), 'native attachment card');
    await clickSelector('.delivered-files button'); await hasText('Đã lưu tệp vào vị trí anh chọn.');
    assert.equal(counts['management.artifact-save'],1);
    checks.push('Native attachment metadata retained; Save sends exact session/artifact identity and renders acknowledged result');
    checks.push('Two concurrent tasks; new session enabled; approval nonmodal; Stop B preserves A; native idle clears missed final event');
    if(process.argv.includes('--clipboard-event-only')) {
      const png=readFileSync(path.join(root,'apps/desktop/electron/assets/icon-256.png')).toString('base64');
      await evaluate(`(() => { const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0))],'pasted.png',{type:'image/png'}));document.querySelector('#composer-input').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:d})); })()`);
      await until(()=>evaluate("document.querySelectorAll('.composer__attachment').length>0"),'clipboard image event draft');
      checks.push('Synthetic clipboard event creates attachment draft; native OS clipboard NOT verified (host access denied)');
      await capture('multitasking.png');finish(0);return;
    }
    const oldClipboard = { text:clipboard.readText(), html:clipboard.readHTML(), rtf:clipboard.readRTF(), image:clipboard.readImage() };
    const oldBookmark = clipboard.readBookmark(); if (oldBookmark.url) oldClipboard.bookmark = oldBookmark.title;
    try {
      const { installEditMenu } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/edit-menu.mjs')));
      let pasteMenu;
      installEditMenu(window, { buildFromTemplate(template) { const menu = Menu.buildFromTemplate(template); pasteMenu = menu; return { popup() {} }; } });
      const sample=nativeImage.createFromBitmap(Buffer.alloc(32*32*4,255),{width:32,height:32});
      assert.equal(sample.isEmpty(),false);
      clipboard.writeImage(sample);
      await until(()=>Promise.resolve(!clipboard.readImage().isEmpty()),'OS clipboard image available');
      window.show(); window.focus(); window.webContents.focus();
      await until(()=>Promise.resolve(window.webContents.isFocused()),'clipboard fixture window focus');
      await wait(150);
      await evaluate("document.querySelector('#composer-input').focus()");
      const sendsBefore = counts['chat.send'] ?? 0;
      window.webContents.sendInputEvent({type:'keyDown',keyCode:'V',modifiers:['control']});
      window.webContents.sendInputEvent({type:'keyUp',keyCode:'V',modifiers:['control']});
      await until(() => evaluate("document.querySelectorAll('.composer__attachment').length > 0"), 'OS clipboard keyboard image draft');
      const beforeMouse = await evaluate("document.querySelectorAll('.composer__attachment').length");
      window.webContents.emit('context-menu', {}, { isEditable:true,frame:window.webContents.mainFrame });
      assert.ok(pasteMenu.items.some(item => item.role === 'paste'));
      pasteMenu.items.find(item => item.role === 'paste').click(undefined, window, window.webContents);
      await until(() => evaluate("document.querySelectorAll('.composer__attachment').length") .then(n => n > beforeMouse), 'native mouse Paste image draft');
      assert.equal(counts['chat.send'] ?? 0, sendsBefore);
      checks.push('Actual OS clipboard image pasted by Ctrl+V and native Paste role, draft only');
    } finally { clipboard.write(oldClipboard); }
    await capture('multitasking.png'); finish(0); return;
  }
  assert.equal(await evaluate("Boolean(document.querySelector('#files-panel'))"), true, 'files are visible at initial startup');
  for (const width of [1440, 980]) {
    window.setContentSize(width, 900); await wait(80);
    const welcome = await evaluate("(() => { const g=document.querySelector('.workspace-guide'), t=document.querySelector('.transcript'), gr=g.getBoundingClientRect(), tr=t.getBoundingClientRect(); return { delta:Math.abs((gr.left+gr.right-tr.left-tr.right)/2), centered:getComputedStyle(g).textAlign, logo:!!g.querySelector('.brand-mark'), text:g.textContent, fits:g.scrollWidth<=g.clientWidth }; })()");
    assert.ok(welcome.delta < 2, JSON.stringify(welcome)); assert.equal(welcome.centered, 'center');
    assert.equal(welcome.logo, false); assert.equal(welcome.fits, true);
    assert.ok(welcome.text.includes('AI for Boss') && welcome.text.includes('dự án') && !welcome.text.includes('CÙNG AI'));
    await capture('welcome-' + width + 'px.png');
  }
  window.setContentSize(browserIntegration ? 1600 : 980, browserIntegration ? 1000 : 720); await wait(80);
  if (browserIntegration) {
    assert.equal(nativeTabs.tabs.size, 0, 'startup must not open network/browser');
    await clickSelector('#web-tab');
    await until(() => Promise.resolve(nativeTabs.state().tabs.some(t => t.title === 'Trang kiểm trình duyệt' && !t.loading)), 'real browser visible in production renderer');
    assert.equal(nativeTabs.tabs.size, 1); await nativeTabs.run({ action: 'web-open' }); assert.equal(nativeTabs.tabs.size, 1, 'open is idempotent');
    const first = nativeTabs.active, contents = nativeTabs.tabs.get(first).view.webContents;
    await until(() => Promise.resolve(nativeTabs.tabs.get(first).view.getVisible()), 'native surface visible');
    assert.equal(await contents.executeJavaScript('typeof process'), 'undefined');
    for (const theme of ['dark', 'light']) {
      await click('Cài đặt'); await click('Giao diện'); await select('[aria-label="Màu giao diện"]', theme);
      await until(() => contents.executeJavaScript(`matchMedia('(prefers-color-scheme: dark)').matches === ${theme === 'dark'}`), 'native browser follows product theme');
      assert.equal(nativeTheme.themeSource, theme);
      await click('Đóng cài đặt');
    }
    checks.push('product light/dark settings update prefers-color-scheme in the existing sandboxed native browser');
    const bounds = nativeTabs.tabs.get(first).view.getBounds(); assert.ok(bounds.width > 500 && bounds.height > 400, JSON.stringify(bounds));
    await contents.executeJavaScript('document.querySelector("button").click()', true);
    await click('Đưa trang vào chat'); await until(() => evaluate("document.querySelector('#composer-input').value.includes('Người dùng đã cập nhật website')"), 'actual page shared to active draft');
    assert.equal(counts['sessions.send'] ?? 0, 0);
    mkdirSync(path.dirname(output), { recursive: true }); await wait(300);
    await capture('browser-shell-1600px.png');
    writeFileSync(path.join(path.dirname(output), 'browser-real-page.png'), (await contents.capturePage()).toPNG());
    await click('Thu gọn trình duyệt'); await until(() => Promise.resolve(nativeTabs.tabs.get(first).view.getBounds().width < bounds.width), 'native surface resizes with shell');
    await click('Mở rộng trình duyệt');
    await click('Mở tab web mới'); await until(() => Promise.resolve(nativeTabs.tabs.size === 2), 'new tab');
    await until(() => evaluate("document.querySelector('[aria-label=\"Địa chỉ web\"]')?.value === '' && document.querySelectorAll('.web-tabs > div').length === 2"), 'renderer has selected blank new tab');
    await until(() => evaluate("Boolean(document.querySelector('.browser-start'))"), 'new tab has start page');
    await until(() => Promise.resolve(!nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'blank native view cannot cover start page');
    await capture('browser-new-tab-1600px.png');
    await fill('[aria-label="Tìm kiếm trong tab mới"]', browserUrl + '/second'); await click('Tìm kiếm');
    await until(() => Promise.resolve(nativeTabs.state().tabs.some(t => t.url.endsWith('/second') && !t.loading)), 'address navigates real tab');
    await click('Chrome'); await until(() => Promise.resolve(!nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'connection guide hides native page');
    await click('Trở lại trình duyệt'); await until(() => Promise.resolve(nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'return restores native page');

    const sharedDraft = await evaluate("document.querySelector('#composer-input').value");
    await openThinkingDock();
    await until(() => Promise.resolve(!nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'Thinking hides real browser');
    assert.equal(await evaluate("document.querySelector('#composer-input').value"), sharedDraft);
    await evaluate("document.querySelector('#thinking-tab').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}))");
    assert.equal(await evaluate("document.activeElement.id"), 'web-tab', 'arrow key selects and focuses adjacent Web tab');
    await until(() => Promise.resolve(nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'Web restores same actual tab');
    await clickSelector('#files-tab'); await until(() => Promise.resolve(!nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'files hide browser');
    await clickSelector('#web-tab'); assert.equal(nativeTabs.tabs.size, 2);
    await click('Cài đặt'); await until(() => Promise.resolve(!nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'settings covers native browser');
    await capture('settings-over-browser-1600px.png');
    await click('Đóng cài đặt'); await until(() => Promise.resolve(nativeTabs.tabs.get(nativeTabs.active).view.getVisible()), 'settings close restores native browser');
    assert.equal(nativeTabs.tabs.size, 2);
    const resizeBefore = nativeTabs.tabs.get(nativeTabs.active).view.getBounds().width;
    const handle = await evaluate("(() => { const r=document.querySelector('.panel-resizer--right').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+200)}; })()");
    await evaluate("(() => {globalThis.__fixturePointerEvents=[]; for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture']) document.addEventListener(type,event=>{if(globalThis.__fixturePointerEvents.length<30)globalThis.__fixturePointerEvents.push({type:event.type,x:event.clientX,y:event.clientY,buttons:event.buttons,pointerId:event.pointerId,target:event.target.className,focused:document.hasFocus(),capture:document.querySelector('.panel-resizer--right').hasPointerCapture(event.pointerId)});},true);})()");
    window.focus(); window.webContents.focus();
    dragVisibility = [];
    window.webContents.sendInputEvent({type:'mouseMove',x:handle.x,y:handle.y});
    window.webContents.sendInputEvent({type:'mouseDown',x:handle.x,y:handle.y,button:'left',modifiers:['leftbuttondown'],clickCount:1});
    // Queue held movement before yielding: hiding a native child can inject an
    // OS hover (physical mouse up) between synthetic down and synthetic move.
    window.webContents.sendInputEvent({type:'mouseMove',x:handle.x+100,y:handle.y,button:'left',modifiers:['leftbuttondown']});
    await until(() => Promise.resolve(dragVisibility.includes(false)), 'drag hides actual native page');
    window.webContents.sendInputEvent({type:'mouseUp',x:handle.x+100,y:handle.y,button:'left',clickCount:1});
    try {
      await until(() => Promise.resolve(nativeTabs.tabs.get(nativeTabs.active).view.getVisible() && nativeTabs.tabs.get(nativeTabs.active).view.getBounds().width < resizeBefore - 50), 'drag updates real browser bounds and restores native page');
    } finally {
      pointerDiagnostic = { before: resizeBefore, handle, dragVisibility, nativeVisible: nativeTabs.tabs.get(nativeTabs.active).view.getVisible(), nativeBounds: nativeTabs.tabs.get(nativeTabs.active).view.getBounds(),
        renderer: await evaluate("({events:globalThis.__fixturePointerEvents,viewport:{width:innerWidth,height:innerHeight},dock:document.querySelector('.workspace__dock').getBoundingClientRect().toJSON(),browserPresent:!!document.querySelector('.web-panel')})") };
    }
    assert.ok(pointerDiagnostic.renderer.events.some(event => event.type === 'pointermove' && event.buttons === 1 && event.capture), 'native pointer move preserves the held button and capture');
    await capture('resized-browser-1600px.png');
    checks.push('new-tab search page and actual pointer-drag resize preserve native tab, no model calls');
    checks.push('production renderer/preload with actual WebContentsView; user-open loads first page once; website interaction/share; tab/address; wide/narrow bounds; Chrome/files hide and restore; no AI sends');
    const browserBeforeDelete = nativeTabs.active, keyBeforeDelete = sessions[0].key;
    const draftBeforeDelete = await evaluate("document.querySelector('#composer-input').value");
    const deletesBefore = managementRequests.filter(packet => packet.action === 'conversation-delete').length;
    await until(() => Promise.resolve(nativeTabs.tabs.get(browserBeforeDelete).view.getVisible()), 'browser positively visible before delete confirmation');
    await openConversationMenu(keyBeforeDelete, 'right-click'); await click('Xóa cuộc trò chuyện');
    await until(() => evaluate("Boolean(document.querySelector('.conversation-delete-dialog:modal .conversation-delete-dialog__confirm:not(:disabled)'))"), 'browser conversation confirmation ready');
    await until(() => Promise.resolve(!nativeTabs.tabs.get(browserBeforeDelete).view.getVisible()), 'delete dialog hides the actual native browser view');
    assert.equal(await evaluate("document.activeElement?.textContent.trim()"), 'Hủy');
    await capture('conversation-delete-over-browser-1600px.png');
    await click('Hủy');
    await until(() => evaluate(`!document.querySelector('.conversation-delete-dialog') && document.activeElement === document.querySelector('.sidebar-session[data-session-key="${keyBeforeDelete}"] .sidebar-session__more')`), 'browser deletion cancellation returns exact opener focus');
    await until(() => Promise.resolve(nativeTabs.tabs.get(browserBeforeDelete).view.getVisible()), 'cancel restores the same native browser tab');
    assert.equal(nativeTabs.active, browserBeforeDelete); assert.equal(nativeTabs.tabs.size, 2);
    assert.equal(await evaluate("document.querySelector('#composer-input').value"), draftBeforeDelete);
    assert.equal(managementRequests.filter(packet => packet.action === 'conversation-delete').length, deletesBefore);
    assert.equal(counts['sessions.send'] ?? 0, 0);
    checks.push('delete confirmation hides a previously visible real WebContentsView; Cancel restores that same tab and opener focus with no delete request or draft loss');
    finish(0); return;
  }
  assert.equal(advisorRequests.length, 0); assert.equal(sessions.length, 1);
  assert.equal(counts['sessions.send'] ?? 0, 0, 'automatic empty session must not send');
  await hasText('1.234 / 10.000 token');
  await clickSelector('.context-meter > summary'); await hasText('Cửa sổ mô hình theo kết nối: 16.000 token.');
  await clickSelector('.context-meter > summary');
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), "session composer");
  await until(() => evaluate("getComputedStyle(document.querySelector('#composer-input')).overflowY === 'hidden'"), 'empty composer has no scrollbar');
  await fill('#composer-input', 'Một đoạn nháp đủ dài để kiểm tra xuống dòng theo chiều rộng của khung soạn thảo. '.repeat(4));
  const wideInputHeight = await evaluate("document.querySelector('#composer-input').clientHeight");
  await evaluate("document.querySelector('.composer__box').style.width = '360px'");
  await until(() => evaluate(`document.querySelector('#composer-input').clientHeight > ${wideInputHeight}`), 'textarea follows changed panel width');
  await fill('#composer-input', 'Nội dung dài.\n'.repeat(40));
  await until(() => evaluate("document.querySelector('#composer-input').clientHeight === 180 && getComputedStyle(document.querySelector('#composer-input')).overflowY === 'auto'"), 'long composer scrolls only at height cap');
  await capture('composer-long-narrow-1440px.png');
  await fill('#composer-input', ''); await evaluate("document.querySelector('.composer__box').style.width = ''");
  await until(() => evaluate("document.querySelector('#composer-input').clientHeight < 80 && getComputedStyle(document.querySelector('#composer-input')).overflowY === 'hidden'"), 'cleared composer shrinks and removes scrollbar');
  await capture('composer-default-1440px.png');
  await fill('#composer-input', 'Dòng đầu\nDòng thứ hai\nDòng thứ ba');
  const beforeFontHeight = await evaluate("document.querySelector('#composer-input').clientHeight");
  await clickSelector('[aria-label="Điều chỉnh bố cục"]');
  await evaluate("(() => { const el=document.querySelector('.layout-menu [aria-label=\"Cỡ chữ cuộc trò chuyện\"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'18'); el.dispatchEvent(new Event('input',{bubbles:true})); })()");
  await until(() => evaluate(`document.querySelector('#composer-input').clientHeight > ${beforeFontHeight} && getComputedStyle(document.querySelector('#composer-input')).overflowY === 'hidden'`), 'font size change resizes existing textarea without remount');
  await evaluate("(() => { const el=document.querySelector('.layout-menu [aria-label=\"Cỡ chữ cuộc trò chuyện\"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'14'); el.dispatchEvent(new Event('input',{bubbles:true})); })()");
  await until(() => evaluate(`document.querySelector('#composer-input').clientHeight === ${beforeFontHeight}`), 'font size reset returns textarea height');
  await clickSelector('[aria-label="Điều chỉnh bố cục"]'); await fill('#composer-input', '');
  assert.equal(await evaluate("(() => { const a=document.querySelector('.work-templates>summary').getBoundingClientRect(), b=document.querySelector('.session-skills>summary').getBoundingClientRect(); return Math.abs(a.y-b.y)<2; })()"), true);
  await clickSelector('.work-templates > summary'); await clickSelector('.session-skills > summary');
  await until(() => evaluate("document.querySelector('.session-skills').open && !document.querySelector('.work-templates').open"), 'one compact options menu at a time');
  await evaluate("document.querySelector('.session-skills>summary').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("!document.querySelector('.session-skills').open && document.activeElement === document.querySelector('.session-skills>summary')"), true);
  checks.push('compact templates/skills share one row and exclusive menus with Escape focus; textarea reacts to width, actual layout font changes and long/empty drafts without permanent scrollbar');
  await fill("#composer-input", "Xin trả lời mô phỏng."); await composerKey({ key: 'Enter' });
  await until(() => Promise.resolve(counts["sessions.send"] === 1), "one send");
  assert.equal(latestSend.thinking, undefined, "default reasoning never adds a per-turn override");
  await until(() => evaluate("document.querySelector('#composer-input').value === ''"), "first ACK handled");
  await hasText("Dừng");
  assert.equal(await evaluate("Boolean(document.querySelector('.transcript .run-progress'))"), false, 'center chat contains no noisy progress');
  assert.equal(await evaluate("Boolean(document.querySelector('.workspace__topbar button[aria-label=\"Thông tin\"]'))"), false, 'center Info action removed');
  await openThinkingDock(); await hasText('Đang chờ mô hình xác nhận');
  await until(() => evaluate("document.querySelector('#thinking-status')?.textContent === 'Đang chờ mô hình xác nhận'"), 'right Thinking shows actual waiting phase');
  assert.equal(await evaluate("Boolean(document.querySelector('.run-progress__reasoning'))"), false, 'no invented reasoning before event');
  emitAgent('lifecycle', 1, { phase: 'start' });
  emitAgent('thinking', 2, { text: 'Nội dung suy nghĩ mô phỏng: kiểm yêu cầu trước khi trả lời.' });
  await hasText('Đang suy nghĩ');
  await hasText('Nội dung suy nghĩ mô phỏng');
  assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark[data-model-active=true]'))"), true, 'accepted native activity activates approved logo');
  await until(() => evaluate("document.querySelector('#thinking-status')?.textContent === 'Đang suy nghĩ' && Boolean(document.querySelector('.thinking-tab__live'))"), 'right Thinking exposes native reasoning phase while selected');
  const sampleMotion = () => evaluate("(() => { const mark=document.querySelector('.brand-mark--active'), ring=mark.querySelector('.brand-mark__ring'), core=mark.querySelector('.brand-mark__core'), rs=getComputedStyle(ring), cs=getComputedStyle(core); return {ring:rs.transform, ringOrigin:rs.transformOrigin, ringAnimation:rs.animationName, ringDuration:rs.animationDuration, ringTiming:rs.animationTimingFunction, radius:parseFloat(cs.getPropertyValue('r')), opacity:Number(cs.opacity), coreAnimation:cs.animationName, coreDuration:cs.animationDuration, coreTiming:cs.animationTimingFunction, cx:core.getAttribute('cx'), cy:core.getAttribute('cy'), fill:cs.fill, markTransform:getComputedStyle(mark).transform}; })()");
  const motionSamples = [];
  const motionEnvironment = await evaluate("({visibility:document.visibilityState,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches})");
  for (let i = 0; i < 3; i++) {
    // A hidden test window has no compositor frames until capture requests one.
    // Render the actual CSS at wall-clock intervals; never seek animation time.
    await window.webContents.capturePage();
    await evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    motionSamples.push(await sampleMotion()); await wait(220);
  }
  motionDiagnostic = { environment: motionEnvironment, samples: motionSamples };
  assert.ok(new Set(motionSamples.map(sample => sample.ring)).size > 1, 'real CSS ring transform changes over frames');
  assert.ok(new Set(motionSamples.map(sample => sample.radius)).size > 1, 'real CSS center radius changes over frames');
  for (const sample of motionSamples) {
    assert.equal(sample.ringAnimation, 'brand-mark-spin-ring'); assert.equal(sample.ringDuration, '2.2s'); assert.equal(sample.ringTiming, 'linear');
    assert.equal(sample.ringOrigin, '50px 50px'); assert.equal(sample.coreAnimation, 'brand-mark-pulse-core'); assert.equal(sample.coreDuration, '1.6s'); assert.equal(sample.coreTiming, 'ease-in-out');
    assert.ok(sample.radius >= 17 && sample.radius <= 19); assert.ok(sample.opacity >= .88 && sample.opacity <= 1);
    assert.equal(sample.cx, '50'); assert.equal(sample.cy, '50'); assert.equal(sample.markTransform, 'none');
  }
  // Test-only, in-process media emulation; no remote debugging port or OS setting change.
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await until(() => evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"), 'reduced motion media enabled');
  const reduced = await sampleMotion(); await wait(240); const reducedLater = await sampleMotion();
  motionDiagnostic.reduced = [reduced, reducedLater];
  assert.equal(reduced.ringAnimation, 'none'); assert.equal(reduced.coreAnimation, 'none');
  assert.equal(reduced.ring, 'none'); assert.equal(reduced.radius, 17); assert.equal(reduced.opacity, 1);
  assert.deepEqual(reducedLater, reduced, 'reduced motion remains visually stationary across frames');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  await until(() => evaluate("!matchMedia('(prefers-reduced-motion: reduce)').matches"), 'reduced motion media reset');
  window.webContents.debugger.detach();
  emitAgent('thinking', 2, { text: 'Không được thay thế bằng sự kiện lặp.' });
  emitAgent('thinking', 3, { text: 'Không được hiện từ phiên khác.' }, { sessionKey: 'other-session' });
  emitAgent('thinking', 3, { text: 'Không được hiện từ lượt khác.' }, { runId: 'other-run' });
  await wait(80); assert.equal((await text()).includes('Không được hiện từ'), false);
  assert.equal((await text()).includes('Không được thay thế'), false);
  emitAgent('tool', 4, { toolCallId: 'fixture-status', name: 'session_status', phase: 'start', args: { value: 'RAW_SHOULD_NOT_RENDER' } });
  await hasText('Kiểm tra trạng thái phiên');
  await until(() => evaluate("document.querySelector('#thinking-status')?.textContent === 'Đang dùng công cụ'"), 'right Thinking changes to tool phase without raw arguments');
  emitAgent('tool', 5, { toolCallId: 'fixture-status', name: 'session_status', phase: 'result', isError: false, result: 'RAW_SHOULD_NOT_RENDER' });
  await hasText('Hoàn tất');
  assert.equal((await text()).includes('RAW_SHOULD_NOT_RENDER'), false);
  emitAgent('plan', 6, { explanation: 'Ưu tiên kiểm dữ kiện trước khi kết luận.', phase: 'update', steps: [{ step: 'Đọc yêu cầu mô phỏng', status: 'completed' }, { step: 'Chuẩn bị trả lời', status: 'in_progress' }] });
  await until(() => evaluate("document.querySelector('#thinking-status')?.textContent === 'Đang lập kế hoạch'"), 'right Thinking changes to actual planning phase');
  assert.equal(await evaluate("document.querySelector('.thinking-view__stop').textContent.trim()"), 'Dừng', 'progress cannot end native run');

  await hasText('Ưu tiên kiểm dữ kiện trước khi kết luận.');
  emitAgent('tool', 7, { toolCallId: 'fixture-skill', name: 'read', phase: 'start', activity: { kind: 'skill', label: 'business-review' } });
  emitAgent('tool', 8, { toolCallId: 'fixture-child', name: 'sessions_spawn', phase: 'start', activity: { kind: 'agent', label: 'Kiểm dữ kiện', agentId: 'researcher' } });
  emitAgent('tool', 9, { toolCallId: 'fixture-skill', name: 'read', phase: 'result' });
  emitAgent('tool', 10, { toolCallId: 'fixture-child', name: 'sessions_spawn', phase: 'result' });
  await hasText('business-review'); await hasText('researcher'); await hasText('Lệnh đã trả kết quả');
  await fill('#composer-input', 'Nháp cạnh tiến trình.');
  await clickSelector('#files-tab'); await clickSelector('#thinking-tab');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Nháp cạnh tiến trình.');
  assert.equal(counts['sessions.send'], 1, 'switching dock never submits a draft');
  await fill('#composer-input', '');
  const channelChangesBeforeBusySettings = counts['management.channel-setup'] ?? 0;
  await click('Cài đặt'); await click('Cổng kết nối');
  await hasText('Chờ tác vụ hiện tại kết thúc hoặc bấm Dừng trước khi thiết lập kênh.');
  await until(() => evaluate("document.querySelectorAll('.settings-body .capability-panel .native-list > li').length >= 5"), 'busy channel catalogue still loads for reading');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.settings-body .capability-panel .native-list > li > button')).every(button=>button.disabled)"), true, 'busy worker disables every channel setup action');
  await evaluate("document.querySelector('.settings-body .capability-panel .native-list > li > button').click()"); await wait(50);
  assert.equal(counts['management.channel-setup'] ?? 0, channelChangesBeforeBusySettings, 'busy channel click cannot reach preparation/restart');
  await capture('channels-busy-settings-980px.png'); await click('Trở lại cuộc trò chuyện');
  window.setContentSize(1440, 900); await wait(80); await capture('thinking-live-1440px.png');
  window.setContentSize(980, 720); await wait(80);
  assert.equal(await evaluate("document.querySelector('.thinking-view').scrollWidth <= document.querySelector('.thinking-view').clientWidth"), true);
  await capture('thinking-live-980px.png');
  pushStatus({ connected: false, setupReady: false }); await hasText('Đang nối lại để cập nhật tiến trình');
  assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark--active'))"), false);
  assert.equal(await evaluate("document.querySelector('#thinking-tab').title"), 'Đang chờ kết nối');
  assert.equal(await evaluate("document.querySelector('.thinking-view__stop').disabled"), true);
  pushStatus({ connected: true, setupReady: true }); await hasText('Nội dung suy nghĩ mô phỏng');
  await click('Thu gọn Thinking');
  assert.equal(await evaluate("Boolean(document.querySelector('.thinking-view .run-progress'))"), false);
  checks.push('dedicated Thinking opens while busy; live right public waiting/reasoning/tool/plan/reconnect status; replay/cross-session/run isolation; exact ZIP ring transform and core radius change over real frames, reduced-motion static; 980/1440 fit; Back preserves active run without center progress');
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.composer__primary')).map(node => node.textContent.trim())"), ["Dừng"]);
  assert.equal(await evaluate("document.querySelector('[data-workspace-stage]').dataset.workspaceStage"), "responding");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Phiên mới').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#composer-input').disabled"), false);
  await fill("#composer-input", "Nháp cho lượt tiếp theo.");
  await composerKey({ key: "Enter" });
  await wait(60);
  assert.equal(counts["sessions.send"], 1, "typing while busy must not send concurrently");
  emitChat({ state: "delta", seq: 1, deltaText: "Xin" }); await hasText("Xin");
  emitChat({ state: "delta", seq: 2, deltaText: " chào từng phần" }); await hasText("Xin chào từng phần");
  emitChat({ state: "delta", seq: 2, deltaText: " chào từng phần" });
  emitChat({ state: "error", seq: 99, runId: "different-run", errorMessage: "Không được hiện" });
  await wait(100);
  assert.ok(!(await text()).includes("Không được hiện"));
  assert.ok(!(await text()).includes("Xin chào từng phần chào từng phần"));
  emitChat({ state: "delta", seq: 3, replace: true, deltaText: "Câu trả lời mô phỏng hoàn tất." });
  await hasText("Câu trả lời mô phỏng hoàn tất.");
  histories.get(latestSend.key).push({ role: "assistant", content: [
    { type: 'thinking', thinking: 'Nội dung suy nghĩ mô phỏng: kiểm yêu cầu trước khi trả lời.' },
    { type: 'text', text: "Câu trả lời mô phỏng hoàn tất." }
  ], __openclaw: { id: "assistant-1" } });
  emitChat({ state: "final", seq: 4, message: histories.get(latestSend.key).at(-1) });
  await until(async () => !(await text()).includes("Dừng"), "final clears busy");
  assert.equal((await text()).split("Câu trả lời mô phỏng hoàn tất.").length - 1, 1);
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "Nháp cho lượt tiếp theo.");
  assert.equal(await evaluate("Boolean(document.querySelector('.transcript .run-progress__reasoning'))"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark--active'))"), false);
  assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark__ring,.brand-mark__core'))"), false, 'terminal uses exact static assets again');
  assert.equal(await evaluate("document.querySelector('#thinking-tab').title"), 'Đã hoàn tất');
  await openThinkingDock();
  await until(() => evaluate("document.querySelectorAll('.thinking-view__reasoning').length === 1 && document.querySelectorAll('.run-progress__reasoning').length === 0"), 'same-turn public reasoning once in dedicated view');
  await hasText('Đọc yêu cầu mô phỏng'); await hasText('Kiểm tra trạng thái phiên');
  await capture('thinking-completed-980px.png');
  await click('Thu gọn Thinking');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Nháp cho lượt tiếp theo.');
  checks.push('accepted native message anchor binds same-turn reasoning exactly once outside chat; completed native plan/tool history remains visible; Back preserves draft');
  await fill("#composer-input", "Lượt bị dừng."); await click("Gửi");
  await until(() => Promise.resolve(counts["sessions.send"] === 2), "second send");
  await until(() => evaluate("document.querySelector('#composer-input').value === ''"), "second ACK handled");
  assert.equal(await evaluate("Boolean(document.querySelector('.run-progress .run-progress__reasoning'))"), false, 'new turn clears previous progress reasoning');
  emitAgent('thinking', 1, { text: 'Nội dung suy nghĩ mô phỏng: kiểm yêu cầu trước khi trả lời.' });
  await openThinkingDock();
  await until(() => evaluate("document.querySelectorAll('.run-progress__reasoning').length === 1 && document.querySelectorAll('.thinking-view__reasoning').length === 1"), 'equal reasoning from an older turn cannot suppress a new run');
  await click('Thu gọn Thinking');
  await fill("#composer-input", "Nháp còn sau khi dừng.");
  emitChat({ state: "aborted", seq: 1 });
  await until(async () => !(await text()).includes("Dừng"), "external abort clears busy");
  checks.push("session creation, idempotent send, streaming/replacement/dedup, wrong-run isolation, final and aborted settlement");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "Nháp còn sau khi dừng.");
  await click("Phiên mới");
  await until(() => Promise.resolve(sessions.length === 2), "second conversation created");
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), "second composer");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "");
  await fill("#composer-input", "Nháp của cuộc trò chuyện thứ hai.");
  for (const label of ["subscription", "history"]) {
    await until(() => evaluate("document.querySelector('[data-workspace-stage]')?.dataset.workspaceStage === 'history-error'"), `${label} failure is recoverable`);
    assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gửi').disabled"), true);
    await click("Tải lại cuộc trò chuyện");
  }
  await until(() => evaluate("document.querySelector('[data-workspace-stage]')?.dataset.workspaceStage === 'ready'"), "manual retry recovers current history");
  assert.equal(counts["sessions.send"], 2, "retrying history must never resend a message");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "Nháp của cuộc trò chuyện thứ hai.");
  checks.push("subscription and initial history failures recover only on user retry, preserve draft and never resend");
  await evaluate("document.querySelectorAll('.sidebar-session .session-item')[0].click()");
  await until(() => evaluate("document.querySelector('#composer-input').value === 'Nháp còn sau khi dừng.'"), "first draft restored");
  await evaluate("document.querySelectorAll('.sidebar-session .session-item')[1].click()");
  await until(() => evaluate("document.querySelector('#composer-input').value === 'Nháp của cuộc trò chuyện thứ hai.'"), "second draft restored");
  await click("Cài đặt"); await click("Kết nối AI");
  await click("Xong"); await click("Trở lại cuộc trò chuyện");
  await until(() => evaluate("document.querySelector('#composer-input')?.value === 'Nháp của cuộc trò chuyện thứ hai.'"), "draft survives connection screen");
  await until(() => evaluate("Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Gửi' && !b.disabled)"), "second history ready for sending");
  for (const keys of [{ key: "Enter", shiftKey: true }, { key: "Enter", ctrlKey: true, isComposing: true },
    { key: "Enter", ctrlKey: true, repeat: true }, { key: "Enter", ctrlKey: true, keyCode: 229 }]) await composerKey(keys);
  await wait(60); assert.equal(counts["sessions.send"], 2, "Shift+Enter, IME and repeated keys must not send");
  await composerKey({ key: "Enter" });
  await until(() => Promise.resolve(counts["sessions.send"] === 3), "keyboard sends exactly once");
  await until(() => evaluate("document.querySelector('#composer-input').value === ''"), "third ACK handled");
  assert.equal(latestSend.key, sessions[1].key);
  await openThinkingDock(); await clickSelector('.thinking-view__stop');
  await until(() => evaluate("!document.querySelector('.thinking-view__stop')"), 'Stop in Thinking waits for exact native abort acknowledgement');
  assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark--active,.brand-mark__ring,.brand-mark__core'))"), false, 'Stop returns logo to static assets');
  assert.equal(await evaluate("document.querySelector('#thinking-tab').title"), 'Đã dừng');
  await hasText('Đã dừng'); await click('Thu gọn Thinking');
  assert.equal(counts["chat.abort"], 1, "stop button aborts the exact admitted run once");
  checks.push("editable busy composer, per-conversation RAM drafts, Enter send and Shift/IME/repeat key guards");

  // A native transcript anchor can project several display rows. A changed
  // singular event cannot prove which sibling is replaced: reconcile history.
  const siblingKey = sessions[1].key;
  const siblingRows = [
    { role: "user", content: "Dòng dùng chung mốc thứ nhất.", __openclaw: { id: "shared-anchor", seq: 71 } },
    { role: "assistant", content: "Dòng dùng chung mốc thứ hai.", __openclaw: { id: "shared-anchor", seq: 71 } }
  ];
  histories.get(siblingKey).push(siblingRows[0]);
  const emitTranscript = message => window.webContents.send("aifb:gateway-event", { event: "session.message",
    payload: { sessionKey: siblingKey, messageId: "shared-anchor", messageSeq: 71, message } });
  emitTranscript(siblingRows[0]); await hasText(siblingRows[0].content);
  const historyBeforeSibling = counts["chat.history"];
  histories.get(siblingKey).push(siblingRows[1]); emitTranscript(siblingRows[1]);
  await hasText(siblingRows[1].content); await hasText(siblingRows[0].content);
  assert.ok(counts["chat.history"] > historyBeforeSibling, "ambiguous anchor refreshes native history");
  emitTranscript(siblingRows[1]); await wait(100);
  for (const row of siblingRows) assert.equal((await text()).split(row.content).length - 1, 1);
  checks.push("native messageId/messageSeq event collision reloads history and preserves both shared-anchor rows");

  await fill("#composer-input", "Nháp giữ khi model chưa sẵn sàng.");
  selectedAvailable = false;
  await click("Cài đặt"); await click("Kết nối AI"); await click("Xong"); await click("Trở lại cuộc trò chuyện");
  await until(() => evaluate("document.querySelector('[data-workspace-stage]')?.dataset.workspaceStage === 'session-model-unavailable'"), "selected model unavailable despite another available model");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gửi').disabled"), true);
  await composerKey({ key: "Enter" }); await wait(60);
  assert.equal(counts["sessions.send"], 3);
  selectedAvailable = true; unknownSessionModel = true;
  await click("Cài đặt"); await click("Kết nối AI"); await click("Xong"); await click("Trở lại cuộc trò chuyện");
  await until(() => evaluate("document.querySelector('[data-workspace-stage]')?.dataset.workspaceStage === 'session-model-unknown'"), "unknown selected session model blocks send");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Gửi').disabled"), true);
  unknownSessionModel = false;
  await click("Tải lại kết nối");
  await until(() => evaluate("document.querySelector('[data-workspace-stage]')?.dataset.workspaceStage === 'ready'"), "selected native model restored");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "Nháp giữ khi model chưa sẵn sàng.");
  checks.push("selected session model gates send independently of other models; unknown identity blocks; draft survives recovery");

  window.setContentSize(980, 720);
  await wait(120);
  const fits = () => evaluate("Array.from(document.querySelectorAll('.workspace,.workspace__rail,.workspace__main,.workspace__dock,.composer')).every(node => { const r = node.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; })");
  assert.equal(await fits(), true, "default layout fits 980px");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns.split(' ').length"), 3);
  if (await evaluate("Boolean(document.querySelector('.workspace--right-hidden'))")) await click('Mở bảng bên phải');
  await clickSelector('#files-tab');
  assert.equal(await evaluate("Boolean(document.querySelector('#files-panel'))"), true, "files remain accessible after closing Thinking");
  assert.equal(await evaluate("Boolean(document.querySelector('#advisor-panel'))"), false, "Advisor opens only by explicit button");
  const sendsBeforeAdvisor = counts["sessions.send"];
  const previousDraft = await evaluate("document.querySelector('#composer-input').value");
  await clickSelector(".work-templates summary");
  await click("Lập kế hoạch");
  await until(() => evaluate(`document.querySelector('#composer-input').value.length > ${previousDraft.length}`), "template appended");
  assert.ok((await evaluate("document.querySelector('#composer-input').value")).startsWith(previousDraft));
  assert.equal(counts["sessions.send"], sendsBeforeAdvisor, "template never sends");
  assert.equal(await evaluate("Boolean(document.querySelector('#advisor-panel'))"), false, "no manual Advisor form");
  assert.equal(await evaluate("document.querySelector('#advisor-tab').tagName"), 'SPAN', "Advisor is a label, no extra settings action");
  assert.equal(await evaluate("document.querySelectorAll('.advisor-switch').length"), 1);
  assert.equal(advisorRequests.length, 0, 'disabled Advisor has no model calls');
  await capture('advisor-compact-980px.png');
  await clickSelector('#advisor-model-picker'); await assertModelPopupFits(); await capture('advisor-model-popup-980px.png');
  const patchesBeforeAdvisorChoice = counts['sessions.patch'] ?? 0;
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.model-picker__options button')).find(button=>button.textContent.includes('fixture-b/not-offered'))?.disabled"), false, 'default-agent Advisor can choose its own native review-only model');
  await click('Mô hình dùng riêng cho Advisor');
  await until(() => evaluate("document.querySelector('#advisor-model-picker').textContent.includes('Mô hình dùng riêng cho Advisor')"), 'Advisor keeps default-agent model choice');
  assert.equal(counts['sessions.patch'] ?? 0, patchesBeforeAdvisorChoice, 'Advisor selection never mutates worker model');
  assert.equal(await evaluate("document.querySelector('#composer-model').value"), '["fixture","model"]');
  await clickSelector('#advisor-model-picker'); await click('Model mô phỏng'); await clickSelector('#advisor-model-picker');
  window.setContentSize(1440, 900); await wait(100); await assertModelPopupFits();
  window.setContentSize(980, 720); await wait(100); await assertModelPopupFits();
  await evaluate("document.querySelector('[aria-label=\"Tìm mô hình\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
  checks.push('Advisor exposes only connected model selection and toggle; no manual goal, criteria or review form; disabled mode makes no Advisor calls');

  const composerFits = () => evaluate("Array.from(document.querySelectorAll('.composer__box,#composer-input,.composer__add,.composer__model,.composer__thinking,.composer__primary,.composer__attachment')).every(node => { const r = node.getBoundingClientRect(); const b = document.querySelector('.composer__box').getBoundingClientRect(); return r.left >= b.left - 1 && r.right <= b.right + 1 && r.right <= innerWidth + 1; })");
  assert.equal(await evaluate("(() => { const box = document.querySelector('.composer__box'); return ['#composer-input','#composer-model','.composer__add','.composer__primary'].every(selector => box.contains(document.querySelector(selector))); })()"), true);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.composer__primary')).map(node => node.textContent.trim())"), ["Gửi"]);
  const sendsBeforeModel = counts["sessions.send"], historyBeforeModel = counts["chat.history"];
  const draftBeforeModel = await evaluate("document.querySelector('#composer-input').value");
  await clickSelector("#composer-model");
  await until(() => evaluate("document.activeElement?.getAttribute('aria-label') === 'Tìm mô hình'"), "model search focused");
  await fill('[aria-label="Tìm mô hình"]', "khác");
  assert.equal(await evaluate("document.querySelectorAll('[role=menuitemradio]').length"), 1);
  await capture("model-picker-980px.png");
  await clickSelector('[role="menuitemradio"]');
  assert.equal(await evaluate("Boolean(document.querySelector('.composer__confirmation'))"), false);
  assert.equal(counts["sessions.send"], sendsBeforeModel);
  await until(() => Promise.resolve(Boolean(pendingPatch)), "one selection starts native model patch");
  assert.equal(counts["sessions.patch"], 1);
  assert.equal(await evaluate("document.querySelector('.composer__model-name').textContent"), "Đang đổi…");
  await hasText('Đang cập nhật ngữ cảnh…');
  assert.deepEqual(pendingPatch.params, { key: siblingKey, model: "fixture/other" });
  assert.equal(await evaluate("document.querySelector('.composer__primary').disabled"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.sidebar-session .session-item')).every(button => button.disabled)"), true);
  assert.equal(await evaluate("document.querySelector('#composer-model').value"), JSON.stringify(["fixture", "model"]), "model label cannot change before history truth");
  modelBySession.set(siblingKey, "fixture/other");
  pendingPatch.resolve({ ok: true, resolved: { modelProvider: "fixture", model: "ack-only-model" } }); pendingPatch = null;
  await until(() => evaluate("document.querySelector('#composer-model').value === '[\"fixture\",\"other\"]' && !document.querySelector('#composer-model').disabled"), "history confirms native selected model");
  assert.ok(counts["chat.history"] > historyBeforeModel);
  assert.equal(await evaluate("document.querySelector('.composer__model-name').textContent"), "Model khác", "provider-qualified history uses the short catalogue name");
  await hasText('1.234 / 24.000 token'); await clickSelector('.context-meter > summary');
  await hasText('Cửa sổ mô hình theo kết nối: 32.000 token.'); await clickSelector('.context-meter > summary');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), draftBeforeModel);
  assert.equal(counts["sessions.send"], sendsBeforeModel);
  checks.push("one-click model selection without confirmation; native patch locks send/navigation and history truth owns the label");

  await clickSelector('#composer-model');
  await until(() => evaluate("document.querySelectorAll('.model-picker__options [role=menuitemradio]').length === 5"), 'default connected-provider filter includes two connected providers and policy-excluded row');
  await select('[aria-label="Lọc nhà cung cấp mô hình"]', '__all');
  await until(() => evaluate("document.querySelectorAll('.model-picker__options [role=menuitemradio]').length === 6"), 'complete model discovery expands the initial two prepared models');
  assert.ok((counts['management.model-catalogue'] ?? 0) > 0);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.model-picker__options small')).some(node => node.textContent === 'fixture-c/unavailable')"), true, 'unconnected provider remains discoverable');
  await fill('[aria-label="Tìm mô hình"]', 'fixture-b');
  assert.equal(await evaluate("document.querySelectorAll('.model-picker__options [role=menuitemradio]').length"), 3);
  assert.equal(await evaluate("document.querySelectorAll('.model-picker__options [role=menuitemradio]:disabled').length"), 1);
  const beforeBlockedSelection = counts['sessions.patch'];
  await evaluate("document.querySelector('.model-picker__options [role=menuitemradio]:disabled').click()"); await wait(40);
  assert.equal(counts['sessions.patch'], beforeBlockedSelection, 'available but policy-excluded row cannot trigger model change');
  await fill('[aria-label="Tìm mô hình"]', 'fixture-c'); await hasText('Chưa xác nhận quyền dùng mô hình; kiểm tra kết nối');
  assert.equal(await evaluate("document.querySelector('.model-picker__options [role=menuitemradio]').disabled"), true);
  await fill('[aria-label="Tìm mô hình"]', '');
  deferCatalogue = true;
  const catalogueBefore = counts['management.model-catalogue'];
  await click('Tải lại danh mục'); await until(() => Promise.resolve(Boolean(pendingCatalogue)), 'explicit refresh reaches bounded catalogue action');
  assert.equal(counts['management.model-catalogue'], catalogueBefore + 1);
  assert.equal(managementRequests.filter(packet => packet.action === 'model-catalogue').at(-1).refresh, true);
  await hasText('Đang tải danh mục từ OpenClaw…');
  assert.equal(await evaluate("document.querySelector('#composer-input').disabled || document.querySelector('#composer-model').disabled || document.querySelector('.composer__primary').disabled"), false, 'background discovery does not block ready chat controls');
  await fill('#composer-input', 'Nháp vẫn sửa khi tải danh mục.');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Nháp vẫn sửa khi tải danh mục.');
  assert.equal(counts['sessions.send'], sendsBeforeModel);
  pendingCatalogue(); await until(() => evaluate("!document.querySelector('.model-picker__refresh').disabled"), 'refresh settles without closing picker');
  failCatalogue = true; await click('Tải lại danh mục');
  await hasText('Chưa tải được danh mục đầy đủ. Anh vẫn có thể dùng các mô hình đã xác nhận.');
  assert.equal(await evaluate("document.querySelectorAll('.model-picker__options [role=menuitemradio]:not(:disabled)').length"), 4, 'failed refresh keeps previously confirmed choices');
  failCatalogue = false; await click('Tải lại danh mục');
  await until(() => evaluate("!document.querySelector('.model-picker__popover [role=alert]') && !document.querySelector('.model-picker__refresh').disabled"), 'explicit refresh recovers catalogue error');
  await assertModelPopupFits();
  await capture('model-catalogue-full-980px.png');
  await fill('[aria-label="Tìm mô hình"]', 'fixture-b/reasoning'); await click('Mô hình thử Alpha');
  await until(() => Promise.resolve(Boolean(pendingPatch)), 'additional provider model can be selected through the same native patch');
  assert.deepEqual(pendingPatch.params, { key: siblingKey, model: 'fixture-b/reasoning' });
  modelBySession.set(siblingKey, 'fixture-b/reasoning'); pendingPatch.resolve({ ok: true }); pendingPatch = null;
  await until(() => evaluate("document.querySelector('#composer-model').value === '[\"fixture-b\",\"reasoning\"]' && !document.querySelector('#composer-model').disabled"), 'additional provider model is confirmed by native session history');
  assert.equal(await evaluate("document.querySelector('.composer__model-name').textContent"), 'Mô hình thử Alpha');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Nháp vẫn sửa khi tải danh mục.');
  await clickSelector('#composer-model'); await fill('[aria-label="Tìm mô hình"]', 'fixture-b/writing'); await click(longModelName);
  await until(() => Promise.resolve(Boolean(pendingPatch)), 'long model name also receives native model acknowledgement');
  modelBySession.set(siblingKey, 'fixture-b/writing'); pendingPatch.resolve({ ok: true }); pendingPatch = null;
  await until(() => evaluate("document.querySelector('#composer-model').value === '[\"fixture-b\",\"writing\"]' && !document.querySelector('#composer-model').disabled"), 'long model choice is ready');
  await clickSelector('#composer-model'); await assertModelPopupFits(); await capture('model-catalogue-long-name-980px.png');
  await evaluate("document.querySelector('[aria-label=\"Tìm mô hình\"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))");
  await clickSelector('#composer-model'); await fill('[aria-label="Tìm mô hình"]', 'khác'); await click('Model khác');
  await until(() => Promise.resolve(Boolean(pendingPatch)), 'restore original fixture model through explicit selection');
  modelBySession.set(siblingKey, 'fixture/other'); pendingPatch.resolve({ ok: true }); pendingPatch = null;
  await until(() => evaluate("document.querySelector('#composer-model').value === '[\"fixture\",\"other\"]' && !document.querySelector('#composer-model').disabled"), 'original model restored');
  await fill('#composer-input', draftBeforeModel);
  assert.equal(counts['sessions.send'], sendsBeforeModel, 'catalogue browse/refresh/model selection never sends a prompt');
  checks.push('full catalogue expands prepared two rows into six across three providers; provider/model filter, unavailable and policy-excluded rows, deferred/error/retry refresh preserves usable chat/draft; additional provider selection waits for native history and restores original choice');

  await fill("#composer-input", "");
  await chooseFile("Ghi chú thử.txt", "Nội dung chỉ từ tệp được chọn.", true);
  await until(() => evaluate("Boolean(document.querySelector('.composer__attachment--reading'))"), "file remains reading until bytes arrive");
  assert.equal(await evaluate("document.querySelector('.composer__primary').disabled"), true);
  assert.equal(await evaluate("document.querySelector('#composer-files').value"), "", "picker resets so the same file may be selected again");
  assert.equal(counts["sessions.send"], sendsBeforeModel, "file selection never sends");
  await evaluate("globalThis.__finishFixtureFile()");
  await until(() => evaluate("Boolean(document.querySelector('.composer__attachment--ready'))"), "selected file read complete");
  assert.equal(await composerFits(), true);
  await evaluate("document.querySelector('.composer__remove').click()");
  await until(() => evaluate("!document.querySelector('.composer__attachment')"), "file removed before send");
  assert.equal(await evaluate("document.querySelector('.composer__primary').disabled"), true, "empty draft after removing its only file cannot send");
  await chooseFile("Ghi chú thử.txt", "Nội dung chỉ từ tệp được chọn.");
  await until(() => evaluate("Boolean(document.querySelector('.composer__attachment--ready')) && !document.querySelector('.composer__primary').disabled"), "file-only message ready");
  await wait(80);
  await capture("composer-file-980px.png");
  checks.push("synthetic File/DataTransfer reading and ready chips stay inside textbox; selection does not send; remove and same-file reselection work");

  const patchesBeforeThinking = counts["sessions.patch"];
  await select("#composer-thinking", "high");
  await until(() => evaluate("document.querySelector('#composer-thinking').value === 'high'"), "reasoning chosen for next send");
  assert.equal(counts["sessions.patch"], patchesBeforeThinking, "thinking preference does not issue admin-only patches");
  assert.equal(counts["sessions.send"], sendsBeforeModel);
  deferSend = true;

  await click("Gửi");
  await until(() => Promise.resolve(Boolean(pendingSend)), "file-only native send awaiting ACK");
  assert.equal(await evaluate("Boolean(document.querySelector('#advisor-panel'))"), false, "explicit send returns to worker transcript");
  assert.equal(latestSend.message, ""); assert.equal(latestSend.key, siblingKey);
  assert.equal(latestSend.thinking, "high", "explicit next-turn choice uses the public sessions.send thinking field");
  assert.deepEqual(latestSend.attachments, [{ type: "file", mimeType: "text/plain", fileName: "Ghi chú thử.txt",
    sizeBytes: Buffer.byteLength("Nội dung chỉ từ tệp được chọn.", "utf8"),
    content: Buffer.from("Nội dung chỉ từ tệp được chọn.", "utf8").toString("base64") }]);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.composer__primary')).map(node => node.textContent.trim())"), ["Dừng"]);
  assert.equal(await evaluate("document.querySelector('#composer-input').disabled"), false);
  assert.equal(await evaluate("document.querySelector('#composer-model').disabled"), true);
  await fill("#composer-input", "Nháp mới giữ sau ACK.");
  await chooseFile("Tệp tiếp theo.txt", "Tệp của lượt tiếp theo.");
  await until(() => evaluate("document.querySelectorAll('.composer__attachment--ready').length === 2"), "next file composed while first send waits");
  pendingSend.resolve({ ok: true, runId: pendingSend.runId }); pendingSend = null; deferSend = false;
  await until(() => evaluate("document.querySelectorAll('.composer__attachment').length === 1 && document.querySelector('.composer__file-name').textContent === 'Tệp tiếp theo.txt'"), "ACK clears only its sent file");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "Nháp mới giữ sau ACK.");
  await hasText("Dừng"); await click("Dừng");
  await until(() => evaluate("document.querySelector('.composer__primary').textContent.trim() === 'Gửi'"), "stop returns the single send action");
  await evaluate("document.querySelectorAll('.sidebar-session .session-item')[0].click()");
  await until(() => evaluate("document.querySelector('#composer-model').value === '[\"fixture\",\"model\"]'"), "other session retains its model");
  assert.equal(await evaluate("document.querySelectorAll('.composer__attachment').length"), 0);
  await evaluate("document.querySelectorAll('.sidebar-session .session-item')[1].click()");
  await until(() => evaluate("document.querySelector('.composer__file-name')?.textContent === 'Tệp tiếp theo.txt'"), "file draft stays with source session");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), "Nháp mới giữ sau ACK.");
  assert.equal(await composerFits(), true); assert.equal(await fits(), true);
  await capture("composer-final-980px.png");
  checks.push("file-only send carries exact bytes without paths; pending ACK preserves new text/files; one stop action and per-session model/file drafts fit 980px");

  const sendsBeforeWorkbench = counts["sessions.send"];
  const workbenchDraft = await evaluate("document.querySelector('#composer-input').value");
  await until(() => evaluate("Boolean(document.querySelector('#composer-thinking:not(:disabled)'))"), "native reasoning levels available");
  assert.equal(await evaluate("document.querySelector('#composer-thinking').value"), "high", "per-session reasoning selection survives switches");
  const thinkingPatchCount = counts["sessions.patch"];
  await select("#composer-thinking", "");
  await until(() => evaluate("document.querySelector('#composer-thinking').value === ''"), "automatic choice restored locally");
  assert.equal(counts["sessions.patch"], thinkingPatchCount);
  await select("#composer-thinking", "high");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), workbenchDraft);
  assert.equal(await composerFits(), true);
  checks.push("native reasoning options select per-session RAM preference; high is sent only with the next user send, auto clears override, no admin patch or draft loss");

  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.sidebar-navigation button')).map(button => button.getAttribute('aria-label') || button.textContent.trim())"),
    ["Phiên mới", "Dự án", "Thống kê sử dụng", "Kỹ năng", "Nhắn tin", "Tác vụ định kỳ"]);
  await fill(".sidebar-search input", "thử 1");
  assert.equal(await evaluate("document.querySelectorAll('.sidebar-session').length"), 1);
  await fill(".sidebar-search input", "");
  const selectedBeforeMenu = await evaluate("document.querySelector('.session-tabs [aria-selected=true]').id");
  await openConversationMenu(sessions[0].key);
  await until(() => evaluate("document.activeElement?.textContent.trim() === 'Đổi tên'"), 'menu first item focus');
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#conversation-menu button')).map(button => button.textContent.trim())"), ['Đổi tên', 'Ghim', 'Xóa cuộc trò chuyện']);
  await menuKey('ArrowDown'); assert.equal(await evaluate("document.activeElement?.textContent.trim()"), 'Ghim');
  await menuKey('End'); assert.equal(await evaluate("document.activeElement?.textContent.trim()"), 'Xóa cuộc trò chuyện');
  await menuKey('Home'); assert.equal(await evaluate("document.activeElement?.textContent.trim()"), 'Đổi tên');
  await capture('conversation-menu-980px.png');
  await menuKey('Escape'); await until(() => evaluate("!document.querySelector('#conversation-menu')"), 'Escape closes menu');
  assert.equal(await evaluate(`document.activeElement === document.querySelector('.sidebar-session[data-session-key="${sessions[0].key}"] .sidebar-session__more')`), true);
  await openConversationMenu(sessions[0].key, 'keyboard'); await menuKey('Escape');
  assert.equal(await evaluate(`document.activeElement === document.querySelector('.sidebar-session[data-session-key="${sessions[0].key}"] .session-item')`), true, 'keyboard context returns to its row');
  await openConversationMenu(sessions[0].key, 'right-click');
  assert.equal(await evaluate("(() => {const rect = document.querySelector('#conversation-menu').getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;})()"), true, 'context menu fits viewport');
  await evaluate("document.querySelector('#composer-input').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}))");
  await until(() => evaluate("!document.querySelector('#conversation-menu')"), 'outside pointer closes menu');
  assert.equal(await evaluate("document.querySelector('.session-tabs [aria-selected=true]').id"), selectedBeforeMenu, 'menus on another row never open that conversation');
  assert.equal(await evaluate("document.querySelectorAll('.sidebar-session__rename, .sidebar-session__pin').length"), 0, 'no separate confusing pencil or pin action button');
  const pinsBefore = counts["sessions.patch"];
  await evaluate(`document.querySelector('.sidebar-session[data-session-key="${siblingKey}"] .session-item').dispatchEvent(new MouseEvent('click', {bubbles:true,shiftKey:true}))`);
  await until(() => evaluate(`document.querySelector('.sidebar-section[aria-label="Đã ghim"] .sidebar-session')?.dataset.sessionKey === ${JSON.stringify(siblingKey)}`), "Shift click pins through native patch");
  assert.equal(counts["sessions.patch"], pinsBefore + 1);
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), workbenchDraft);
  await openConversationMenu(siblingKey, 'right-click'); await click('Bỏ ghim');
  await until(() => evaluate("document.querySelectorAll('.sidebar-section[aria-label=\"Đã ghim\"] .sidebar-session').length === 0"), "context menu unpins through native patch");
  assert.equal(sessions[1].pinned, false);
  deferPin = true; await openConversationMenu(siblingKey); await click('Ghim');
  await until(() => Promise.resolve(Boolean(pendingPin)), 'pin waits for backend ACK');
  await hasText('Đang cập nhật ghim');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.sidebar-session__more')).every(button => button.disabled)"), true);
  assert.equal(sessions[1].pinned, false, 'pin does not move optimistically before ACK');
  pendingPin(); await until(() => evaluate(`Boolean(document.querySelector('.sidebar-section[aria-label="Đã ghim"] .sidebar-session[data-session-key="${siblingKey}"]'))`), 'pin readback moves row');
  await openConversationMenu(siblingKey, 'keyboard'); await click('Bỏ ghim');
  await until(() => evaluate("document.querySelectorAll('.sidebar-section[aria-label=\"Đã ghim\"] .sidebar-session').length === 0"), 'keyboard context unpins');
  assert.equal(counts['sessions.patch'], pinsBefore + 4);
  assert.equal(await evaluate("document.querySelector('.session-tabs [aria-selected=true]').id"), selectedBeforeMenu);
  checks.push('real DOM ellipsis/right-click/keyboard menu; proper edit/pin/unpin/trash roles, focus return, viewport fit/outside close, deferred pin ACK and no unintended conversation selection');
  await evaluate("document.querySelector('.session-tabs [aria-selected=true]').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowLeft',bubbles:true}))");
  await until(() => evaluate("document.querySelector('#composer-input').value === 'Nháp còn sau khi dừng.'"), "keyboard tab changes source session");
  await evaluate("document.querySelector('.session-tabs [aria-selected=true]').dispatchEvent(new KeyboardEvent('keydown', {key:'End',bubbles:true}))");
  await until(() => evaluate(`document.querySelector('#composer-input').value === ${JSON.stringify(workbenchDraft)}`), "End restores second session draft");
  await clickSelector(".session-tab--active .session-tab__close");
  await until(() => evaluate("document.querySelectorAll('.session-tabs [role=tab]').length === 1"), "close removes one tab only");
  assert.equal(sessions.length, 2); assert.equal(histories.has(siblingKey), true);
  await selectSession(1);
  await until(() => evaluate(`document.querySelector('#composer-input').value === ${JSON.stringify(workbenchDraft)}`), "reopening closed tab restores RAM draft and file");
  assert.equal(await evaluate("document.querySelector('.composer__file-name').textContent"), "Tệp tiếp theo.txt");
  checks.push("reference menu order; local search; native pin/unpin; keyboard session tabs and close/reopen preserve source history, text and file drafts");

  await click("Dự án");
  await until(() => evaluate("document.querySelector('.native-page h1')?.textContent === 'Dự án'"), "native project page");
  await hasText("Dự án mô phỏng"); await click("Mở dự án"); await click("＋ Chat trong dự án");
  await until(() => Promise.resolve(sessions.length === 3), "create in chosen native project");
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), "project session ready");
  assert.equal(sessions[2].projectId, projects[0].id);
  assert.ok(sessions[2].key.startsWith(`agent:${projects[0].agentId}:`), "chosen project's native agent owns the created session");
  await until(() => evaluate(`Boolean(document.querySelector('.sidebar-project[data-project-id="fixture-project"] .sidebar-session[data-session-key="${sessions[2].key}"]'))`), "refreshed session catalogue groups native project session");
  await selectSession(1);
  await until(() => evaluate(`document.querySelector('#composer-input').value === ${JSON.stringify(workbenchDraft)}`), "project flow leaves previous draft intact");
  checks.push("projects are native records; creating within a project sends its exact project id and agent id, groups the session and preserves previous drafts");

  await click("Tệp");
  await until(() => evaluate("document.querySelectorAll('.workspace__dock .file-entry').length === 4"), "session file root listed");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.workspace__dock .file-entry')).filter(button => button.disabled).length"), 2, "symlink and missing entries cannot open");
  await clickFile("Thư mục thử");
  await until(() => evaluate("document.querySelector('.workspace__dock .files-path')?.textContent === 'thu-muc'"), "native child directory");
  await clickFile("Ghi chú con.txt");
  await until(() => evaluate("Boolean(document.querySelector('.workspace__dock .file-preview pre'))"), "text file preview");
  assert.equal(await evaluate("Boolean(globalThis.fixtureInjected)"), false);
  assert.ok((await evaluate("document.querySelector('.workspace__dock .file-preview pre').textContent")).includes("<script>"));
  await click("Lên một thư mục");
  await fill(".workspace__dock input[aria-label='Tìm tệp trong phiên']", "Báo cáo"); await click("Tìm");
  await until(() => evaluate("document.querySelectorAll('.workspace__dock .file-entry').length === 1"), "native file search");
  await clickFile("Báo cáo thử.txt"); await until(() => evaluate("Boolean(document.querySelector('.workspace__dock .file-preview'))"), "chosen report preview");
  await capture("files-980px.png");
  deferFile = true; await clickFile("Báo cáo thử.txt");
  await until(() => Promise.resolve(Boolean(pendingFile)), "deferred file fetch");
  await selectSession(0); pendingFile.resolve(pendingFile.response); pendingFile = null; deferFile = false;
  await until(() => evaluate("document.querySelector('#composer-input')?.value === 'Nháp còn sau khi dừng.'"), "session switched during file preview");
  await wait(80);
  assert.equal(await evaluate("Boolean(document.querySelector('.workspace__dock .file-preview'))"), false, "old file reply cannot populate another session");
  deferFile = true; await clickFile("Báo cáo thử.txt");
  await until(() => Promise.resolve(Boolean(pendingFile)), "deferred file before disconnect");
  pushStatus({ supervisor: "starting", connected: false, setupReady: false, detail: "setup-reconnecting" });
  await hasText("Kết nối bộ chạy để xem tệp.");
  pendingFile.resolve(pendingFile.response); pendingFile = null; deferFile = false;
  await wait(80); assert.equal(await evaluate("Boolean(document.querySelector('.workspace__dock .file-preview'))"), false);
  pushStatus({ supervisor: "ready", connected: true, setupReady: true, detail: null });
  await until(() => evaluate("Boolean(document.querySelector('.workspace__dock .file-entry'))"), "reconnected file browser reloads truth");
  await selectSession(1);
  await until(() => evaluate(`document.querySelector('#composer-input').value === ${JSON.stringify(workbenchDraft)}`), "draft restored after file disconnect");
  checks.push("native file tree, child/back/search and inert text preview; missing/symlink unavailable; late get replies fenced after session switch and disconnect");

  await click("Thống kê sử dụng");
  await hasText("9.876"); await hasText("Chi phí ghi nhận, USD");
  assert.equal(publicRequests.filter(request => request.method === "usage.status").length, 0, "local usage never probes provider limits");
  await click("Kỹ năng"); await hasText("Soạn nội dung thử"); await hasText("Kỹ năng chưa bật");
  await fill("input[aria-label='Lọc kỹ năng']", "chưa bật");
  assert.equal(await evaluate("document.querySelectorAll('.native-page .native-list li').length"), 1);
  await fill("input[aria-label='Lọc kỹ năng']", "Soạn nội dung");
  await click("Tắt kỹ năng"); await until(() => Promise.resolve(skillDisabled), "native skill toggle fixture");
  await hasText("Đang tắt"); await click("Bật kỹ năng"); await until(() => Promise.resolve(!skillDisabled), "enable skill fixture");
  await click("Dùng trong chat");
  await until(() => evaluate("document.querySelector('#composer-input')?.value.includes('Dùng kỹ năng Soạn nội dung thử')"), "skill is inserted into draft without sending");
  await fill("#composer-input", workbenchDraft);
  await click("Kỹ năng"); await hasText("Soạn nội dung thử"); await capture("skills-980px.png");
  await click("Nhắn tin"); await hasText("Kênh mô phỏng"); await hasText("Chưa thiết lập");
  await hasText("Telegram"); await capture("channels-980px.png");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.capability-panel .native-list > li > div > strong [data-brand]')).slice(0,5).map(node=>node.dataset.brand)"), ['telegram', 'zalo', 'whatsapp', 'discord', 'googlechat']);
  for (const id of ['telegram', 'zalo', 'whatsapp', 'discord', 'googlechat']) {
    assert.equal(await evaluate(`Boolean(document.querySelector('.capability-panel [data-brand="${id}"]:not(.brand-icon--initials)'))`), true, `${id} uses its channel brand icon`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.capability-panel [data-brand="${id}"]')).getPropertyValue('--brand-mask').includes('url(')`), true);
  }
  assert.equal(await evaluate("Boolean(document.querySelector('.capability-panel [data-brand=telegram]:not(.brand-icon--initials)'))"), true, 'Telegram has its own bundled brand asset');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.capability-panel [data-brand=telegram]')).getPropertyValue('--brand-mask').includes('url(')"), true);
  await click("Thiết lập Telegram"); await hasText("Hướng dẫn Telegram mô phỏng"); await click("Tiếp tục");
  await hasText("Nhập token bot mô phỏng");
  assert.equal(await evaluate("document.querySelector('input[aria-label=\"Câu trả lời thiết lập\"]').type"), "password");
  await fill("input[aria-label='Câu trả lời thiết lập']", "fixture-not-a-token"); await click("Tiếp tục");
  await hasText("Đã thiết lập"); await click("Khởi động kênh"); await hasText("Đang chạy"); await click("Dừng kênh");
  await click('Duyệt người nhắn'); await hasText('Người thử ghép đôi');
  await click('Cho phép'); await hasText('Chưa xác nhận thay đổi. Yêu cầu vẫn được giữ trong danh sách.');
  assert.equal(await evaluate("document.querySelectorAll('.channel-access-row').length"), 1, 'negative pairing readback keeps pending sender visible');
  pairingAccepted = true; await click('Bỏ qua');
  await until(() => evaluate("document.querySelectorAll('.channel-access-row').length === 0"), 'positive native pairing receipt removes exact request');
  await clickSelector('.capability-form[aria-label="Duyệt người được phép nhắn"] > button');
  checks.push("native skill toggle/readback and draft insertion; five priority channel brand icons; Telegram sensitive wizard/account start-stop; negative pairing readback retains request until positive exact acknowledgement");
  const cancellationsBeforeRestart = counts['management.channel-cancel'] ?? 0;
  await evaluate("globalThis.__fixtureChannelPanel = document.querySelector('.capability-panel[aria-label=\"Kết nối kênh chat\"]')");
  await click('Thiết lập Zalo'); await until(() => Promise.resolve(Boolean(pendingChannelRestart)), 'first channel setup waits for planned native restart');
  await hasText('Đang chờ kết nối lại. Thiết lập đang mở vẫn được giữ.');
  assert.equal(await evaluate("document.querySelector('.capability-panel[aria-label=\"Kết nối kênh chat\"]') === globalThis.__fixtureChannelPanel"), true, 'planned restart does not unmount pending channel setup');
  assert.equal(counts['management.channel-cancel'] ?? 0, cancellationsBeforeRestart);
  pendingChannelRestart(); await hasText('Hướng dẫn Zalo sau khởi động lại mô phỏng');
  assert.equal(await evaluate("document.querySelector('.capability-panel[aria-label=\"Kết nối kênh chat\"]') === globalThis.__fixtureChannelPanel"), true);
  assert.equal(counts['management.channel-cancel'] ?? 0, cancellationsBeforeRestart, 'first wizard response survives reconnect without an automatic cancellation');
  await capture('channel-planned-restart-980px.png');
  await click('Tiếp tục'); await until(() => Promise.resolve(Boolean(pendingChannelPoll)), 'native wizard progress is polled without user input');
  pushStatus({ connected: false, setupReady: false, supervisor: 'restarting', detail: 'startup-preparing' });
  await hasText('Đang chờ kết nối lại. Thiết lập đang mở vẫn được giữ.');
  await click('Hủy thiết lập'); await until(() => Promise.resolve(!managementWizard), 'user explicitly cancels the retained channel wizard');
  await until(() => evaluate("!document.querySelector('.capability-form[aria-label=\"Thiết lập Zalo\"]')"), 'channel cancellation closes only after native acknowledgement');
  const pollsAtCancel = counts['management.channel-next']; pendingChannelPoll();
  pushStatus({ connected: true, setupReady: true, supervisor: 'ready', detail: null }); await wait(850);
  assert.equal(await evaluate("Boolean(document.querySelector('.capability-form[aria-label=\"Thiết lập Zalo\"]'))"), false, 'late response after exact cancellation cannot reopen wizard');
  assert.equal(counts['management.channel-next'], pollsAtCancel, 'cancelled old wizard cannot resume polling after reconnect');
  assert.equal(managementRequests.filter(packet => packet.action === 'channel-cancel').at(-1).sessionId, 'channel-restart-fixture');
  checks.push('first optional-channel setup preserves actual ChannelPanel through planned disconnect/reconnect; progress auto-polls; explicit cancellation during pending poll/offline uses exact session and ignores late reply without resuming');
  await click('Thiết lập Google Chat'); await hasText('Tên tài khoản trong ứng dụng');
  await click('Tiếp tục'); await click('Dán JSON tài khoản dịch vụ');
  await until(() => evaluate("Boolean(document.querySelector('textarea.channel-secret-input'))"), 'multiline Google secret form');
  const syntheticServiceAccount = JSON.stringify({ type: 'service_account', client_id: '123456789012345678901', client_email: 'fixture@fixture.invalid', private_key: '-----BEGIN ' + 'PRIVATE KEY-----\nsynthetic-private-key-never-used\n-----END PRIVATE KEY-----', token_uri: 'https://oauth2.googleapis.com/token' }, null, 2);
  await fill('textarea.channel-secret-input', syntheticServiceAccount);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('textarea.channel-secret-input')).webkitTextSecurity"), 'disc');
  assert.equal(await evaluate("document.querySelector('textarea.channel-secret-input').value"), syntheticServiceAccount);
  assert.equal(await evaluate("document.querySelector('textarea.channel-secret-input').maxLength"), 65536);
  await click('Hiện nội dung'); assert.equal(await evaluate("getComputedStyle(document.querySelector('textarea.channel-secret-input')).webkitTextSecurity"), 'none');
  await click('Ẩn nội dung'); await capture('channel-google-json-masked-980px.png');
  await click('Tiếp tục'); await click('Địa chỉ ứng dụng (khuyên dùng)');
  await until(() => evaluate("Boolean(document.querySelector('input[aria-label=\"Câu trả lời thiết lập\"]'))"), 'Google audience input');
  await fill('input[aria-label="Câu trả lời thiết lập"]', 'https://fixture.invalid/google-chat'); await click('Tiếp tục');
  await hasText('Địa chỉ HTTPS công khai nhận tin nhắn'); await click('Tiếp tục');
  await hasText('Kênh hiện đang tắt: hành động này cũng bật lại kênh');
  assert.equal((await text()).includes('synthetic-private-key-never-used'), false, 'confirm must not echo credential');
  assert.equal(channelConfigRequests.filter(request => request.method === 'config.patch').length, 0, 'form description alone never writes');
  await capture('channel-google-confirm-980px.png'); await click('Lưu và bật tài khoản');
  await until(() => Promise.resolve(Boolean(pendingChannelConfigCommit)), 'save waits for native config acknowledgement');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.capability-form button')).find(button=>button.textContent==='Lưu và bật tài khoản').disabled"), true);
  await hasText('Đang lưu tài khoản và kiểm tra kết quả…');
  const cancellationsBeforeConfigCommit = counts['management.channel-cancel'] ?? 0;
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.capability-form button')).some(button=>button.textContent.trim().includes('Hủy thiết lập')&&!button.disabled)"), false, 'confirmed config commit cannot discard its pending readback through cancellation');
  await evaluate("Array.from(document.querySelectorAll('.capability-form button')).find(button=>button.textContent==='Hủy thiết lập')?.click()");
  assert.equal(counts['management.channel-cancel'] ?? 0, cancellationsBeforeConfigCommit);
  assert.equal((await text()).includes('Đã lưu thiết lập.'), false, 'pending native save cannot claim success');
  pendingChannelConfigCommit(); await hasText('Đã lưu thiết lập. Kiểm tra trạng thái tài khoản bên dưới.');
  assert.equal(channelConfigRequests.filter(request => request.method === 'config.patch').length, 1);
  assert.deepEqual(channelConfig.models, initialChannelConfig.models); assert.deepEqual(channelConfig.channels.googlechat.accounts.other, initialChannelConfig.channels.googlechat.accounts.other);
  assert.equal(channelConfig.channels.googlechat.dmPolicy, 'pairing'); assert.equal(channelConfig.channels.googlechat.enabled, true);
  assert.equal(channelConfig.channels.googlechat.accounts.default.serviceAccount, syntheticServiceAccount);
  assert.equal(channelConfig.channels.googlechat.accounts.default.appPrincipal, '123456789012345678901');
  assert.equal(counts['sessions.send'], sendsBeforeWorkbench, 'channel credentials never enter a model request');
  checks.push('actual compatibility form with synthetic native config: masked multiline Google JSON retains newlines, explicit save waits for ACK/applied revision, preserves other configuration/accounts and never sends credentials to a model');
  const whatsappQrStarts = counts['management.channel-qr-start'] ?? 0;
  await click('Thiết lập WhatsApp'); await hasText('Tên tài khoản trong ứng dụng');
  await fill('input[aria-label="Câu trả lời thiết lập"]', 'whatsapp-fixture'); await click('Tiếp tục'); await hasText('Lưu và bật tài khoản');
  assert.equal(await evaluate("Boolean(document.querySelector('.capability-form input[type=password],.capability-form textarea'))"), false, 'WhatsApp account creation never asks for credentials');
  await click('Lưu và bật tài khoản'); await until(() => Promise.resolve(Boolean(pendingChannelConfigCommit)), 'WhatsApp account waits for native persistence');
  assert.equal(counts['management.channel-qr-start'] ?? 0, whatsappQrStarts, 'QR waits for verified account creation');
  pendingChannelConfigCommit(); await hasText('Mã mô phỏng, không dùng để liên kết.');
  await until(() => evaluate("document.querySelector('.channel-qr img')?.complete && document.querySelector('.channel-qr img')?.naturalWidth > 0"), 'synthetic QR image actually renders');
  assert.equal((await text()).includes('WhatsApp đã liên kết.'), false, 'account creation does not mean the phone is paired');
  assert.equal(counts['management.channel-qr-start'], whatsappQrStarts + 1);
  await until(() => Promise.resolve(Boolean(pendingWhatsAppQr)), 'first WhatsApp QR waits for phone');
  await capture('channel-whatsapp-qr-980px.png');
  const staleQr = pendingWhatsAppQr; pendingWhatsAppQr = null;
  await click('Đóng mã QR'); await hasText('Quét mã QR để liên kết điện thoại với tài khoản này.');
  assert.equal(await evaluate("Boolean(document.querySelector('.channel-qr'))"), false);
  await click('Liên kết bằng QR'); await hasText('Mã mô phỏng, không dùng để liên kết.');
  assert.equal(counts['management.channel-qr-start'], whatsappQrStarts + 2, 'unpaired account remains eligible for QR');
  staleQr(); whatsappLinked = false; await wait(50);
  assert.equal((await text()).includes('WhatsApp đã liên kết.'), false, 'closed QR cannot report a late paired result');
  await until(() => Promise.resolve(Boolean(pendingWhatsAppQr)), 'current QR waits separately'); pendingWhatsAppQr();
  await hasText('WhatsApp đã liên kết.'); await hasText('Đã kết nối');
  assert.equal(await evaluate("Boolean(document.querySelector('.channel-qr'))"), false);
  assert.deepEqual(channelConfig.channels.whatsapp.accounts['whatsapp-fixture'], { enabled: true });
  assert.deepEqual(channelConfig.channels.whatsapp.accounts.other, initialChannelConfig.channels.whatsapp.accounts.other);
  assert.equal(counts['sessions.send'], sendsBeforeWorkbench);
  checks.push('actual WhatsApp account form uses only id/confirmation; verified creation opens simulated QR without claiming pairing; an unpaired account can relink, a closed QR ignores late completion and only current connected readback reports linked');
  await click("Tác vụ định kỳ"); await hasText("Lịch mô phỏng trang một");
  const createsBefore = managementRequests.filter(p => p.action === "cron-create").length;
  await click("Lập ba ưu tiên trong ngày");
  assert.equal(managementRequests.filter(p => p.action === "cron-create").length, createsBefore);
  await capture("schedule-form-980px.png");
  await click("Lưu lịch đang tắt"); await hasText("Lịch của anh");
  await until(() => evaluate("document.querySelector('.capability-panel .native-list')?.textContent.includes('Lập ba ưu tiên trong ngày')"), 'saved schedule appears with the chosen name');
  await click("Bật lịch"); await hasText("Tạm dừng"); await click("Tạm dừng"); await hasText("Bật lịch");
  await click("Sửa"); await hasText("Sửa tác vụ"); await click("Lưu lịch đang tắt");
  await click("Xóa"); await until(() => evaluate("Boolean(document.querySelector('[aria-label=\"Xác nhận xóa lịch\"]'))"), "delete confirmation"); await click("Giữ lại");
  assert.ok(managedJob); await click("Xóa"); await click("Xóa lịch này"); await until(() => Promise.resolve(!managedJob), "native schedule removal fixture");
  await until(() => evaluate("!document.querySelector('.capability-panel .native-list') && !document.body.innerText.includes('Đang đọc dữ liệu…')"), 'schedule removal refreshed in renderer');
  await click("Xem lịch sử"); await hasText("Lượt chạy được ghi nhận mô phỏng.");
  checks.push("schedule suggestions do not create until save; disabled creation, edit, enable/pause and confirmed removal fixture");
  await click("Trang tiếp"); await hasText("Lịch mô phỏng trang hai");
  assert.equal(await evaluate("Boolean(document.querySelector('.cron-history'))"), false, "new page clears old job history");
  await clickSelector('#files-tab'); await click('Kết quả');
  await until(() => evaluate("document.querySelectorAll('.workspace__dock .file-entry').length === 1"), "only native modified files shown as artifacts");
  await click('Tất cả');
  await click("Cài đặt"); await click("Trò chuyện"); await hasText("Ngôn ngữ: Tiếng Việt");
  assert.equal(await evaluate("Boolean(document.querySelector('.settings-dialog[open]'))"), true);
  await click('Đóng cài đặt');
  await selectSession(1);
  await until(() => evaluate(`document.querySelector('#composer-input').value === ${JSON.stringify(workbenchDraft)}`), "read pages preserve selected conversation draft");
  checks.push("native local usage, skill filtering, channel status without probe, cron status/history/pagination, modified artifacts and honest settings are read-only");

  const presentation = "## Kết quả mô phỏng\n\n**Ghi chú quan trọng**\n\n| Việc | Người phụ trách |\n| --- | --- |\n| Chuẩn bị | Nhóm thử |\n\n- Bước thứ nhất\n- Bước thứ hai\n\n```txt\n<script>globalThis.fixtureInjected=true</script>\n```";
  const renderedMessage = { role: "assistant", content: presentation, __openclaw: { id: "fixture-format", seq: 99 } };
  histories.get(siblingKey).push(renderedMessage);
  window.webContents.send("aifb:gateway-event", { event: "session.message", payload: { sessionKey: siblingKey, messageId: "fixture-format", messageSeq: 99, message: renderedMessage } });
  await until(() => evaluate("Boolean(document.querySelector('.transcript .message-content__table'))"), "formatted native transcript");
  assert.equal(await evaluate("Boolean(globalThis.fixtureInjected)"), false);
  assert.equal(await evaluate("document.querySelector('.message-content__table tbody td').textContent"), "Chuẩn bị");
  await evaluate("document.querySelector('.work-templates[open] summary')?.click()");
  await click("Thu gọn thanh bên");
  await until(() => evaluate("document.querySelector('.workspace').classList.contains('workspace--left-hidden')"), "collapse left rail");
  await click("Mở thanh bên"); await click("Thu gọn bảng bên phải");
  await until(() => evaluate("document.querySelector('.workspace').classList.contains('workspace--right-hidden')"), "collapse right dock");
  await click("Mở bảng bên phải");
  assert.equal(await fits(), true); assert.equal(await composerFits(), true);
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.workspace')).gridTemplateColumns.split(' ')[0]"), "230px");
  await capture("viewport-check-980px.png"); assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight"), true, await evaluate("JSON.stringify({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,overflow:Array.from(document.querySelectorAll('body *')).filter(n=>n.getBoundingClientRect().bottom>innerHeight+1).slice(-12).map(n=>({tag:n.tagName,cls:n.className,bottom:n.getBoundingClientRect().bottom}))})"));
  await capture("workbench-final-980px.png");
  window.setContentSize(1440, 851); await wait(80);
  assert.equal(await fits(), true);
  await capture("workbench-final-1440px.png");
  assert.equal(counts["sessions.send"], sendsBeforeWorkbench, "all workbench controls above never send chat");
  assert.equal(advisorRequests.length, 0, "read-only workbench never invokes Advisor");
  assert.ok(publicRequests.every(request => !/^(?:cron\.(?:add|update|remove|run)|send|channels\.logout|skills\.(?:install|update))$|^(?:exec|browser)\./.test(request.method)));
  checks.push("native answer headings/bold/lists/table/code stay inert; panels collapse/restore, compact composer and full shell fit 980px and reference 1440px without unintended work");
  assert.equal(networkAttempts, 0);
  await openConversationMenu(siblingKey); await click('Đổi tên');
  await fill(".session-rename input", "Kế hoạch đổi tên thử");
  await click("Hủy");
  assert.notEqual(sessions[1].label, "Kế hoạch đổi tên thử");
  await openConversationMenu(siblingKey, 'right-click'); await click('Đổi tên');
  await fill(".session-rename input", "Kế hoạch đổi tên thử");
  await click("Lưu tên"); await until(() => evaluate("!document.querySelector('.session-rename')"), "rename readback closes form");
  await until(() => evaluate("document.querySelector('.session-tabs [aria-selected=true]').textContent.includes('Kế hoạch đổi tên thử')"), "manual title reaches active tab");
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), workbenchDraft);
  await clickSelector("#composer-model");
  await until(() => evaluate("document.activeElement?.getAttribute('aria-label') === 'Tìm mô hình'"), 'model search gets focus');
  await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("document.activeElement === document.querySelector('[role=menuitemradio]')"), true, 'ArrowDown moves to first model');
  await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("document.activeElement === document.querySelectorAll('[role=menuitemradio]')[1]"), true, 'ArrowDown moves to next model');
  await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("document.activeElement === document.querySelector('[role=menuitemradio]')"), true, 'ArrowUp moves to previous model');
  await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true,cancelable:true}))");
  assert.equal(await evaluate("document.querySelector('#composer-model').getAttribute('aria-expanded')"), "false");
  assert.equal(await evaluate("document.activeElement === document.querySelector('#composer-model')"), true, 'Escape returns focus to model trigger');
  await chooseFile("Bản tóm tắt.txt", "Tệp ở trên lời nhắn.");
  await until(() => evaluate("document.querySelector('.composer__attachment')?.textContent.includes('Sẵn sàng gửi')"), "file ready above text");
  assert.equal(await evaluate("document.querySelector('.composer__attachments').getBoundingClientRect().bottom <= document.querySelector('#composer-input').getBoundingClientRect().top"), true);
  await capture("composer-order-1440px.png");
  const { fixturePdf, fixtureDocx } = await import(pathToFileURL(path.join(root, "scripts/fixture-documents.mjs")));
  const documents = [{ name: "Báo cáo.pdf", type: "application/pdf", data: fixturePdf("Synthetic PDF fixture").toString("base64") },
    { name: "Kế hoạch.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", data: fixtureDocx("Synthetic DOCX fixture").toString("base64") }];
  await evaluate(`(() => { const transfer = new DataTransfer(); for (const file of ${JSON.stringify(documents)}) {
    transfer.items.add(new File([Uint8Array.from(atob(file.data), c => c.charCodeAt(0))], file.name, {type:file.type}));
  } const input = document.querySelector('#composer-files'); input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(() => evaluate("document.querySelectorAll('.composer__attachment--ready').length === 4"), "PDF and DOCX accepted in picker");
  await hasText("Đã đọc văn bản và bảng");
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.composer__attachment')).find(node=>node.textContent.includes('Kế hoạch.docx')).textContent.includes('lõi hiện chưa tự đọc nội dung Office')"), false);
  window.setContentSize(980, 720); await wait(80);
  assert.equal(await fits(), true); assert.equal(await composerFits(), true);
  assert.equal(await evaluate("document.querySelector('.composer__attachments').clientHeight <= 144 && document.querySelector('.composer__attachments').scrollHeight > document.querySelector('.composer__attachments').clientHeight"), true, 'four attachments scroll inside a bounded list above textarea');
  await evaluate("document.querySelector('.composer__attachments').scrollTop = document.querySelector('.composer__attachments').scrollHeight");
  await capture("composer-documents-980px.png");
  await clickSelector('.composer__remove');
  const { fixtureZip } = await import(pathToFileURL(path.join(root, 'scripts/fixture-documents.mjs')));
  const zipData = fixtureZip({ 'notes.txt': 'Synthetic ZIP content' }).toString('base64');
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(${JSON.stringify(zipData)}), c => c.charCodeAt(0))], 'Tai-lieu.zip', {type:'application/x-zip-compressed'})); const input = document.querySelector('#composer-files'); input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(() => evaluate("document.querySelectorAll('.composer__attachment--ready').length === 4"), 'ZIP accepted without changing selection limit');
  await hasText('chưa tự giải nén hoặc đọc các tệp bên trong');
  assert.equal(await composerFits(), true); await capture('composer-zip-980px.png');
  checks.push('ZIP accepted with Windows MIME and clear extraction limitation, within four-file limit');
  checks.push("manual rename cancel/save native readback reaches sidebar/tab without draft loss; model popover search/Escape; attachment before text in DOM and screen");
  await click('Dự án'); await click('＋ Tạo dự án');
  await fill('.project-form input', 'Kế hoạch kinh doanh'); await click('Chọn nơi lưu và tạo');
  await until(() => evaluate("document.querySelector('.project-page h1')?.textContent === 'Kế hoạch kinh doanh'"), 'folder project created and selected');
  await hasText('C:/Synthetic/Ke hoach'); await click('＋ Chat trong dự án');
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), 'folder project chat');
  const projectKey = sessions.at(-1).key;
  assert.equal(projectBindings[projectKey], 'aifb:fixture-project');
  await clickSelector('.agents-control summary'); await click('Tạo và quản lý agents');
  assert.equal(await evaluate("Boolean(document.querySelector('.project-form .agent-icons'))"), true);
  await fill('#agent-name', 'Chuyên viên kế hoạch'); await fill('#agent-role', 'Phân tích và lập kế hoạch theo dữ liệu đã cung cấp.');
  await fill('#agent-goal', 'Tạo ba ưu tiên có thể thực hiện.'); await select('#agent-model', 'fixture/model');
  await click('Biểu tượng Mục tiêu'); assert.equal(await evaluate("document.querySelector('.agent-icons').scrollWidth <= document.querySelector('.agent-icons').clientWidth"), true); await capture('agent-create-980px.png'); await click('Tạo agent'); await until(() => Promise.resolve(fixtureAgents.length === 1), 'agent created');
  assert.equal(fixtureAgents[0].identity.emoji, '🎯'); await click('Dùng agent'); await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), 'agent project session');
  await until(() => evaluate("document.querySelector('.agents-control summary').textContent.includes('🎯')"), 'current agent icon');
  assert.ok((await evaluate("document.querySelector('.agents-control summary').textContent")).includes(fixtureAgents[0].name));
  await evaluate("document.querySelector('.agents-control summary').click()");
  await until(() => evaluate("document.querySelector('.agents-control').open"), 'agent menu opened');
  await evaluate("document.querySelector('#composer-input').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}))");
  assert.equal(await evaluate("document.querySelector('.agents-control').open"), false);
  assert.equal(await evaluate("document.body.innerText.includes('Chụp màn hình')"), false);
  await evaluate("(() => { const d = new DataTransfer(); d.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII='), c => c.charCodeAt(0))], 'pasted.png', {type:'image/png'})); document.querySelector('#composer-input').dispatchEvent(new ClipboardEvent('paste', {bubbles:true, clipboardData:d})); })()");
  await until(() => evaluate("Boolean(document.querySelector('.composer__attachment--ready'))"), 'pasted image enters draft');
  await evaluate("document.querySelector('.composer__remove').click()");
  await until(() => evaluate("!document.querySelector('.composer__attachment')"), 'pasted image removed');
  assert.ok(sessions.at(-1).key.startsWith('agent:fixture-planner:'));
  assert.equal(projectBindings[sessions.at(-1).key], 'aifb:fixture-project');
  await evaluate(`(() => { const file=${JSON.stringify(documents[1])}; const transfer=new DataTransfer(); transfer.items.add(new File([Uint8Array.from(atob(file.data), c=>c.charCodeAt(0))], file.name, {type:file.type})); const input=document.querySelector('#composer-files'); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await until(() => evaluate("Boolean(document.querySelector('.composer__attachment--ready'))"), 'generated Word ready for local Stop checks');
  for (const advisor of [false, true]) {
    if (advisor) await clickSelector('[role="switch"][aria-label="Bật giám sát tự động"]');
    await fill('#composer-input', 'Giữ Word khi dừng trước khi gửi.');
    const sends = counts['sessions.send'] ?? 0, supervised = counts['advisor.supervise'] ?? 0;
    const aborts = counts['chat.abort'] ?? 0, cancels = counts['advisor.supervision-cancel'] ?? 0;
    deferProjectSave = true; await click('Gửi');
    await until(() => Promise.resolve(Boolean(pendingProjectSave)), 'project save awaits completion before dispatch');
    assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark--active'))"), false, 'local project save is not model activity');
    await openThinkingDock();
    if (advisor) await hasText('Đang chuẩn bị yêu cầu');
    await clickSelector('.thinking-view__stop');
    await until(() => evaluate("!document.querySelector('.thinking-view__stop')"), 'local Stop settles from Thinking before native dispatch');
    await click('Thu gọn Thinking');
    await until(() => evaluate("document.querySelector('.composer__primary').textContent === 'Gửi' && !document.querySelector('.composer__primary').disabled"), 'local Stop immediately returns editable send state');
    pendingProjectSave(); await wait(100);
    assert.equal(counts['sessions.send'] ?? 0, sends); assert.equal(counts['advisor.supervise'] ?? 0, supervised);
    assert.equal(counts['chat.abort'] ?? 0, aborts); assert.equal(counts['advisor.supervision-cancel'] ?? 0, cancels);
    assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Giữ Word khi dừng trước khi gửi.');
    assert.equal(await evaluate("document.querySelectorAll('.composer__attachment--ready').length"), 1);
  }
  await clickSelector('[role="switch"][aria-label="Bật giám sát tự động"]'); await clickSelector('.composer__remove');
  checks.push('actual Stop during pending project Word save prevents both normal and Advisor dispatch/cancel RPCs; late save preserves draft and parsed Word chip');
  await fill('#composer-input', 'Hãy lập ba ưu tiên công việc.');
  await clickSelector('[role="switch"][aria-label="Bật giám sát tự động"]');
  assert.equal(await evaluate("document.querySelector('[role=switch]').getAttribute('aria-checked')"), 'true');
  holdSupervision = true; await click('Gửi');
  await until(() => Promise.resolve(Boolean(pendingSupervision)), 'native supervised request accepted by fixture');
  assert.equal(await evaluate("document.querySelector('#composer-model').disabled"), true);
  await openThinkingDock(); await hasText('Đang lập kế hoạch');
  await until(() => evaluate("Boolean(document.querySelector('.brand-mark--active'))"), 'host-reported Advisor model activity lights logo');
  assert.equal(await evaluate("!document.querySelector('.thinking-view__recorded').open && document.querySelector('.thinking-view__activity').firstElementChild.getAttribute('aria-label') === 'Giám sát của Advisor'"), true, 'current Advisor leads; retained stopped run is a collapsed record');
  await capture('thinking-advisor-live-980px.png');
  pendingSupervision(); pendingSupervision = null;
  await hasText('Đạt tiêu chí đã kiểm');
  assert.equal(await evaluate("Boolean(document.querySelector('.brand-mark--active'))"), false);
  await clickSelector('.context-meter summary'); await hasText('Cửa sổ ngữ cảnh');
  await clickSelector('.context-meter summary');
  await clickSelector('.gateway-control summary'); await hasText('Gateway OpenClaw'); await clickSelector('.gateway-control summary');
  await capture('supervision-980px.png');
  window.setContentSize(1440, 851); await wait(100); assert.equal(await fits(), true);
  await capture('supervision-1440px.png');
  await click('Thu gọn Thinking');
  await until(() => evaluate("document.querySelector('#composer-input').value === ''"), 'supervised accepted draft cleared');
  await click('Dự án'); await hasText('Cuộc trò chuyện (2)'); await capture('project-history-1440px.png');
  checks.push('folder project create/select/history and agent create/model/role/goal stay associated; toolbar order, context/gateway details and automatic supervision status/send locks complete without manual review');
  await selectSession(sessions.length - 1);
  await fill('#composer-input', 'Giữ nháp khi tạm dừng Gateway');
  await clickSelector('.session-skills > summary'); await hasText('Giúp viết nội dung rõ ràng.');
  await clickSelector('.session-skills input[type=checkbox]');
  await until(() => Promise.resolve(sessionSkillChoices.get(sessions.at(-1).key)?.length === 1), 'session-only skill selected');
  await click('Dùng mặc định'); await until(() => Promise.resolve(sessionSkillChoices.get(sessions.at(-1).key)?.length === 0), 'native defaults restored');
  await until(() => evaluate(`!!Array.from(document.querySelectorAll('.session-skills button')).find(b => b.textContent === 'Dùng mặc định' && !b.disabled)`), 'skills controls ready');
  assert.equal(await evaluate(`document.querySelector('.session-skills input[type="checkbox"]').getBoundingClientRect().width <= 20`), true, 'skill checkbox stays compact');
  await capture('session-skills-1440px.png');
  await clickSelector('.gateway-control > summary'); await click('Kiểm tra sức khỏe'); await hasText('Gateway phản hồi bình thường.');
  await click('Dừng Gateway'); await hasText('Đang tạm dừng');
  await hasText('Gateway đã tạm dừng');
  assert.equal((await text()).includes('Lần đầu có thể mất vài phút.'), false, 'manual pause never looks like startup');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), 'Giữ nháp khi tạm dừng Gateway');
  await capture('gateway-paused-1440px.png'); await click('Tiếp tục Gateway'); await hasText('Đã sẵn sàng nhận việc.');
  await until(() => evaluate("document.querySelector('#composer-input').value === 'Giữ nháp khi tạm dừng Gateway'"), 'pause/resume preserves draft');
  await clickSelector('.gateway-control > summary'); await click('Tác vụ định kỳ'); await hasText('Nhắc vận động');
  await capture('simple-schedules-1440px.png');
  checks.push('agent form needs no skills; session skill choice/default persists; Gateway health and stop/resume preserve draft; eight short schedule cards');
  await selectSession(sessions.length - 1); deferWebPoll = true; await clickSelector('#web-tab');
  await until(() => Promise.resolve(Boolean(pendingWebPoll)), 'old web snapshot in flight');
  await until(() => evaluate("Boolean(document.querySelector('[aria-label=\"Địa chỉ web\"]'))"), 'browser tab admitted'); await fill('[aria-label="Địa chỉ web"]', 'https://example.com'); await click('Đi'); await hasText('Trang web mô phỏng');
  pendingWebPoll(); pendingWebPoll = null; await wait(100);
  assert.equal(await evaluate("Boolean(document.querySelector('[aria-label=\"Địa chỉ web\"]'))"), true, 'late old snapshot cannot erase a newly created tab');
  await click('Đưa trang vào chat'); await until(() => evaluate("document.querySelector('#composer-input').value.includes('Nội dung trang đã chọn để cùng đọc.')"), 'chosen web page appended to current draft');
  await click('Mở tab web mới'); assert.equal(webState.tabs.length, 2); await click('Đóng tab Tab mới'); assert.equal(webState.tabs.length, 1);
  await clickSelector('#files-tab'); await click('Kết quả'); await until(() => evaluate("document.querySelectorAll('.workspace__dock .file-entry').length === 1"), 'merged result filter');
  await clickSelector('#web-tab'); assert.equal(webState.tabs.length, 1, 'web tabs persist across panels');
  await capture('web-panel-1440px.png');
  await click('Chrome'); await click('Kết nối Chrome extension'); await click('Xem tab đã chia sẻ'); await hasText('Chrome được chọn');
  await capture('chrome-bridge-1440px.png');
  window.setContentSize(980, 700); await wait(100); assert.equal(await fits(), true); await capture('chrome-bridge-980px.png');
  checks.push('one file panel with result filter; web tab create/navigate/share/close/preserve; Chrome selected-tab instructions; page goes to draft without sending');
  await click('Tập trung vào chat');
  assert.equal(await evaluate("document.querySelector('.workspace').classList.contains('workspace--left-hidden') && document.querySelector('.workspace').classList.contains('workspace--right-hidden')"), true);
  await click('Tập trung vào chat');
  await click('Cài đặt'); await click('Giao diện'); await hasText('Giao diện và bố cục');
  await evaluate("(() => { const el = document.querySelector('[aria-label=\"Cỡ chữ cuộc trò chuyện\"]'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, '16'); el.dispatchEvent(new Event('input', { bubbles: true })); })()");
  await until(() => evaluate("getComputedStyle(document.querySelector('.workspace')).getPropertyValue('--chat-font-size') === '16px'"), 'text size changes');
  await capture('layout-settings-980px.png');
  const sendsBeforeReload = counts['sessions.send'];
  window.webContents.reload();
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), 'reload remains immediately usable');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.workspace')).getPropertyValue('--chat-font-size')"), '16px');
  assert.equal(counts['sessions.send'], sendsBeforeReload, 'restart must not resend');
  await click('Cài đặt'); await click('Giao diện'); await click('Khôi phục bố cục mặc định');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.workspace')).getPropertyValue('--chat-font-size')"), '14px');
  await click('Trở lại cuộc trò chuyện'); window.setContentSize(1440, 900); await wait(100);
  await capture('ready-workspace-1440px.png');
  checks.push('startup automatically opens one usable empty session; Enter sends without New Session; exact native usage/ceiling and catalog window; layout focus/text/reset/persistence across reload without resending');
  await fill('#composer-input', 'Nháp giữ khi mở cài đặt.');
  const settingsSends = counts['sessions.send'], settingsSessions = counts['sessions.create'];
  await click('Cài đặt');
  assert.equal(await evaluate("document.querySelector('.settings-dialog').matches(':modal')"), true);
  const categories = await evaluate("Array.from(document.querySelectorAll('.settings-nav nav button')).map(b => b.textContent.trim())");
  assert.equal(categories.length, 22);
  for (const name of categories) { await click(name); await until(() => evaluate(`document.querySelector('#settings-title').textContent === ${JSON.stringify(name)}`), `settings category ${name}`); }
  await click('Làm mới thông tin phiên bản'); await hasText('Đã làm mới thông tin bản đang chạy.');
  await click('Kiểm tra cập nhật'); await hasText('Có bản thử mới mô phỏng');
  await click('Tải bản mới'); await hasText('Lưu công việc rồi đóng và mở lại ứng dụng');
  assert.equal(updateFixture.readyVersion, '0.0.5-beta.32');
  await capture('settings-about-1440px.png');
  await click('Dữ liệu & sao lưu'); await hasText('Sao lưu tự động'); await hasText('Chưa có bản sao lưu hoàn tất.'); await capture('settings-data-1440px.png');
  await click('Trình duyệt & tiện ích'); await hasText('Browser Extension');
  await click('Kiểm tra tab đã chia sẻ'); await hasText('Đã nhận 1 tab từ tiện ích.'); await capture('settings-browser-1440px.png');
  await click('Cache & cập nhật mô hình'); await hasText('Prompt caching & cập nhật mô hình');
  await evaluate("(() => { const el = document.querySelector('[aria-label=\"Thời gian lưu prompt cache\"]'); el.value = 'long'; el.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await click('Lưu cài đặt mô hình'); await hasText('Đã lưu và áp dụng cài đặt.');
  assert.equal(counts['management.model-settings-save'], 1); await capture('settings-cache-1440px.png');
  await click('Mô hình'); window.setContentSize(980, 720); await wait(100);
  await clickSelector('#settings-model'); await assertModelPopupFits(); await capture('settings-model-popup-980px.png');
  window.setContentSize(1440, 900); await wait(100); await assertModelPopupFits();
  await fill('[aria-label="Tìm mô hình"]', 'khác'); await clickSelector('[role="menuitemradio"]');
  await until(() => Promise.resolve(Boolean(pendingPatch)), 'settings model uses native patch');
  modelBySession.set(pendingPatch.params.key, 'other'); pendingPatch.resolve({ ok: true }); pendingPatch = null;
  await until(() => evaluate("document.querySelector('#settings-model')?.textContent.includes('Model khác')"), 'settings model history readback');
  await click('Giao diện'); window.setContentSize(980, 720); await wait(80); await capture('settings-appearance-980px.png');
  assert.equal(await evaluate("document.querySelector('.settings-dialog').scrollWidth <= document.querySelector('.settings-dialog').clientWidth"), true);
  await evaluate("(() => { const el = document.querySelector('[aria-label=\"Màu giao diện\"]'); el.value = 'dark'; el.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await until(() => evaluate("document.documentElement.dataset.theme === 'dark'"), 'dark mode applied to full renderer');
  await capture('settings-dark-980px.png');
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown',{key:'n',ctrlKey:true,bubbles:true}))");
  assert.equal(counts['sessions.create'], settingsSessions); assert.equal(counts['sessions.send'], settingsSends);
  await evaluate("document.querySelector('.settings-dialog').dispatchEvent(new Event('cancel',{cancelable:true}))");
  await until(() => evaluate("!document.querySelector('.settings-dialog') && document.querySelector('#composer-input')?.value === 'Nháp giữ khi mở cài đặt.'"), 'Escape restores draft');
  await capture('workspace-dark-980px.png');
  await click('Cài đặt'); await click('Giao diện');
  await evaluate("(() => { const el = document.querySelector('[aria-label=\"Màu giao diện\"]'); el.value = 'light'; el.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await until(() => evaluate("document.documentElement.dataset.theme === 'light'"), 'light mode restored'); await click('Đóng cài đặt');
  checks.push('21 settings categories, browser extension and prompt-cache controls, modal focus, keyboard model navigation and focus return, native model patch/readback, local version refresh, 980/1440 layouts, light/dark, Escape draft return and blocked background new-session shortcut');
  window.setContentSize(1440, 900); await click('Cài đặt'); await click('Nhà cung cấp'); await hasText('Tài khoản thử OAuth');
  await until(() => evaluate("document.querySelectorAll('.catalog-list > li').length > 60"), 'catalogue has loaded');
  await fill('[aria-label="Tìm trong danh mục"]', 'anthropic'); await hasText('Anthropic'); await capture('providers-1440px.png');
  assert.equal(await evaluate("Boolean(document.querySelector('.catalog-list [data-brand=anthropic]:not(.brand-icon--initials)'))"), true, 'provider logo matches Anthropic');
  await fill('[aria-label="Tìm trong danh mục"]', 'this-provider-does-not-exist'); await hasText('Không có mục phù hợp.');
  await click('Plugin'); await hasText('Document Extract'); await fill('[aria-label="Tìm trong danh mục"]', 'document'); await capture('plugins-1440px.png');
  await click('Tắt plugin'); await until(() => Promise.resolve(pluginEnabled === false), 'plugin disabled through narrow management');
  await hasText('đã tắt'); await hasText('Dừng rồi Tiếp tục Gateway để áp dụng');
  await click('Bật plugin'); await until(() => Promise.resolve(pluginEnabled === true), 'plugin enabled through narrow management');
  assert.equal(managementRequests.filter(packet => packet.action === 'plugin-toggle').length, 2);
  await click('Công cụ & khóa API'); await hasText('Quyền của phiên đã được xác nhận'); await hasText('Kiểm tra trạng thái phiên');
  await fill('[aria-label="Tìm công cụ"]', 'tài liệu'); await hasText('Tra cứu tài liệu thử'); await hasText('Bị giới hạn trong phiên');
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=" + JSON.stringify('Công cụ của phiên') + "] .catalog-list > li').length"), 1);
  await capture('tools-effective-1440px.png');
  await click('MCP'); await hasText('Knowledge Fixture'); await hasText('Đang tắt'); await capture('mcp-1440px.png');
  await click('Đóng cài đặt');
  const railBefore = await evaluate("document.querySelector('.workspace__rail').getBoundingClientRect().width");
  await evaluate("document.querySelector('.panel-resizer--left').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))");
  await until(() => evaluate("JSON.parse(localStorage.getItem('aifb.layout.v1')).railWidth > " + railBefore), 'panel keyboard persists width');
  pushStatus({ connected: false, setupReady: false }); await click('Cài đặt'); await click('Nhà cung cấp'); await hasText('Bật Gateway');
  await until(() => evaluate("document.querySelectorAll('.catalog-list > li').length > 60"), 'catalogue has loaded');
  await click('Đóng cài đặt'); pushStatus({ connected: true, setupReady: true });
  checks.push('generated and live provider/plugin/MCP catalogues, search, roles/icons, offline discovery, native agent emoji request, keyboard panel persistence');
  checks.push('provider and channel assets match brand identity; plugin toggle/readback and restart notice; effective tool inventory/search and per-session denial labels');
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), 'conversation controls ready after reconnect');
  const keptKey = await evaluate("decodeURIComponent(document.querySelector('.session-tabs [aria-selected=true]').id.slice('workspace-tab-'.length))");
  const keptDraft = await evaluate("document.querySelector('#composer-input').value");
  const originalKeys = sessions.map(session => session.key), originalProjects = structuredClone(localProjects), originalAgents = structuredClone(fixtureAgents);
  const sendsBeforeDelete = counts['sessions.send'];
  await click('Phiên mới'); await until(() => Promise.resolve(sessions.length === originalKeys.length + 1), 'new synthetic delete candidate');
  const deleteKey = sessions.at(-1).key; deletableSessions.add(deleteKey);
  await until(() => evaluate("Boolean(document.querySelector('#composer-input:not(:disabled)'))"), 'delete candidate ready');
  await fill('#composer-input', 'Chỉ xóa nháp tổng hợp này.');
  await clickSelector(`.sidebar-session[data-session-key="${keptKey}"] .session-item`);
  await until(() => evaluate(`document.querySelector('#composer-input')?.value === ${JSON.stringify(keptDraft)}`), 'original conversation draft restored');
  const activeBeforeDelete = await evaluate("document.querySelector('.session-tabs [aria-selected=true]').id");
  const deleteCallsBefore = managementRequests.filter(packet => packet.action === 'conversation-delete').length;
  await openConversationMenu(deleteKey, 'right-click'); await click('Xóa cuộc trò chuyện');
  await until(() => evaluate("Boolean(document.querySelector('.conversation-delete-dialog:modal .conversation-delete-dialog__confirm:not(:disabled)'))"), 'exact conversation confirmation ready');
  assert.equal(await evaluate("document.querySelector('.conversation-delete-dialog strong').textContent"), sessions.at(-1).displayName);
  assert.equal(await evaluate("document.activeElement?.textContent.trim()"), 'Hủy', 'safe cancellation receives default focus');
  assert.equal(await evaluate("document.querySelector('.session-tabs [aria-selected=true]').id"), activeBeforeDelete);
  const createsAtConfirm = counts['sessions.create'];
  await evaluate("window.dispatchEvent(new KeyboardEvent('keydown', {key:'n',ctrlKey:true,bubbles:true,cancelable:true}))");
  await wait(60); assert.equal(counts['sessions.create'], createsAtConfirm, 'delete dialog blocks background new-conversation shortcut');
  await capture('conversation-delete-confirmation-1440px.png');
  await click('Hủy'); await until(() => evaluate("!document.querySelector('.conversation-delete-dialog')"), 'delete cancellation closes dialog');
  assert.equal(managementRequests.filter(packet => packet.action === 'conversation-delete').length, deleteCallsBefore);
  assert.equal(histories.has(deleteKey), true); assert.equal(sessions.some(session => session.key === deleteKey), true);
  await until(() => evaluate(`document.activeElement === document.querySelector('.sidebar-session[data-session-key="${deleteKey}"] .sidebar-session__more')`), 'cancel returns to menu trigger without opening its row');
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), keptDraft);
  await click('Cài đặt'); await click('Giao diện');
  await select('[aria-label="Màu giao diện"]', 'dark');
  await until(() => evaluate("document.documentElement.dataset.theme === 'dark'"), 'dark theme before delete confirmation');
  await click('Đóng cài đặt');
  await openConversationMenu(deleteKey); await click('Xóa cuộc trò chuyện');
  await until(() => evaluate("Boolean(document.querySelector('.conversation-delete-dialog:modal .conversation-delete-dialog__confirm:not(:disabled)'))"), 'second confirmation ready');
  await capture('conversation-delete-dark-1440px.png');
  deferDelete = true; await click('Xóa hội thoại'); await until(() => Promise.resolve(Boolean(pendingDelete)), 'confirmed deletion waits for backend');
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.conversation-delete-dialog button')).every(button => button.disabled)"), true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.sidebar-session__more')).every(button => button.disabled)"), true);
  await evaluate("document.querySelector('.conversation-delete-dialog').dispatchEvent(new Event('cancel', {cancelable:true}))");
  assert.equal(await evaluate("Boolean(document.querySelector('.conversation-delete-dialog:modal'))"), true, 'pending deletion cannot be dismissed or repeated');
  assert.equal(sessions.some(session => session.key === deleteKey), true, 'row remains until backend acknowledgement');
  pendingDelete();
  await until(() => evaluate(`!document.querySelector('.conversation-delete-dialog') && !document.querySelector('.sidebar-session[data-session-key="${deleteKey}"]')`), 'confirmed inactive conversation removed');
  assert.equal(histories.has(deleteKey), false); assert.deepEqual(sessions.map(session => session.key), originalKeys);
  assert.equal(await evaluate("document.querySelector('.session-tabs [aria-selected=true]').id"), activeBeforeDelete);
  assert.equal(await evaluate("document.querySelector('#composer-input').value"), keptDraft);
  assert.deepEqual(localProjects, originalProjects); assert.deepEqual(fixtureAgents, originalAgents);
  await click('Cài đặt'); await click('Giao diện');
  await select('[aria-label="Màu giao diện"]', 'light');
  await until(() => evaluate("document.documentElement.dataset.theme === 'light'"), 'restore light theme after delete confirmation');
  await click('Đóng cài đặt');
  await click('Phiên mới'); await until(() => Promise.resolve(sessions.length === originalKeys.length + 1), 'active synthetic delete candidate');
  const activeDeleteKey = sessions.at(-1).key; deletableSessions.add(activeDeleteKey);
  await until(() => evaluate(`document.querySelector('.session-tabs [aria-selected=true]')?.id === ${JSON.stringify('workspace-tab-' + encodeURIComponent(activeDeleteKey))} && Boolean(document.querySelector('#composer-input:not(:disabled)'))`), 'active deletion candidate ready');
  await openConversationMenu(activeDeleteKey, 'keyboard'); await click('Xóa cuộc trò chuyện'); await click('Xóa hội thoại');
  await until(() => evaluate(`!document.querySelector('.conversation-delete-dialog') && !document.querySelector('.sidebar-session[data-session-key="${activeDeleteKey}"]') && Boolean(document.querySelector('#composer-input:not(:disabled)'))`), 'active deletion selects a remaining ready conversation');
  assert.equal(histories.has(activeDeleteKey), false); assert.deepEqual(sessions.map(session => session.key), originalKeys);
  assert.equal(managementRequests.filter(packet => packet.action === 'conversation-delete').length, deleteCallsBefore + 2);
  assert.equal(counts['sessions.send'], sendsBeforeDelete, 'conversation management never sends a prompt');
  checks.push('real DOM confirmation focuses Cancel and blocks background Ctrl+N; cancellation makes no delete request, returns focus and preserves active draft');
  checks.push('ticket-based simulated backend deletion waits for ACK, disables conflicts, removes only two new synthetic conversations, preserves other histories/projects/agents/drafts and handles active-session fallback');
  for (const decision of ['Từ chối', 'Cho phép lần này']) {
    pendingApproval = { id: 'synthetic-command', revision: 'fixture-revision', command: 'node fixture.cjs', sessionKey: originalKeys[0],
      warning: null, agentId: 'fixture', host: 'gateway', expiresAtMs: Date.now() + 60000, canAllow: true };
    window.webContents.send('aifb:gateway-event', { event: 'exec.approval.requested', payload: { changed: true } });
    if (!await evaluate("Boolean(document.querySelector('.approval-dialog'))")) {
      await until(() => evaluate("Boolean(document.querySelector('.approval-pending'))"), 'approval pending');
      await clickSelector('.approval-pending');
    }
    assert.equal(await evaluate("document.querySelectorAll(':modal').length"), 0);
    assert.equal(await evaluate("document.querySelector('.approval-dialog').innerText.includes('Không có sandbox')"), true);
    assert.equal(await evaluate("document.querySelector('.approval-dialog pre').textContent"), 'node fixture.cjs');
    assert.equal(await evaluate("document.querySelectorAll('.approval-dialog button').length"), 3);
    await click(decision); await until(() => evaluate("!document.querySelector('.approval-dialog')"), 'approval closes after response');
    assert.equal(pendingApproval, null);
  }
  checks.push('production nonmodal approval panel shows full command/no-sandbox notice, offers collapse/deny/allow-once and closes after response');
  finish(0);
}).catch(async error => {
  if (window && !window.isDestroyed()) {
    mkdirSync(path.dirname(output), { recursive: true });
    try {
      writeFileSync(path.join(path.dirname(output), 'renderer-failure-dom.json'), JSON.stringify(await evaluate("({text:document.body.innerText,html:document.querySelector('.connect')?.outerHTML})"), null, 2));
      await capture('renderer-failure.png');
    } catch { /* Preserve the original failure if capture is unavailable. */ }
  }
  finish(1, error);
});

let finished = false;
function finish(code, error) {
  if (finished) return;
  finished = true;
  nativeTabs?.dispose(); browserServer?.close();
  mkdirSync(path.dirname(output), { recursive: true });
  const rendererAssets = [...readFileSync(path.join(root, "apps/desktop/dist/index.html"), "utf8").matchAll(/(?:src|href)="\.\/assets\/([^"]+)"/g)].map(match => match[1]);
  const record = { nativeClipboardVerified: process.argv.includes('--multitasking') && !process.argv.includes('--clipboard-event-only') && code===0, recordedAt: new Date().toISOString(), scope: "Real renderer and preload with simulated local IPC responses; NOT a real AI response or account login",
    rendererAssets, checks, counts, networkAttempts, ...(pointerDiagnostic ? { pointerDiagnostic } : {}), ...(motionDiagnostic ? { motionDiagnostic } : {}), modelPopupDiagnostics, realWebContentsView: browserIntegration, simulatedWebsite: browserIntegration, gatewayStarted: false, realProviderCalls: 0, failures: error ? [String(error.stack ?? error)] : [] };
  writeFileSync(output, JSON.stringify(record, null, 2) + "\n");
  console.log(`[first-session UI fixture] ${code ? "FAIL" : "PASS"}: ${checks.length} scenarios; ${output}`);
  if (error) console.error(error);
  app.exit(code);
}
