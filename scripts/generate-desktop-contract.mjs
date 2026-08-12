import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");

const inputPaths = {
  runtime: "manifests/runtime/runtime-manifest.lock.json",
  capability: "manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json",
  auth: "manifests/providers/auth-support.manifest.json",
  source: "manifests/data/source-of-truth.manifest.json",
  threat: "manifests/security/threat-model.manifest.json"
};

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(repoRoot, relativePath), "utf8"));
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  return value;
}

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function componentVersion(runtime, name) {
  const component = runtime.components.find((item) => item.name === name);
  if (!component?.version) {
    throw new Error(`Runtime manifest is missing ${name}`);
  }
  return component.version;
}

function stableDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildShellContract({ runtime, capability, auth, source, threat }) {
  const capabilities = requireArray(capability.capabilities, "capabilities");
  const authRecords = requireArray(auth.records, "auth records");
  const sources = requireArray(source.sources, "sources of truth");
  const flows = requireArray(source.flows, "data flows");
  const threats = requireArray(threat.threats, "threats");

  if (
    capability.releaseTrain.id !== runtime.releaseTrainId ||
    auth.releaseTrainId !== runtime.releaseTrainId ||
    source.releaseTrainId !== runtime.releaseTrainId ||
    threat.releaseTrainId !== runtime.releaseTrainId
  ) {
    throw new Error("Feature contracts do not share the locked release train");
  }

  const advertisableCapabilities = capabilities.filter((item) => item.advertisable).length;
  if (advertisableCapabilities !== 0) {
    throw new Error("Feature 0.4 cannot advertise unimplemented capabilities");
  }

  return {
    schemaVersion: "0.4.0",
    classification: "experimental-internal",
    product: {
      name: "AI for Boss",
      version: runtime.productVersion,
      attribution: "Built on OpenClaw"
    },
    releaseTrain: {
      id: runtime.releaseTrainId,
      openclaw: componentVersion(runtime, "openclaw"),
      electron: componentVersion(runtime, "electron"),
      node: componentVersion(runtime, "node"),
      pnpm: componentVersion(runtime, "pnpm")
    },
    contractSummary: {
      capabilityFamilies: capabilities.length,
      capabilityTreatments: countBy(capabilities, (item) => item.productTreatment),
      advertisableCapabilities,
      authModes: authRecords.length,
      sourcesOfTruth: sources.length,
      dataFlows: flows.length,
      threats: threats.length,
      residualThreatSeverity: countBy(threats, (item) => item.residualRisk.severity)
    },
    featureState: {
      shell: "implemented-internal",
      gateway: "not-implemented",
      providerConnection: "not-implemented",
      agentGenesis: "not-implemented",
      advisor: "preview-only",
      tools: "blocked"
    },
    evidence: {
      contractDigest: stableDigest({ runtime, capability, auth, source, threat }),
      allCapabilitiesAdvertisable: false
    }
  };
}

export async function generateShellContract(outputPath) {
  const entries = await Promise.all(
    Object.entries(inputPaths).map(async ([key, relativePath]) => [key, await readJson(relativePath)])
  );
  const contract = buildShellContract(Object.fromEntries(entries));
  const resolvedOutput = path.resolve(
    outputPath ??
      process.env.AIFB_SHELL_CONTRACT_OUT ??
      path.join(repoRoot, "apps", "desktop", "generated", "shell-contract.json")
  );

  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  return { contract, outputPath: resolvedOutput };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { contract, outputPath } = await generateShellContract();
  console.log(
    `Desktop shell contract generated: ${path.relative(repoRoot, outputPath)}; ` +
      `capabilities=${contract.contractSummary.capabilityFamilies}; threats=${contract.contractSummary.threats}`
  );
}
