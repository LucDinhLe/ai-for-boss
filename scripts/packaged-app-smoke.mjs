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
 * identity file appears seconds earlier and proves only that the main process
 * loaded, so it is recorded as a milestone rather than as the verdict.
 *
 * Usage: node scripts/packaged-app-smoke.mjs [--package <dir>] [--out <file>] [--timeout <seconds>]
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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

const timeoutMs = Number(argValue("--timeout") ?? 120) * 1000;
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

const appArgs = [`--user-data-dir=${userData}`, ...(process.platform === "linux" ? ["--no-sandbox"] : [])];
const command = hasXvfb ? "xvfb-run" : executable;
const commandArgs = hasXvfb ? ["-a", executable, ...appArgs] : appArgs;
record.launch.wrappedInXvfb = hasXvfb;

const output = [];
const child = record.failures.length === 0 ? spawn(command, commandArgs, { stdio: ["ignore", "pipe", "pipe"] }) : null;
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const remember = (chunk) => {
  const text = String(chunk).replace(ansi, "").trim();
  if (text) output.push(text.slice(0, 300));
};
child?.stdout?.on("data", remember);
child?.stderr?.on("data", remember);

const stateDirectory = path.join(userData, "openclaw-state");
const identityPath = path.join(stateDirectory, "device-identity.json");
const tokenPath = path.join(stateDirectory, "device-token.json");
const startedAt = Date.now();
let connected = false;
let identityAt = null;
let fatal = null;

while (child && Date.now() - startedAt < timeoutMs) {
  if (identityAt === null && existsSync(identityPath)) identityAt = Date.now() - startedAt;
  if (existsSync(tokenPath)) {
    connected = true;
    break;
  }
  fatal = output.find((line) => FATAL.test(line)) ?? null;
  if (fatal) break;
  if (child.exitCode !== null) break;
  await wait(500);
}

record.launch.elapsedMs = Date.now() - startedAt;
record.launch.mainProcessLoadedMs = identityAt;
record.launch.deviceTokenMinted = connected;
record.launch.exitedEarly = child ? child.exitCode !== null : null;
// The first lines are where a module-resolution failure shows up.
record.launch.output = output.slice(0, 25);

if (child) {
  if (fatal) record.failures.push(`main process failed: ${fatal}`);
  else if (!connected) {
    record.failures.push(
      identityAt === null
        ? `the main process never got as far as starting the Gateway within ${Math.round(timeoutMs / 1000)}s`
        : `the main process started but never completed a Gateway handshake within ${Math.round(timeoutMs / 1000)}s`
    );
  }
  child.kill("SIGTERM");
  await wait(1_500);
  if (child.exitCode === null) child.kill("SIGKILL");
}

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
rmSync(userData, { recursive: true, force: true });

const verdict = record.failures.length === 0 ? "PASS" : "FAIL";
console.log(`[packaged app] ${verdict} on ${record.host.platform}/${record.host.arch} in ${record.launch.elapsedMs} ms`);
console.log(`[packaged app] evidence=${outPath}`);
for (const failure of record.failures) console.error(` - ${failure}`);
if (record.failures.length > 0) for (const line of record.launch.output ?? []) console.error(`   app | ${line}`);
process.exit(record.failures.length === 0 ? 0 : 1);
