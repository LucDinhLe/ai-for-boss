import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createWindowOptions,
  isAllowedNavigation,
  SHELL_STATUS_CHANNEL
} from "../../apps/desktop/electron/security-policy.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("packaged window keeps Electron security boundaries enabled", () => {
  const options = createWindowOptions({ preloadPath: "preload.cjs", isPackaged: true });

  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.sandbox, true);
  assert.equal(options.webPreferences.webSecurity, true);
  assert.equal(options.webPreferences.webviewTag, false);
  assert.equal(options.webPreferences.devTools, false);
  assert.equal(options.webPreferences.navigateOnDragDrop, false);
});

test("renderer navigation is constrained to the exact local entry point", () => {
  assert.equal(isAllowedNavigation("file:///app/index.html", "file:///app/index.html"), true);
  assert.equal(isAllowedNavigation("https://example.com", "file:///app/index.html"), false);
  assert.equal(isAllowedNavigation("file:///app/other.html", "file:///app/index.html"), false);
});

test("preload exposes only allowlisted, invoke-shaped IPC requests", () => {
  const preload = read("apps/desktop/electron/preload.cjs");

  assert.equal(SHELL_STATUS_CHANNEL, "aifb:shell-status");
  // Beta 0 (D-0019) adds the two supervised-runtime channels. The shape stays
  // request/response against named channels; nothing fire-and-forget appears.
  assert.equal([...preload.matchAll(/ipcRenderer\.invoke\(/g)].length, 4);
  assert.match(preload, /getShellStatus/);
  assert.doesNotMatch(preload, /ipcRenderer\.(?:send|sendSync|once)\s*\(/);
  // One receive helper, and it must hand back an unsubscribe.
  assert.equal([...preload.matchAll(/ipcRenderer\.on\s*\(/g)].length, 1);
  assert.match(preload, /ipcRenderer\.removeListener/);
});

test("main process does not opt out of the sandbox or web security", () => {
  const main = read("apps/desktop/electron/main.mjs");

  assert.match(main, /app\.enableSandbox\(\)/);
  assert.doesNotMatch(main, /remote-debugging|disable-web-security|no-sandbox/i);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /will-attach-webview/);
});

test("renderer policy denies all outbound network connections", () => {
  const html = read("apps/desktop/index.html");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /object-src 'none'/);
  assert.match(html, /frame-src 'none'/);
});
