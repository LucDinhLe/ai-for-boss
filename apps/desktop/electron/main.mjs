import path from "node:path";
import { mkdirSync, realpathSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, WebContentsView, clipboard, dialog, ipcMain, nativeTheme, session, shell } from "electron";
import { applyUiTheme } from './ui-theme.mjs';
import { keepWindowControlsVisible } from './window-controls.mjs';
import { WebTabs } from './web-tabs.mjs';
import { ChromeBridge } from './chrome-bridge.mjs';
import { ProjectService } from "./project-service.mjs";
import { ConversationService } from "./conversation-service.mjs";
import { SupervisionService } from "./supervision-service.mjs";
import { RuntimeControl } from "./runtime-control.mjs";
import { UpdateService } from './update-service.mjs';
import { resolveProviderDoc } from './provider-docs.mjs';
import { ChannelPluginInstaller } from './channel-plugin-installer.mjs';
import { ChannelWorkGuard } from './channel-work-guard.mjs';
import {
  createWindowOptions,
  isAllowedNavigation,
  isTrustedRendererEvent,
  GATEWAY_EVENT_CHANNEL,
  GATEWAY_REQUEST_CHANNEL,
  GATEWAY_STATUS_CHANNEL,
  GATEWAY_RETRY_CHANNEL,
  GATEWAY_STATUS_EVENT_CHANNEL,
  SETUP_REQUEST_CHANNEL,
  SETUP_OPEN_PAGE_CHANNEL,
  ADVISOR_REQUEST_CHANNEL,
  MANAGEMENT_REQUEST_CHANNEL,
  SHELL_STATUS_CHANNEL
} from "./security-policy.mjs";
import { createUnavailableShellContract, loadShellContract } from "./shell-contract.mjs";
import {
  GatewaySupervisor,
  SUPERVISOR_STATES,
  resolveNodeExecutable,
  resolveOpenClawEntry
} from "./supervisor.mjs";
import { GatewayAdapter } from "./gateway-adapter.mjs";
import { SetupChannel } from "./setup-channel.mjs";
import { STARTUP_TIMEOUT_MS, STARTUP_SLOW_MS, waitForGatewayReady, isExpectedStartupConnectionError, createGatewayRestart, createStartupRetry } from "./startup-readiness.mjs";
import { waitForGatewayListener } from "./startup-listener.mjs";
import { waitForSmokeRendererReady } from "./startup-smoke.mjs";
import { createSetupPageAccess } from "./setup-page-access.mjs";
import { AdvisorService } from "./advisor-service.mjs";
import { packagedChannelBundlePath } from './channel-bundle-path.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const smoke = process.argv.includes("--smoke-test");
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

let mainWindow = null;
let channelPluginInstaller = null;
let shellStatus = createUnavailableShellContract();
let supervisor = null;
let adapter = null;
let setupChannel = null;
let gatewayEndpoint = null;
let shuttingDown = false;
let connectionGeneration = 0;
let appExitCode = 0;
let smokeFinished = false;
let projectService = null;
let conversationService = null;
let runtimePaused = false;
let webTabs = null;
let updater = null, checkingUpdateHealth = false;
const chromeBridge = new ChromeBridge({ request: params => setupChannel.browserRequest(params), getSupervisor: () => supervisor,
  clipboard, openExternal: url => shell.openExternal(url), onPaired: () => writeFileSync(path.join(app.getPath('userData'), 'aifb-chrome-enabled.json'), '{"enabled":true}\n') });
let runtimeStatus = {
  supervisor: SUPERVISOR_STATES.IDLE,
  detail: null,
  connected: false,
  setupReady: false,
  attachmentPolicy: null,
  serverVersion: null,
  protocol: null,
  nodeRuntime: null,
  stateDirectory: null,
  lastError: null
};

const setupPageAccess = createSetupPageAccess({
  openExternal: (url) => shell.openExternal(url),
  canOpen: () => !smoke && !shuttingDown && setupChannel?.connected === true
});

const advisorService = new AdvisorService({ getAdapter: () => adapter, getSetup: () => setupChannel,
  isReady: () => !smoke && !shuttingDown && adapter?.connected === true && setupChannel?.connected === true });
const supervisionService = new SupervisionService({ advisor: advisorService, getAdapter: () => adapter, getSetup: () => setupChannel,
  isReady: () => !smoke && !shuttingDown && adapter?.connected === true && setupChannel?.connected === true });
const channelWorkGuard = new ChannelWorkGuard({
  requestHistory: key => adapter.request('sessions.history', { key, limit: 1 }),
  otherBusy: () => supervisionService.status()?.busy || advisorService.busy
});
const channelMutations = new Set(['channel-setup', 'channel-next', 'channel-start', 'channel-stop',
  'channel-qr-start', 'channel-qr-wait', 'channel-pairing-approve', 'channel-pairing-dismiss']);

app.enableSandbox();
app.on("second-instance", () => {
  if (smoke || !mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function publishStatus(patch) {
  runtimeStatus = { ...runtimeStatus, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(GATEWAY_STATUS_EVENT_CHANNEL, runtimeStatus);
  }
  if (updater?.state.pending && !checkingUpdateHealth && runtimeStatus.connected && runtimeStatus.setupReady) {
    checkingUpdateHealth = true;
    void waitForSmokeRendererReady({ runtimeReady: () => Boolean(runtimeStatus.connected && runtimeStatus.setupReady && mainWindow && !mainWindow.isDestroyed()),
      readReady: () => mainWindow.webContents.executeJavaScript('Boolean(document.querySelector(\'#root[data-gateway-state="ready"][data-gateway-connected="true"][data-setup-ready="true"]\'))')
    }).then(ready => ready && updater.markHealthy()).catch(() => {}).finally(() => { checkingUpdateHealth = false; });
  }
}

async function finishStartupSmoke(started = true) {
  if (!smoke || smokeFinished) return;
  smokeFinished = true;
  const chatReady = () => started && adapter?.connected === true && runtimeStatus.connected === true
    && runtimeStatus.supervisor === SUPERVISOR_STATES.READY && supervisor?.state === SUPERVISOR_STATES.READY;
  const setupReady = () => started && setupChannel?.connected === true && runtimeStatus.setupReady === true;
  const runtimeReady = () => !shuttingDown && chatReady() && setupReady();
  let rendererReady = false;
  let captured = false;
  if (runtimeReady()) {
    try {
      rendererReady = await waitForSmokeRendererReady({
        runtimeReady,
        readReady: () => mainWindow.webContents.executeJavaScript(`Boolean(document.querySelector(
          '#root[data-gateway-state="ready"][data-gateway-connected="true"][data-setup-ready="true"]'
        ))`)
      });
      if (rendererReady && runtimeReady()) {
        const screenshot = await mainWindow.webContents.capturePage();
        writeFileSync(path.join(app.getPath("userData"), "startup-smoke.png"), screenshot.toPNG());
        captured = true;
      }
    } catch { captured = false; }
  }
  const ready = runtimeReady() && rendererReady && captured;
  console.log(JSON.stringify({ kind: "AIFB_PACKAGED_APP_SMOKE", connected: chatReady(), setupReady: setupReady(),
    rendererReady, providerCalls: 0 }));
  appExitCode = ready ? 0 : 1;
  app.quit();
}

/**
 * Windows can hand back an 8.3 short path (C:\Users\RUNNER~1\...). libuv's
 * filesystem watcher compares the event filename against the watched directory
 * and fast-fails the process when the two spellings differ, which crashes the
 * Gateway in a restart loop. Resolving to the long form first avoids handing a
 * short path to the child at all. See R-034.
 */
function longPath(candidate) {
  try {
    return realpathSync.native(candidate);
  } catch {
    return candidate;
  }
}

function stateDirectory() {
  const directory = path.join(longPath(app.getPath("userData")), "openclaw-state");
  mkdirSync(directory, { recursive: true });
  return longPath(directory);
}

async function startRuntime() {
  if (shuttingDown) return;
  const directory = stateDirectory();
  const nodeExecutable = resolveNodeExecutable({ resourcesPath: process.resourcesPath });
  publishStatus({ stateDirectory: directory, nodeRuntime: nodeExecutable, lastError: null });

  if (!nodeExecutable) {
    publishStatus({
      supervisor: SUPERVISOR_STATES.SAFE_MODE,
      detail: "node-runtime-missing",
      lastError: "Không tìm thấy Node runtime để chạy OpenClaw."
    });
    return;
  }

  let openclawEntry;
  try {
    openclawEntry = resolveOpenClawEntry(undefined, { resourcesPath: process.resourcesPath });
  } catch (error) {
    publishStatus({
      supervisor: SUPERVISOR_STATES.SAFE_MODE,
      detail: "openclaw-package-missing",
      lastError: String(error?.message ?? error)
    });
    return;
  }

  supervisor = new GatewaySupervisor({
    stateDirectory: directory,
    nodeExecutable,
    openclawEntry,
    onOwnedChildExit: () => { advisorService.ownedRuntimeStopped(); supervisionService.ownedRuntimeStopped(); },
    onStateChange: ({ state, detail }) => {
      publishStatus({ supervisor: state, detail });
    }
  });

  adapter = new GatewayAdapter({
    stateDirectory: directory,
    appVersion: app.getVersion(),
    authorizeWorker: key => setupChannel.authorizeWorker(key),
    onStatus: (status) => {
      if (shuttingDown) return;
      if (status.phase === "connected") {
        supervisor?.markReady();
        publishStatus({
          connected: true,
          attachmentPolicy: status.attachmentPolicy ?? null,
          serverVersion: status.serverVersion ?? null,
          protocol: status.protocol ?? null,
          detail: null,
          lastError: setupChannel?.connected ? null : runtimeStatus.lastError
        });
        void advisorService.connectionRestored();
        return;
      }
      if (status.phase === "closed") {
        publishStatus({ connected: false, attachmentPolicy: null });
        return;
      }
      if (isExpectedStartupConnectionError(status.message)
        && [SUPERVISOR_STATES.STARTING, SUPERVISOR_STATES.RESTARTING].includes(supervisor?.state)) return;
      publishStatus({ lastError: status.message ?? null });
    },
    onEvent: (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(GATEWAY_EVENT_CHANNEL, payload);
      }
    }
  });

  const channelBundleRoot = app.isPackaged ? packagedChannelBundlePath(process.resourcesPath)
    : path.resolve(currentDirectory, '../resources/bundle/channel-installer');
  channelPluginInstaller = new ChannelPluginInstaller({ bundleRoot: channelBundleRoot, stateDirectory: directory, nodeExecutable, openclawEntry });
  setupChannel = new SetupChannel({
    catalogue: JSON.parse(readFileSync(path.join(currentDirectory, "native-catalog.json"), "utf8")),
    channelBundleRoot,
    installPlugin: id => {
      channelWorkGuard.assertExclusive();
      if (smoke || shuttingDown || runtimePaused || supervisionService.status()?.busy) throw new Error('Chưa thể chuẩn bị plugin.');
      return channelPluginInstaller.install(id);
    },
    restartRuntime: async () => {
      channelWorkGuard.assertExclusive();
      if (smoke || shuttingDown || runtimePaused || supervisionService.status()?.busy) throw new Error('Chưa thể tải lại Gateway.');
      if (!await restartGateway()) throw new Error('Gateway chưa sẵn sàng sau khi chuẩn bị kênh.');
    },
    stateDirectory: directory,
    appVersion: app.getVersion(),
    hostApproval: !smoke,
    onStatus: (status) => {
      if (shuttingDown) return;
      if (status.phase !== "connected") setupPageAccess.clear();
      publishStatus({ setupReady: status.phase === "connected" });
      if (status.phase === "connected") void advisorService.connectionRestored();
      if (status.phase === 'connected') {
        try { if (JSON.parse(readFileSync(path.join(app.getPath('userData'), 'aifb-chrome-enabled.json'), 'utf8')).enabled === true) void chromeBridge.native('/').catch(() => {}); }
        catch { /* No Chrome pairing requested for this product profile. */ }
      }
      if (status.phase === "connect-error" && !isExpectedStartupConnectionError(status.message)) {
        publishStatus({ lastError: status.message ?? "Chưa kết nối được màn hình thiết lập." });
      }
    }
  });

  const { port, token } = await supervisor.start();
  if (shuttingDown || runtimePaused) { await supervisor.stop(); return; }
  gatewayEndpoint = { url: `ws://127.0.0.1:${port}`, token };
  await connectWithRetry(gatewayEndpoint);
}

/**
 * Activating a provider asks the Gateway to restart. The child is ours, so the
 * host restarts it and reconnects both channels rather than leaving the app
 * pointed at a process that is going away.
 */
const restartGateway = createGatewayRestart({
  shouldStop: () => shuttingDown || runtimePaused,
  onRestart: () => {
    connectionGeneration++;
    advisorService.cancelForShutdown();
    publishStatus({ connected: false, setupReady: false, attachmentPolicy: null, detail: "startup-preparing", lastError: null });
  },
  disconnect: () => Promise.all([adapter?.disconnect(), setupChannel?.disconnect()]),
  stop: () => supervisor.stop(),
  start: () => supervisor.start(),
  connect: ({ port, token }) => {
    gatewayEndpoint = { url: `ws://127.0.0.1:${port}`, token };
    return connectWithRetry(gatewayEndpoint);
  }
});

const runtimeControl = new RuntimeControl({
  available: () => !smoke && !shuttingDown && Boolean(supervisor),
  isPaused: () => runtimePaused,
  stop: async () => {
    runtimePaused = true; connectionGeneration++;
    advisorService.cancelForShutdown(); setupPageAccess.clear();
    publishStatus({ paused: true, connected: false, setupReady: false, detail: 'user-pausing' });
    await Promise.all([adapter?.disconnect(), setupChannel?.disconnect()]);
    await supervisor.stop();
    publishStatus({ paused: true, supervisor: SUPERVISOR_STATES.IDLE, detail: 'user-paused', lastError: null });
  },
  resume: async () => {
    runtimePaused = false; publishStatus({ paused: false });
    try { const ready = await restartGateway(); if (ready) return true; }
    catch { /* Restore a resumable stopped state below. */ }
    runtimePaused = true; connectionGeneration++;
    await Promise.all([adapter?.disconnect(), setupChannel?.disconnect()]); await supervisor.stop();
    publishStatus({ paused: true, connected: false, setupReady: false, supervisor: SUPERVISOR_STATES.IDLE, detail: 'user-paused' });
    return false;
  },
  health: () => setupChannel.workspaceRequest('health', { probe: false })
});

const retryStartup = createStartupRetry({
  restart: restartGateway,
  getRuntimeStatus: () => runtimeStatus,
  hasSupervisor: () => supervisor !== null,
  shouldStop: () => shuttingDown,
  isSmoke: () => smoke,
  onFailure: () => publishStatus({ supervisor: SUPERVISOR_STATES.SAFE_MODE,
    connected: false, setupReady: false, detail: "startup-retry-failed",
    lastError: "Chưa khởi động lại được. Hãy thử lại hoặc đóng và mở lại ứng dụng." })
});

async function restartGatewayForSetup() {
  if (!await restartGateway() && !shuttingDown) {
    throw new Error("Kết nối chưa sẵn sàng sau khi thiết lập. Hãy mở lại ứng dụng.");
  }
}

/**
 * Defer the initial SDK attempts until the owned port listens. The socket probe
 * sends no credential; both authenticated SDK handshakes are still required.
 * Listener and handshakes share one deadline, including during a user retry.
 */
async function connectWithRetry({ url, token }) {
  if (shuttingDown) return false;
  const generation = ++connectionGeneration;
  const shouldStop = () => shuttingDown || generation !== connectionGeneration;
  const started = Date.now();
  if (url !== supervisor.url) return false;
  publishStatus({ lastError: null, detail: "startup-preparing" });
  const slowTimer = setTimeout(() => {
    if (!shouldStop()) publishStatus({ detail: "startup-slow" });
  }, STARTUP_SLOW_MS);
  try {
    let result = await waitForGatewayListener({ port: supervisor.port, supervisor, shouldStop,
      timeoutMs: STARTUP_TIMEOUT_MS });
    if (shouldStop()) return false;
    if (result === "ready") {
      adapter.connect({ url, token });
      setupChannel.connect({ url, token });
      result = await waitForGatewayReady({
        adapter: { get connected() { return adapter.connected && setupChannel.connected; } },
        supervisor, shouldStop, timeoutMs: Math.max(0, STARTUP_TIMEOUT_MS - (Date.now() - started))
      });
    }
    if (shouldStop()) return false;
    if (result === "ready") { publishStatus({ detail: null, lastError: null }); return true; }
    if (result === "timed-out" || result === "failed") {
      const failure = runtimeStatus;
      await Promise.all([adapter.disconnect(), setupChannel.disconnect()]);
      if (shouldStop()) return false;
      await supervisor.stop();
      if (shouldStop()) return false;
      publishStatus({ supervisor: SUPERVISOR_STATES.SAFE_MODE, connected: false, setupReady: false,
        detail: result === "timed-out" ? "startup-timeout" : failure.detail,
        lastError: result === "timed-out"
          ? "Chưa khởi động xong sau 4 phút. Bạn có thể bấm Thử khởi động lại bên dưới."
          : failure.lastError ?? "Bộ chạy chưa khởi động được. Bạn có thể bấm Thử khởi động lại bên dưới." });
    }
    return false;
  } finally {
    clearTimeout(slowTimer);
  }
}

async function createMainWindow() {
  const appRoot = app.getAppPath();
  const rendererPath = path.join(appRoot, "dist", "index.html");
  const rendererUrl = pathToFileURL(rendererPath).href;
  const preloadPath = path.join(currentDirectory, "preload.cjs");
  const contractPath = path.join(appRoot, "generated", "shell-contract.json");

  try {
    shellStatus = await loadShellContract(contractPath, app.getVersion());
  } catch (error) {
    console.error("AI for Boss shell contract unavailable", error);
    shellStatus = createUnavailableShellContract("contract-validation-failed");
  }

  mainWindow = new BrowserWindow(createWindowOptions({ preloadPath, isPackaged: app.isPackaged }));
  keepWindowControlsVisible(mainWindow);
  if (smoke) mainWindow.webContents.setBackgroundThrottling(false);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, candidateUrl) => {
    if (!isAllowedNavigation(candidateUrl, rendererUrl)) {
      event.preventDefault();
    }
  });
  const owner = mainWindow;
  owner.once("closed", () => {
    const ownedTabs = webTabs?.window === owner ? webTabs : null;
    if (ownedTabs) webTabs = null;
    if (mainWindow === owner) mainWindow = null;
    try { ownedTabs?.dispose(); } catch (error) {
      appExitCode = 1;
      console.error("AI for Boss Web cleanup failed", error);
    }
  });
  owner.once("ready-to-show", () => { if (!smoke && !owner.isDestroyed()) owner.show(); });
  await owner.loadFile(rendererPath);
}

ipcMain.handle(SHELL_STATUS_CHANNEL, (event) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted shell status request");
  }
  return structuredClone(shellStatus);
});

ipcMain.handle(GATEWAY_STATUS_CHANNEL, (event) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted gateway status request");
  }
  return structuredClone(runtimeStatus);
});

ipcMain.handle(GATEWAY_RETRY_CHANNEL, (event, ...args) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted startup retry request");
  }
  if (args.length !== 0) throw new Error("Startup retry accepts no arguments");
  return retryStartup();
});

ipcMain.handle(SETUP_OPEN_PAGE_CHANNEL, (event, ...args) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted setup page request");
  }
  if (smoke || shuttingDown || args.length !== 1 || typeof args[0] !== "string") return false;
  return setupPageAccess.openPage(args[0]);
});

function getProjectService() {
  projectService ??= new ProjectService({ directory: path.join(app.getPath('userData'), 'aifb-projects'),
    request: (method, params) => setupChannel.workspaceRequest(method, params),
    chooseDirectory: async () => {
      const result = await dialog.showOpenDialog(mainWindow, { title: 'Chọn nơi tạo thư mục dự án', properties: ['openDirectory', 'createDirectory'] });
      return result.canceled ? null : result.filePaths[0];
    }, openDirectory: async directory => { const error = await shell.openPath(directory); if (error) throw new Error('Chưa mở được thư mục.'); } });
  return projectService;
}

ipcMain.handle(MANAGEMENT_REQUEST_CHANNEL, (event, ...args) => {
  if (!isTrustedRendererEvent(event, mainWindow)) throw new Error("Untrusted management request");
  if (!shuttingDown && args.length === 1 && args[0]?.action === 'ui-theme') return applyUiTheme(args[0], nativeTheme);
  if (!smoke && !shuttingDown && args.length === 1 && args[0]?.action === 'document-read') {
    if (Object.keys(args[0]).some(key => !['action', 'attachment'].includes(key))) throw new Error('Yêu cầu đọc tài liệu không hợp lệ.');
    // Load the shell reader only for an explicit file selection, never at startup.
    return import('./docx-extract.mjs').then(({ extractDocxAttachment }) => extractDocxAttachment(args[0].attachment));
  }
  if (!smoke && !shuttingDown && args.length === 1 && args[0]?.action === 'catalog' && Object.keys(args[0]).length === 1) {
    return JSON.parse(readFileSync(path.join(currentDirectory, 'native-catalog.json'), 'utf8'));
  }
  if (!smoke && !shuttingDown && args.length === 1 && args[0]?.action === 'provider-doc') {
    const catalogue = JSON.parse(readFileSync(path.join(currentDirectory, 'native-catalog.json'), 'utf8'));
    return shell.openExternal(resolveProviderDoc(args[0], catalogue)).then(() => ({ opened: true }));
  }
  if (!smoke && !shuttingDown && args.length === 1 && /^web-/u.test(args[0]?.action ?? '')) {
    if (!webTabs && args[0].action === 'web-bounds' && args[0].bounds === null) return { tabs: [], active: null };
    webTabs ??= new WebTabs({ window: mainWindow, createView: options => new WebContentsView(options), browserSession: session.fromPartition('persist:aifb-web') });
    return webTabs.run(args[0]);
  }
  if (!smoke && !shuttingDown && args.length === 1 && /^chrome-/u.test(args[0]?.action ?? '')) return chromeBridge.run(args[0]);
  if (args.length === 1 && /^update-/u.test(args[0]?.action ?? '')) {
    if (!updater || smoke || shuttingDown) throw new Error('Cập nhật chỉ hoạt động trong bản đã đóng gói.');
    return updater.run(args[0]);
  }
  if (args.length === 1 && /^gateway-/u.test(args[0]?.action ?? '')) return runtimeControl.run(args[0]);
  if (smoke || shuttingDown || args.length !== 1 || !setupChannel?.connected) throw new Error("Chưa sẵn sàng quản lý.");
  if (/^conversation-/u.test(args[0]?.action ?? '')) {
    if (supervisionService.status()?.busy) throw new Error('Hãy chờ công việc đang giám sát kết thúc trước khi xóa hội thoại.');
    conversationService ??= new ConversationService((method, params) => setupChannel.workspaceRequest(method, params));
    if (args[0].action === 'conversation-delete') return getProjectService().withConversationDeletion(() => conversationService.run(args[0]));
    return conversationService.run(args[0]);
  }
  if (/^(project-|agent-create$|agent-session$)/u.test(args[0]?.action ?? '')) {
    return getProjectService().run(args[0]);
  }
  if (channelMutations.has(args[0]?.action) || args[0]?.action === 'model-settings-save') return channelWorkGuard.run(() => setupChannel.manage(args[0]));
  return setupChannel.manage(args[0]);
});

ipcMain.handle(ADVISOR_REQUEST_CHANNEL, (event, ...args) => {
  if (!isTrustedRendererEvent(event, mainWindow)) throw new Error("Untrusted Advisor request");
  if (smoke || shuttingDown || args.length !== 1) throw new Error("Advisor is unavailable");
  const input = args[0];
  if (channelWorkGuard.busy && ['supervise', 'plan', 'review'].includes(input?.action)) {
    throw new Error('Đang chuẩn bị kênh chat. Hãy chờ thiết lập hoàn tất rồi gửi lại.');
  }
  if (input?.action === 'supervise') return supervisionService.run(input).then(async result => {
    try { await projectService?.recordReview(result); }
    catch { return { ...result, error: 'Đã kiểm nhưng chưa lưu được bản Advisor vào thư mục dự án.' }; }
    return result;
  });
  if (input?.action === 'supervision-status' && Object.keys(input).length === 1) return supervisionService.status();
  if (input?.action === 'supervision-cancel' && Object.keys(input).length === 1) return supervisionService.cancel();
  if (supervisionService.status()?.busy) throw new Error('Đang giám sát tự động. Hãy dừng lượt đó trước.');
  return advisorService.request(input);
});

ipcMain.handle(GATEWAY_REQUEST_CHANNEL, async (event, payload) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted gateway request");
  }
  if (smoke) throw new Error("Requests are disabled during startup smoke.");
  const method = payload?.method;
  if (typeof method !== "string") {
    throw new Error("Gateway request requires a method name");
  }
  if (!adapter) {
    throw new Error("Gateway adapter is not running");
  }
  if (method === 'sessions.send') return channelWorkGuard.send(payload?.params?.key, () => adapter.request(method, payload?.params));
  const result = await adapter.request(method, payload?.params);
  // An idle history response may predate a concurrent send. Only fresh reads
  // under the channel lease may release ownership; active evidence is additive.
  if (method === 'sessions.history' && (result?.inFlightRun || result?.sessionInfo?.hasActiveRun === true
    || result?.sessionInfo?.activeRunIds?.length)) channelWorkGuard.observeHistory(payload?.params?.key, result);
  return result;
});

/**
 * Native activation waits for config application and explicitly reports when
 * a restart is still required. A queued progress step may already carry the
 * runner's done status; only the terminal activation receipt is authoritative.
 */
function finishesSetup(method, result) {
  if (!result || typeof result !== "object") return false;
  if (!/^(wizard\.|openclaw\.setup\.)/.test(method) || method === "wizard.cancel") return false;
  if (result.error || result.ok === false || ['error', 'cancelled'].includes(result.status)) return false;
  if (method === 'openclaw.setup.activate') return result.ok === true && result.gatewayRestartRequired === true;
  return result.done === true && result.status === 'done' && typeof result.modelActivation?.modelRef === 'string'
    && (result.modelActivation.gatewayRestartRequired === true || result.gatewayRestartRequired === true);
}

ipcMain.handle(SETUP_REQUEST_CHANNEL, async (event, payload) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted setup request");
  }
  if (smoke) throw new Error("Setup is disabled during startup smoke.");
  if (shuttingDown) throw new Error("Ứng dụng đang đóng.");
  const method = payload?.method;
  if (typeof method !== "string") {
    throw new Error("Setup request requires a method name");
  }
  if (!setupChannel) {
    throw new Error("Setup channel is not running");
  }
  const pageRequest = setupPageAccess.begin(method, payload?.params);
  let result;
  try {
    result = await setupChannel.request(method, payload?.params);
    pageRequest.complete(result);
  } catch (error) {
    pageRequest.fail();
    throw error;
  }
  if (finishesSetup(method, result)) {
    // Restart before returning so the renderer never talks to a dead child, and
    // so the next `verify` reads the settings that were just written.
    await restartGatewayForSetup().catch((error) => {
      if (shuttingDown) return;
      publishStatus({ lastError: String(error?.message ?? error) });
      throw error;
    });
  }
  return result;
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

if (hasInstanceLock) app.whenReady().then(async () => {
  if (app.isPackaged && !smoke) {
    try {
      updater = new UpdateService({ publicKey: JSON.parse(readFileSync(path.join(currentDirectory, 'update-public-key.json'), 'utf8')).publicKey,
        version: app.getVersion(), currentRoot: path.dirname(app.getPath('exe')), dataRoot: path.join(app.getPath('userData'), 'component-updates') });
      await updater.initialize();
      const target = await updater.startupTarget();
      if (target) { app.relaunch({ execPath: target, args: [] }); app.quit(); return; }
      const timer = setTimeout(() => { void updater.background(); }, 8000); timer.unref();
    } catch (error) { if (updater) updater.message = 'Giữ bản hiện tại: ' + error.message; }
  }
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  await createMainWindow();
  startRuntime().then(() => finishStartupSmoke()).catch((error) => {
    if (shuttingDown) return;
    if (smoke) { void finishStartupSmoke(false); return; }
    console.error("AI for Boss runtime failed to start", error);
    publishStatus({
      supervisor: SUPERVISOR_STATES.SAFE_MODE,
      lastError: String(error?.message ?? error)
    });
  });

  app.on("activate", async () => {
    if (!shuttingDown && BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
}).catch((error) => {
  if (smoke) { void finishStartupSmoke(false); return; }
  console.error("AI for Boss window failed to start", error);
});

app.on("before-quit", (event) => {
  // Every quit request must wait for the same cleanup, including recursive quits.
  event.preventDefault();
  if (shuttingDown) return;
  shuttingDown = true;
  const ownedTabs = webTabs; webTabs = null;
  const cleanup = async (operation) => {
    try { await operation(); } catch (error) {
      appExitCode = 1;
      console.error("AI for Boss shutdown cleanup failed", error);
    }
  };
  void (async () => {
    try {
      for (const operation of [
        () => ownedTabs?.dispose(), () => advisorService.cancelForShutdown(), () => channelPluginInstaller?.stop(),
        () => setupPageAccess.clear(), () => adapter?.disconnect(),
        () => setupChannel?.disconnect(), () => supervisor?.stop(),
      ]) await cleanup(operation);
    } finally {
      // Release Chromium windows after the owned runtime stops. On Windows,
      // app.exit alone can leave the main process and helpers alive.
      try {
        for (const window of BrowserWindow.getAllWindows()) await cleanup(() => { if (!window.isDestroyed()) window.destroy(); });
      } finally { app.exit(appExitCode); }
    }
  })();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
