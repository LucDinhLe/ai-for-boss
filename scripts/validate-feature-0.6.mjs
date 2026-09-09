import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import {
  validateFixtureOnlyProbeSource,
  validateJsonSchemaSubset,
  validateSandboxDecisionContract,
  validateSandboxProbeEvidence
} from "../src/sandbox/feasibility-policy.mjs";
import { runSandboxFeasibilityProbe } from "../src/sandbox/feasibility-probe.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function readJson(relativePath) {
  const text = read(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`invalid JSON in ${relativePath}: ${error.message}`);
    return null;
  }
}

function requireValue(actual, expected, label) {
  if (actual !== expected) failures.push(`${label} must equal ${JSON.stringify(expected)}`);
}

function requireIncludes(text, marker, label) {
  if (!text.includes(marker)) failures.push(`${label} is missing ${JSON.stringify(marker)}`);
}

function sha256Text(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
const probeSchema = readJson("manifests/security/sandbox-feasibility-probe.schema.json");
const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");
const threatManifest = readJson("manifests/security/threat-model.manifest.json");
const packageJson = readJson("package.json");
const readme = read("README.md");
const adr = read("docs/architecture/SANDBOX-FEASIBILITY-ADR.md");
const spec = read("docs/feature-specs/0006-sandbox-feasibility.md");
const decisionLog = read("DECISIONS.md");
const riskRegister = read("RISKS.md");
const capabilityInventory = read("docs/architecture/CAPABILITY-INVENTORY.md");
const readinessAudit = read("docs/release/PRODUCT-READINESS-AUDIT-2026-08-11.md");
const featureAudit = read("docs/release/FEATURE-0.6-AUDIT.md");
const changelog = read("CHANGELOG.md");
const progress = read("PROGRESS.md");
const probe = `${read("scripts/spike/sandbox-feasibility-probe.mjs")}\n${read("src/sandbox/feasibility-probe.mjs")}`;
const policy = read("src/sandbox/feasibility-policy.mjs");
const contractTest = read("tests/contract/sandbox-feasibility-contract.test.mjs");
const governanceValidator = read("scripts/validate-governance.ps1");
const desktopWorkflow = read(".github/workflows/desktop-shell.yml");
const governanceWorkflow = read(".github/workflows/governance.yml");

if (manifest && capabilityManifest) {
  const result = validateSandboxDecisionContract({ manifest, schema, capabilityManifest });
  if (!result.ok) failures.push(...result.errors.map((error) => `decision contract: ${error}`));
  const alwaysOn = capabilityManifest.capabilities?.find((entry) => entry?.id === "always-on.private-instance");
  requireValue(alwaysOn?.productTreatment, "BLOCKED", "always-on.private-instance productTreatment");
  requireValue(alwaysOn?.advertisable, false, "always-on.private-instance advertisable");
}

const probeReport = runSandboxFeasibilityProbe();
const probeEvidence = validateSandboxProbeEvidence(probeReport, {
  expectedPlatform: process.platform,
  expectedArchitecture: process.arch,
  expectedNodeMajor: Number.parseInt(process.versions.node.split(".")[0], 10),
  nowMs: Date.parse(probeReport.capturedAt),
  maxAgeMs: 60_000
});
if (!probeEvidence.ok) failures.push(...probeEvidence.errors.map((error) => `probe evidence: ${error}`));
if (probeSchema) {
  const probeSchemaResult = validateJsonSchemaSubset(probeReport, probeSchema);
  if (!probeSchemaResult.ok) failures.push(...probeSchemaResult.errors.map((error) => `probe schema: ${error}`));
}
const probeSourcePolicy = validateFixtureOnlyProbeSource(probe);
if (!probeSourcePolicy.ok) failures.push(...probeSourcePolicy.errors.map((error) => `probe source: ${error}`));
const expectedProbePaths = [
  "src/sandbox/feasibility-probe.mjs",
  "scripts/spike/sandbox-feasibility-probe.mjs"
];
requireValue(
  JSON.stringify((manifest?.probeSourceLocks ?? []).map((entry) => entry.path)),
  JSON.stringify(expectedProbePaths),
  "probe source lock paths"
);
for (const lock of manifest?.probeSourceLocks ?? []) {
  requireValue(sha256Text(read(lock.path)), lock.sha256, `probe source lock ${lock.path}`);
}

requireValue(manifest?.$schema, "./sandbox-feasibility.schema.json", "manifest.$schema");
requireValue(schema?.properties?.safeDefault?.properties?.execution?.const, "blocked", "schema safe execution");
requireValue(schema?.properties?.safeDefault?.properties?.automaticFallback?.const, false, "schema automatic fallback");
requireValue(schema?.properties?.spikeBoundary?.properties?.claimsIsolation?.const, false, "schema isolation claim");
requireValue(schema?.properties?.reviewGate?.properties?.status?.const, "pending", "schema review status");
requireValue(probeSchema?.additionalProperties, false, "probe schema top-level additionalProperties");

for (const marker of [
  "**Trạng thái hiện tại:**",
  "bản thử nghiệm",
  "mục tiêu sản phẩm",
  "không capability nào đang được quảng cáo là production-ready"
]) requireIncludes(readme, marker, "README current-status disclaimer");
for (const forbiddenClaim of [
  "AI for Boss hoạt động trên Windows, macOS và Linux như một phần mềm desktop thông thường.",
  "AI for Boss hỗ trợ kết nối với nhiều nhà cung cấp mô hình",
  "Mỗi Agent có danh tính, phiên làm việc, bộ nhớ và quyền truy cập riêng."
]) {
  if (readme.includes(forbiddenClaim)) failures.push(`README contains unqualified production claim ${JSON.stringify(forbiddenClaim)}`);
}

requireValue(packageJson?.scripts?.["validate:sandbox"], "node scripts/validate-feature-0.6.mjs", "package validate:sandbox");
if (!packageJson?.scripts?.["validate:desktop"]?.includes("validate-feature-0.6.mjs")) {
  failures.push("package validate:desktop must run validate-feature-0.6.mjs");
}

for (const marker of [
  "local-managed-container",
  "remote-openshell-ssh",
  "native-os-restrictions",
  "spike-tested",
  "documented-primary-source",
  "assumption-pending",
  "blocked-or-not-feasible",
  "productHostExec`: `false",
  "claimsIsolation:false",
  "productOwnerDecision: pending"
]) requireIncludes(adr, marker, "sandbox ADR");

for (const marker of [
  "spike-tested",
  "documented-primary-source",
  "assumption-pending",
  "blocked-or-not-feasible",
  "Senior platform/security review",
  "Product Owner"
]) requireIncludes(spec, marker, "Feature 0.6 spec");

for (const marker of [
  "D-0018. Khuyến nghị sandbox local managed container có điều kiện",
  "Đề xuất, chưa chấp nhận làm backend production",
  "Bằng chứng này không chứng minh isolation thực tế"
]) requireIncludes(decisionLog, marker, "Decision D-0018");

for (const marker of [
  "| R-028 |",
  "| R-029 |",
  "| R-030 |",
  "Open — architecture-guarded, runtime untested",
  "Open — product blocking"
]) requireIncludes(riskRegister, marker, "Feature 0.6 risk register");

const threatsById = new Map((threatManifest?.threats ?? []).map((threat) => [threat.id, threat]));
for (const [riskId, threatIds] of Object.entries(manifest?.governanceTraceability?.riskThreatRefs ?? {})) {
  for (const threatId of threatIds) {
    if (!threatsById.get(threatId)?.riskRefs?.includes(riskId)) {
      failures.push(`threat ${threatId} must reference ${riskId}`);
    }
  }
}
for (const decisionId of manifest?.governanceTraceability?.decisionRefs ?? []) {
  requireIncludes(decisionLog, `${decisionId}.`, `Decision ${decisionId}`);
}

for (const [text, label, markers] of [
  [capabilityInventory, "capability inventory", ["Always-on | BLOCKED", "Feature 0.6", "không đủ để chuyển"]],
  [readinessAudit, "product readiness audit", ["sandbox feasibility contract bằng dữ liệu giả", "chưa thể đóng gói hoặc phát hành"]],
  [featureAudit, "Feature 0.6 audit", ["không chứng minh isolation", "Senior platform reviewer", "CI Windows/macOS/Linux/governance"]],
  [changelog, "changelog", ["Feature 0.6", "80/80", "Governance CI", "unsigned và non-distributable"]],
  [progress, "handoff progress", ["feature/0.6-sandbox-feasibility", "Product Owner chưa chấp nhận backend production", "R-028, R-029 và R-030"]]
]) {
  for (const marker of markers) requireIncludes(text, marker, label);
}

const sourceIds = new Set();
const sourceUrls = new Set();
const allowedSourceHosts = new Set([
  "github.com",
  "docs.docker.com",
  "docs.nvidia.com",
  "learn.microsoft.com",
  "developer.apple.com",
  "docs.kernel.org"
]);
for (const source of manifest?.sources ?? []) {
  if (sourceIds.has(source.id)) failures.push(`duplicate source id: ${source.id}`);
  if (sourceUrls.has(source.url)) failures.push(`duplicate source URL: ${source.url}`);
  sourceIds.add(source.id);
  sourceUrls.add(source.url);
  let url;
  try {
    url = new URL(source.url);
  } catch {
    failures.push(`invalid source URL: ${source.url}`);
    continue;
  }
  if (url.protocol !== "https:" || !allowedSourceHosts.has(url.hostname)) {
    failures.push(`source is not an allowlisted official HTTPS host: ${source.url}`);
  }
  requireIncludes(adr, `\`${source.id}\``, "sandbox ADR source register");
  requireIncludes(adr, source.url, "sandbox ADR source register");
}
requireValue(sourceIds.size, 18, "official source count");
requireIncludes(adr, "Tất cả nguồn được truy cập ngày 2026-08-12", "sandbox ADR");

for (const marker of [
  "claimsIsolation: false",
  "credentialUse: false",
  "networkEgress: false",
  "mkdtempSync(",
  "rmdirSync("
]) requireIncludes(probe, marker, "sandbox probe");

for (const marker of [
  "productHostExec",
  "elevatedExec",
  "sensitiveBrowser",
  "automaticFallback",
  "REQUIRED_LOCKED_CAPABILITIES"
]) requireIncludes(policy, marker, "sandbox policy");

for (const marker of [
  "safe default denies every product execution route",
  "decision contract cross-checks exact directions",
  "fixture-only probe proves containment mechanics",
  "CI workflows pin official Node 24 action runtimes and reject Node 20 refs",
  "governance scan prunes dependency and build directories before recursion",
  "Feature 0.6 validator binds ADR"
]) requireIncludes(contractTest, marker, "sandbox contract test");

for (const marker of ["function Get-RepositoryFiles", "ignoredDirectoryNames"]) {
  requireIncludes(governanceValidator, marker, "governance scanner pruning");
}

const node24ActionPins = [
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1, Node 24",
  "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0, Node 24"
];
for (const workflow of [desktopWorkflow, governanceWorkflow]) {
  for (const pin of node24ActionPins) requireIncludes(workflow, pin, "Node 24 GitHub Actions pin");
}
requireIncludes(
  desktopWorkflow,
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1, Node 24",
  "Node 24 upload-artifact pin"
);
requireIncludes(
  governanceWorkflow,
  "node ./scripts/validate-feature-0.6.mjs",
  "governance Feature 0.6 validation"
);
for (const forbiddenActionRef of [
  "actions/checkout@v4",
  "actions/setup-node@v4",
  "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
  "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
]) {
  if (`${desktopWorkflow}\n${governanceWorkflow}`.includes(forbiddenActionRef)) {
    failures.push(`workflow contains forbidden Node 20 or floating action ref ${JSON.stringify(forbiddenActionRef)}`);
  }
}

if (failures.length > 0) {
  process.stderr.write("Feature 0.6 validation failed:\n");
  for (const failure of failures) process.stderr.write(` - ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`Feature 0.6 validation passed. Directions: ${manifest.directions.length}; sources: ${manifest.sources.length}; locked capabilities: ${manifest.lockedCapabilityIds.length}.\n`);
