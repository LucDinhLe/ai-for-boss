import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, ipcMain, session } from "electron";
import {
  createWindowOptions,
  isAllowedNavigation,
  isTrustedRendererEvent,
  SHELL_STATUS_CHANNEL
} from "./security-policy.mjs";
import {
  createUnavailableShellContract,
  loadShellContract
} from "./shell-contract.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
let shellStatus = createUnavailableShellContract();

app.enableSandbox();

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

  mainWindow = new BrowserWindow(
    createWindowOptions({ preloadPath, isPackaged: app.isPackaged })
  );

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

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => event.preventDefault());
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
