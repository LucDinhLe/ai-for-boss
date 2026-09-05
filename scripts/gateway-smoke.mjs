/**
 * Beta 0 integration smoke.
 *
 * Runs the shipped Supervisor and Gateway adapter against a real OpenClaw
 * install on the current operating system, with an isolated state directory and
 * no provider credential. It answers one product question with evidence rather
 * than assumption: does the embedded Gateway start and serve authenticated RPC
 * natively on this platform, or does the platform need a Linux subsystem?
 *
 * Usage: node scripts/gateway-smoke.mjs [--out <file>]
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import {
  GatewaySupervisor,
  SUPERVISOR_STATES,
  resolveNodeExecutable
} from "../apps/desktop/electron/supervisor.mjs";
import { GatewayAdapter, ALLOWED_METHODS } from "../apps/desktop/electron/gateway-adapter.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDesktop = createRequire(path.join(repoRoot, "apps", "desktop", "package.json"));

const outFlagIndex = process.argv.indexOf("--out");
const outPath =
  outFlagIndex >= 0 && process.argv[outFlagIndex + 1]
    ? path.resolve(process.argv[outFlagIndex + 1])
    : path.join(repoRoot, "artifacts", "beta-0", `gateway-smoke-${process.platform}-${process.arch}.json`);

const READ_PROBES = [
  "health",
  "models.list",
  "models.authStatus",
  "sessions.list",
  "agents.list",
  "projects.list",
  "usage.status"
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `openclaw` does not export its package.json, so the entry is resolved the way
 * the supervisor resolves it in production: from the installed package main.
 */
function packageRoot(specifier) {
  return path.resolve(path.dirname(requireFromDesktop.resolve(specifier)), "..");
}

function resolveOpenClawEntryFromDesktop() {
  return path.join(packageRoot("openclaw"), "openclaw.mjs");
}

function packageVersion(specifier) {
  return JSON.parse(readFileSync(path.join(packageRoot(specifier), "package.json"), "utf8")).version;
}

async function main() {
  const stateDirectory = mkdtempSync(path.join(os.tmpdir(), "aifb-smoke-"));
  const startedAt = Date.now();
  const record = {
    recordedAt: new Date().toISOString(),
    scope: "AI for Boss beta 0 — supervised OpenClaw Gateway, isolated state, no provider credential",
    host: {
      platform: process.platform,
      arch: process.arch,
      release: os.release(),
      node: process.version
    },
    linuxSubsystemUsed: false,
    supervisor: {},
    handshake: {},
    probes: {},
    failures: []
  };

  const nodeExecutable = resolveNodeExecutable();
  record.supervisor.nodeExecutable = nodeExecutable ? "resolved" : "missing";
  if (!nodeExecutable) {
    record.failures.push("no Node runtime resolved for the Gateway child");
    finish(record, stateDirectory, 1);
    return;
  }

  const openclawEntry = resolveOpenClawEntryFromDesktop();
  record.supervisor.openclawEntryResolved = true;
  record.runtime = {
    openclaw: packageVersion("openclaw"),
    gatewayClient: packageVersion("@openclaw/gateway-client"),
    gatewayProtocol: packageVersion("@openclaw/gateway-protocol")
  };

  const supervisor = new GatewaySupervisor({
    stateDirectory,
    nodeExecutable,
    openclawEntry,
    logger: { info: () => {}, warn: () => {}, error: () => {} }
  });

  let hello = null;
  const adapter = new GatewayAdapter({
    stateDirectory,
    appVersion: "0.0.0-beta0-smoke",
    logger: { warn: () => {} },
    onStatus: (status) => {
      if (status.phase === "connected") {
        hello = status;
        supervisor.markReady();
      }
    }
  });

  const { port } = await supervisor.start();
  record.supervisor.boundPort = port > 0;
  adapter.connect({ url: `ws://127.0.0.1:${port}`, token: supervisor.token });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !adapter.connected) {
    if (supervisor.state === SUPERVISOR_STATES.SAFE_MODE) break;
    await wait(500);
  }

  record.supervisor.state = supervisor.state;
  record.handshake.connected = adapter.connected;
  record.handshake.elapsedMs = Date.now() - startedAt;

  if (!adapter.connected) {
    record.failures.push(`handshake did not complete (supervisor state ${supervisor.state})`);
  } else {
    record.handshake.protocol = hello?.protocol ?? null;
    record.handshake.serverVersion = hello?.serverVersion ?? null;
    record.handshake.methodCount = adapter.hello?.features?.methods?.length ?? 0;
    record.handshake.scopes = adapter.hello?.auth?.scopes ?? [];
    record.handshake.deviceTokenMinted = Boolean(adapter.hello?.auth?.deviceToken);

    for (const method of READ_PROBES) {
      try {
        await adapter.request(method, method === "sessions.list" ? { limit: 1 } : undefined);
        record.probes[method] = "ok";
      } catch (error) {
        record.probes[method] = `failed: ${error?.message ?? error}`;
        record.failures.push(`${method} failed`);
      }
    }

    try {
      await adapter.request("config.patch", {});
      record.probes["config.patch"] = "unexpectedly allowed";
      record.failures.push("adapter allowed a method outside the allowlist");
    } catch (error) {
      record.probes["config.patch"] = `blocked: ${error?.message ?? error}`;
    }
    record.allowlistSize = ALLOWED_METHODS.length;
  }

  await adapter.disconnect();
  await supervisor.stop();
  record.supervisor.stoppedCleanly = supervisor.state === SUPERVISOR_STATES.IDLE;
  finish(record, stateDirectory, record.failures.length === 0 ? 0 : 1);
}

function finish(record, stateDirectory, exitCode) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`);
  try {
    rmSync(stateDirectory, { recursive: true, force: true });
  } catch {
    // a leftover temp directory is not a smoke failure
  }
  const verdict = exitCode === 0 ? "PASS" : "FAIL";
  console.log(`[beta-0 smoke] ${verdict} on ${record.host.platform}/${record.host.arch}`);
  console.log(`[beta-0 smoke] handshake=${record.handshake.connected ? "ok" : "no"} evidence=${outPath}`);
  for (const failure of record.failures) console.error(` - ${failure}`);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("[beta-0 smoke] fatal", error);
  process.exit(1);
});
