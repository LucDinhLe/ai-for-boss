/* Isolated native Windows caption/lifecycle test. No Gateway or account. */
/* global __dirname */
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
app.disableHardwareAcceleration();
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/window-controls-welcome/native-window-controls.json');
const record = { scope: 'Real isolated Electron window with production window options and fullscreen guard; no real profile/account', checks: [], failures: [] };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  const end = Date.now() + 5000;
  while (!check()) { if (Date.now() > end) throw new Error(label); await sleep(25); }
}
let window;
app.whenReady().then(async () => {
  try {
    assert.equal(process.platform, 'win32');
    const { createWindowOptions } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/security-policy.mjs')));
    const { keepWindowControlsVisible } = await import(pathToFileURL(path.join(root, 'apps/desktop/electron/window-controls.mjs')));
    const options = createWindowOptions({ preloadPath: path.join(root, 'apps/desktop/electron/preload.cjs'), isPackaged: true });
    window = new BrowserWindow(options);
    keepWindowControlsVisible(window);
    await window.loadURL('data:text/html,<title>AI for Boss window controls test</title><p>Isolated window controls test</p>');
    window.showInactive();
    assert.ok(window.isMinimizable() && window.isMaximizable() && window.isClosable());
    const outer = window.getBounds(), content = window.getContentBounds();
    assert.ok(content.y > outer.y + 10, 'Native caption must occupy space above web content');
    record.captionInset = content.y - outer.y;
    record.checks.push('Native caption is outside renderer bounds; minimize/maximize/close supported');
    window.maximize(); await until(() => window.isMaximized(), 'maximize');
    assert.equal(window.isFullScreen(), false);
    window.unmaximize(); await until(() => !window.isMaximized(), 'restore');
    record.checks.push('Maximize and restore keep normal window mode');
    window.minimize(); await until(() => window.isMinimized(), 'minimize');
    window.restore(); await until(() => !window.isMinimized(), 'restore from taskbar');
    record.checks.push('Minimize and restore work');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'F11' });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'F11' });
    await sleep(150); assert.equal(window.isFullScreen(), false);
    window.setFullScreen(true); await sleep(200); assert.equal(window.isFullScreen(), false);
    record.checks.push('F11 and programmatic fullscreen cannot leave Windows caption hidden');
    const closed = new Promise(resolve => window.once('closed', resolve));
    window.close(); await closed;
    assert.equal(window.isDestroyed(), true);
    record.checks.push('Native close completes window lifecycle');
  } catch (error) { record.failures.push(error.message); }
  finally {
    if (window && !window.isDestroyed()) window.destroy();
    record.pass = record.failures.length === 0;
    record.recordedAt = new Date().toISOString();
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify(record)); app.exit(record.pass ? 0 : 1);
  }
});
app.on('window-all-closed', () => {});
