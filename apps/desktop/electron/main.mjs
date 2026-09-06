import path from "node:path";
import { mkdirSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, session } from "electron";
import {
  createWindowOptions,
  isAllowedNavigation,
  isTrustedRendererEvent,
  GATEWAY_EVENT_CHANNEL,
  GATEWAY_REQUEST_CHANNEL,
  GATEWAY_STATUS_CHANNEL,
  GATEWAY_STATUS_EVENT_CHANNEL,
  SETUP_REQUEST_CHANNEL,
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

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const CONNECT_RETRY_MS = 1_000;
const CONNECT_TIMEOUT_MS = 60_000;

let mainWindow = null;
let shellStatus = createUnavailableShellContract();
let supervisor = null;
let adapter = null;
let setupChannel = null;
let gatewayEndpoint = null;
let runtimeStatus = {
  supervisor: SUPERVISOR_STATES.IDLE,
  detail: null,
  connected: false,
  setupReady: false,
  serverVersion: null,
  protocol: null,
  nodeRuntime: null,
  stateDirectory: null,
  lastError: null
};

app.enableSandbox();

function publishStatus(patch) {
  runtimeStatus = { ...runtimeStatus, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(GATEWAY_STATUS_EVENT_CHANNEL, runtimeStatus);
  }
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
  const directory = stateDirectory();
  const nodeExecutable = resolveNodeExecutable({ resourcesPath: process.resourcesPath });
  publishStatus({ stateDirectory: directory, nodeRuntime: nodeExecutable });

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
    onStateChange: ({ state, detail }) => publishStatus({ supervisor: state, detail })
  });

  adapter = new GatewayAdapter({
    stateDirectory: directory,
    appVersion: app.getVersion(),
    onStatus: (status) => {
      if (status.phase === "connected") {
        supervisor?.markReady();
        publishStatus({
          connected: true,
          serverVersion: status.serverVersion ?? null,
          protocol: status.protocol ?? null,
          lastError: null
        });
        return;
      }
      if (status.phase === "closed") {
        publishStatus({ connected: false });
        return;
      }
      publishStatus({ lastError: status.message ?? null });
    },
    onEvent: (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(GATEWAY_EVENT_CHANNEL, payload);
      }
    }
  });

  setupChannel = new SetupChannel({
    stateDirectory: directory,
    appVersion: app.getVersion(),
    onStatus: (status) => publishStatus({ setupReady: status.phase === "connected" })
  });

  const { port, token } = await supervisor.start();
  gatewayEndpoint = { url: `ws://127.0.0.1:${port}`, token };
  await connectWithRetry(gatewayEndpoint);
  setupChannel.connect(gatewayEndpoint);
}

/**
 * Activating a provider asks the Gateway to restart. The child is ours, so the
 * host restarts it and reconnects both channels rather than leaving the app
 * pointed at a process that is going away.
 */
async function restartGatewayForSetup() {
  publishStatus({ connected: false, setupReady: false, detail: "provider-activated" });
  await Promise.all([adapter?.disconnect(), setupChannel?.disconnect()]);
  await supervisor?.stop();
  const { port, token } = await supervisor.start();
  gatewayEndpoint = { url: `ws://127.0.0.1:${port}`, token };
  await connectWithRetry(gatewayEndpoint);
  setupChannel.connect(gatewayEndpoint);
}

/**
 * The Gateway accepts the WebSocket before it finishes starting, so the host
 * retries the handshake on a bounded schedule rather than scraping the log for
 * a readiness string.
 */
async function connectWithRetry({ url, token }) {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  adapter.connect({ url, token });
  while (Date.now() < deadline) {
    if (adapter.connected) return;
    if (supervisor?.state === SUPERVISOR_STATES.SAFE_MODE) return;
    await new Promise((resolve) => setTimeout(resolve, CONNECT_RETRY_MS));
  }
  publishStatus({ lastError: "Hết thời gian chờ Gateway sẵn sàng." });
}

async function createMainWindow() {
  const appRoot = app.getAppPath();
  const rendererPath = path.join(appRoot, "dist", "index.html");
  const rendererUrl = pathToFileURL(rendererPath).href;
  const preloadPath = path.join(currentDirectory, "preload.cjs");
  const contractPath = path.join(appRoot, "generated", "shell-contract.json");

  try {
    shellStatus = await loadShellContract(contractPath);
  } catch (error) {
    console.error("AI for Boss shell contract unavailable", error);
    shellStatus = createUnavailableShellContract("contract-validation-failed");
  }

  mainWindow = new BrowserWindow(createWindowOptions({ preloadPath, isPackaged: app.isPackaged }));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, candidateUrl) => {
    if (!isAllowedNavigation(candidateUrl, rendererUrl)) {
      event.preventDefault();
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  await mainWindow.loadFile(rendererPath);
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

ipcMain.handle(GATEWAY_REQUEST_CHANNEL, async (event, payload) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted gateway request");
  }
  const method = payload?.method;
  if (typeof method !== "string") {
    throw new Error("Gateway request requires a method name");
  }
  if (!adapter) {
    throw new Error("Gateway adapter is not running");
  }
  return adapter.request(method, payload?.params);
});

/**
 * A finished setup wizard writes provider settings into a Gateway that is
 * already running, and the running child keeps serving the old ones until it
 * restarts: `openclaw.setup.verify` answers "saved but not active yet" until
 * then. The wizard reports completion without asking for a restart, so the host
 * treats a finished setup session as the trigger.
 */
function finishesSetup(method, result) {
  if (!result || typeof result !== "object") return false;
  if (!/^(wizard\.|openclaw\.setup\.)/.test(method) || method === "wizard.cancel") return false;
  return result.done === true || result.status === "done" || result.status === "completed";
}

ipcMain.handle(SETUP_REQUEST_CHANNEL, async (event, payload) => {
  if (!isTrustedRendererEvent(event, mainWindow)) {
    throw new Error("Untrusted setup request");
  }
  const method = payload?.method;
  if (typeof method !== "string") {
    throw new Error("Setup request requires a method name");
  }
  if (!setupChannel) {
    throw new Error("Setup channel is not running");
  }
  const result = await setupChannel.request(method, payload?.params);
  if (result?.gatewayRestartRequired || finishesSetup(method, result)) {
    // Restart before returning so the renderer never talks to a dead child, and
    // so the next `verify` reads the settings that were just written.
    await restartGatewayForSetup().catch((error) => {
      publishStatus({ lastError: String(error?.message ?? error) });
    });
  }
  return result;
});

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  await createMainWindow();
  startRuntime().catch((error) => {
    console.error("AI for Boss runtime failed to start", error);
    publishStatus({
      supervisor: SUPERVISOR_STATES.SAFE_MODE,
      lastError: String(error?.message ?? error)
    });
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

let shuttingDown = false;
app.on("before-quit", (event) => {
  if (shuttingDown) return;
  shuttingDown = true;
  event.preventDefault();
  Promise.resolve()
    .then(() => adapter?.disconnect())
    .then(() => setupChannel?.disconnect())
    .then(() => supervisor?.stop())
    .catch(() => {})
    .finally(() => app.exit(0));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
