import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_METHODS,
  FORWARDED_EVENTS,
  OPERATOR_SCOPES,
  isAllowedMethod
} from "../apps/desktop/electron/gateway-adapter.mjs";
import { EMBEDDING_ENV } from "../apps/desktop/electron/supervisor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

for (const requiredPath of [
  "docs/feature-specs/0007-beta-0-supervised-openclaw.md",
  "manifests/runtime/beta-0-candidate.lock.json",
  "manifests/runtime/beta-0-candidate.schema.json",
  "apps/desktop/electron/supervisor.mjs",
  "apps/desktop/electron/gateway-adapter.mjs",
  "apps/desktop/electron/device-identity.mjs",
  "apps/desktop/src/gateway-client.ts",
  "scripts/gateway-smoke.mjs",
  "tests/contract/beta-0-runtime-contract.test.mjs",
  "tests/unit/supervisor.test.mjs",
  "tests/unit/device-identity.test.mjs"
]) {
  if (!fs.existsSync(path.join(repoRoot, requiredPath))) failures.push(`missing ${requiredPath}`);
}

const supervisor = read("apps/desktop/electron/supervisor.mjs");
const adapter = read("apps/desktop/electron/gateway-adapter.mjs");
const main = read("apps/desktop/electron/main.mjs");
const renderer = read("apps/desktop/src/App.tsx");
const rendererBridge = read("apps/desktop/src/gateway-client.ts");
const index = read("apps/desktop/index.html");

// The Gateway must never leave the loopback interface in this gate.
if (!supervisor.includes('"--bind"') || !supervisor.includes('"loopback"')) {
  failures.push("supervisor does not bind the Gateway to loopback");
}
if (!supervisor.includes('"--auth"') || !supervisor.includes('"token"')) {
  failures.push("supervisor does not require token authentication");
}
if (!supervisor.includes("randomBytes(32)")) {
  failures.push("supervisor does not mint a fresh Gateway token");
}
if (/--auth[^\n]*none/.test(supervisor)) {
  failures.push("supervisor can start the Gateway without authentication");
}

// The embedding preset the OpenClaw guide prescribes for a supervised child.
for (const key of [
  "OPENCLAW_DISABLE_BONJOUR",
  "OPENCLAW_EXEC_SHELL_SNAPSHOT",
  "OPENCLAW_NO_RESPAWN",
  "OPENCLAW_SKIP_CHANNELS"
]) {
  if (!(key in EMBEDDING_ENV)) failures.push(`embedding preset is missing ${key}`);
}
if (EMBEDDING_ENV.OPENCLAW_EXEC_SHELL_SNAPSHOT !== "0") {
  failures.push("shell snapshot capture is not disabled for the Gateway child");
}

// OpenClaw owns its own state; the host must not read the private layout.
if (/\.openclaw[/\\](?:sessions|agents|state|cache)/.test(`${main}\n${adapter}\n${renderer}`)) {
  failures.push("host code reaches into private OpenClaw state paths");
}

// Every renderer call crosses a named allowlist that excludes admin surfaces.
if (isAllowedMethod("config.patch") || isAllowedMethod("config.set")) {
  failures.push("renderer allowlist exposes configuration writes");
}
for (const forbidden of ["tools.invoke", "exec.approval.resolve", "plugins.install", "terminal.open", "browser.request"]) {
  if (isAllowedMethod(forbidden)) failures.push(`renderer allowlist exposes ${forbidden}`);
}
if (ALLOWED_METHODS.length !== new Set(ALLOWED_METHODS).size) {
  failures.push("renderer allowlist contains duplicates");
}
if (FORWARDED_EVENTS.includes("exec.approval.requested") || FORWARDED_EVENTS.includes("terminal.data")) {
  failures.push("event forwarding exposes an unimplemented capability");
}
if (OPERATOR_SCOPES.includes("operator.admin") || OPERATOR_SCOPES.includes("operator.pairing")) {
  failures.push("adapter requests scopes beyond the chat surface");
}

// The renderer stays a pure view: no sockets, no storage, no direct transport.
if (/localStorage|sessionStorage|indexedDB|new WebSocket\s*\(|XMLHttpRequest|fetch\s*\(/.test(
  `${renderer}\n${rendererBridge}`
)) {
  failures.push("renderer opens its own transport or persistence");
}
if (!index.includes("connect-src 'none'")) {
  failures.push("renderer CSP does not deny outbound connections");
}

// Beta 0 makes no claim it has not tested.
const spec = read("docs/feature-specs/0007-beta-0-supervised-openclaw.md");
for (const marker of ["experimental-internal", "Ngoài phạm vi"]) {
  if (!spec.includes(marker)) failures.push(`feature spec is missing ${marker}`);
}
if (/(installer|bộ cài)[^\n]*(sẵn sàng|đã xong|hoàn tất)/i.test(spec)) {
  failures.push("feature spec claims an installer that does not exist");
}

// The candidate train stays a candidate. It has to differ from the locked
// train, match what the desktop app actually installs, keep its promotion
// blockers, and never claim evidence it does not hold.
const readJson = (relativePath) => JSON.parse(read(relativePath));
const candidate = readJson("manifests/runtime/beta-0-candidate.lock.json");
const locked = readJson("manifests/runtime/runtime-manifest.lock.json");
const desktopPackage = readJson("apps/desktop/package.json");

if (candidate.status !== "candidate" || candidate.advertisable !== false) {
  failures.push("the beta 0 train is not marked as a non-advertisable candidate");
}
if (candidate.candidateTrainId === locked.releaseTrainId) {
  failures.push("the candidate train id collides with the locked release train");
}
if (candidate.supersedesLockedTrainId !== locked.releaseTrainId) {
  failures.push("the candidate does not record which locked train it would supersede");
}
if (!Array.isArray(candidate.promotionBlockers) || candidate.promotionBlockers.length === 0) {
  failures.push("the candidate has no promotion blockers recorded");
}

for (const component of candidate.components) {
  const declared = desktopPackage.dependencies?.[component.name];
  if (declared !== component.version) {
    failures.push(
      `apps/desktop declares ${component.name}@${declared ?? "nothing"}, candidate pins ${component.version}`
    );
  }
}

for (const entry of candidate.evidence) {
  if (entry.level !== "spike-tested") {
    if (entry.artifact !== null || entry.linuxSubsystemUsed !== null) {
      failures.push(`${entry.platform}/${entry.architecture} claims evidence it has not produced`);
    }
    continue;
  }
  if (!entry.artifact || !fs.existsSync(path.join(repoRoot, entry.artifact))) {
    failures.push(`${entry.platform}/${entry.architecture} is spike-tested without a stored artifact`);
    continue;
  }
  const record = JSON.parse(fs.readFileSync(path.join(repoRoot, entry.artifact), "utf8"));
  if (record.host?.platform !== entry.platform || record.host?.arch !== entry.architecture) {
    failures.push(`${entry.artifact} was recorded on a different platform than it is filed under`);
  }
  if (record.handshake?.connected !== true || (record.failures ?? []).length > 0) {
    failures.push(`${entry.artifact} does not record a clean handshake`);
  }
}

const claimsLocked = /candidate[^\n]{0,40}(?:is|as)\s+locked|beta-0-candidate[^\n]{0,60}locked release train/i;
for (const relativePath of ["docs/feature-specs/0007-beta-0-supervised-openclaw.md", "README.md"]) {
  if (fs.existsSync(path.join(repoRoot, relativePath)) && claimsLocked.test(read(relativePath))) {
    failures.push(`${relativePath} presents the candidate as a locked release train`);
  }
}

if (failures.length > 0) {
  console.error("Beta 0 validation failed:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log(
  `Beta 0 validation passed: loopback+token supervision; allowlist=${ALLOWED_METHODS.length} methods; ` +
    `events=${FORWARDED_EVENTS.length}; renderer transport denied; ` +
    `candidate ${candidate.candidateTrainId} with ${candidate.promotionBlockers.length} promotion blockers`
);
