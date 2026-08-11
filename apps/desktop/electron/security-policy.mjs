export const SHELL_STATUS_CHANNEL = "aifb:shell-status";

export function createWindowOptions({ preloadPath, isPackaged }) {
  return {
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: "#f3efe7",
    title: "AI for Boss",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      navigateOnDragDrop: false,
      devTools: !isPackaged
    }
  };
}

export function isTrustedRendererEvent(event, window) {
  return Boolean(
    window &&
      !window.isDestroyed() &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
  );
}

export function isAllowedNavigation(candidateUrl, rendererUrl) {
  return candidateUrl === rendererUrl;
}
