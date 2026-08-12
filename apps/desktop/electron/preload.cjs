const { contextBridge, ipcRenderer } = require("electron");

const SHELL_STATUS_CHANNEL = "aifb:shell-status";

const api = Object.freeze({
  getShellStatus: () => ipcRenderer.invoke(SHELL_STATUS_CHANNEL)
});

contextBridge.exposeInMainWorld("aiForBoss", api);
