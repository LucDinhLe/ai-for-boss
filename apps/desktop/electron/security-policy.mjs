import { fileURLToPath } from "node:url";

export const SHELL_STATUS_CHANNEL = "aifb:shell-status";

/** Renderer → main. Every call is checked against the adapter method allowlist. */
export const GATEWAY_REQUEST_CHANNEL = "aifb:gateway-request";

/** Renderer → main. Returns supervisor and connection state, never credentials. */
export const GATEWAY_STATUS_CHANNEL = "aifb:gateway-status";

/** Renderer → main. A user-triggered, argument-free retry of owned startup. */
export const GATEWAY_RETRY_CHANNEL = "aifb:gateway-retry-startup";

/** Renderer → main. Provider connection, checked against the setup allowlist. */
export const SETUP_REQUEST_CHANNEL = "aifb:setup-request";

/** Renderer → main. Selects a known wizard session, never a destination URL. */
export const SETUP_OPEN_PAGE_CHANNEL = "aifb:setup-open-page";

/** Main owns one bounded text-only Advisor request; never arbitrary Gateway RPC. */
export const MANAGEMENT_REQUEST_CHANNEL = "aifb:native-management";

export const ADVISOR_REQUEST_CHANNEL = "aifb:advisor-request";

/** Main → renderer. Runtime status transitions. */
export const GATEWAY_STATUS_EVENT_CHANNEL = "aifb:gateway-status-changed";

/** Main → renderer. Allowlisted Gateway events. */
export const GATEWAY_EVENT_CHANNEL = "aifb:gateway-event";

export const RENDERER_INVOKE_CHANNELS = Object.freeze([
  MANAGEMENT_REQUEST_CHANNEL,
  SHELL_STATUS_CHANNEL,
  GATEWAY_REQUEST_CHANNEL,
  GATEWAY_STATUS_CHANNEL,
  SETUP_REQUEST_CHANNEL,
  GATEWAY_RETRY_CHANNEL,
  SETUP_OPEN_PAGE_CHANNEL,
  ADVISOR_REQUEST_CHANNEL
]);

export const MAIN_TO_RENDERER_CHANNELS = Object.freeze([
  GATEWAY_STATUS_EVENT_CHANNEL,
  GATEWAY_EVENT_CHANNEL
]);

export function createWindowOptions({ preloadPath, isPackaged }) {
  return {
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    frame: true,
    titleBarStyle: "default",
    minimizable: true,
    maximizable: true,
    closable: true,
    fullscreen: false,
    ...(process.platform === "win32" ? { fullscreenable: false } : {}),
    backgroundColor: "#f3efe7",
    title: "AI for Boss",
    icon: fileURLToPath(new URL("./assets/icon-256.png", import.meta.url)),
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
