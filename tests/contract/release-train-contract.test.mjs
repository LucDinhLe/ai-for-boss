import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..");
const validator = path.join(repoRoot, "scripts", "validate-runtime-manifest.mjs");
const manifestPath = path.join(
  repoRoot,
  "manifests",
  "runtime",
  "runtime-manifest.lock.json"
);
const contractPath = path.join(
  repoRoot,
  "manifests",
  "runtime",
  "gateway-contract.lock.json"
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runValidator({ manifest = readJson(manifestPath), contract = readJson(contractPath) } = {}) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aifb-release-train-"));
  const fixtureManifest = path.join(fixtureRoot, "runtime-manifest.json");
  const fixtureContract = path.join(fixtureRoot, "gateway-contract.json");
  fs.writeFileSync(fixtureManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(fixtureContract, `${JSON.stringify(contract, null, 2)}\n`);

  try {
    return spawnSync(process.execPath, [validator], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        AIFB_RUNTIME_MANIFEST: fixtureManifest,
        AIFB_GATEWAY_CONTRACT: fixtureContract
      }
    });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("accepts the pinned stable OpenClaw WebSocket RPC contract", () => {
  const result = runValidator();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /status: locked; Gateway protocol: v4/);
});

test("rejects a locked train that treats a private workspace package as unresolved", () => {
  const manifest = readJson(manifestPath);
  manifest.components.find(
    (component) => component.name === "@openclaw/gateway-client"
  ).status = "unavailable-upstream";

  const result = runValidator({ manifest });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be locked while components remain unresolved/);
});

test("rejects a policy that waits for unsupported public Gateway packages", () => {
  const contract = readJson(contractPath);
  contract.policy.publicGatewayPackagesRequired = true;

  const result = runValidator({ contract });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected constant false/);
});

test("rejects a private workspace tree fingerprint drift", () => {
  const contract = readJson(contractPath);
  contract.workspacePackages[0].gitTree = "0".repeat(40);

  const result = runValidator({ contract });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tree fingerprint does not match/);
});

test("rejects a beta dependency in the stable release train", () => {
  const manifest = readJson(manifestPath);
  manifest.components.find((component) => component.name === "openclaw").version =
    "2026.8.1-beta.1";

  const result = runValidator({ manifest });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /beta component is forbidden/);
});
