import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

for (const requiredPath of [
  "docs/feature-specs/0005-first-run-journey.md",
  "docs/release/FEATURE-0.5-AUDIT.md",
  "apps/desktop/src/first-run-machine.mjs",
  "apps/desktop/src/first-run-machine.d.ts",
  "apps/desktop/src/first-run-machine.d.mts",
  "tests/unit/first-run-machine.test.mjs",
  "tests/contract/first-run-security-contract.test.mjs"
]) if (!fs.existsSync(path.join(repoRoot, requiredPath))) failures.push(`missing ${requiredPath}`);

const app = read("apps/desktop/src/App.tsx");
const machine = read("apps/desktop/src/first-run-machine.mjs");
const index = read("apps/desktop/index.html");
const preload = read("apps/desktop/electron/preload.cjs");
const combined = `${app}\n${machine}`;

for (const marker of [
  'stage: "INSTALL"',
  'stage: "CONNECT"',
  'stage: "ASSIGN"',
  'stage: "COMPLETE"',
  'state: "PENDING_RESUME"',
  'plan: "pending-runtime"',
  'final: "pending-runtime"',
  "experimental-internal"
]) if (!combined.includes(marker)) failures.push(`missing first-run marker ${marker}`);

if (!index.includes("connect-src 'none'")) failures.push("renderer network is not denied");
if ([...preload.matchAll(/ipcRenderer\.invoke\(/g)].length !== 1) failures.push("preload IPC surface expanded");
if (/localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|new WebSocket\s*\(/.test(combined)) failures.push("first-run contains persistence or outbound transport code");
if ([...machine.matchAll(/live: false/g)].length !== 3 || /live:\s*true/.test(machine)) failures.push("connection fixtures are not strictly offline");
if (!machine.includes('bootstrapRetained: true') || !machine.includes('reportReady: false') || !machine.includes('remove-bootstrap-last')) failures.push("Genesis fail-closed contract is incomplete");

if (failures.length) {
  console.error("Feature 0.5 validation failed:");
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}
console.log("Feature 0.5 validation passed: three-step fixture journey; offline; resumable; fail-closed");
