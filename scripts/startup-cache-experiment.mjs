/** Feature 0012 exploratory measurement. No product defaults or provider RPCs. */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(here), "..");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const value = name => process.argv[process.argv.indexOf(name) + 1];
const cases = ["baseline-fresh", "baseline-reuse", "disabled-fresh", "disabled-reuse"];
const resources = path.resolve(value("--resources"));
const node = path.join(resources, "runtime/node/node.exe");
const entry = path.join(resources, "node_modules/openclaw/openclaw.mjs");
const outputDirectory = path.join(root, "artifacts/continuous-chat/startup-cache-experiment");
const systemDirectory = path.join(process.env.SystemRoot ?? "C:/Windows", "System32");
const isWorker = process.argv.includes("--worker");

function osSnapshot() {
  const script = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress";
  const result = spawnSync(path.join(systemDirectory, "WindowsPowerShell/v1.0/powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-Command", script], { env: process.env, encoding: "utf8", windowsHide: true, timeout: 8000 });
  if (result.status !== 0) throw new Error("OS_PROCESS_READ_FAILED");
  return JSON.parse(result.stdout);
}
function descendants(snapshot, parentIds) {
  const known = new Set(parentIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of snapshot) if (known.has(item.ParentProcessId) && !known.has(item.ProcessId)) {
      known.add(item.ProcessId); changed = true;
    }
  }
  return snapshot.filter(item => known.has(item.ProcessId));
}
function listeners(port) {
  const result = spawnSync(path.join(systemDirectory, "netstat.exe"), ["-ano", "-p", "tcp"],
    { env: process.env, encoding: "utf8", windowsHide: true, timeout: 5000 });
  if (result.status !== 0) throw new Error("OS_LISTENER_READ_FAILED");
  return result.stdout.split(/\r?\n/u).flatMap(line => {
    const fields = line.trim().split(/\s+/u);
    return fields[0] === "TCP" && fields[1]?.endsWith(`:${port}`) && fields[3] === "LISTENING"
      ? [{ address: fields[1], pid: Number(fields[4]) }] : [];
  });
}
function cacheSize(directory) {
  const summary = { files: 0, bytes: 0 };
  if (!existsSync(directory)) return summary;
  const visit = folder => {
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, item.name);
      if (item.isDirectory()) visit(file);
      else if (item.isFile()) { summary.files++; summary.bytes += statSync(file).size; }
      else throw new Error("UNEXPECTED_CACHE_LINK");
    }
  };
  visit(directory);
  return summary;
}
function writeRecord(name, record) {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(path.join(outputDirectory, `${name}.json`), JSON.stringify(record, null, 2) + "\n");
}
function assertTemporaryHome(directory) {
  const actual = realpathSync.native(directory);
  const parent = path.dirname(actual);
  if (parent !== realpathSync.native(os.tmpdir()) || !/^aifb-cache-study-[A-Za-z0-9]+$/u.test(path.basename(actual)))
    throw new Error("UNSAFE_EXPERIMENT_HOME");
  return actual;
}

async function worker() {
  const name = value("--worker");
  if (!cases.includes(name) || process.version !== "v24.19.0" || process.platform !== "win32") throw new Error("UNEXPECTED_TEST_RUNTIME");
  const disabled = name.startsWith("disabled");
  if ((process.env.NODE_DISABLE_COMPILE_CACHE === "1") !== disabled || process.env.NODE_COMPILE_CACHE !== undefined)
    throw new Error("UNEXPECTED_CACHE_ENVIRONMENT");
  const home = process.env.HOME;
  if (!home || process.env.USERPROFILE !== home || process.env.PATH !== "" || !path.basename(home).startsWith("aifb-cache-study-"))
    throw new Error("EXPERIMENT_ISOLATION_REQUIRED");
  const version = JSON.parse(readFileSync(path.join(resources, "node_modules/openclaw/package.json"), "utf8")).version;
  if (version !== "2026.9.1") throw new Error("UNEXPECTED_OPENCLAW_VERSION");
  const { GatewaySupervisor } = await import("../apps/desktop/electron/supervisor.mjs");
  const { GatewayAdapter } = await import("../apps/desktop/electron/gateway-adapter.mjs");
  const { SetupChannel } = await import("../apps/desktop/electron/setup-channel.mjs");
  const nativeRequire = createRequire(path.join(resources, "package.json"));
  const { GatewayClient } = await import(pathToFileURL(nativeRequire.resolve("@openclaw/gateway-client")));
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const stateDirectory = path.join(home, "gateway-state");
  mkdirSync(stateDirectory, { recursive: true });
  const cacheDirectory = path.join(process.env.TEMP, "node-compile-cache");
  const record = { case: name, startedAt: new Date().toISOString(), node: process.version, openclaw: version,
    cacheMode: disabled ? "NODE_DISABLE_COMPILE_CACHE=1" : "upstream-default-in-process",
    homeFresh: name.endsWith("fresh"), osFileCache: "already-warm-or-uncontrolled; not a cold-OS claim",
    cacheBefore: cacheSize(cacheDirectory), cacheAfter: null, gatewaySpawnMs: null, chatReadyMs: null, setupReadyMs: null, bothReadyMs: null,
    ownedPids: [], phases: [], supervisorStates: [], sdkErrors: { chat: 0, setup: 0 },
    providerRequestsDispatched: 0, requestScope: "harness calls no adapter.request or setup.request; not packet monitoring",
    discardedLogChunks: 0, failures: [] };
  let quitting = false, port = null, supervisor;
  const reportPhase = message => {
    const text = String(message);
    const mark = text.match(/\[gateway\] (loading configuration|resolving authentication|starting HTTP server|starting channels and sidecars|http server listening|ready|starting\.\.\.)/u)?.[1];
    if (mark && record.phases.length < 80) record.phases.push({ atMs: elapsed(), mark });
    record.discardedLogChunks++;
  };
  const logger = { info: reportPhase, warn: reportPhase, error: () => { record.discardedLogChunks++; } };
  supervisor = new GatewaySupervisor({ stateDirectory, nodeExecutable: node, openclawEntry: entry, logger,
    onStateChange: ({ state }) => record.supervisorStates.push({ atMs: elapsed(), state }),
    spawnChild: (command, args, options) => {
      record.gatewaySpawnMs ??= elapsed();
      const child = spawn(command, args, options);
      child.once("spawn", () => {
        record.ownedPids.push(child.pid);
        process.send?.({ kind: "owned-pid", pid: child.pid });
      });
      return child;
    }
  });
  const chat = new GatewayAdapter({ stateDirectory, appVersion: "0.0.5-beta.2", Client: GatewayClient, logger,
    onStatus: status => {
      if (status.phase === "connected") { record.chatReadyMs ??= elapsed(); supervisor.markReady(); }
      if (status.phase === "connect-error") record.sdkErrors.chat++;
    } });
  const setup = new SetupChannel({ stateDirectory, appVersion: "0.0.5-beta.2", Client: GatewayClient, logger,
    onStatus: status => {
      if (status.phase === "connected") record.setupReadyMs ??= elapsed();
      if (status.phase === "connect-error") record.sdkErrors.setup++;
    } });
  const denyRequest = () => { record.providerRequestsDispatched++; throw new Error("NO_REQUESTS_IN_STARTUP_EXPERIMENT"); };
  chat.request = denyRequest; setup.request = denyRequest;
  process.on("message", message => { if (message?.kind === "stop") quitting = true; });
  let seenDescendants = [];
  try {
    const endpoint = await supervisor.start();
    port = endpoint.port;
    const connection = { url: `ws://127.0.0.1:${port}`, token: endpoint.token };
    chat.connect(connection); setup.connect(connection);
    let nextProgress = 20_000;
    while (!quitting && elapsed() < 220_000) {
      if (chat.connected && setup.connected) { record.bothReadyMs = elapsed(); break; }
      if (supervisor.state === "safe-mode" || record.ownedPids.length > 1) break;
      if (elapsed() >= nextProgress) { process.send?.({ kind: "progress", case: name, elapsedMs: elapsed() }); nextProgress += 20_000; }
      await wait(100);
    }
    if (record.bothReadyMs === null) record.failures.push("BOTH_HANDSHAKES_NOT_READY_WITHIN_220S");
    const currentListeners = listeners(port);
    record.listenerCheck = { ownedPid: record.ownedPids[0] ?? null, listeners: currentListeners,
      matchesOneOwnedPid: record.ownedPids.length === 1 && currentListeners.length > 0
        && currentListeners.every(item => item.pid === record.ownedPids[0] && item.address.startsWith("127.0.0.1:")) };
    if (!record.listenerCheck.matchesOneOwnedPid) record.failures.push("LISTENER_OWNERSHIP_NOT_PROVEN");
    seenDescendants = descendants(osSnapshot(), record.ownedPids);
    record.childProcessCountBeforeStop = seenDescendants.length;
  } catch (error) {
    record.failures.push(typeof error?.code === "string" ? error.code : "EXPERIMENT_RUN_FAILED");
  } finally {
    const shutdown = elapsed();
    try { await Promise.all([chat.disconnect(), setup.disconnect()]); await supervisor.stop(); }
    catch { record.failures.push("OWNED_STOP_FAILED"); }
    try {
      const remaining = descendants(osSnapshot(), [...record.ownedPids, ...seenDescendants.map(item => item.ProcessId)]);
      record.remainingOwnedPids = remaining.map(item => item.ProcessId);
      record.listenerGone = port === null || listeners(port).length === 0;
      record.ownedTreeGone = remaining.length === 0;
      if (!record.ownedTreeGone || !record.listenerGone) record.failures.push("OWNED_PROCESS_OR_LISTENER_REMAINS");
    } catch { record.failures.push("POST_STOP_OS_READ_FAILED"); }
    record.shutdownMs = elapsed() - shutdown;
    record.totalMs = elapsed();
    record.spawnToBothReadyMs = record.bothReadyMs === null ? null : record.bothReadyMs - record.gatewaySpawnMs;
    record.cacheAfter = cacheSize(cacheDirectory);
    if (process.send) await new Promise(resolve => process.send({ kind: "result", record }, resolve));
  }
}

async function runCase(name, home) {
  const env = {};
  for (const key of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT"]) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, "appdata"), LOCALAPPDATA: path.join(home, "localappdata"),
    TEMP: path.join(home, "tmp"), TMP: path.join(home, "tmp"), PATH: "", OPENCLAW_DISABLE_BONJOUR: "1",
    OPENCLAW_EXEC_SHELL_SNAPSHOT: "0", OPENCLAW_NO_RESPAWN: "1", OPENCLAW_SKIP_CHANNELS: "1" });
  if (name.startsWith("disabled")) env.NODE_DISABLE_COMPILE_CACHE = "1";
  for (const directory of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) mkdirSync(directory, { recursive: true });
  console.log(`[cache experiment] START ${name}`);
  const child = spawn(node, [here, "--resources", resources, "--worker", name], { env, cwd: root, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", "ipc"] });
  const ownedPids = [];
  let record = null, discardedOutputBytes = 0, timedOut = false;
  child.stdout.on("data", chunk => { discardedOutputBytes += chunk.length; });
  child.stderr.on("data", chunk => { discardedOutputBytes += chunk.length; });
  child.on("message", message => {
    if (message?.kind === "owned-pid") ownedPids.push(message.pid);
    if (message?.kind === "result") record = message.record;
    if (message?.kind === "progress") console.log(`[cache experiment] ${name}: ${Math.round(message.elapsedMs / 1000)}s waiting`);
  });
  const soft = setTimeout(() => { if (child.connected) child.send({ kind: "stop" }); }, 220_000);
  const hard = setTimeout(() => {
    timedOut = true;
    // This PID is the Node worker spawned immediately above; /T is confined to its test tree.
    spawnSync(path.join(systemDirectory, "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 8000 });
  }, 240_000);
  const code = await new Promise(resolve => { child.once("exit", resolve); child.once("error", () => resolve(1)); });
  clearTimeout(soft); clearTimeout(hard);
  record ??= { case: name, ownedPids, failures: ["WORKER_DID_NOT_RETURN_RECEIPT"] };
  record.workerExitCode = code; record.hardTimeout = timedOut; record.discardedWorkerOutputBytes = discardedOutputBytes;
  if (code !== 0) record.failures.push("WORKER_EXIT_FAILURE");
  const remaining = descendants(osSnapshot(), [child.pid, ...ownedPids]);
  record.orchestratorConfirmsTreeGone = remaining.length === 0;
  if (remaining.length) record.failures.push("TEST_TREE_REMAINS");
  writeRecord(name, record);
  console.log(`[cache experiment] END ${name}: both=${record.bothReadyMs ?? "unavailable"}ms failures=${record.failures.length}`);
  if (remaining.length) throw new Error("TEST_TREE_REMAINS_STOPPING_EXPERIMENT");
  return record;
}

async function orchestrate() {
  if (process.platform !== "win32" || process.version !== "v24.19.0" || !existsSync(node) || !existsSync(entry)) throw new Error("PINNED_WINDOWS_RUNTIME_REQUIRED");
  const homes = [mkdtempSync(path.join(realpathSync.native(os.tmpdir()), "aifb-cache-study-")),
    mkdtempSync(path.join(realpathSync.native(os.tmpdir()), "aifb-cache-study-"))].map(assertTemporaryHome);
  const records = [];
  const summary = { recordedAt: new Date().toISOString(), classification: "exploratory-four-runs-not-performance-guarantee",
    sourceCheckpoint: "869bd8a", sourceRuntime: "InternalBuilds/0.0.5-beta.2/resources", hardWallPerRunMs: 240000,
    handshakeBudgetMs: 220000, cleanupReserveMs: 20000, order: cases,
    isolation: "two empty temporary homes; second run per cache mode reuses only that mode's temporary home",
    osCache: "already warm/uncontrolled; fixed order and n=1 per condition confound causal inference",
    providerRequestsDispatched: 0, installedProfileTouched: false, productionDefaultsChanged: false,
    temporaryHomesRemoved: false, records, failures: [] };
  try {
    for (let index = 0; index < cases.length; index++) records.push(await runCase(cases[index], homes[Math.floor(index / 2)]));
  } catch (error) { summary.failures.push(error.message === "TEST_TREE_REMAINS_STOPPING_EXPERIMENT" ? error.message : "EXPERIMENT_ABORTED"); }
  finally {
    // Do not remove a home while a test runtime may still own it.
    const safeToRemove = records.every(record => record.orchestratorConfirmsTreeGone) && !summary.failures.length;
    if (safeToRemove) {
      for (const home of homes) rmSync(assertTemporaryHome(home), { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
      summary.temporaryHomesRemoved = true;
    } else summary.failures.push("TEST_HOMES_PRESERVED_FOR_OWNERSHIP_REVIEW");
    writeRecord("summary", summary);
  }
  if (records.length !== 4 || records.some(record => record.failures.length) || summary.failures.length) process.exitCode = 1;
  console.log(`[cache experiment] SUMMARY ${path.join(outputDirectory, "summary.json")}`);
}

try {
  if (isWorker) { await worker(); process.exit(0); }
  else await orchestrate();
} catch {
  if (isWorker) process.send?.({ kind: "result", record: { case: value("--worker"), failures: ["WORKER_PREFLIGHT_OR_CLEANUP_FAILED"] } });
  process.exitCode = 1;
  if (isWorker) process.exit(1);
}
