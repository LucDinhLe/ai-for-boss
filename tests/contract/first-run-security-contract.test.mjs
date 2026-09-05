import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(left, right) {
  const [bright, dark] = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (bright + 0.05) / (dark + 0.05);
}

test("first-run UI labels provider, task, and artifact states as mock/internal", () => {
  const app = read("apps/desktop/src/first-run/first-run-journey.tsx");
  for (const marker of [
    "Feature 0.5 · dữ liệu giả",
    "MÔ PHỎNG · KHÔNG KẾT NỐI",
    "Task không chạy, không gọi model",
    "Kế hoạch mẫu · chưa thực thi",
    "Feature 0.5 · mock data",
    "SIMULATION · NOT CONNECTED",
    "runs no task, calls no model"
  ]) assert.ok(app.includes(marker), `missing honest-state marker: ${marker}`);
});

test("first-run source contains no persistence, outbound transport, or process execution", () => {
  const combined = `${read("apps/desktop/src/first-run-machine.mjs")}\n${read("apps/desktop/src/first-run/first-run-journey.tsx")}`;
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|new WebSocket\s*\(/);
  assert.doesNotMatch(combined, /writeFile|unlink|rmSync|spawn\s*\(|exec\s*\(/);
  assert.doesNotMatch(combined, /(?:^|[^A-Za-z])sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/);
});

test("renderer cannot self-assert trusted Genesis promotion evidence", () => {
  const app = read("apps/desktop/src/first-run/first-run-journey.tsx");
  assert.match(app, /approvePreviewGenesis/);
  assert.doesNotMatch(app, /approveGenesis|PASSING_PROMOTION_CHECKS|trusted-supervisor-runtime/);
  assert.match(app, /emoji/);
  assert.match(app, /priority/);
  assert.match(app, /disabled=\{journey\.connection\.status === "connected-fixture"\}/);
  assert.match(app, /readinessChecks\.map/);
  assert.match(app, /passed: index === 0 \? bridgeReady : true/);
});

test("light theme text colors and minimum viewport remain accessible", () => {
  const styles = read("apps/desktop/src/styles.css");
  const securityPolicy = read("apps/desktop/electron/security-policy.mjs");
  assert.ok(contrastRatio("9b5428", "f3efe7") >= 4.5, "copper on paper must meet WCAG AA text contrast");
  assert.ok(contrastRatio("9b5428", "fffaf3") >= 4.5, "button label on copper must meet WCAG AA text contrast");
  assert.ok(contrastRatio("477159", "f3efe7") >= 4.5, "safe state on paper must meet WCAG AA text contrast");
  assert.match(styles, /@media \(max-width: 1000px\)/);
  assert.match(securityPolicy, /minWidth: 980/);
  assert.match(styles, /button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible/);
});

test("renderer preload boundary stays request-shaped and allowlisted", () => {
  const preload = read("apps/desktop/electron/preload.cjs");
  // The fixture journey still reads shell status only; beta 0 (D-0019) added
  // the supervised-runtime channels beside it without loosening the shape.
  assert.equal([...preload.matchAll(/ipcRenderer\.invoke\(/g)].length, 4);
  assert.match(preload, /getShellStatus/);
  assert.doesNotMatch(preload, /ipcRenderer\.(?:send|sendSync|once)\s*\(/);
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
  assert.match(machine, /validateFirstRunSnapshot/);
  assert.match(machine, /snapshot-invariant-failed/);
  assert.match(machine, /stage-identity-preview/);
});
