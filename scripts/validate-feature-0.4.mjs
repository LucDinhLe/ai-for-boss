import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWindowOptions } from "../apps/desktop/electron/security-policy.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const failures = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const rootPackage = readJson("package.json");
const desktopPackage = readJson("apps/desktop/package.json");
const runtime = readJson("manifests/runtime/runtime-manifest.lock.json");
const generated = readJson("apps/desktop/generated/shell-contract.json");
const preload = readText("apps/desktop/electron/preload.cjs");
const main = readText("apps/desktop/electron/main.mjs");
const index = readText("apps/desktop/index.html");
const workflow = readText(".github/workflows/desktop-shell.yml");

const componentVersions = Object.fromEntries(
  runtime.components.map((component) => [component.name, component.version])
);

requireEqual(rootPackage.packageManager, "pnpm@11.2.2", "root packageManager");
requireEqual(rootPackage.devDependencies.electron, componentVersions.electron, "Electron dependency pin");
requireEqual(desktopPackage.main, "electron/main.mjs", "desktop main entry");
requireEqual(generated.classification, "experimental-internal", "shell classification");
requireEqual(generated.releaseTrain.id, runtime.releaseTrainId, "shell release train");
requireEqual(generated.contractSummary.capabilityFamilies, 23, "capability family count");
requireEqual(generated.contractSummary.advertisableCapabilities, 0, "advertisable capability count");
requireEqual(generated.contractSummary.authModes, 9, "auth mode count");
requireEqual(generated.contractSummary.sourcesOfTruth, 9, "source-of-truth count");
requireEqual(generated.contractSummary.dataFlows, 8, "data-flow count");
requireEqual(generated.contractSummary.threats, 14, "threat count");

const options = createWindowOptions({ preloadPath: "preload.cjs", isPackaged: true });
const expectedPreferences = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  webSecurity: true,
  webviewTag: false,
  navigateOnDragDrop: false,
  devTools: false
};
for (const [key, expected] of Object.entries(expectedPreferences)) {
  requireEqual(options.webPreferences[key], expected, `webPreferences.${key}`);
}

// Beta 0 (D-0018) widens the preload from one read call to the three invoke
// channels and one receive helper the supervised runtime needs. The surface
// stays closed: renderer→main is invoke-only against a named allowlist, and
// main→renderer carries only events the adapter already filtered.
const preloadInvokes = [...preload.matchAll(/ipcRenderer\.invoke\(([^)]+)\)/g)];
requireEqual(preloadInvokes.length, 3, "preload invoke count");
for (const channel of ["aifb:shell-status", "aifb:gateway-request", "aifb:gateway-status"]) {
  if (!preload.includes(`"${channel}"`)) {
    failures.push(`preload does not use the allowlisted channel ${channel}`);
  }
}
if (/ipcRenderer\.(?:send|sendSync|once)\s*\(/.test(preload)) {
  failures.push("preload exposes a forbidden mutable IPC method");
}
requireEqual([...preload.matchAll(/ipcRenderer\.on\s*\(/g)].length, 1, "preload subscription helper count");
if (!preload.includes("ipcRenderer.removeListener")) {
  failures.push("preload subscriptions cannot be released");
}
if (!main.includes("app.enableSandbox()")) {
  failures.push("Electron main does not enable the global sandbox");
}
if (/remote-debugging|disable-web-security|no-sandbox/i.test(main)) {
  failures.push("Electron main contains a forbidden security-weakening flag");
}
if (!index.includes("connect-src 'none'")) {
  failures.push("renderer CSP does not deny outbound connections");
}

for (const requiredTerm of [
  "windows-latest",
  "macos-14",
  "ubuntu-latest",
  "24.19.0",
  "11.2.2",
  "experimental-internal"
]) {
  if (!workflow.includes(requiredTerm)) {
    failures.push(`desktop CI workflow is missing ${requiredTerm}`);
  }
}

if (process.argv.includes("--require-artifact")) {
  const inventoryPath = path.join(repoRoot, "out", "desktop", "artifact-inventory.json");
  if (!fs.existsSync(inventoryPath)) {
    failures.push("desktop artifact inventory is required but missing");
  } else {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    requireEqual(inventory.classification, "experimental-internal", "artifact classification");
    requireEqual(inventory.platform, process.platform, "artifact platform");
    requireEqual(inventory.architecture, process.arch, "artifact architecture");
    requireEqual(inventory.signed, false, "Feature 0.4 signed claim");
    requireEqual(inventory.distributable, false, "Feature 0.4 distribution claim");
    if (inventory.fileCount < 2 || inventory.totalBytes <= 0 || !inventory.appAsar?.sha256) {
      failures.push("desktop artifact inventory is incomplete");
    }
    const asarEntries = inventory.appAsar?.entries ?? [];
    if (
      asarEntries.length !== inventory.appAsar?.entryCount ||
      !asarEntries.includes("package.json") ||
      !asarEntries.includes("dist/index.html") ||
      !asarEntries.includes("electron/main.mjs") ||
      !asarEntries.includes("electron/preload.cjs") ||
      !asarEntries.includes("generated/shell-contract.json")
    ) {
      failures.push("app.asar allowlist inventory is incomplete");
    }
    if (asarEntries.some((entry) => /(^|\/)(?:src|node_modules)(\/|$)|\.map$/i.test(entry))) {
      failures.push("app.asar contains source, node_modules or source maps");
    }
  }
}

if (failures.length > 0) {
  console.error("Feature 0.4 validation failed:");
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Feature 0.4 validation passed: ${generated.releaseTrain.id}; ` +
    `capabilities=${generated.contractSummary.capabilityFamilies}; ` +
    `classification=${generated.classification}`
);
