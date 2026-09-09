/** Explicit Windows native model-switch + document-attachment fixture. Only a
 * generated loopback model and an isolated temporary home are used. */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_REF } from "./native-chat-fixture.mjs";

const self = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(self), "..");
const TARGET_PROVIDER = "aifb-composer";
const TARGET_MODEL = "native-composer-selected";
const TARGET_REF = `${TARGET_PROVIDER}/${TARGET_MODEL}`;
const PROMPT = "AIFB_COMPOSER_WITH_FILE: Read the selected text attachment.";
const SENTINELS = ["AIFB_COMPOSER_TXT_PAYLOAD_ONE_493715", "AIFB_COMPOSER_TXT_PAYLOAD_ONLY_286041"];
const REPLIES = ["AIFB composer fixture: text attachment received.", "AIFB composer fixture: file-only attachment received."];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const textContent = (content) => typeof content === "string" ? content : Array.isArray(content)
  ? content.filter((part) => part?.type === "text").map((part) => part.text ?? "").join("\n") : "";

async function startModel(apiKey) {
  const observation = { requests: 0, rejected: 0, received: [], failures: [] };
  const server = createServer(async (request, response) => {
    try {
      let raw = "";
      for await (const chunk of request) {
        raw += chunk.toString();
        if (raw.length > 1_048_576) throw new Error("Fixture body limit exceeded");
      }
      const index = observation.requests++;
      if (index >= 2) throw new Error("Unexpected extra simulated model request");
      if (request.method !== "POST" || request.url !== "/v1/chat/completions"
        || request.headers.authorization !== `Bearer ${apiKey}`) throw new Error("Unexpected local model endpoint");
      const body = JSON.parse(raw);
      if (body.model !== TARGET_MODEL || body.stream !== true || !Array.isArray(body.messages)) throw new Error("Wrong selected model or request shape");
      if (body.tools?.length || body.functions?.length) throw new Error("Native tools must remain denied");
      const sentinel = SENTINELS[index];
      // Native can append a same-run model-switch notice as another user block.
      // Match the unique bytes supplied for this turn, rather than last-role order.
      const userContents = body.messages.filter((message) => message.role === "user").map((message) => textContent(message.content));
      const content = userContents.find((text) => text.includes(sentinel)) ?? userContents.at(-1) ?? "";
      const sentinelAt = content.indexOf(sentinel);
      const openingAt = content.lastIndexOf("<<<EXTERNAL_UNTRUSTED_CONTENT", sentinelAt);
      const closingAt = content.indexOf("<<<END_EXTERNAL_UNTRUSTED_CONTENT", sentinelAt);
      const shape = { selectedModel: body.model, messageRoles: body.messages.map((message) => message.role),
        currentUserTextLength: content.length, documentTextPresent: sentinelAt >= 0,
        untrustedOpeningBeforeText: openingAt >= 0 && openingAt < sentinelAt,
        untrustedClosingAfterText: closingAt > sentinelAt, externalSourceLabel: content.includes("Source: External"),
        advertisedToolCount: body.tools?.length ?? 0, fileOnly: index === 1,
        ...(sentinelAt < 0 ? { syntheticUserDiagnostics: userContents.map((text) => ({ length: text.length,
          prefix: text.slice(0, 700), suffix: text.slice(-700) })) } : {}) };
      observation.received.push(shape);
      if (!shape.documentTextPresent || !shape.untrustedOpeningBeforeText || !shape.untrustedClosingAfterText
        || !shape.externalSourceLabel || (index === 0 && !userContents.some((text) => text.includes(PROMPT)))) throw new Error("Native extracted document boundaries missing");
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const identity = { id: `chatcmpl-composer-${index + 1}`, object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000), model: TARGET_MODEL };
      const frame = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...identity,
        choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      frame({ role: "assistant", content: "" });
      frame({ content: REPLIES[index] });
      frame({}, "stop");
      response.write(`data: ${JSON.stringify({ ...identity, choices: [],
        usage: { prompt_tokens: 32, completion_tokens: 16, total_tokens: 48 } })}\n\n`);
      response.end("data: [DONE]\n\n");
    } catch (error) {
      observation.rejected++;
      observation.failures.push(String(error?.message ?? error).slice(0, 250));
      if (!response.headersSent) response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Local composer fixture rejected request", type: "fixture_error" } }));
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { observation, port: server.address().port, close: async () => {
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
  const { waitForGatewayListener } = await import("../apps/desktop/electron/startup-listener.mjs");
  const { waitForGatewayReady } = await import("../apps/desktop/electron/startup-readiness.mjs");
  const apiKey = `fixture-only-${randomUUID()}`;
  const model = await startModel(apiKey);
  const config = fixtureConfig(root, model.port, apiKey);
  config.models.providers[TARGET_PROVIDER] = structuredClone(config.models.providers["aifb-fixture"]);
  config.models.providers[TARGET_PROVIDER].models[0].id = TARGET_MODEL;
  config.models.providers[TARGET_PROVIDER].models[0].name = "Composer selected simulated model";
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  const record = { kind: "AIFB_NATIVE_COMPOSER_FIXTURE", recordedAt: new Date().toISOString(),
    simulatedModel: true, realAI: false, runtimeVersion: "2026.9.1", nodeVersion: process.version,
    evidenceScope: "Production Supervisor and both public SDK adapters; native session model patch and TXT attachments; no renderer",
    networkEvidence: "Only generated loopback model routes configured; external updates/catalogue disabled; no packet monitoring",
    configuredExternalModelRoutes: 0, configuredToolsDenied: true, sdkFromSelectedBundle: true,
    selectedBundleLayout: native.layout, handshake: {}, patch: {}, sends: [], cleanup: {}, failures: [] };
  const events = [];
  const logs = [];
  const remember = (message) => { logs.push(String(message).slice(0, 500)); if (logs.length > 15) logs.shift(); };
  let gatewayChild;
  let gatewayToken = "<unset>";
  let stopping = false;
  let sessionKey;
  const statuses = [];
  const observeStatus = (channel) => (status) => {
    if (statuses.length < 30) statuses.push({ channel, at: Date.now(), phase: status.phase,
      ...(typeof status.message === "string" ? { message: status.message.replaceAll(apiKey, "[fixture-key]").replaceAll(gatewayToken, "[gateway-token]").slice(0, 250) } : {}) });
  };
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (gatewayChild = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-composer-fixture", logger: { warn() {} },
    onStatus: observeStatus("chat"),
    onEvent: (event) => { if (events.length < 1000) events.push(event); } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-composer-fixture", logger: { warn() {} }, onStatus: observeStatus("setup") });
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
      if (!endpoint) throw new Error("Gateway start cancelled");
      gatewayToken = endpoint.token;
      const listener = await waitForGatewayListener({ port: endpoint.port, supervisor, shouldStop: () => stopping });
      record.handshake.listenerElapsedMs = Date.now() - started;
      record.handshake.listenerOutcome = listener;
      if (listener !== "ready") throw new Error(`Gateway listener ${listener}`);
      const connection = { url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token };
      adapter.connect(connection); setup.connect(connection);
      const ready = await waitForGatewayReady({ supervisor, adapter: { get connected() { return adapter.connected && setup.connected; } },
        timeoutMs: Math.max(0, 240_000 - (Date.now() - started)), shouldStop: () => stopping });
      if (ready !== "ready") throw new Error(`Gateway handshake ${ready}`);
      supervisor.markReady();
      const policy = adapter.hello?.policy;
      record.handshake = { ...record.handshake, connected: true, setupReady: true, elapsedMs: Date.now() - started,
        protocol: adapter.hello?.protocol, serverVersion: adapter.hello?.server?.version,
        attachmentPolicy: { maxBytes: policy?.attachments?.maxBytes, maxImageBytes: policy?.attachments?.maxImageBytes },
        maxPayload: policy?.maxPayload, chatAdminGranted: adapter.hello?.auth?.scopes?.includes("operator.admin") === true };
      if (!Number.isFinite(policy?.attachments?.maxBytes) || !Number.isFinite(policy?.maxPayload)) throw new Error("Native attachment policy missing");
      if (record.handshake.chatAdminGranted) throw new Error("Chat adapter unexpectedly has admin");
      const catalogue = await adapter.request("models.list", { agentId: "fixture" });
      if (!catalogue.models?.some((entry) => entry.id === TARGET_MODEL && entry.provider === TARGET_PROVIDER && entry.available === true)) throw new Error("Selected fixture model unavailable");
      const created = await adapter.request("sessions.create", { key: `aifb-composer-${randomUUID()}`, agentId: "fixture",
        model: MODEL_REF, displayName: "Composer attachment fixture", permissionMode: "read-only", thinkingLevel: "off" });
      if (typeof created.key !== "string") throw new Error("Native session key missing");
      sessionKey = created.key;
      await adapter.request("sessions.messages.subscribe", { key: sessionKey, agentId: "fixture" });
      const before = await adapter.request("chat.history", { sessionKey, agentId: "fixture", limit: 20 });
      const params = { key: sessionKey, agentId: "fixture", model: TARGET_REF,
        ...(typeof before.sessionId === "string" ? { expectedSessionId: before.sessionId } : {}) };
      const patched = await adapter.request("sessions.patch", params);
      record.patch = { requested: { model: TARGET_REF, expectedSessionIdPresent: "expectedSessionId" in params },
        ok: patched.ok, resolved: { provider: patched.resolved?.modelProvider, model: patched.resolved?.model } };
      if (patched.ok !== true || patched.resolved?.modelProvider !== TARGET_PROVIDER || patched.resolved?.model !== TARGET_MODEL) throw new Error("Native patch did not resolve selected provider/model");
      const after = await adapter.request("chat.history", { sessionKey, agentId: "fixture", limit: 20 });
      record.patch.historyModel = { provider: after.sessionInfo?.modelProvider, model: after.sessionInfo?.model };
      if (after.sessionInfo?.modelProvider !== TARGET_PROVIDER || after.sessionInfo?.model !== TARGET_MODEL) throw new Error("History model did not confirm patch");
      for (let index = 0; index < 2; index++) {
        const bytes = Buffer.from(`${SENTINELS[index]}\nOwner: local fixture only.\n`, "utf8");
        const attachment = { type: "file", mimeType: "text/plain", fileName: index === 0 ? "composer-notes.txt" : "composer-file-only.txt",
          content: bytes.toString("base64"), sizeBytes: bytes.length };
        const runId = randomUUID();
        const payload = { key: sessionKey, agentId: "fixture", message: index === 0 ? PROMPT : "",
          attachments: [attachment], idempotencyKey: runId };
        const wireBytes = Buffer.byteLength(JSON.stringify({ type: "req", id: randomUUID(), method: "sessions.send", params: payload }));
        if (bytes.length > policy.attachments.maxBytes || wireBytes > policy.maxPayload) throw new Error("Fixture file exceeds advertised policy");
        const ack = await adapter.request("sessions.send", payload);
        const acceptedRun = ack.runId ?? runId;
        const runEvents = () => events.filter((event) => event.event === "chat" && event.payload?.sessionKey === sessionKey && event.payload.runId === acceptedRun);
        await waitUntil(() => runEvents().some((event) => ["final", "error", "aborted"].includes(event.payload.state)), 60_000, "Attachment terminal event");
        const terminal = runEvents().find((event) => ["final", "error", "aborted"].includes(event.payload.state));
        record.sends.push({ fileOnly: index === 1, messageLength: payload.message.length,
          attachmentShape: { type: attachment.type, mimeType: attachment.mimeType, fileName: attachment.fileName,
            sizeBytes: attachment.sizeBytes, contentEncoding: "base64", contentPresent: true, hostPathPassed: false },
          wireBytes, terminal: terminal?.payload.state });
        if (terminal?.payload.state !== "final") throw new Error(`Native file turn failed: ${terminal?.payload.errorMessage ?? terminal?.payload.state}`);
        const history = await adapter.request("chat.history", { sessionKey, agentId: "fixture", limit: 20 });
        const users = history.messages?.filter((row) => row.role === "user") ?? [];
        const assistants = history.messages?.filter((row) => row.role === "assistant" && textContent(row.content) === REPLIES[index]) ?? [];
        const currentUser = users.at(-1);
        const publicUser = JSON.stringify(currentUser ?? {});
        const historyShape = { userRows: users.length, matchingAssistantRows: assistants.length,
          userMessageKeys: Object.keys(currentUser ?? {}), userContentTypes: Array.isArray(currentUser?.content)
            ? currentUser.content.map((part) => part.type) : typeof currentUser?.content,
          fileNamePresent: publicUser.includes(attachment.fileName), managedMediaPresent: publicUser.includes("media://inbound/") };
        record.sends.at(-1).history = historyShape;
        if (users.length !== index + 1 || assistants.length !== 1 || !historyShape.managedMediaPresent) throw new Error("Canonical attachment history mismatch");
      }
      if (model.observation.requests !== 2 || model.observation.rejected !== 0) throw new Error("Unexpected simulated model calls");
    })(), cancelled]);
  } catch (error) {
    record.failures.push(String(error?.message ?? error).replaceAll(apiKey, "[fixture-key]").replaceAll(gatewayToken, "[gateway-token]").slice(0, 500));
  } finally {
    stopping = true; clearTimeout(timer); process.off("message", onMessage);
    if (sessionKey && adapter.connected) await adapter.request("sessions.messages.unsubscribe", { key: sessionKey, agentId: "fixture" }).catch(() => {});
    await Promise.all([adapter.disconnect(), setup.disconnect()]);
    try { await supervisor.stop(); } catch { record.failures.push("Owned Gateway cleanup failed"); }
    record.cleanup.gatewayExited = !gatewayChild || gatewayChild.exitCode !== null || gatewayChild.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await model.close(); record.cleanup.modelServerClosed = true;
    record.simulatedModelRequests = model.observation;
    record.channelStatuses = statuses;
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
  const output = path.resolve(value("--out") ?? path.join(repoRoot, "artifacts", "unified-composer", `native-composer-${Date.now()}.json`));
  const timeoutMs = Number(value("--timeout") ?? 360) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000 || timeoutMs > 600_000) throw new Error("Invalid fixture deadline");
  const { node } = fixtureRuntime(resources);
  const tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, "aifb-native-composer-")));
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
  receipt ??= { kind: "AIFB_NATIVE_COMPOSER_FIXTURE", simulatedModel: true, realAI: false, pass: false, failures: ["Worker exited without receipt"] };
  receipt.workerExitCode = exitCode; receipt.forcedCleanup = forcedCleanup;
  receipt.pass = receipt.pass && exitCode === 0 && !forcedCleanup;
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith("aifb-native-composer-")) throw new Error("Unsafe fixture cleanup path");
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.tempProfileRemoved = false; receipt.pass = false; receipt.failures.push("Temporary profile cleanup failed"); }
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  console.log(`[native composer simulated model] ${receipt.pass ? "PASS" : "FAIL"}; evidence=${output}`);
  process.exitCode = receipt.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch((error) => {
  console.error(`[native composer fixture] ${error?.message ?? error}`); process.exitCode = 1;
});
