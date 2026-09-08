import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..");
const validator = path.join(repoRoot, "scripts", "validate-feature-0.3.mjs");
const inputs = {
  capability: "manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json",
  auth: "manifests/providers/auth-support.manifest.json",
  source: "manifests/data/source-of-truth.manifest.json",
  genesis: "manifests/agents/agent-genesis.contract.json",
  threat: "manifests/security/threat-model.manifest.json"
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function baseline() {
  return Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, readJson(value)]));
}

function runValidator(mutator = () => {}) {
  const fixture = baseline();
  mutator(fixture);
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aifb-feature-0.3-"));
  const environment = { ...process.env };
  const envNames = {
    capability: "AIFB_CAPABILITY_MANIFEST",
    auth: "AIFB_AUTH_MANIFEST",
    source: "AIFB_SOURCE_MANIFEST",
    genesis: "AIFB_GENESIS_CONTRACT",
    threat: "AIFB_THREAT_MODEL"
  };

  try {
    for (const [key, value] of Object.entries(fixture)) {
      const filePath = path.join(fixtureRoot, `${key}.json`);
      fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
      environment[envNames[key]] = filePath;
    }
    return spawnSync(process.execPath, [validator], { cwd: repoRoot, encoding: "utf8", env: environment });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("accepts the locked capability, auth, data-flow, Genesis and threat contracts", () => {
  const result = runValidator();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Capabilities: 23; auth modes: 9; sources: 9; flows: 8; threats: 14/);
});

test("rejects a missing required capability family", () => {
  const result = runValidator(({ capability }) => {
    capability.capabilities = capability.capabilities.filter((item) => item.family !== "advisor");
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing family advisor/);
});

test("rejects removing a family from both inventory and required-family declaration", () => {
  const result = runValidator(({ capability }) => {
    capability.capabilities = capability.capabilities.filter((item) => item.family !== "advisor");
    capability.requiredFamilies = capability.requiredFamilies.filter((item) => item !== "advisor");
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contract removed family advisor/);
});

test("rejects release-train drift", () => {
  const result = runValidator(({ capability }) => {
    capability.releaseTrain.gitCommit = "0".repeat(40);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /git commit drift/);
});

test("rejects a private Gateway package as a capability source", () => {
  const result = runValidator(({ capability }) => {
    capability.capabilities[0].upstreamSources[0].path = "packages/gateway-client/src/index.ts";
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /forbidden private, dist, beta or dynamic source/);
});

test("rejects a blocked capability without an explicit blocker", () => {
  const result = runValidator(({ capability }) => {
    capability.capabilities.find((item) => item.productTreatment === "BLOCKED").blockers = [];
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BLOCKED capability requires a blocker/);
});

test("rejects OAuth storage moved out of OpenClaw native auth store", () => {
  const result = runValidator(({ auth }) => {
    auth.records.find((item) => item.id === "openai.codex-oauth").storageAuthority = "os-key-store-via-secretref";
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /OAuth\/device token must remain in OpenClaw native auth store/);
});

test("rejects duplicate source-of-truth ownership", () => {
  const result = runValidator(({ source }) => {
    source.sources[1].authoritativeDomains.push(source.sources[0].authoritativeDomains[0]);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate source-of-truth domain/);
});

test("rejects project grants stored as user business files", () => {
  const result = runValidator(({ source }) => {
    source.sources.find((item) => item.id === "SOT-02").authoritativeDomains =
      source.sources.find((item) => item.id === "SOT-02").authoritativeDomains.filter(
        (domain) => domain !== "project-folder-grant"
      );
    source.sources.find((item) => item.id === "SOT-06").authoritativeDomains.push("project-folder-grant");
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /project-folder-grant must be authoritative.*SOT-02/);
});

test("rejects a data flow that references an unknown threat", () => {
  const result = runValidator(({ source }) => {
    source.flows[0].threatRefs = ["T-99"];
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown reference T-99/);
});

test("rejects a threat not traceable to the Risk Register", () => {
  const result = runValidator(({ threat }) => {
    threat.threats[0].riskRefs = ["R-999"];
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /risk register does not contain R-999/);
});

test("rejects Genesis without the locked bootstrap reference", () => {
  const result = runValidator(({ genesis }) => {
    genesis.templateReferences = genesis.templateReferences.filter((item) => item.name !== "BOOTSTRAP.md");
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing BOOTSTRAP\.md/);
});

test("rejects a Genesis reference-template fingerprint drift", () => {
  const result = runValidator(({ genesis }) => {
    genesis.templateReferences.find((item) => item.name === "SOUL.md").sha256 = "0".repeat(64);
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /locked reference drift for SOUL\.md/);
});

test("rejects premature memory creation during interrupted Genesis", () => {
  const result = runValidator(({ genesis }) => {
    genesis.failureBehavior.createMemory = true;
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /expected constant false|must keep bootstrap, avoid memory/);
});
