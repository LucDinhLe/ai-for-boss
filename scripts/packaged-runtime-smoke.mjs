/**
 * Proves the packaged app is self-sufficient.
 *
 * The claim under test is narrow and checkable: with nothing on PATH, the
 * Gateway starts from the Node binary and the OpenClaw install that the package
 * itself carries, and serves authenticated RPC. It runs the shipped Supervisor
 * and Adapter, resolving both paths exactly the way the packaged main process
 * resolves them.
 *
 * Usage: node scripts/packaged-runtime-smoke.mjs [--package <dir>] [--out <file>]
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GatewaySupervisor, SUPERVISOR_STATES, resolveNodeExecutable, resolveOpenClawEntry } from "../apps/desktop/electron/supervisor.mjs";
import { GatewayAdapter } from "../apps/desktop/electron/gateway-adapter.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const longPath = (candidate) => {
  try {
    return realpathSync.native(candidate);
  } catch {
    return candidate;
  }
};

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** The packager writes one directory per platform under out/desktop. */
function findPackageDirectory() {
  const explicit = argValue("--package");
  if (explicit) return path.resolve(explicit);
  const root = path.join(repoRoot, "out", "desktop");
  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name));
  if (directories.length !== 1) {
    throw new Error(`expected exactly one packaged app under out/desktop, found ${directories.length}`);
  }
  return directories[0];
}

/** macOS nests the resources inside the .app bundle; the others do not. */
function findResourcesPath(packageDirectory) {
  const flat = path.join(packageDirectory, "resources");
  if (existsSync(flat)) return flat;
  const bundle = readdirSync(packageDirectory).find((entry) => entry.endsWith(".app"));
  if (bundle) {
    const nested = path.join(packageDirectory, bundle, "Contents", "Resources");
    if (existsSync(nested)) return nested;
  }
  throw new Error(`no resources directory inside ${packageDirectory}`);
}

const outPath = argValue("--out")
  ? path.resolve(argValue("--out"))
  : path.join(repoRoot, "artifacts", "beta-0", `packaged-runtime-${process.platform}-${process.arch}.json`);

const packageDirectory = findPackageDirectory();
const resourcesPath = findResourcesPath(packageDirectory);
const stateDirectory = longPath(mkdtempSync(path.join(longPath(os.tmpdir()), "aifb-packaged-")));

const record = {
  recordedAt: new Date().toISOString(),
  scope: "AI for Boss — the packaged app starts its Gateway with nothing installed on the host",
  host: { platform: process.platform, arch: process.arch, release: os.release(), node: process.version },
  package: { directory: path.basename(packageDirectory) },
  bundled: {},
  handshake: {},
  failures: []
};

// An empty PATH is the whole point: anything the run finds must come out of the
// package. `resolveNodeExecutable` falls back to PATH, so a host Node would
// silently rescue a package that carries none.
const strippedEnv = { ...process.env, PATH: "", Path: "", AIFB_NODE_PATH: "" };
const nodeExecutable = resolveNodeExecutable({ env: strippedEnv, resourcesPath });
record.bundled.nodeExecutable = nodeExecutable ? path.relative(resourcesPath, nodeExecutable).split(path.sep).join("/") : null;
record.bundled.nodeFromPackage = Boolean(nodeExecutable && nodeExecutable.startsWith(resourcesPath));

let openclawEntry = null;
try {
  openclawEntry = resolveOpenClawEntry(
    () => {
      throw new Error("workspace resolution is not allowed in this check");
    },
    { resourcesPath }
  );
} catch (error) {
  record.failures.push(`packaged OpenClaw entry did not resolve: ${error?.message ?? error}`);
}
record.bundled.openclawEntry = openclawEntry ? path.relative(resourcesPath, openclawEntry).split(path.sep).join("/") : null;

if (nodeExecutable && record.bundled.nodeFromPackage && openclawEntry) {
  const inventoryPath = path.join(repoRoot, "out", "desktop", "artifact-inventory.json");
  if (existsSync(inventoryPath)) {
    const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
    record.bundled.declared = inventory.bundledRuntime ?? null;
  }

  const supervisor = new GatewaySupervisor({
    stateDirectory,
    nodeExecutable,
    openclawEntry,
    logger: { info: () => {}, warn: () => {}, error: () => {} }
  });
  const adapter = new GatewayAdapter({
    stateDirectory,
    appVersion: "0.0.0-packaged-smoke",
    logger: { warn: () => {} },
    onStatus: (status) => {
      if (status.phase === "connected") supervisor.markReady();
    }
  });

  const startedAt = Date.now();
  const { port } = await supervisor.start();
  adapter.connect({ url: `ws://127.0.0.1:${port}`, token: supervisor.token });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !adapter.connected) {
    if (supervisor.state === SUPERVISOR_STATES.SAFE_MODE) break;
    await wait(500);
  }

  record.handshake.connected = adapter.connected;
  record.handshake.elapsedMs = Date.now() - startedAt;
  record.handshake.serverVersion = adapter.hello?.server?.version ?? null;
  if (!adapter.connected) {
    record.failures.push(`handshake did not complete (supervisor state ${supervisor.state})`);
  } else {
    try {
      await adapter.request("health");
      record.handshake.health = "ok";
    } catch (error) {
      record.handshake.health = `failed: ${error?.message ?? error}`;
      record.failures.push(`health failed: ${error?.message ?? error}`);
    }
  }

  await adapter.disconnect();
  await supervisor.stop();
} else if (!record.bundled.nodeFromPackage) {
  record.failures.push("the package does not carry a Node runtime");
}

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
rmSync(stateDirectory, { recursive: true, force: true });

const verdict = record.failures.length === 0 ? "PASS" : "FAIL";
console.log(`[packaged smoke] ${verdict} on ${record.host.platform}/${record.host.arch}`);
console.log(`[packaged smoke] node=${record.bundled.nodeExecutable} openclaw=${record.bundled.openclawEntry}`);
console.log(`[packaged smoke] evidence=${outPath}`);
for (const failure of record.failures) console.error(` - ${failure}`);
process.exit(record.failures.length === 0 ? 0 : 1);
