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
import { SETUP_METHODS, SETUP_SCOPES, isForbiddenOnSetupChannel, isSetupMethod } from "../apps/desktop/electron/setup-channel.mjs";

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
  "apps/desktop/electron/setup-channel.mjs",
  "apps/desktop/src/connect/ConnectScreen.tsx",
  "apps/desktop/src/connect/wizard-vi.ts",
  "scripts/gateway-smoke.mjs",
  "scripts/provider-verify.mjs",
  "scripts/stage-runtime.mjs",
  "scripts/packaged-runtime-smoke.mjs",
  "scripts/packaged-app-smoke.mjs",
  "manifests/runtime/bundled-runtime.lock.json",
  "tests/unit/bundled-runtime.test.mjs",
  "docs/testing/BETA-0-PROVIDER-VERIFICATION.md",
  "tests/unit/provider-verify.test.mjs",
  "tests/contract/setup-channel-contract.test.mjs",
  "tests/contract/beta-0-runtime-contract.test.mjs",
  "tests/unit/supervisor.test.mjs",
  "tests/unit/device-identity.test.mjs"
]) {
  if (!fs.existsSync(path.join(repoRoot, requiredPath))) failures.push(`missing ${requiredPath}`);
}

const readJsonEarly = (relativePath) => JSON.parse(read(relativePath));
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

// Provider connection needs admin, so it lives on its own connection with its
// own short allowlist. Admin must never leak onto the chat adapter.
if (!SETUP_SCOPES.includes("operator.admin")) {
  failures.push("the setup channel cannot connect a provider without admin scope");
}
if (OPERATOR_SCOPES.includes("operator.admin")) {
  failures.push("the chat adapter carries admin scope");
}
for (const method of ["config.patch", "secrets.store.set", "plugins.install", "tools.invoke", "terminal.open"]) {
  if (isSetupMethod(method) || !isForbiddenOnSetupChannel(method)) {
    failures.push(`the setup channel can reach ${method}`);
  }
}
if (!SETUP_METHODS.includes("openclaw.setup.detect")) {
  failures.push("the setup channel cannot read the provider catalogue");
}

// The provider list belongs to OpenClaw. A hard-coded provider in the shell
// freezes the catalogue the day upstream adds one.
const connect = read("apps/desktop/src/connect/ConnectScreen.tsx");
for (const provider of ["openai", "anthropic", "gemini", "openrouter", "copilot", "ollama"]) {
  if (new RegExp(`["'\`][^"'\`]*${provider}`, "i").test(connect)) {
    failures.push(`the Connect screen hard-codes ${provider}`);
  }
}
if (!connect.includes("openclaw.setup.detect") || !connect.includes("manualProviders")) {
  failures.push("the Connect screen does not render the catalogue the Gateway reports");
}
if (!read("apps/desktop/src/connect/wizard-vi.ts").includes("recognised")) {
  failures.push("unrecognised wizard text has no verbatim fallback");
}

// The provider-verification harness is the only place a real credential ever
// enters the project, so it may not take one from argv, may not name a
// provider, and may not open a connection outside the shipped modules (D-0024).
const providerVerify = read("scripts/provider-verify.mjs");
if (!providerVerify.includes("process.env.AIFB_PROVIDER_SECRET")) {
  failures.push("the provider harness does not read its credential from the environment");
}
if (/--secret|--api-key|--token\b/.test(providerVerify)) {
  failures.push("the provider harness accepts a credential on the command line");
}
if (/new GatewayClient|new WebSocket\s*\(/.test(providerVerify)) {
  failures.push("the provider harness opens a connection outside the shipped modules");
}
const harnessCode = providerVerify.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
for (const provider of ["openai", "anthropic", "gemini", "openrouter", "copilot", "ollama"]) {
  if (new RegExp(`["'\`][^"'\`]*${provider}`, "i").test(harnessCode)) {
    failures.push(`the provider harness hard-codes ${provider}`);
  }
}

// The gate is closed by an evidence file, not by a sentence in a document.
const providerEvidencePath = "artifacts/beta-0/provider-verify-linux-x64.json";
if (!fs.existsSync(path.join(repoRoot, providerEvidencePath))) {
  failures.push(`missing ${providerEvidencePath}`);
} else {
  const evidence = readJsonEarly(providerEvidencePath);
  if (evidence.verify?.ok !== true) failures.push("provider evidence does not record a passing verify");
  if (evidence.chatTurn?.replied !== true) failures.push("provider evidence records no model reply");
  if ((evidence.failures ?? []).length > 0) failures.push("provider evidence records failures");
  if (/sk-[a-z]+-/i.test(read(providerEvidencePath))) failures.push("provider evidence contains a credential");
}

// The Connect screen must drive both activation shapes and wait for the step
// the wizard is still preparing; treating "no step" as "done" ends the flow
// before a provider is connected.
if (!connect.includes("wizard.status") || !connect.includes('kind: "api-key"')) {
  failures.push("the Connect screen cannot complete a key-based provider");
}
if (!main.includes("finishesSetup")) {
  failures.push("a finished setup wizard does not restart the Gateway");
}

// The launch check must wait for the device token, which only exists after a
// real handshake. Waiting for the identity file instead would pass on an app
// that loaded and then failed to reach its Gateway.
const appSmoke = read("scripts/packaged-app-smoke.mjs");
if (!appSmoke.includes("device-token.json") || !appSmoke.includes("ERR_MODULE_NOT_FOUND")) {
  failures.push("the packaged app check does not prove a real handshake, or ignores module-resolution failures");
}

// A packaged app that finds Node on the host proves nothing about a clean
// machine, so the check that says otherwise must strip PATH before resolving.
const packagedSmoke = read("scripts/packaged-runtime-smoke.mjs");
if (!packagedSmoke.includes('PATH: ""') || !packagedSmoke.includes("nodeFromPackage")) {
  failures.push("the packaged runtime check can be rescued by a Node on the host");
}
if (!read("apps/desktop/electron/supervisor.mjs").includes('path.join(resourcesPath, "node_modules"')) {
  failures.push("a packaged app cannot resolve the OpenClaw install it carries");
}

// The renderer stays a pure view: no sockets, no storage, no direct transport.
if (/localStorage|sessionStorage|indexedDB|new WebSocket\s*\(|XMLHttpRequest|fetch\s*\(/.test(
  `${renderer}\n${rendererBridge}\n${connect}`
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

const PLATFORM_ARTIFACT_LABEL = { win32: "windows", darwin: "macos", linux: "linux" };

for (const entry of candidate.evidence) {
  const label = `${entry.platform}/${entry.architecture}`;
  if (entry.level !== "spike-tested") {
    if (entry.artifact !== null || entry.linuxSubsystemUsed !== null || entry.ciArtifact) {
      failures.push(`${label} claims evidence it has not produced`);
    }
    continue;
  }

  // Evidence is either a record stored in the repository or a CI artifact
  // pinned by run and digest. Both are checkable; a bare claim is not.
  if (!entry.artifact && !entry.ciArtifact) {
    failures.push(`${label} is spike-tested without a stored or pinned artifact`);
    continue;
  }

  if (entry.artifact) {
    if (!fs.existsSync(path.join(repoRoot, entry.artifact))) {
      failures.push(`${label} points at a missing artifact ${entry.artifact}`);
    } else {
      const record = JSON.parse(fs.readFileSync(path.join(repoRoot, entry.artifact), "utf8"));
      if (record.host?.platform !== entry.platform || record.host?.arch !== entry.architecture) {
        failures.push(`${entry.artifact} was recorded on a different platform than it is filed under`);
      }
      if (record.handshake?.connected !== true || (record.failures ?? []).length > 0) {
        failures.push(`${entry.artifact} does not record a clean handshake`);
      }
    }
  }

  if (entry.ciArtifact) {
    const expected = PLATFORM_ARTIFACT_LABEL[entry.platform];
    if (!entry.ciArtifact.name.includes(expected)) {
      failures.push(`${label} is filed against CI artifact ${entry.ciArtifact.name}`);
    }
    if (entry.ciArtifact.conclusion !== "success") {
      failures.push(`${label} cites a CI run that did not succeed`);
    }
    if (!entry.ciArtifact.url.includes(entry.ciArtifact.runId)) {
      failures.push(`${label} cites a CI URL that does not match its run id`);
    }
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
