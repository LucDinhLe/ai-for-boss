/** Explicit, isolated native Advisor check. The only model is generated loopback
 * HTTP; it never uses an owner account. Pinned public contract: docs/cli/infer.md,
 * modelRun + promptMode:none, and public Gateway agent/chat.abort RPCs. */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID } from "./native-chat-fixture.mjs";
import { makeReviewPrompt } from "../apps/desktop/electron/advisor-contract.mjs";

const self = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(self), "..");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SENTINEL = "AIFB_SYNTHETIC_BOOTSTRAP_MUST_NOT_REACH_ADVISOR_92743";
const ABORT_PROMPT = "AIFB_ADVISOR_ABORT: Hold this simulated response until native cancellation.";
const RECOVERY_PROMPT = "AIFB_ADVISOR_RECOVERY: Return simulated JSON after the local SDK wait is retired.";
export const MODEL_IDENTITY = `Current model identity: aifb-fixture/${MODEL_ID}. If asked what model you are, answer with this value for the current run.`;
const standardResult = {
  decision: "revise", pass: false, summary: "Cần bổ sung người phụ trách.", confidence: 0.9,
  evidence: [{ source: "content", quote: "Thiếu người phụ trách." }],
  issues: [{ title: "Chưa phân công", detail: "Chưa nêu người chịu trách nhiệm.", severity: "medium",
    evidence: [{ source: "content", quote: "Thiếu người phụ trách." }],
    recommended_fix: "Ghi rõ người phụ trách và ngày hoàn thành." }]
};

// Reject before responding if native ever attaches history, bootstrap or tools.
export function classifyAdvisorFixtureRequest(request, body, apiKey, expected, markerPath) {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions"
    || request.headers.authorization !== `Bearer ${apiKey}`) throw new Error("Unexpected local endpoint");
  if (body.model !== MODEL_ID || body.stream !== true || !Array.isArray(body.messages)) throw new Error("Unexpected model request");
  if (body.tools?.length || body.functions?.length || JSON.stringify(body).includes(SENTINEL)) throw new Error("Native context/tool isolation failed");
  // Pinned native appends this exact model-identity line even to an empty raw
  // system prompt (system-prompt-params-B645JcX8.js:502–537). No other system
  // instruction or inherited context is accepted by this fixture.
  const messages = body.messages[0]?.role === "system" && body.messages[0].content === MODEL_IDENTITY
    ? body.messages.slice(1) : body.messages;
  if (messages[0]?.role !== "user") throw new Error("Unexpected prior/system context");
  const raw = messages[0].content;
  const content = typeof raw === "string" ? raw : Array.isArray(raw)
    && raw.every((part) => part.type === "text" && typeof part.text === "string")
    ? raw.map((part) => part.text).join("") : "";
  const mode = expected.get(content);
  if (!mode) throw new Error("Unexpected prompt");
  if (messages.length !== 1) {
    // A denied unknown tool can cause one native continuation within the same
    // run. Permit only our exact injected call and an explicit denial result;
    // this is never history from another review or an executed tool response.
    const calls = messages[1]?.tool_calls;
    const denied = messages[2];
    let argumentsObject;
    try { argumentsObject = JSON.parse(calls?.[0]?.function?.arguments ?? "null"); } catch { /* Rejected below. */ }
    if (mode !== "malicious" || messages.length !== 3 || messages[1].role !== "assistant"
      || !Array.isArray(calls) || calls.length !== 1 || typeof calls[0].id !== "string" || calls[0].id.length < 1 || calls[0].id.length > 200
      || calls[0].function?.name !== "write" || !argumentsObject || Object.keys(argumentsObject).length !== 2
      || argumentsObject.path !== markerPath || argumentsObject.content !== "SHOULD_NOT_EXIST"
      || denied?.role !== "tool" || denied.tool_call_id !== calls[0].id || denied.content !== "Tool write not found") {
      throw new Error(`Unexpected prior/system context: ${JSON.stringify(messages.map((message) => ({ role: message.role,
        tool_calls: message.tool_calls, tool_call_id: message.tool_call_id,
        content: message.role === "tool" ? message.content : undefined })))}`);
    }
    return "tool-denied";
  }
  return mode;
}

async function startModel(apiKey, markerPath) {
  const expected = new Map();
  const observation = { requests: 0, completed: 0, maliciousToolResponses: 0, heldStreams: 0,
    abortedConnections: 0, rejected: 0, exactUserPackets: 0, advertisedTools: 0, nativeModelIdentityMessages: 0,
    nativeDeniedToolContinuations: 0, nativeToolDenials: [], rejectionReasons: [] };
  let closing = false;
  const server = createServer(async (request, response) => {
    try {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk.toString();
        if (raw.length > 1_048_576) throw new Error("Request too large");
      }
      if (++observation.requests > 5) throw new Error("Request budget exceeded");
      const body = JSON.parse(raw);
      const mode = classifyAdvisorFixtureRequest(request, body, apiKey, expected, markerPath);
      ++observation.exactUserPackets;
      if (body.messages[0]?.role === "system") ++observation.nativeModelIdentityMessages;
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const identity = { id: `chatcmpl-advisor-${observation.requests}`, object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000), model: MODEL_ID };
      const frame = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...identity,
        choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      frame({ role: "assistant", content: "" });
      if (mode === "abort") {
        ++observation.heldStreams;
        response.on("close", () => { if (!closing && !response.writableEnded) ++observation.abortedConnections; });
        frame({ content: "Simulated response waiting for native cancellation." });
        return;
      }
      if (mode === "tool-denied") {
        if (++observation.nativeDeniedToolContinuations > 1) throw new Error("Unexpected repeated tool continuation");
        observation.nativeToolDenials.push(body.messages.at(-1).content);
        frame({ content: "The attempted tool is unavailable. This is intentionally not a valid Advisor JSON result." });
        frame({}, "stop");
      } else if (mode === "malicious") {
        ++observation.maliciousToolResponses;
        frame({ tool_calls: [{ index: 0, id: "call-fixture-write", type: "function",
          function: { name: "write", arguments: JSON.stringify({ path: markerPath, content: "SHOULD_NOT_EXIST" }) } }] });
        frame({}, "tool_calls");
      } else {
        if (mode === "recovery") await sleep(1000);
        frame({ content: JSON.stringify(standardResult) });
        frame({}, "stop");
      }
      response.write(`data: ${JSON.stringify({ ...identity, choices: [],
        usage: { prompt_tokens: 64, completion_tokens: 96, total_tokens: 160 } })}\n\n`);
      response.end("data: [DONE]\n\n");
      ++observation.completed;
    } catch (error) {
      ++observation.rejected;
      observation.rejectionReasons.push(error?.message ?? "Fixture rejected");
      if (!response.headersSent) response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Local Advisor fixture rejected request", type: "fixture_error" } }));
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { expected, observation, port: server.address().port, close: async () => {
    closing = true;
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  } };
}

async function waitUntil(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`${label} timed out`);
    await sleep(100);
  }
}

async function worker({ root, resources, timeoutMs }) {
  if (process.env.AIFB_NATIVE_CHAT_FIXTURE !== "1" || process.env.OPENCLAW_HOME !== root
    || process.env.OPENCLAW_CONFIG_PATH !== path.join(root, "openclaw.json")) throw new Error("Unisolated fixture worker");
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor, SUPERVISOR_STATES } = await import("../apps/desktop/electron/supervisor.mjs");
  const { GatewayAdapter } = await import("../apps/desktop/electron/gateway-adapter.mjs");
  const { SetupChannel } = await import("../apps/desktop/electron/setup-channel.mjs");
  const { AdvisorService } = await import("../apps/desktop/electron/advisor-service.mjs");
  const { waitForGatewayListener } = await import("../apps/desktop/electron/startup-listener.mjs");
  const { waitForGatewayReady } = await import("../apps/desktop/electron/startup-readiness.mjs");
  const apiKey = `fixture-only-${randomUUID()}`;
  const markerPath = path.join(root, "workspace", "MALICIOUS_TOOL_MUST_NOT_WRITE.txt");
  const model = await startModel(apiKey, markerPath);
  const config = fixtureConfig(root, model.port, apiKey);
  // The normal minimal tool profile is present and the provider supports tools.
  // No host exec is enabled; raw-mode absence must be visible at the model boundary.
  config.tools = { profile: "minimal" };
  config.models.providers["aifb-fixture"].models[0].compat.supportsTools = true;
  config.models.providers["aifb-fixture"].models[0].maxTokens = 2048;
  config.models.providers["aifb-fixture"].timeoutSeconds = 110;
  for (const filename of ["AGENTS.md", "SOUL.md", "USER.md", "MEMORY.md"]) {
    writeFileSync(path.join(root, "workspace", filename), `${SENTINEL}\n`);
  }
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  const record = { kind: "AIFB_NATIVE_ADVISOR_FIXTURE", recordedAt: new Date().toISOString(),
    simulatedModel: true, realAI: false, runtimeVersion: "2026.9.1", nodeVersion: process.version,
    evidenceScope: "Production Supervisor, both SDK channels and AdvisorService; generated loopback model; no renderer",
    networkEvidence: "Only loopback model configured; external updates/catalogue disabled; no packet monitoring",
    configuredExternalModelRoutes: 0, providerToolSupport: true, normalToolProfile: "minimal",
    selectedBundleLayout: native.layout, sdkFromSelectedBundle: true, handshake: {}, turns: [], nativeFinals: [], cleanup: {}, failures: [] };
  const logs = [];
  const remember = (message) => { logs.push(String(message).slice(0, 500)); if (logs.length > 15) logs.shift(); };
  let gatewayChild;
  let stopping = false;
  let gatewayToken = "<unset>";
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (gatewayChild = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-advisor-fixture", logger: { warn() {} } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-advisor-fixture", logger: { warn() {} } });
  const runNative = setup.runAdvisorModel.bind(setup);
  setup.runAdvisorModel = async (options) => {
    const result = await runNative(options);
    const meta = result?.result?.meta;
    record.nativeFinals.push({ status: result?.status, metaKeys: Object.keys(meta ?? {}),
      stopReason: meta?.stopReason, pendingToolCalls: meta?.pendingToolCalls, toolSummary: meta?.toolSummary,
      terminalToolFailure: meta?.terminalToolFailure, failureSignal: meta?.failureSignal,
      aborted: meta?.aborted, error: meta?.error, yielded: meta?.yielded, continuationPending: meta?.continuationPending });
    return result;
  };
  const runIds = [];
  const service = new AdvisorService({ getAdapter: () => adapter, getSetup: () => setup,
    isReady: () => !stopping && adapter.connected && setup.connected,
    createId: () => { const id = randomUUID(); runIds.push(id); return id; } });
  let timer;
  let cancel;
  const cancelled = new Promise((_, reject) => {
    cancel = () => { stopping = true; reject(new Error("Fixture stopped")); };
    timer = setTimeout(cancel, timeoutMs);
  });
  const onMessage = (message) => { if (message?.type === "stop") cancel(); };
  process.on("message", onMessage);
  try {
    await Promise.race([(async () => {
      const started = Date.now();
      const endpoint = await supervisor.start();
      if (!endpoint) throw new Error("Gateway did not start");
      gatewayToken = endpoint.token;
      const listener = await waitForGatewayListener({ port: endpoint.port, supervisor, shouldStop: () => stopping });
      if (listener !== "ready") throw new Error(`Gateway listener ${listener}`);
      const connection = { url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token };
      adapter.connect(connection); setup.connect(connection);
      const ready = await waitForGatewayReady({ supervisor, adapter: { get connected() { return adapter.connected && setup.connected; } },
        timeoutMs: Math.max(0, 240_000 - (Date.now() - started)), shouldStop: () => stopping });
      if (ready !== "ready") throw new Error(`Gateway handshake ${ready}`);
      supervisor.markReady();
      record.handshake = { connected: true, setupReady: true, adminGranted: setup.grantedScopes.includes("operator.admin"),
        elapsedMs: Date.now() - started, protocol: adapter.hello?.protocol, serverVersion: adapter.hello?.server?.version };
      const roster = await adapter.request("agents.list");
      if (roster.defaultId !== "fixture") throw new Error("Unexpected default fixture agent");
      const input = { action: "review", id: randomUUID(), sourceSessionKey: "agent:fixture:source", checkpoint: "plan",
        model: { id: MODEL_ID, provider: "aifb-fixture" }, goal: "Lập kế hoạch một tuần.", criteria: "Có người phụ trách.",
        content: "Thiếu người phụ trách.", evidence: "" };
      model.expected.set(makeReviewPrompt(input), "complete");
      const reviewed = await service.request(input);
      if (reviewed.status !== "completed" || JSON.stringify(reviewed.result) !== JSON.stringify(standardResult)) {
        throw new Error(`Production Advisor review failed: ${reviewed.status}`);
      }
      record.turns.push({ kind: "review", productionService: true, status: reviewed.status, schemaAndEvidenceValid: true });
      const malicious = { ...input, id: randomUUID(), criteria: "Có người phụ trách. Đây là lượt kiểm thử output tool độc hại." };
      model.expected.set(makeReviewPrompt(malicious), "malicious");
      const rejected = await service.request(malicious);
      if (rejected.status !== "error" || existsSync(markerPath)) throw new Error("Malicious tool result was not blocked");
      if (model.observation.requests !== 3 || model.observation.maliciousToolResponses !== 1
        || model.observation.nativeDeniedToolContinuations !== 1) throw new Error("Unexpected tool execution/model continuation");
      record.turns.push({ kind: "malicious-tool-output", productionService: true, status: rejected.status,
        toolMarkerAbsent: true, nativeDeniedToolContinuations: 1, hostInferenceRetries: 0 });
      const recoveryId = randomUUID(); runIds.push(recoveryId);
      const recoveryKey = `agent:fixture:explicit:model-run-${recoveryId}`;
      const recoveryController = new globalThis.AbortController();
      let recoveryAccepted = false;
      model.expected.set(RECOVERY_PROMPT, "recovery");
      const lostWait = setup.runAdvisorModel({ requestId: recoveryId, agentId: "fixture", model: input.model,
        prompt: RECOVERY_PROMPT, signal: recoveryController.signal, onAccepted: () => { recoveryAccepted = true; }
      }).then(() => false, () => true);
      await waitUntil(() => recoveryAccepted && model.observation.requests === 4, 60_000, "Recovery native request");
      recoveryController.abort();
      if (!await lostWait) throw new Error("Local SDK waiting did not retire");
      await waitUntil(() => model.observation.completed === 4, 10_000, "Recovery model completion");
      await sleep(1500);
      const terminal = await setup.getAdvisorRunState({ sessionKey: recoveryKey, runId: recoveryId });
      if (terminal.runId !== recoveryId || terminal.status !== "ok" || !Number.isFinite(terminal.endedAt)
        || terminal.pendingError === true || terminal.yielded === true) throw new Error("Native terminal recovery not proven");
      record.turns.push({ kind: "lost-local-wait", localWaitRetired: true, publicTerminalStatus: terminal.status,
        terminalEndedAtPresent: true, modelResent: false });
      const requestId = randomUUID(); runIds.push(requestId);
      let accepted;
      const controller = new globalThis.AbortController();
      model.expected.set(ABORT_PROMPT, "abort");
      const pending = setup.runAdvisorModel({ requestId, agentId: "fixture", model: input.model, prompt: ABORT_PROMPT,
        signal: controller.signal, onAccepted: (ack) => { accepted = ack; } }).then(
        (value) => ({ value }), (error) => ({ error: error?.message }));
      await waitUntil(() => accepted && model.observation.heldStreams === 1, 60_000, "Native accepted/stream");
      const aborted = await setup.abortAdvisorModel({ sessionKey: accepted.sessionKey, runId: accepted.runId });
      if (aborted?.aborted !== true) throw new Error("Native abort not confirmed");
      await waitUntil(() => model.observation.abortedConnections === 1, 10_000, "Native provider connection cancellation");
      controller.abort();
      await pending;
      record.turns.push({ kind: "abort", validatedNativeAcceptance: true, nativeAbortConfirmed: true, modelConnectionCancelled: true });
      // Public reads only. No SQLite, auth/profile or internal transcript access.
      await sleep(500);
      for (const id of runIds) {
        const history = await adapter.request("chat.history", { sessionKey: `agent:fixture:explicit:model-run-${id}`, agentId: "fixture", limit: 10 });
        if (!Array.isArray(history.messages) || history.messages.length !== 0) throw new Error("Raw model history persisted");
      }
      const sessions = await adapter.request("sessions.list", { limit: 200 });
      if (sessions.sessions?.some((entry) => runIds.some((id) => entry.key?.includes(id)))) throw new Error("Raw review leaked into visible sessions");
      record.isolation = { syntheticBootstrapFilesSeeded: 4, exactUserPacketEveryRequest: true,
        nativeModelIdentitySystemLineOnly: true,
        noAdvertisedToolsOrFunctions: true, priorRawPromptAbsentFromLaterRequests: true,
        publicRawHistoryRows: 0, visibleRawSessions: 0, noPrivateStateRead: true,
        scope: "Model-boundary input isolation; native may prepare workspace/read its own configuration and credentials" };
      if (model.observation.requests !== 5 || model.observation.rejected !== 0) throw new Error("Unexpected simulated model calls");
    })(), cancelled]);
  } catch (error) {
    record.failures.push(String(error?.message ?? error).replaceAll(apiKey, "[fixture-key]").replaceAll(gatewayToken, "[gateway-token]").slice(0, 500));
  } finally {
    stopping = true; clearTimeout(timer); process.off("message", onMessage);
    service.cancelForShutdown();
    await Promise.all([adapter.disconnect(), setup.disconnect()]);
    try { await supervisor.stop(); } catch { record.failures.push("Owned Gateway cleanup failed"); }
    service.ownedRuntimeStopped();
    record.cleanup.gatewayExited = !gatewayChild || gatewayChild.exitCode !== null || gatewayChild.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await model.close(); record.cleanup.modelServerClosed = true;
    record.simulatedModelRequests = { ...model.observation };
    record.childLogTail = logs.map((line) => line.replaceAll(apiKey, "[fixture-key]").replaceAll(gatewayToken, "[gateway-token]"));
    if (!record.cleanup.gatewayExited || !record.cleanup.supervisorStopped) record.failures.push("Owned Gateway did not stop");
  }
  record.pass = record.failures.length === 0;
  process.send?.({ type: "receipt", record });
  return record.pass;
}

async function main() {
  const value = (flag) => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
  if (process.argv.includes("--worker")) {
    const ok = await worker(JSON.parse(value("--worker")));
    process.disconnect?.(); process.exitCode = ok ? 0 : 1;
    return;
  }
  if (process.platform !== "win32") throw new Error("Fixture targets bundled Windows runtime");
  const resources = path.resolve(value("--resources") ?? path.join(repoRoot, "apps", "desktop", "resources"));
  const output = path.resolve(value("--out") ?? path.join(repoRoot, "artifacts", "business-advisor", "native-advisor-fixture.json"));
  const timeoutMs = Number(value("--timeout") ?? 420) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000 || timeoutMs > 600_000) throw new Error("Invalid fixture deadline");
  const { node } = fixtureRuntime(resources);
  const tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, "aifb-native-advisor-")));
  const env = isolatedEnvironment(root);
  for (const directory of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, "workspace")]) mkdirSync(directory, { recursive: true });
  let receipt;
  let forcedCleanup = false;
  const child = spawn(node, [self, "--worker", JSON.stringify({ root, resources, timeoutMs })], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  child.on("message", (message) => { if (message?.type === "receipt") receipt = message.record; });
  const timer = setTimeout(() => { if (child.connected) child.send({ type: "stop" }, () => {}); }, timeoutMs + 5000);
  const force = setTimeout(() => {
    if (child.exitCode !== null) return;
    forcedCleanup = true;
    spawnSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  }, timeoutMs + 80_000);
  const exitCode = await new Promise((resolve) => { child.once("error", () => resolve(-1)); child.once("exit", resolve); });
  clearTimeout(timer); clearTimeout(force);
  receipt ??= { kind: "AIFB_NATIVE_ADVISOR_FIXTURE", simulatedModel: true, realAI: false, pass: false, failures: ["Worker exited without receipt"] };
  receipt.workerExitCode = exitCode; receipt.forcedCleanup = forcedCleanup;
  receipt.pass = receipt.pass && exitCode === 0 && !forcedCleanup;
  // Only the fresh, verified child of the temp directory is removed.
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith("aifb-native-advisor-")) throw new Error("Unsafe fixture cleanup path");
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.tempProfileRemoved = false; receipt.pass = false; receipt.failures.push("Temporary profile cleanup failed"); }
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`[native Advisor simulated model] ${receipt.pass ? "PASS" : "FAIL"}; evidence=${output}`);
  process.exitCode = receipt.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch((error) => {
  console.error(`[native Advisor fixture] ${error?.message ?? error}`); process.exitCode = 1;
});
