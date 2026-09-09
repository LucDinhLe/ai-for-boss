import fs from "node:fs/promises";

const REQUIRED_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "classification",
  "product",
  "releaseTrain",
  "contractSummary",
  "featureState"
];

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid shell contract ${label}`);
  }
}

export async function loadShellContract(filePath, runningVersion) {
  const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in parsed)) {
      throw new Error(`Shell contract missing ${key}`);
    }
  }

  if (parsed.classification !== "experimental-internal") {
    throw new Error("Shell contract classification must remain experimental-internal");
  }

  assertNonEmptyString(parsed.releaseTrain.id, "releaseTrain.id");
  assertNonEmptyString(parsed.product.name, "product.name");

  // The running package is authoritative; generated descriptive metadata can
  // survive a UI-only build and must never label a newer executable as older.
  if (runningVersion !== undefined) {
    assertNonEmptyString(runningVersion, "runningVersion");
    parsed.product.version = runningVersion;
  }

  return structuredClone(parsed);
}

export function createUnavailableShellContract(reason = "contract-unavailable") {
  return {
    schemaVersion: "0.4.0",
    classification: "experimental-internal",
    product: {
      name: "AI for Boss",
      version: "0.0.0-dev",
      attribution: "Built on OpenClaw"
    },
    releaseTrain: {
      id: "unavailable",
      openclaw: "unavailable",
      electron: "unavailable",
      node: "unavailable",
      pnpm: "unavailable"
    },
    contractSummary: {
      capabilityFamilies: 0,
      advertisableCapabilities: 0,
      authModes: 0,
      sourcesOfTruth: 0,
      dataFlows: 0,
      threats: 0
    },
    featureState: {
      shell: "degraded",
      gateway: "not-implemented",
      providerConnection: "not-implemented",
      agentGenesis: "not-implemented",
      advisor: "preview-only",
      tools: "blocked"
    },
    reason
  };
}
