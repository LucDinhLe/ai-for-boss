/** Native Paste emits the same Chromium clipboard event as Ctrl+V. */
export function installEditMenu(window, Menu) {
  window.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable || window.isDestroyed()) return;
    Menu.buildFromTemplate([
      { role: 'undo', label: 'Hoàn tác' },
      { role: 'redo', label: 'Làm lại' },
      { type: 'separator' },
      { role: 'cut', label: 'Cắt' },
      { role: 'copy', label: 'Sao chép' },
      { role: 'paste', label: 'Dán' },
      { role: 'selectAll', label: 'Chọn tất cả' }
    ]).popup({ window, frame: params.frame });
  });
}
