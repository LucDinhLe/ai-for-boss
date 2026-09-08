/** Native Windows Gateway + public SDK + loopback simulated model. Never real AI.
 * Run only explicitly: node scripts/native-chat-fixture.mjs [--resources <dir>] [--out <json>]
 * Public pinned contracts: openclaw/docs/gateway/config-tools.md:545,607,625,649;
 * config-agents.md:528,536,605; configuration-reference.md:97,1812,1923.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const self = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(self), "..");
export const MODEL_ID = "native-fixture";
export const MODEL_REF = `aifb-fixture/${MODEL_ID}`;
export const COMPLETE_PROMPT = "AIFB_FIXTURE_COMPLETE: Return the fixed simulated response.";
export const ABORT_PROMPT = "AIFB_FIXTURE_ABORT: Stream until this fixture cancels the turn.";
export const COMPLETE_REPLY = "AIFB simulated model: native Windows chat completed.";
export const ABORT_REPLY = "AIFB simulated model: waiting for cancellation.";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function fixtureRuntime(resources) {
  const packaged = path.join(resources, "node_modules");
  const modules = existsSync(path.join(packaged, "openclaw", "openclaw.mjs")) ? packaged : path.join(resources, "bundle", "node_modules");
  const node = path.join(resources, "runtime", "node", "node.exe");
  const entry = path.join(modules, "openclaw", "openclaw.mjs");
  const sdk = createRequire(path.join(path.dirname(modules), "package.json")).resolve("@openclaw/gateway-client");
  if (!sdk.startsWith(modules + path.sep)) throw new Error("SDK must resolve inside the selected bundle");
  for (const manifest of [path.join(modules, "openclaw", "package.json"), path.join(modules, "@openclaw", "gateway-client", "package.json")]) {
    if (JSON.parse(readFileSync(manifest, "utf8")).version !== "2026.9.1") throw new Error("Expected pinned bundled runtime and SDK");
  }
  if (!existsSync(node) || !existsSync(entry)) throw new Error("Bundled Windows runtime is missing");
  return { node, entry, sdk, layout: modules === packaged ? "packaged" : "staged" };
}

export function isolatedEnvironment(root, inherited = process.env) {
  const env = {};
  for (const name of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT"]) {
    if (inherited[name]) env[name] = inherited[name];
  }
  return Object.assign(env, {
    HOME: root, USERPROFILE: root, OPENCLAW_HOME: root,
    APPDATA: path.join(root, "appdata"), LOCALAPPDATA: path.join(root, "localappdata"),
    TEMP: path.join(root, "tmp"), TMP: path.join(root, "tmp"), PATH: "",
    OPENCLAW_STATE_DIR: path.join(root, "state"), OPENCLAW_CONFIG_PATH: path.join(root, "openclaw.json"),
    OPENCLAW_SKIP_CHANNELS: "1", OPENCLAW_DISABLE_BONJOUR: "1", OPENCLAW_EXEC_SHELL_SNAPSHOT: "0",
    OPENCLAW_NO_RESPAWN: "1", OPENCLAW_NO_AUTO_UPDATE: "1", AIFB_NATIVE_CHAT_FIXTURE: "1"
  });
}

export function fixtureConfig(root, port, apiKey) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid loopback port");
  return {
    gateway: { mode: "local", bind: "loopback" },
    update: { checkOnStart: false, auto: { enabled: false } }, telemetry: { enabled: false },
    cron: { enabled: false, triggers: { enabled: false } }, plugins: { enabled: false },
    tools: { profile: "minimal", deny: ["*"] },
    models: {
      mode: "replace", catalogRefresh: { enabled: false },
      providers: { "aifb-fixture": {
        baseUrl: `http://127.0.0.1:${port}/v1`, api: "openai-completions", apiKey,
        agentRuntime: { id: "openclaw" }, timeoutSeconds: 45,
        models: [{ id: MODEL_ID, name: "Local simulated fixture", reasoning: false, input: ["text"],
          contextWindow: 128000, maxTokens: 256, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          compat: { supportsTools: false, supportsUsageInStreaming: true } }]
      } }
    },
    agents: {
      defaults: { model: { primary: MODEL_REF, fallbacks: [] }, utilityModel: MODEL_REF,
        skipBootstrap: true, heartbeat: { every: "0m" }, timeoutSeconds: 45,
        systemAgent: { agentId: "fixture" } },
      entries: { fixture: { name: "Local fixture", workspace: path.join(root, "workspace"),
        agentDir: path.join(root, "state", "agents", "fixture", "agent") } }
    }
  };
}

export function classifyFixtureRequest(request, body, apiKey) {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") throw new Error("Unexpected endpoint");
  if (request.headers.authorization !== `Bearer ${apiKey}`) throw new Error("Unexpected fixture credential");
  if (body.model !== MODEL_ID || body.stream !== true || !Array.isArray(body.messages)) throw new Error("Unexpected model request");
  if (body.tools?.length || body.functions?.length) throw new Error("Tools must be absent");
  const lastUser = body.messages.findLast((message) => message.role === "user");
  const content = typeof lastUser?.content === "string" ? lastUser.content
    : Array.isArray(lastUser?.content) ? lastUser.content.filter((item) => item.type === "text").map((item) => item.text).join("\n") : "";
  if (content.includes(ABORT_PROMPT)) return "abort";
  if (content.includes(COMPLETE_PROMPT)) return "complete";
  throw new Error("Unexpected fixture prompt");
}

export async function startFixtureModel(apiKey) {
  const observation = { requests: 0, completed: 0, abortStreams: 0, abortedConnections: 0, rejected: 0 };
  let closing = false;
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        if (body.length > 1_048_576) throw new Error("Fixture request too large");
      }
      if (++observation.requests > 6) throw new Error("Fixture request budget exceeded");
      const mode = classifyFixtureRequest(request, JSON.parse(body), apiKey);
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const identity = { id: `chatcmpl-fixture-${observation.requests}`, object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000), model: MODEL_ID };
      const frame = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...identity,
        choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      frame({ role: "assistant", content: "" });
      if (mode === "abort") {
        ++observation.abortStreams;
        response.on("close", () => { if (!closing && !response.writableEnded) ++observation.abortedConnections; });
        frame({ content: ABORT_REPLY });
      } else {
        frame({ content: COMPLETE_REPLY.slice(0, 25) });
        await sleep(80);
        if (response.destroyed) return;
        frame({ content: COMPLETE_REPLY.slice(25) });
        frame({}, "stop");
        response.write(`data: ${JSON.stringify({ ...identity, choices: [],
          usage: { prompt_tokens: 24, completion_tokens: 12, total_tokens: 36 } })}\n\n`);
        response.end("data: [DONE]\n\n");
        ++observation.completed;
      }
    } catch {
      ++observation.rejected;
      if (!response.headersSent) response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Local fixture rejected the request", type: "fixture_error" } }));
    }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { port: server.address().port, observation, close: async () => {
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

const messageText = (message) => typeof message?.content === "string" ? message.content
  : Array.isArray(message?.content) ? message.content.filter((part) => part.type === "text").map((part) => part.text).join("") : "";

async function worker({ root, resources, timeoutMs }) {
  if (process.env.AIFB_NATIVE_CHAT_FIXTURE !== "1" || process.env.OPENCLAW_HOME !== root) throw new Error("Fixture worker must be isolated");
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor, SUPERVISOR_STATES } = await import("../apps/desktop/electron/supervisor.mjs");
  const { GatewayAdapter } = await import("../apps/desktop/electron/gateway-adapter.mjs");
  const { SetupChannel } = await import("../apps/desktop/electron/setup-channel.mjs");
  const { waitForGatewayReady } = await import("../apps/desktop/electron/startup-readiness.mjs");
  const apiKey = `fixture-only-${randomUUID()}`;
  const model = await startFixtureModel(apiKey);
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, `${JSON.stringify(fixtureConfig(root, model.port, apiKey), null, 2)}\n`);
  const record = { kind: "AIFB_NATIVE_CHAT_FIXTURE", recordedAt: new Date().toISOString(),
    simulatedModel: true, realAI: false, runtimeVersion: "2026.9.1", platform: process.platform,
    evidenceScope: "Bundled Node/OpenClaw and production adapters; simulated loopback model; no renderer",
    networkEvidence: "Only loopback model configured; remote catalogue/update disabled; no packet monitoring",
    configuredExternalModelRoutes: 0, toolsDenied: true, selectedBundleLayout: native.layout,
    sdkFromSelectedBundle: true, handshake: {}, turns: [], cleanup: {}, failures: [] };
  const events = [];
  const childLog = [];
  const remember = (message) => { childLog.push(String(message).slice(0, 500)); if (childLog.length > 15) childLog.shift(); };
  let gatewayChild = null;
  let sessionKey = null;
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry,
    runDoctor: () => false, logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => {
      gatewayChild = spawn(command, args, { ...options, cwd: root, windowsHide: true });
      return gatewayChild;
    }
  });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-native-fixture", logger: { warn() {} },
    onEvent: (event) => { if (events.length < 2000) events.push(event); } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-native-fixture", logger: { warn() {} } });
  let timeout;
  let stop;
  const cancelled = new Promise((_, reject) => {
    stop = () => reject(new Error("Fixture cancelled"));
    timeout = setTimeout(() => reject(new Error("Fixture deadline exceeded")), timeoutMs);
  });
  const onMessage = (message) => { if (message?.type === "stop") stop(); };
  process.on("message", onMessage);
  try {
    await Promise.race([(async () => {
      const startedAt = Date.now();
      const endpoint = await supervisor.start();
      if (!endpoint) throw new Error("Gateway start cancelled");
      const connect = { url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token };
      adapter.connect(connect); setup.connect(connect);
      const readiness = await waitForGatewayReady({ supervisor,
        adapter: { get connected() { return adapter.connected && setup.connected; } }, timeoutMs: Math.min(timeoutMs, 240_000) });
      if (readiness !== "ready") throw new Error(`Gateway handshake ${readiness}`);
      supervisor.markReady();
      record.handshake = { connected: true, setupReady: true, elapsedMs: Date.now() - startedAt,
        protocol: adapter.hello?.protocol, serverVersion: adapter.hello?.server?.version };
      const catalogue = await adapter.request("models.list", { agentId: "fixture" });
      if (!catalogue.models?.some((item) => item.id === MODEL_ID && item.available === true)) throw new Error("Fixture model unavailable");
      const created = await adapter.request("sessions.create", { key: `aifb-fixture-${randomUUID()}`, agentId: "fixture",
        model: MODEL_REF, displayName: "Local simulated chat", permissionMode: "read-only", thinkingLevel: "off" });
      if (!created.key) throw new Error("Session key missing");
      sessionKey = created.key;
      await adapter.request("sessions.messages.subscribe", { key: sessionKey, agentId: "fixture" });
      const initial = await adapter.request("chat.history", { sessionKey, agentId: "fixture", limit: 30 });
      if (initial.sessionInfo?.hasActiveRun === true) throw new Error("New fixture session already active");
      const firstId = randomUUID();
      const firstAck = await adapter.request("sessions.send", { key: sessionKey, agentId: "fixture",
        message: COMPLETE_PROMPT, idempotencyKey: firstId, thinking: "off", timeoutMs: 45_000 });
      const firstRunId = firstAck.runId ?? firstId;
      const runEvents = (id) => events.filter((entry) => entry.event === "chat" && entry.payload?.sessionKey === sessionKey && entry.payload.runId === id);
      await waitUntil(() => runEvents(firstRunId).some((entry) => ["final", "error", "aborted"].includes(entry.payload.state)), 45_000, "First terminal event");
      const firstEvents = runEvents(firstRunId);
      if (!firstEvents.some((entry) => entry.payload.state === "delta" && entry.payload.deltaText)) throw new Error("Native text delta missing");
      if (!firstEvents.some((entry) => entry.payload.state === "final")) {
        const failed = firstEvents.find((entry) => entry.payload.state === "error");
        throw new Error(`First native turn failed: ${failed?.payload?.errorMessage ?? "no final event"}`);
      }
      const history = await adapter.request("chat.history", { sessionKey, agentId: "fixture", limit: 30 });
      const rows = history.messages ?? [];
      if (rows.filter((row) => row.role === "user" && messageText(row).includes(COMPLETE_PROMPT)).length !== 1
        || rows.filter((row) => row.role === "assistant" && messageText(row) === COMPLETE_REPLY).length !== 1) throw new Error("Native persisted transcript mismatch");
      record.turns.push({ outcome: "final", nativeDelta: true, persistedUserRows: 1, persistedAssistantRows: 1 });
      const secondId = randomUUID();
      const secondAck = await adapter.request("sessions.send", { key: sessionKey, agentId: "fixture",
        message: ABORT_PROMPT, idempotencyKey: secondId, thinking: "off", timeoutMs: 45_000 });
      const secondRunId = secondAck.runId ?? secondId;
      await waitUntil(() => runEvents(secondRunId).some((entry) => entry.payload.state === "delta" && entry.payload.deltaText), 30_000, "Second native delta");
      await adapter.request("chat.abort", { sessionKey, agentId: "fixture", runId: secondRunId });
      await waitUntil(() => runEvents(secondRunId).some((entry) => entry.payload.state === "aborted"), 10_000, "Native abort event");
      await waitUntil(() => model.observation.abortedConnections > 0, 10_000, "Model connection cancellation");
      record.turns.push({ outcome: "aborted", nativeDelta: true, modelConnectionCancelled: true });
      if (model.observation.rejected || model.observation.requests !== 2) throw new Error("Unexpected simulated model calls");
    })(), cancelled]);
  } catch (error) {
    record.failures.push(String(error?.message ?? error).replaceAll(apiKey, "[fixture-key]").replaceAll(supervisor.token ?? "<no-token>", "[gateway-token]").slice(0, 500));
  } finally {
    clearTimeout(timeout); process.off("message", onMessage);
    if (sessionKey && adapter.connected) await adapter.request("sessions.messages.unsubscribe", { key: sessionKey, agentId: "fixture" }).catch(() => {});
    await Promise.all([adapter.disconnect(), setup.disconnect()]);
    try { await supervisor.stop(); } catch { record.failures.push("Gateway cleanup failed"); }
    record.cleanup.gatewayExited = !gatewayChild || gatewayChild.exitCode !== null || gatewayChild.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await model.close();
    record.cleanup.modelServerClosed = true;
    record.simulatedModelRequests = { ...model.observation };
    record.childLogTail = childLog.map((line) => line.replaceAll(apiKey, "[fixture-key]").replaceAll(supervisor.token ?? "<no-token>", "[gateway-token]"));
    if (!record.cleanup.gatewayExited || !record.cleanup.supervisorStopped) record.failures.push("Owned Gateway did not stop");
  }
  record.pass = record.failures.length === 0;
  process.send?.({ type: "receipt", record });
  return record.pass;
}

async function main() {
  const value = (flag) => { const i = process.argv.indexOf(flag); return i < 0 ? undefined : process.argv[i + 1]; };
  if (process.argv.includes("--worker")) {
    const ok = await worker(JSON.parse(value("--worker")));
    process.disconnect?.(); process.exitCode = ok ? 0 : 1;
    return;
  }
  if (process.platform !== "win32") throw new Error("This fixture targets the bundled Windows runtime");
  const resources = path.resolve(value("--resources") ?? path.join(repoRoot, "apps", "desktop", "resources"));
  const output = path.resolve(value("--out") ?? path.join(repoRoot, "artifacts", "native-readiness", "native-chat-fixture.json"));
  const timeoutMs = Number(value("--timeout") ?? 330) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000 || timeoutMs > 600_000) throw new Error("Invalid fixture deadline");
  const { node } = fixtureRuntime(resources);
  const tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, "aifb-native-chat-")));
  const env = isolatedEnvironment(root);
  for (const directory of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, "workspace")]) mkdirSync(directory, { recursive: true });
  let receipt = null;
  let forcedCleanup = false;
  const child = spawn(node, [self, "--worker", JSON.stringify({ root, resources, timeoutMs })], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  child.on("message", (message) => { if (message?.type === "receipt") receipt = message.record; });
  const timeout = setTimeout(() => { if (child.connected) child.send({ type: "stop" }, () => {}); }, timeoutMs + 5000);
  const force = setTimeout(() => {
    if (child.exitCode !== null) return;
    forcedCleanup = true;
    spawnSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  }, timeoutMs + 80_000);
  const exitCode = await new Promise((resolve) => { child.once("error", () => resolve(-1)); child.once("exit", resolve); });
  clearTimeout(timeout); clearTimeout(force);
  receipt ??= { kind: "AIFB_NATIVE_CHAT_FIXTURE", simulatedModel: true, realAI: false, pass: false, failures: ["Isolated worker exited without a receipt"] };
  receipt.workerExitCode = exitCode;
  receipt.forcedCleanup = forcedCleanup;
  receipt.pass = receipt.pass && exitCode === 0 && !forcedCleanup;
  // Only remove the mkdtemp directory we created beneath the verified temp root.
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith("aifb-native-chat-")) throw new Error("Unsafe fixture cleanup path");
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.tempProfileRemoved = false; receipt.pass = false; receipt.failures.push("Temporary profile cleanup failed"); }
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`[native simulated model] ${receipt.pass ? "PASS" : "FAIL"}; evidence=${output}`);
  process.exitCode = receipt.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch((error) => {
  console.error(`[native simulated model] ${error?.message ?? error}`); process.exitCode = 1;
});
