import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildShellContract } from "../../scripts/generate-desktop-contract.mjs";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "..", "..");

const inputPaths = {
  runtime: "manifests/runtime/runtime-manifest.lock.json",
  capability: "manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json",
  auth: "manifests/providers/auth-support.manifest.json",
  source: "manifests/data/source-of-truth.manifest.json",
  threat: "manifests/security/threat-model.manifest.json"
};

function baseline() {
  return Object.fromEntries(
    Object.entries(inputPaths).map(([key, relativePath]) => [
      key,
      JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"))
    ])
  );
}

test("builds a sanitized shell contract from the locked evidence set", () => {
  const contract = buildShellContract(baseline());

  assert.equal(contract.classification, "experimental-internal");
  assert.equal(contract.releaseTrain.id, "oc-2026.7.1-2-locked.1");
  assert.equal(contract.contractSummary.capabilityFamilies, 23);
  assert.equal(contract.contractSummary.advertisableCapabilities, 0);
  assert.equal(contract.contractSummary.authModes, 9);
  assert.equal(contract.contractSummary.sourcesOfTruth, 9);
  assert.equal(contract.contractSummary.dataFlows, 8);
  assert.equal(contract.contractSummary.threats, 14);
  assert.match(contract.evidence.contractDigest, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(contract).includes("integrity"), false);
  assert.equal(JSON.stringify(contract).includes("sourceOfTruthRefs"), false);
});

test("rejects release-train drift before renderer data is generated", () => {
  const fixture = baseline();
  fixture.auth.releaseTrainId = "different-release";

  assert.throws(() => buildShellContract(fixture), /do not share the locked release train/);
});

test("rejects any prematurely advertisable capability", () => {
  const fixture = baseline();
  fixture.capability.capabilities[0].advertisable = true;

  assert.throws(() => buildShellContract(fixture), /cannot advertise unimplemented capabilities/);
});

