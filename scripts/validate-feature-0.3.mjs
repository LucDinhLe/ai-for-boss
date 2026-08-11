import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const errors = [];

function inputPath(environmentName, fallback) {
  const override = process.env[environmentName];
  if (!override) return path.join(repoRoot, fallback);
  return path.isAbsolute(override) ? override : path.resolve(repoRoot, override);
}

function readJson(environmentName, fallback) {
  return JSON.parse(fs.readFileSync(inputPath(environmentName, fallback), "utf8"));
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) throw new Error(`Only local schema references are supported: ${ref}`);
  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, part) => current?.[part], rootSchema);
}

function validateSchema(rootSchema, nodeSchema, value, location) {
  if (nodeSchema.$ref) {
    const resolved = resolveRef(rootSchema, nodeSchema.$ref);
    if (!resolved) {
      errors.push(`${location}: unresolved schema reference ${nodeSchema.$ref}`);
      return;
    }
    validateSchema(rootSchema, resolved, value, location);
    return;
  }

  if (Object.hasOwn(nodeSchema, "const") && value !== nodeSchema.const) {
    errors.push(`${location}: expected constant ${JSON.stringify(nodeSchema.const)}`);
  }
  if (nodeSchema.enum && !nodeSchema.enum.some((item) => Object.is(item, value))) {
    errors.push(`${location}: expected one of ${nodeSchema.enum.join(", ")}`);
  }
  if (nodeSchema.type) {
    const accepted = Array.isArray(nodeSchema.type) ? nodeSchema.type : [nodeSchema.type];
    const actual = valueType(value);
    if (!accepted.includes(actual)) {
      errors.push(`${location}: expected ${accepted.join(" or ")}, got ${actual}`);
      return;
    }
  }
  if (typeof value === "string") {
    if (nodeSchema.minLength !== undefined && value.length < nodeSchema.minLength) {
      errors.push(`${location}: string is shorter than ${nodeSchema.minLength}`);
    }
    if (nodeSchema.pattern && !new RegExp(nodeSchema.pattern).test(value)) {
      errors.push(`${location}: does not match ${nodeSchema.pattern}`);
    }
    if (nodeSchema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${location}: invalid date-time`);
    }
  }
  if (Array.isArray(value)) {
    if (nodeSchema.minItems !== undefined && value.length < nodeSchema.minItems) {
      errors.push(`${location}: expected at least ${nodeSchema.minItems} items`);
    }
    if (nodeSchema.items) {
      value.forEach((item, index) => validateSchema(rootSchema, nodeSchema.items, item, `${location}[${index}]`));
    }
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of nodeSchema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${location}: missing required property ${required}`);
    }
    const properties = nodeSchema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) validateSchema(rootSchema, properties[key], child, `${location}.${key}`);
      else if (nodeSchema.additionalProperties === false) errors.push(`${location}: unexpected property ${key}`);
    }
  }
}

function indexUnique(items, key, location) {
  const result = new Map();
  for (const item of items) {
    if (result.has(item[key])) errors.push(`${location}: duplicate ${key} ${item[key]}`);
    result.set(item[key], item);
  }
  return result;
}

function requireReference(values, index, location) {
  for (const value of values) {
    if (!index.has(value)) errors.push(`${location}: unknown reference ${value}`);
  }
}

const runtime = readJson("AIFB_RUNTIME_MANIFEST", "manifests/runtime/runtime-manifest.lock.json");
const gateway = readJson("AIFB_GATEWAY_CONTRACT", "manifests/runtime/gateway-contract.lock.json");
const capabilitySchema = readJson("AIFB_CAPABILITY_SCHEMA", "manifests/capabilities/capability-manifest.schema.json");
const capability = readJson("AIFB_CAPABILITY_MANIFEST", "manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");
const authSchema = readJson("AIFB_AUTH_SCHEMA", "manifests/providers/auth-support.schema.json");
const auth = readJson("AIFB_AUTH_MANIFEST", "manifests/providers/auth-support.manifest.json");
const sourceSchema = readJson("AIFB_SOURCE_SCHEMA", "manifests/data/source-of-truth.schema.json");
const source = readJson("AIFB_SOURCE_MANIFEST", "manifests/data/source-of-truth.manifest.json");
const genesisSchema = readJson("AIFB_GENESIS_SCHEMA", "manifests/agents/agent-genesis.schema.json");
const genesis = readJson("AIFB_GENESIS_CONTRACT", "manifests/agents/agent-genesis.contract.json");
const threatSchema = readJson("AIFB_THREAT_SCHEMA", "manifests/security/threat-model.schema.json");
const threat = readJson("AIFB_THREAT_MODEL", "manifests/security/threat-model.manifest.json");

validateSchema(capabilitySchema, capabilitySchema, capability, "$capability");
validateSchema(authSchema, authSchema, auth, "$auth");
validateSchema(sourceSchema, sourceSchema, source, "$source");
validateSchema(genesisSchema, genesisSchema, genesis, "$genesis");
validateSchema(threatSchema, threatSchema, threat, "$threat");

const openclaw = runtime.components.find((component) => component.name === "openclaw");
if (!openclaw) errors.push("$runtime: missing OpenClaw component");
else {
  if (capability.releaseTrain.openclawVersion !== openclaw.version) errors.push("$capability.releaseTrain: OpenClaw version drift");
  if (capability.releaseTrain.gitTag !== gateway.upstream.gitTag) errors.push("$capability.releaseTrain: git tag drift");
  if (capability.releaseTrain.gitCommit !== gateway.upstream.gitCommit) errors.push("$capability.releaseTrain: git commit drift");
  if (capability.releaseTrain.protocolVersion !== gateway.integrationSurface.protocolVersion) errors.push("$capability.releaseTrain: protocol version drift");
  if (capability.releaseTrain.id !== runtime.releaseTrainId) errors.push("$capability.releaseTrain: release train ID drift");
}

for (const manifest of [auth, source, genesis, threat]) {
  if (manifest.releaseTrainId !== runtime.releaseTrainId) errors.push("Feature 0.3 artifact release train ID drift");
}

if (capability.sourcePolicy.helloOkIsCompleteInventory !== false) {
  errors.push("$capability.sourcePolicy: hello-ok must not be treated as a complete inventory");
}
if (capability.sourcePolicy.privateWorkspacePackagesImportable !== false) {
  errors.push("$capability.sourcePolicy: private workspace packages must not be importable");
}

const capabilityIndex = indexUnique(capability.capabilities, "id", "$capability.capabilities");
const familyCounts = new Map();
const expectedFamilies = [
  "gateway",
  "providers-models",
  "sessions",
  "agents",
  "genesis",
  "advisor",
  "memory",
  "workspace-files",
  "tools-exec",
  "browser-web",
  "skills",
  "plugins",
  "mcp",
  "channels",
  "automation",
  "nodes",
  "media-voice",
  "usage-cost",
  "approvals-audit",
  "backup-restore",
  "updates",
  "diagnostics",
  "always-on"
];
for (const item of capability.capabilities) {
  familyCounts.set(item.family, (familyCounts.get(item.family) ?? 0) + 1);
  if (["BLOCKED", "RESTRICTED"].includes(item.productTreatment) && item.blockers.length === 0) {
    errors.push(`$capability.capabilities.${item.id}: ${item.productTreatment} capability requires a blocker`);
  }
  if (item.advertisable !== false) errors.push(`$capability.capabilities.${item.id}: Feature 0.3 capability cannot be advertised`);
  for (const upstream of item.upstreamSources) {
    if (/(?:packages[\\/]gateway-(?:client|protocol)|(?:^|[\\/])dist[\\/]|@(?:latest|beta|next)|beta)/i.test(upstream.path)) {
      errors.push(`$capability.capabilities.${item.id}: forbidden private, dist, beta or dynamic source ${upstream.path}`);
    }
  }
}
for (const family of capability.requiredFamilies) {
  if ((familyCounts.get(family) ?? 0) < 1) errors.push(`$capability.requiredFamilies: missing family ${family}`);
}
for (const family of expectedFamilies) {
  if (!capability.requiredFamilies.includes(family)) errors.push(`$capability.requiredFamilies: contract removed family ${family}`);
}
for (const family of familyCounts.keys()) {
  if (!capability.requiredFamilies.includes(family)) errors.push(`$capability.capabilities: unregistered family ${family}`);
}

const sourceIndex = indexUnique(source.sources, "id", "$source.sources");
for (let number = 1; number <= 9; number += 1) {
  const id = `SOT-${String(number).padStart(2, "0")}`;
  if (!sourceIndex.has(id)) errors.push(`$source.sources: missing required source ${id}`);
}
const domainOwner = new Map();
for (const item of source.sources) {
  for (const domain of item.authoritativeDomains) {
    if (domainOwner.has(domain)) errors.push(`$source.sources: duplicate source-of-truth domain ${domain}`);
    domainOwner.set(domain, item.id);
  }
}
if (domainOwner.get("project-folder-grant") !== "SOT-02") {
  errors.push("$source.sources: project-folder-grant must be authoritative in AI for Boss product storage SOT-02");
}
for (const domain of ["business-source-file", "user-owned-artifact"]) {
  if (domainOwner.get(domain) !== "SOT-06") {
    errors.push(`$source.sources: ${domain} must remain authoritative in user-owned project space SOT-06`);
  }
}

const assetIndex = indexUnique(threat.assets, "id", "$threat.assets");
const actorIndex = indexUnique(threat.actors, "id", "$threat.actors");
const boundaryIndex = indexUnique(threat.trustBoundaries, "id", "$threat.trustBoundaries");
const threatIndex = indexUnique(threat.threats, "id", "$threat.threats");
for (let number = 1; number <= 14; number += 1) {
  const id = `T-${String(number).padStart(2, "0")}`;
  if (!threatIndex.has(id)) errors.push(`$threat.threats: missing required threat ${id}`);
}

for (const item of capability.capabilities) {
  requireReference(item.sourceOfTruthRefs, sourceIndex, `$capability.capabilities.${item.id}.sourceOfTruthRefs`);
  requireReference(item.trustBoundaryRefs, boundaryIndex, `$capability.capabilities.${item.id}.trustBoundaryRefs`);
}

const flowIndex = indexUnique(source.flows, "id", "$source.flows");
for (const flow of source.flows) {
  requireReference(flow.threatRefs, threatIndex, `$source.flows.${flow.id}.threatRefs`);
  for (const step of flow.steps) {
    if (step.trustBoundary !== null && !boundaryIndex.has(step.trustBoundary)) {
      errors.push(`$source.flows.${flow.id}: unknown trust boundary ${step.trustBoundary}`);
    }
  }
}
for (let number = 1; number <= 8; number += 1) {
  const id = `DF-${String(number).padStart(2, "0")}`;
  if (!flowIndex.has(id)) errors.push(`$source.flows: missing required flow ${id}`);
}

const riskText = fs.readFileSync(inputPath("AIFB_RISK_REGISTER", "RISKS.md"), "utf8");
for (const item of threat.threats) {
  requireReference(item.actorRefs, actorIndex, `$threat.threats.${item.id}.actorRefs`);
  requireReference(item.assetRefs, assetIndex, `$threat.threats.${item.id}.assetRefs`);
  requireReference(item.boundaryRefs, boundaryIndex, `$threat.threats.${item.id}.boundaryRefs`);
  for (const riskRef of item.riskRefs) {
    if (!riskText.includes(`| ${riskRef} |`)) errors.push(`$threat.threats.${item.id}: risk register does not contain ${riskRef}`);
  }
  if (["Critical", "High"].includes(item.residualRisk.severity) && item.residualRisk.status === "accepted-out-of-scope") {
    errors.push(`$threat.threats.${item.id}: Critical/High risk cannot be accepted by this feature`);
  }
}
for (const severity of ["Critical", "High"]) {
  if (!threat.reviewGate.releaseBlockingSeverities.includes(severity)) {
    errors.push(`$threat.reviewGate: ${severity} must block release`);
  }
}

const authIndex = indexUnique(auth.records, "id", "$auth.records");
for (const requiredAuth of [
  "openai.api-key",
  "openai.codex-oauth",
  "openai.codex-device-code",
  "anthropic.api-key",
  "anthropic.claude-cli",
  "google.gemini-api-key",
  "google.gemini-cli-oauth",
  "generic.plugin-owned",
  "local.model-no-auth"
]) {
  if (!authIndex.has(requiredAuth)) errors.push(`$auth.records: missing ${requiredAuth}`);
}
for (const record of auth.records) {
  if (record.readiness === "live-tested") {
    if (record.platformsTested.length === 0 || record.liveProbe !== "passed") {
      errors.push(`$auth.records.${record.id}: live-tested requires platform evidence and passed live probe`);
    }
    if (record.revokeFlow !== "verified" && record.revokeFlow !== "not-applicable") {
      errors.push(`$auth.records.${record.id}: live-tested requires verified revoke flow`);
    }
  } else if (record.platformsTested.length > 0) {
    errors.push(`$auth.records.${record.id}: untested record cannot claim tested platforms`);
  }
  if (record.authMode === "api-key" && record.storageAuthority !== "os-key-store-via-secretref") {
    errors.push(`$auth.records.${record.id}: static API key must use the gated OS key store path`);
  }
  if (["oauth", "device-code"].includes(record.authMode) && record.storageAuthority !== "openclaw-native-auth-store") {
    errors.push(`$auth.records.${record.id}: OAuth/device token must remain in OpenClaw native auth store`);
  }
  if (record.supportLevel === "experimental" && record.readiness !== "blocked") {
    errors.push(`$auth.records.${record.id}: experimental auth remains blocked until explicit promotion`);
  }
}

const templateIndex = indexUnique(genesis.templateReferences, "name", "$genesis.templateReferences");
const expectedTemplates = new Map([
  ["AGENTS.md", ["7d340e13e845b8bf7c69c60f5dbcc7b5b0e03b1401496d2a091af7223499bbfc", 7327]],
  ["SOUL.md", ["79c61aaee618c787c164c5d767053a83c6e218191b3b6ebb66fd07320b071ce8", 1645]],
  ["TOOLS.md", ["20eab78b3b117566a1d33a70873e70ff2d5099543aa44e2719dc8d0797099afe", 1005]],
  ["IDENTITY.md", ["1c447d4ce2d33b4836d3c95c2bc70cc783ea3ccd450e61e2db7e04d5465e9820", 1397]],
  ["USER.md", ["599bd4d663c852bca679a341d53605c1a48b7cd7601bd7d102ee5407828dbacb", 650]],
  ["HEARTBEAT.md", ["1605f546995e0bdcb11f9bf905173b14aca25cfad664fe2c7644d18c2b4142e2", 1273]],
  ["BOOTSTRAP.md", ["1c85f2aad8c4ace090e714a0ec2dec3c928e54c8d2d20d58175f0ae3963d99b3", 1802]]
]);
for (const [name, [sha256, bytes]] of expectedTemplates) {
  if (!templateIndex.has(name)) errors.push(`$genesis.templateReferences: missing ${name}`);
  else if (templateIndex.get(name).sha256 !== sha256 || templateIndex.get(name).bytes !== bytes) {
    errors.push(`$genesis.templateReferences: locked reference drift for ${name}`);
  }
}
for (const document of ["docs/start/bootstrapping.md", "docs/concepts/agent-workspace.md", "docs/cli/agents.md"]) {
  if (!genesis.sourceDocuments.includes(document)) errors.push(`$genesis.sourceDocuments: missing ${document}`);
}
for (const state of ["UNSEEDED", "SEEDED", "CONVERSING", "STAGING", "VERIFYING", "ACTIVE", "PENDING_RESUME"]) {
  if (!genesis.states.includes(state)) errors.push(`$genesis.states: missing ${state}`);
}
const activeTransition = genesis.transitions.find((item) => item.to === "ACTIVE");
if (!activeTransition || !/BOOTSTRAP\.md is removed last/i.test(activeTransition.condition)) {
  errors.push("$genesis.transitions: ACTIVE promotion must remove BOOTSTRAP.md last");
}
if (!genesis.activationPreconditions.some((item) => /memory directory does not exist/i.test(item))) {
  errors.push("$genesis.activationPreconditions: memory must not exist before promotion");
}
const workspaceIndex = indexUnique(genesis.workspaceBoundaries, "id", "$genesis.workspaceBoundaries");
for (const id of ["agent-home", "agent-dir", "project-space"]) {
  if (!workspaceIndex.has(id)) errors.push(`$genesis.workspaceBoundaries: missing ${id}`);
}
for (const item of genesis.workspaceBoundaries) {
  requireReference(item.sourceOfTruthRefs, sourceIndex, `$genesis.workspaceBoundaries.${item.id}.sourceOfTruthRefs`);
}
if (workspaceIndex.get("agent-dir")?.rendererAccess !== "none") errors.push("$genesis.workspaceBoundaries.agent-dir: renderer access must be none");
const projectGrants = workspaceIndex.get("project-space")?.grantModes ?? [];
for (const grant of ["none", "read-only", "read-write"]) {
  if (!projectGrants.includes(grant)) errors.push(`$genesis.workspaceBoundaries.project-space: missing grant ${grant}`);
}
for (const sourceRef of ["SOT-02", "SOT-06"]) {
  if (!(workspaceIndex.get("project-space")?.sourceOfTruthRefs ?? []).includes(sourceRef)) {
    errors.push(`$genesis.workspaceBoundaries.project-space: missing source-of-truth ${sourceRef}`);
  }
}
for (const sourceRef of ["SOT-01", "SOT-04"]) {
  if (!(workspaceIndex.get("agent-dir")?.sourceOfTruthRefs ?? []).includes(sourceRef)) {
    errors.push(`$genesis.workspaceBoundaries.agent-dir: missing source-of-truth ${sourceRef}`);
  }
}
if (!genesis.failureBehavior.keepBootstrap || genesis.failureBehavior.createMemory || genesis.failureBehavior.reportReady) {
  errors.push("$genesis.failureBehavior: interrupted bootstrap must keep bootstrap, avoid memory and stay not ready");
}

const allText = JSON.stringify({ capability, auth, source, genesis, threat });
if (/an toàn tuyệt đối|absolutely safe/i.test(allText)) errors.push("Feature 0.3 artifacts contain a forbidden absolute-safety claim");

if (errors.length > 0) {
  console.error("Feature 0.3 validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Feature 0.3 validation passed for ${runtime.releaseTrainId}`);
console.log(`Capabilities: ${capabilityIndex.size}; auth modes: ${authIndex.size}; sources: ${sourceIndex.size}; flows: ${flowIndex.size}; threats: ${threatIndex.size}`);
