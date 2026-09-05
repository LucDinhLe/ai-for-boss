const { contextBridge, ipcRenderer } = require("electron");

const SHELL_STATUS_CHANNEL = "aifb:shell-status";
const GATEWAY_REQUEST_CHANNEL = "aifb:gateway-request";
const GATEWAY_STATUS_CHANNEL = "aifb:gateway-status";
const GATEWAY_STATUS_EVENT_CHANNEL = "aifb:gateway-status-changed";
const GATEWAY_EVENT_CHANNEL = "aifb:gateway-event";
const SETUP_REQUEST_CHANNEL = "aifb:setup-request";

function subscribe(channel, listener) {
  if (typeof listener !== "function") return () => {};
  const handler = (_event, payload) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api = Object.freeze({
  getShellStatus: () => ipcRenderer.invoke(SHELL_STATUS_CHANNEL),
  gateway: Object.freeze({
    /** Method names are validated in the main process against the adapter allowlist. */
    request: (method, params) => ipcRenderer.invoke(GATEWAY_REQUEST_CHANNEL, { method, params }),
    getStatus: () => ipcRenderer.invoke(GATEWAY_STATUS_CHANNEL),
    onStatus: (listener) => subscribe(GATEWAY_STATUS_EVENT_CHANNEL, listener),
    onEvent: (listener) => subscribe(GATEWAY_EVENT_CHANNEL, listener)
  }),
  setup: Object.freeze({
    /** Provider connection only; the main process holds the admin scope. */
    request: (method, params) => ipcRenderer.invoke(SETUP_REQUEST_CHANNEL, { method, params })
  })
});

contextBridge.exposeInMainWorld("aiForBoss", api);
