/** Windows maximize keeps caption buttons; fullscreen hides them. */
export function keepWindowControlsVisible(window, platform = process.platform) {
  if (platform !== 'win32') return;
  window.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11') event.preventDefault();
  });
  window.on('enter-full-screen', () => {
    if (!window.isDestroyed()) window.setFullScreen(false);
  });
}
