import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("first-run UI labels provider, task, and artifact states as mock/internal", () => {
  const app = read("apps/desktop/src/App.tsx");
  for (const marker of [
    "Feature 0.5 · dữ liệu giả",
    "MÔ PHỎNG · KHÔNG KẾT NỐI",
    "Task không chạy, không gọi model",
    "Feature 0.5 · mock data",
    "SIMULATION · NOT CONNECTED",
    "runs no task, calls no model"
  ]) assert.ok(app.includes(marker), `missing honest-state marker: ${marker}`);
});

test("first-run source contains no persistence, outbound transport, or process execution", () => {
  const combined = `${read("apps/desktop/src/first-run-machine.mjs")}\n${read("apps/desktop/src/App.tsx")}`;
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|new WebSocket\s*\(/);
  assert.doesNotMatch(combined, /writeFile|unlink|rmSync|spawn\s*\(|exec\s*\(/);
  assert.doesNotMatch(combined, /(?:^|[^A-Za-z])sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/);
});

test("renderer preload boundary remains one read-only shell-status request", () => {
  const preload = read("apps/desktop/electron/preload.cjs");
  assert.equal([...preload.matchAll(/ipcRenderer\.invoke\(/g)].length, 1);
  assert.match(preload, /getShellStatus/);
  assert.doesNotMatch(preload, /ipcRenderer\.(?:send|sendSync|on|once)\s*\(/);
});

test("renderer CSP remains offline and scripts remain local", () => {
  const html = read("apps/desktop/index.html");
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /object-src 'none'/);
});

test("fixture contract cannot claim a live connection", () => {
  const machine = read("apps/desktop/src/first-run-machine.mjs");
  assert.equal([...machine.matchAll(/live: false/g)].length, 3);
  assert.doesNotMatch(machine, /live:\s*true/);
  assert.match(machine, /fixture-not-allowed/);
  assert.match(machine, /remove-bootstrap-last/);
});
