/**
 * Beta 0 provider verification.
 *
 * Two questions from the Connect screen gate cannot be answered without a real
 * provider account, and both must be answered with evidence rather than a
 * screenshot someone remembers taking:
 *
 *   1. Does the auth flow run end to end — catalogue, wizard, verify?
 *   2. After activation, does the agent runtime leave the broken `codex`
 *      default (R-032), so a chat turn actually reaches a model?
 *
 * This harness drives the very same modules the desktop app drives (the shipped
 * Supervisor, SetupChannel and GatewayAdapter), headless, and writes a redacted
 * evidence record. It never reads a credential from the command line, never
 * writes one into the record, and never names a provider of its own: the
 * catalogue comes from OpenClaw at runtime.
 *
 * Usage:
 *   node scripts/provider-verify.mjs --list
 *   AIFB_PROVIDER_SECRET=... node scripts/provider-verify.mjs --provider <id>
 *   node scripts/provider-verify.mjs --candidate <kind> --interactive
 */

import { createInterface } from "node:readline/promises";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { GatewaySupervisor, SUPERVISOR_STATES, resolveNodeExecutable } from "../apps/desktop/electron/supervisor.mjs";
import { GatewayAdapter } from "../apps/desktop/electron/gateway-adapter.mjs";
import { SetupChannel } from "../apps/desktop/electron/setup-channel.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDesktop = createRequire(path.join(repoRoot, "apps", "desktop", "package.json"));

export const SECRET_KEY_PATTERN = /key|token|secret|password|credential|authorization|cookie|bearer/i;

/**
 * Names that read like a secret and never are. Without this the evidence hides
 * the very fields that make it readable, such as which session was used.
 */
export const SAFE_KEY_NAMES = new Set(["key", "sessionKey", "idempotencyKey", "publicKey", "keys"]);

/**
 * Anything that leaves this process — the evidence file, a log line — passes
 * through here first. A provider secret must never survive the run.
 */
export function redact(value, depth = 0) {
  if (depth > 6) return "[deep]";
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 40).map((entry) => redact(entry, depth + 1));
  if (typeof value !== "object") return String(value);
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    const secretShaped =
      !SAFE_KEY_NAMES.has(key) && SECRET_KEY_PATTERN.test(key) && (typeof entry === "string" || typeof entry === "object");
    out[key] = secretShaped ? "[redacted]" : redact(entry, depth + 1);
  }
  return out;
}

/**
 * The answer policy for one wizard step, decided without a human when the run
 * is non-interactive. Kept pure so the unit tests can exercise every step type
 * without a Gateway. `null` means the step needs a person.
 */
export function planAnswer(step, { secret = null, answers = new Map() } = {}) {
  if (!step || typeof step !== "object") return { value: null, reason: "no step" };
  const explicit = answers.get(step.id);
  if (explicit !== undefined) return { value: explicit, reason: "answer supplied on the command line" };

  switch (step.type) {
    case "note":
    case "progress":
      return { value: true, reason: "acknowledged" };
    case "confirm":
      return { value: true, reason: "accepted" };
    case "text": {
      if (step.secret) {
        if (!secret) return { value: null, reason: "step wants a secret and none was supplied" };
        return { value: secret, reason: "secret from AIFB_PROVIDER_SECRET" };
      }
      return { value: null, reason: "free text step needs a person" };
    }
    case "select": {
      const options = Array.isArray(step.options) ? step.options : [];
      if (options.length === 0) return { value: null, reason: "select step has no options" };
      const preferred = options.find((option) => option.recommended) ?? options[0];
      return { value: preferred.value, reason: `chose "${preferred.label ?? preferred.value}"` };
    }
    case "multiselect": {
      const options = Array.isArray(step.options) ? step.options : [];
      const preferred = options.filter((option) => option.recommended).map((option) => option.value);
      return { value: preferred, reason: preferred.length ? "kept the recommended options" : "chose nothing" };
    }
    case "action":
      return { value: null, reason: "action step needs a person (browser login, device code)" };
    default:
      return { value: null, reason: `unknown step type ${step.type}` };
  }
}

/** Windows 8.3 short paths fast-fail the Gateway file watcher — see R-034. */
function longPath(candidate) {
  try {
    return realpathSync.native(candidate);
  } catch {
    return candidate;
  }
}

function packageRoot(specifier) {
  return path.resolve(path.dirname(requireFromDesktop.resolve(specifier)), "..");
}

function packageVersion(specifier) {
  return JSON.parse(readFileSync(path.join(packageRoot(specifier), "package.json"), "utf8")).version;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Progress goes to stdout as it happens, so a run cut short still says where it got to. */
const step = (message) => console.log(`[provider-verify] ${message}`);

function parseArgs(argv) {
  const options = { answers: new Map(), interactive: false, list: false, fresh: false, chatTimeoutMs: 120_000, prompt: "Xin chào, trả lời ngắn gọn: 2+2 bằng mấy?" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = () => argv[(index += 1)];
    if (flag === "--provider") options.provider = next();
    else if (flag === "--candidate") options.candidate = next();
    else if (flag === "--state-dir") options.stateDirectory = next();
    else if (flag === "--out") options.out = next();
    else if (flag === "--prompt") options.prompt = next();
    else if (flag === "--chat-timeout") options.chatTimeoutMs = Math.max(5, Number(next()) || 0) * 1000;
    else if (flag === "--answer") {
      const pair = next() ?? "";
      const separator = pair.indexOf("=");
      if (separator > 0) options.answers.set(pair.slice(0, separator), pair.slice(separator + 1));
    } else if (flag === "--interactive") options.interactive = true;
    else if (flag === "--list") options.list = true;
    else if (flag === "--fresh") options.fresh = true;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const secret = process.env.AIFB_PROVIDER_SECRET || null;

  const stateDirectory = options.stateDirectory
    ? longPath(path.resolve(options.stateDirectory))
    : longPath(mkdtempSync(path.join(longPath(os.tmpdir()), "aifb-provider-")));
  if (options.fresh && options.stateDirectory) {
    rmSync(stateDirectory, { recursive: true, force: true });
    mkdirSync(stateDirectory, { recursive: true });
  }

  const outPath = options.out
    ? path.resolve(options.out)
    : path.join(repoRoot, "artifacts", "beta-0", `provider-verify-${process.platform}-${process.arch}.json`);

  const record = {
    recordedAt: new Date().toISOString(),
    scope: "AI for Boss beta 0 — real provider auth end to end, then one chat turn (R-032)",
    host: { platform: process.platform, arch: process.arch, release: os.release(), node: process.version },
    runtime: {
      openclaw: packageVersion("openclaw"),
      gatewayClient: packageVersion("@openclaw/gateway-client"),
      gatewayProtocol: packageVersion("@openclaw/gateway-protocol")
    },
    request: { provider: options.provider ?? null, candidate: options.candidate ?? null, interactive: options.interactive },
    catalogue: {},
    wizard: { steps: [], completed: false },
    verify: null,
    authStatus: { before: null, after: null },
    agentRuntime: { before: null, after: null },
    chatTurn: null,
    failures: []
  };

  const nodeExecutable = resolveNodeExecutable();
  if (!nodeExecutable) {
    record.failures.push("no Node runtime resolved for the Gateway child");
    return finish(record, outPath, 1);
  }
  const openclawEntry = path.join(packageRoot("openclaw"), "openclaw.mjs");

  const supervisor = new GatewaySupervisor({
    stateDirectory,
    nodeExecutable,
    openclawEntry,
    logger: { info: () => {}, warn: () => {}, error: () => {} }
  });
  // The adapter takes one event callback at construction, so the harness routes
  // it through a swappable sink the chat-turn probe can claim while it runs.
  let eventSink = () => {};
  const adapter = new GatewayAdapter({
    stateDirectory,
    appVersion: "0.0.0-provider-verify",
    logger: { warn: () => {} },
    onEvent: (frame) => eventSink(frame),
    onStatus: (status) => {
      if (status.phase === "connected") supervisor.markReady();
    }
  });
  const setup = new SetupChannel({ stateDirectory, appVersion: "0.0.0-provider-verify", logger: { warn: () => {} } });

  step("starting the gateway");
  const { port } = await supervisor.start();
  const url = `ws://127.0.0.1:${port}`;
  adapter.connect({ url, token: supervisor.token });
  setup.connect({ url, token: supervisor.token });

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline && !(adapter.connected && setup.connected)) {
    if (supervisor.state === SUPERVISOR_STATES.SAFE_MODE) break;
    await wait(500);
  }
  if (!adapter.connected || !setup.connected) {
    record.failures.push(`connections did not come up (supervisor state ${supervisor.state})`);
    await teardown(adapter, setup, supervisor);
    return finish(record, outPath, 1);
  }

  const safely = async (label, work, sink) => {
    try {
      const result = await work();
      if (sink) sink(result);
      return result;
    } catch (error) {
      record.failures.push(`${label}: ${error?.message ?? error}`);
      return null;
    }
  };

  await safely("models.authStatus (before)", () => adapter.request("models.authStatus"), (result) => {
    record.authStatus.before = redact(result);
  });
  await safely("agents.list (before)", () => adapter.request("agents.list"), (result) => {
    record.agentRuntime.before = summariseAgents(result);
  });

  step("connected; reading the catalogue");
  const detected = await safely("openclaw.setup.detect", () => setup.request("openclaw.setup.detect", {}));
  const manualProviders = detected?.manualProviders ?? [];
  const candidates = detected?.candidates ?? [];
  record.catalogue = {
    setupComplete: detected?.setupComplete ?? null,
    // Whole entries, redacted: the `detail` line is where OpenClaw says why a
    // candidate is or is not usable ("installed, not logged in", and so on).
    candidates: candidates.map((entry) => redact(entry)),
    providerCount: manualProviders.length,
    groups: [...new Set(manualProviders.map((entry) => entry.groupLabel))]
  };

  if (options.list) {
    console.log(`Ứng viên phát hiện được (${candidates.length}):`);
    for (const entry of candidates) console.log(`  --candidate ${entry.kind}\t${entry.label}`);
    console.log(`\nNhà cung cấp khai báo tay (${manualProviders.length}):`);
    for (const entry of manualProviders) console.log(`  --provider ${entry.id}\t[${entry.groupLabel}] ${entry.label}`);
    await teardown(adapter, setup, supervisor);
    return finish(record, outPath, record.failures.length === 0 ? 0 : 1);
  }

  if (!options.provider && !options.candidate) {
    record.failures.push("no --provider or --candidate given; run with --list to see the catalogue");
    await teardown(adapter, setup, supervisor);
    return finish(record, outPath, 1);
  }

  step(`starting ${options.candidate ? `candidate ${options.candidate}` : `provider ${options.provider}`}${secret ? " with a supplied secret" : ""}`);
  const sessionId = randomUUID();
  // OpenClaw has two activation shapes and picks a different code path for each.
  // `auth.start` is the guided one (browser sign-in, device code) and refuses a
  // provider that only takes a pasted secret. A provider plus a secret is the
  // `api-key` activation instead. The candidate list is the third shape.
  record.request.mode = options.candidate ? "candidate" : secret ? "api-key" : "provider-auth";
  const started = options.candidate
    ? await safely("openclaw.setup.activate.start", () =>
        setup.request("openclaw.setup.activate.start", {
          kind: options.candidate,
          sessionId,
          modelRef: candidates.find((entry) => entry.kind === options.candidate)?.modelRef
        })
      )
    : secret
      ? await safely("openclaw.setup.activate.start (api-key)", () =>
          setup.request("openclaw.setup.activate.start", {
            sessionId,
            kind: "api-key",
            authChoice: options.provider,
            apiKey: secret
          })
        )
      : await safely("openclaw.setup.auth.start", () =>
          setup.request("openclaw.setup.auth.start", { sessionId, authChoice: options.provider })
        );

  record.activation = redact(started);
  if (started) {
    const outcome = await driveWizard({ setup, sessionId, started, options, secret, record });
    record.wizard.completed = outcome.completed;
    if (!outcome.completed) record.failures.push(`wizard stopped: ${outcome.reason}`);
  }

  if (record.wizard.completed) {
    // OpenClaw saves provider settings into a Gateway that is already running,
    // so `verify` answers "saved but not active yet" until the child restarts.
    // The desktop app restarts on `gatewayRestartRequired`; the harness always
    // restarts after a completed activation, then reconnects both channels.
    step("activation done; restarting the gateway");
    record.gatewayRestarted = await restart({ supervisor, adapter, setup, record });

    step("verifying the connection");
    await safely("openclaw.setup.verify", () => setup.request("openclaw.setup.verify", {}), (result) => {
      record.verify = redact(result);
      if (result?.ok !== true) record.failures.push(`verify did not pass: ${result?.status ?? ""} ${result?.error ?? ""}`.trim());
    });
    await safely("models.authStatus (after)", () => adapter.request("models.authStatus"), (result) => {
      record.authStatus.after = redact(result);
    });
    await safely("agents.list (after)", () => adapter.request("agents.list"), (result) => {
      record.agentRuntime.after = summariseAgents(result);
    });
    await safely("models.list (after)", () => adapter.request("models.list"), (result) => {
      const models = result?.models ?? [];
      record.models = {
        total: models.length,
        available: models.filter((model) => model.available !== false).length,
        firstAvailable: models.find((model) => model.available !== false)?.id ?? null
      };
    });

    // R-032: activation only counts if a turn actually reaches a model.
    step("sending one chat turn");
    const turn = await runChatTurn({
      adapter,
      prompt: options.prompt,
      timeoutMs: options.chatTimeoutMs,
      subscribe: (handler) => {
        eventSink = handler;
        return () => {
          eventSink = () => {};
        };
      }
    });
    record.chatTurn = turn;
    if (!turn.replied) record.failures.push(`chat turn produced no model reply: ${turn.detail ?? "timeout"}`);

    // R-032 asks whether the agent leaves the default it cannot run. The agent
    // record carries the model it will use, so the before/after pair is the
    // readable half of the answer and the chat turn is the decisive half.
    const primaryModel = (agents) => agents?.[0]?.model?.primary ?? agents?.[0]?.model ?? null;
    const before = primaryModel(record.agentRuntime.before);
    const after = primaryModel(record.agentRuntime.after);
    record.r032 = {
      agentModelBefore: before,
      agentModelAfter: after,
      leftDefault: Boolean(after && after !== before),
      chatReachedModel: Boolean(turn.replied)
    };
    if (!record.r032.chatReachedModel) record.failures.push("R-032 stays open: no model reply after activation");
  }

  await teardown(adapter, setup, supervisor);
  return finish(record, outPath, record.failures.length === 0 ? 0 : 1);
}

/**
 * The same restart the desktop app performs after a provider is activated. The
 * supervisor mints a fresh token and port, so both channels reconnect to the
 * new endpoint rather than the dead one.
 */
async function restart({ supervisor, adapter, setup, record }) {
  try {
    await setup.disconnect();
    await adapter.disconnect();
    await supervisor.stop();
    const { port } = await supervisor.start();
    const url = `ws://127.0.0.1:${port}`;
    adapter.connect({ url, token: supervisor.token });
    setup.connect({ url, token: supervisor.token });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline && !(adapter.connected && setup.connected)) {
      if (supervisor.state === SUPERVISOR_STATES.SAFE_MODE) break;
      await wait(500);
    }
    if (!adapter.connected || !setup.connected) {
      record.failures.push(`reconnect after activation failed (supervisor state ${supervisor.state})`);
      return false;
    }
    return true;
  } catch (error) {
    record.failures.push(`restart after activation failed: ${error?.message ?? error}`);
    return false;
  }
}

function summariseAgents(result) {
  const agents = Array.isArray(result?.agents) ? result.agents : Array.isArray(result) ? result : [];
  return agents.slice(0, 20).map((agent) => ({
    id: agent?.id ?? agent?.agentId ?? null,
    runtime: agent?.runtime ?? agent?.kind ?? null,
    model: agent?.model ?? agent?.modelRef ?? null,
    available: agent?.available ?? null
  }));
}

/**
 * Waits for the wizard to hand over a step. `wizard.next` and the two start
 * calls return as soon as the session is running, so the step itself is read
 * back from `wizard.status` until one appears or the session finishes.
 */
async function settle({ setup, sessionId, result, record, timeoutMs = 90_000 }) {
  let current = result;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (current?.done === true || current?.status === "done" || current?.status === "completed") {
      record.wizard.lastStatus = redact(current);
      return { done: true };
    }
    if (current?.step) return { step: current.step };
    if (current?.status && !["running", "pending", "starting"].includes(current.status)) {
      record.wizard.lastStatus = redact(current);
      return { reason: `wizard status ${current.status}: ${JSON.stringify(redact(current)).slice(0, 400)}` };
    }
    await wait(700);
    try {
      current = await setup.request("wizard.status", { sessionId });
    } catch (error) {
      record.failures.push(`wizard.status: ${error?.message ?? error}`);
      return { reason: `wizard.status failed: ${error?.message ?? error}` };
    }
  }
  return { reason: "wizard produced no step in time" };
}

async function driveWizard({ setup, sessionId, started, options, secret, record }) {
  let current = started;
  const rl = options.interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
  try {
    for (let turn = 0; turn < 40; turn += 1) {
      // A wizard answers `{done:false, status:"running"}` with no step while it
      // is still preparing one, so an absent step means "wait", never "done".
      // Only an explicit `done` ends the run.
      const settled = await settle({ setup, sessionId, result: current, record });
      if (settled.done) return { completed: true, reason: "wizard reported done" };
      if (!settled.step) return { completed: false, reason: settled.reason ?? "wizard produced no step" };
      const step_ = settled.step;
      const planned = planAnswer(step_, { secret, answers: options.answers });
      let value = planned.value;
      let source = planned.reason;

      if (value === null && rl) {
        console.log(`\n[${step_.type}] ${step_.title ?? ""}`);
        if (step_.message) console.log(step_.message);
        if (Array.isArray(step_.options)) {
          step_.options.forEach((option, position) => console.log(`  ${position + 1}. ${option.label ?? option.value}`));
        }
        const typed = await rl.question(step_.secret ? "Giá trị (ẩn khi ghi bằng chứng): " : "Trả lời: ");
        if (step_.type === "select" && /^\d+$/.test(typed.trim())) {
          value = step_.options?.[Number(typed.trim()) - 1]?.value ?? typed;
        } else if (step_.type === "confirm") {
          value = !/^(n|no|không|khong)$/i.test(typed.trim());
        } else {
          value = typed;
        }
        source = "answered interactively";
      }

      step(`wizard [${step_.type}] ${step_.title ?? step_.id} — ${source}`);
      record.wizard.steps.push({
        id: step_.id,
        type: step_.type,
        title: step_.title ?? null,
        secret: Boolean(step_.secret),
        answerSource: source,
        answered: value !== null
      });

      if (value === null) {
        await setup.request("wizard.cancel", { sessionId }).catch(() => {});
        return { completed: false, reason: `${step_.type} step "${step_.title ?? step_.id}" — ${planned.reason}` };
      }

      current = await setup.request("wizard.next", { sessionId, answer: { stepId: step_.id, value } });
    }
    await setup.request("wizard.cancel", { sessionId }).catch(() => {});
    return { completed: false, reason: "wizard did not finish within 40 steps" };
  } catch (error) {
    await setup.request("wizard.cancel", { sessionId }).catch(() => {});
    return { completed: false, reason: error?.message ?? String(error) };
  } finally {
    rl?.close();
  }
}

async function runChatTurn({ adapter, prompt, subscribe, timeoutMs = 120_000 }) {
  const outcome = { prompt, replied: false, elapsedMs: 0, detail: null };
  const startedAt = Date.now();
  try {
    // Sessions are addressed by `key`, exactly as the shipped window addresses
    // them; a shape of the harness's own invention would prove nothing.
    const key = `aifb-verify-${Date.now().toString(36)}`;
    const created = await adapter.request("sessions.create", {
      key,
      displayName: "Kiểm chứng nhà cung cấp",
      label: key
    });
    const sessionKey = created?.key ?? key;
    outcome.sessionKey = sessionKey;

    let replied = false;
    let text = null;
    const stop = subscribe((frame) => {
      if (replied) return;
      const message = frame?.payload?.message ?? frame?.payload ?? null;
      if (message?.role !== "assistant") return;
      const content = message.content;
      const readable = typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((part) => (typeof part === "string" ? part : String(part?.text ?? ""))).join("")
          : String(content?.text ?? "");
      if (!readable.trim()) return;
      replied = true;
      text = readable.slice(0, 200);
    });

    await adapter.request("sessions.messages.subscribe", { key: sessionKey });
    await adapter.request("sessions.send", { key: sessionKey, message: prompt });

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && !replied) await wait(500);
    stop?.();

    outcome.replied = replied;
    outcome.reply = replied ? text : null;
    outcome.elapsedMs = Date.now() - startedAt;
    if (!replied) {
      // A run that never reached a model leaves its reason in the transcript.
      const history = await adapter.request("chat.history", { sessionKey, limit: 20 }).catch(() => null);
      const last = (history?.messages ?? []).at(-1) ?? null;
      outcome.detail = last ? `no assistant reply within ${Math.round(timeoutMs / 1000)}s; last entry ${JSON.stringify(redact(last)).slice(0, 300)}` : `no assistant message within ${Math.round(timeoutMs / 1000)}s`;
    }
    return outcome;
  } catch (error) {
    return { ...outcome, elapsedMs: Date.now() - startedAt, detail: error?.message ?? String(error) };
  }
}

async function teardown(adapter, setup, supervisor) {
  await setup.disconnect().catch(() => {});
  await adapter.disconnect().catch(() => {});
  await supervisor.stop().catch(() => {});
}

function finish(record, outPath, exitCode) {
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(redact(record), null, 2)}\n`);
  const verdict = exitCode === 0 ? "PASS" : "FAIL";
  console.log(`\n[provider-verify] ${verdict} on ${record.host.platform}/${record.host.arch}`);
  console.log(`[provider-verify] bằng chứng: ${outPath}`);
  for (const failure of record.failures) console.error(` - ${failure}`);
  process.exit(exitCode);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error("[provider-verify] fatal", error);
    process.exit(1);
  });
}
