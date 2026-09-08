/**
 * Launches the packaged application itself.
 *
 * The runtime smoke proves the package carries a Node binary and an OpenClaw
 * install. It imports the shell's modules from the repository, so it cannot
 * see whether the packaged main process can load them — and that is exactly how
 * a build shipped that died on launch with
 * `Cannot find package '@openclaw/gateway-client'`. This check starts the real
 * executable with its own user-data directory and waits for the one file that
 * only exists after the whole chain has worked: the device token, which the
 * Gateway mints and the adapter stores after an authenticated handshake. The
 * identity file is created when the SDK starts, possibly after a listener gate;
 * its absence cannot prove the main process or Gateway failed to load.
 *
 * Usage: node scripts/packaged-app-smoke.mjs [--package <dir>] [--out <file>] [--timeout <seconds>]
 */

import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/** The executable name follows the packager's `executableName`, per platform. */
function findExecutable(packageDirectory) {
  if (process.platform === "darwin") {
    const bundle = readdirSync(packageDirectory).find((entry) => entry.endsWith(".app"));
    if (!bundle) throw new Error("no .app bundle in the packaged output");
    return path.join(packageDirectory, bundle, "Contents", "MacOS", "AI-for-Boss");
  }
  const binary = process.platform === "win32" ? "AI-for-Boss.exe" : "AI-for-Boss";
  const full = path.join(packageDirectory, binary);
  if (!existsSync(full)) throw new Error(`no executable at ${full}`);
  return full;
}

const FATAL = /A JavaScript error occurred|Uncaught Exception|ERR_MODULE_NOT_FOUND|Cannot find (?:package|module)/i;

const timeoutMs = Number(argValue("--timeout") ?? 270) * 1000;
if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 600_000) throw new Error("invalid smoke timeout");
const outPath = argValue("--out")
  ? path.resolve(argValue("--out"))
  : path.join(repoRoot, "artifacts", "beta-0", `packaged-app-${process.platform}-${process.arch}.json`);

const packageDirectory = findPackageDirectory();
const executable = findExecutable(packageDirectory);
const userData = longPath(mkdtempSync(path.join(longPath(os.tmpdir()), "aifb-app-")));

const record = {
  recordedAt: new Date().toISOString(),
  scope: "AI for Boss — the packaged executable starts and its main process reaches a connected Gateway",
  host: { platform: process.platform, arch: process.arch, release: os.release(), node: process.version },
  package: { directory: path.basename(packageDirectory), executable: path.basename(executable) },
  launch: {},
  failures: []
};

// A headless Linux runner has no display, so the app is wrapped in Xvfb when one
// is available. Everything else launches directly.
const needsXvfb = process.platform === "linux" && !process.env.DISPLAY;
const hasXvfb = needsXvfb && spawnSync("which", ["xvfb-run"], { encoding: "utf8" }).status === 0;
if (needsXvfb && !hasXvfb) record.failures.push("no display and no xvfb-run to provide one");

const appArgs = [`--user-data-dir=${userData}`, "--smoke-test", ...(process.platform === "linux" ? ["--no-sandbox"] : [])];
const command = hasXvfb ? "xvfb-run" : executable;
const commandArgs = hasXvfb ? ["-a", executable, ...appArgs] : appArgs;
record.launch.wrappedInXvfb = hasXvfb;

const output = [];
// Do not let native discovery borrow the developer's account or configuration.
// Keep only OS launch variables and an entirely separate temporary home.
const env = {};
for (const name of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "DISPLAY", "XAUTHORITY"]) {
  if (process.env[name]) env[name] = process.env[name];
}
Object.assign(env, { HOME: userData, USERPROFILE: userData, APPDATA: path.join(userData, "appdata"),
  LOCALAPPDATA: path.join(userData, "localappdata"), TEMP: path.join(userData, "tmp"), TMP: path.join(userData, "tmp"),
  PATH: process.platform === "win32" ? "" : "/usr/bin:/bin", OPENCLAW_SKIP_CHANNELS: "1",
  OPENCLAW_DISABLE_BONJOUR: "1", OPENCLAW_EXEC_SHELL_SNAPSHOT: "0", OPENCLAW_NO_RESPAWN: "1" });
for (const directory of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) mkdirSync(directory, { recursive: true });
const child = record.failures.length === 0 ? spawn(command, commandArgs, { env, windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"] }) : null;
let smokeReceipt = null;
let streamBuffer = "";
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const remember = (chunk, parseReceipt = false) => {
  const text = String(chunk).replace(ansi, "").trim();
  if (text && output.length < 100) output.push(text.slice(0, 300));
  if (!parseReceipt) return;
  streamBuffer += String(chunk);
  const lines = streamBuffer.split(/\r?\n/u);
  streamBuffer = lines.pop().slice(-16_384);
  for (const line of lines) {
    if (line.startsWith('{"kind":"AIFB_PACKAGED_APP_SMOKE"')) {
      try { smokeReceipt = JSON.parse(line); } catch { /* incomplete record is not success */ }
    }
  }
};
child?.stdout?.on("data", (chunk) => remember(chunk, true));
child?.stderr?.on("data", (chunk) => remember(chunk));
let spawnError = null;
child?.on("error", (error) => { spawnError = error.message; });

const stateDirectory = path.join(userData, "openclaw-state");
const identityPath = path.join(stateDirectory, "device-identity.json");
const tokenPath = path.join(stateDirectory, "device-token.json");
const startedAt = Date.now();
let connected = false;
let identityAt = null;
let fatal = null;

while (child && Date.now() - startedAt < timeoutMs) {
  if (spawnError) { fatal = spawnError; break; }
  if (identityAt === null && existsSync(identityPath)) identityAt = Date.now() - startedAt;
  if (smokeReceipt) {
    connected = smokeReceipt.connected === true && smokeReceipt.setupReady === true
      && smokeReceipt.rendererReady === true && existsSync(tokenPath);
    break;
  }
  fatal = output.find((line) => FATAL.test(line)) ?? null;
  if (fatal) break;
  if (child.exitCode !== null) break;
  await wait(500);
}

record.launch.elapsedMs = Date.now() - startedAt;
record.launch.deviceIdentityCreatedMs = identityAt;
record.launch.deviceTokenMinted = connected;
record.launch.bothChannelsReady = connected;
record.launch.rendererReady = smokeReceipt?.rendererReady === true;
record.launch.providerCalls = 0;
record.launch.isolatedHome = true;
record.launch.exitedEarly = child ? child.exitCode !== null : null;
// The first lines are where a module-resolution failure shows up.
record.launch.output = output.slice(0, 25);

if (child) {
  if (fatal) record.failures.push(`main process failed: ${fatal}`);
  else if (!connected) {
    record.failures.push(
      `the application did not confirm both Gateway handshakes and renderer readiness within ${Math.round(timeoutMs / 1000)}s`
    );
  }
  // The app's smoke mode quits through its normal lifecycle and awaits its
  // owned Gateway. Abruptly killing Electron first can orphan Node on Windows.
  const closeDeadline = Date.now() + 15_000;
  while (!spawnError && child.exitCode === null && Date.now() < closeDeadline) await wait(100);
  record.launch.gracefulExit = child.exitCode === 0;
  if (!spawnError && child.exitCode === null) {
    record.failures.push("packaged app did not close its owned runtime cleanly");
    if (process.platform === "win32") spawnSync("C:/Windows/System32/taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
    else child.kill("SIGKILL");
    await wait(500);
  }
  if (child.exitCode !== 0 && !record.failures.length) record.failures.push("packaged app exited unsuccessfully");
}

mkdirSync(path.dirname(outPath), { recursive: true });
const screenshot = path.join(userData, "startup-smoke.png");
if (existsSync(screenshot)) {
  const screenshotName = path.basename(outPath, ".json") + ".png";
  copyFileSync(screenshot, path.join(path.dirname(outPath), screenshotName));
  record.launch.screenshot = screenshotName;
}
// This target is the absolute directory created by mkdtemp above, never an
// arbitrary CLI argument or an installed user profile.
try {
  rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  record.launch.temporaryDataRemoved = true;
} catch (error) {
  record.launch.temporaryDataRemoved = false;
  record.failures.push(`temporary test data could not be removed (${error.code ?? "unknown"})`);
}
// Only diagnostics on failure; the success record contains no child log text.
if (record.failures.length === 0) delete record.launch.output;
writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);

const verdict = record.failures.length === 0 ? "PASS" : "FAIL";
console.log(`[packaged app] ${verdict} on ${record.host.platform}/${record.host.arch} in ${record.launch.elapsedMs} ms`);
console.log(`[packaged app] evidence=${outPath}`);
for (const failure of record.failures) console.error(` - ${failure}`);
if (record.failures.length > 0) for (const line of record.launch.output ?? []) console.error(`   app | ${line}`);
process.exit(record.failures.length === 0 ? 0 : 1);
