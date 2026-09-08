/** Public streamed thinking/tool/lifecycle integration against the pinned core.
 * Uses one loopback synthetic model and the read-only session_status tool only. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID, MODEL_REF } from "./native-chat-fixture.mjs";
import { newChatRun, reduceAgentProgress, reduceChatRun, recoverChatRun } from "../apps/desktop/src/chat-state.ts";

const self = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(self), "..");
const REASONING = "Fixture reasoning summary: inspect the session before answering.";
const ANSWER = "Fixture answer: session checked.";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, ms, label) { const end = Date.now() + ms; while (!predicate()) {
  if (Date.now() > end) throw new Error(`${label} timed out`); await sleep(80);
} }

async function modelServer(key) {
  const observation = { requests: 0, reasoningFrames: 0, toolCalls: 0, resultRequests: 0, aborted: 0, rejected: 0 };
  let releaseFinal;
  const finalPermission = new Promise(resolve => { releaseFinal = resolve; });
  const server = createServer(async (request, response) => {
    try {
      let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 1048576) throw new Error("size"); }
      const body = JSON.parse(raw);
      assert.equal(request.url, "/v1/chat/completions"); assert.equal(request.method, "POST");
      assert.equal(request.headers.authorization, `Bearer ${key}`); assert.equal(body.model, MODEL_ID); assert.equal(body.stream, true);
      if (++observation.requests > 4) throw new Error("request budget");
      assert.ok(body.tools?.length === 1 && body.tools[0].function?.name === "session_status", "Only read-only session_status may be exposed");
      const last = body.messages.findLast(message => message.role === "user");
      const abort = JSON.stringify(last?.content).includes("AIFB_PROGRESS_ABORT");
      const tool = body.messages.findLast(message => message.role === "tool");
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      if (abort) response.on("close", () => { if (!response.writableEnded) ++observation.aborted; });
      const identity = { id: `fixture-${observation.requests}`, object: "chat.completion.chunk", model: MODEL_ID, created: 1 };
      const frame = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...identity, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      frame({ role: "assistant", content: "" });
      frame({ reasoning_content: abort ? "Fixture reasoning: waiting for cancellation." : REASONING }); ++observation.reasoningFrames;
      await sleep(350);
      if (abort) {
        return;
      }
      if (!tool) {
        ++observation.toolCalls;
        frame({ tool_calls: [{ index: 0, id: "fixture-status-call", type: "function", function: { name: "session_status", arguments: "{}" } }] });
        frame({}, "tool_calls");
      } else {
        ++observation.resultRequests;
        frame({ content: ANSWER.slice(0, 15) }); await finalPermission;
        if (response.destroyed) return;
        frame({ content: ANSWER.slice(15) }); frame({}, "stop");
      }
      response.end("data: [DONE]\n\n");
    } catch { ++observation.rejected; if (!response.headersSent) response.writeHead(400); response.end('{"error":{"message":"Synthetic fixture rejected request"}}'); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { observation, port: server.address().port, releaseFinal,
    close: () => { releaseFinal(); return new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); } };
}

async function worker({ root, resources, timeoutMs }) {
  if (process.env.AIFB_NATIVE_CHAT_FIXTURE !== "1" || process.env.OPENCLAW_HOME !== root) throw new Error("Isolated worker required");
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor } = await import("../apps/desktop/electron/supervisor.mjs");
  const { GatewayAdapter } = await import("../apps/desktop/electron/gateway-adapter.mjs");
  const { SetupChannel } = await import("../apps/desktop/electron/setup-channel.mjs");
  const { waitForGatewayReady } = await import("../apps/desktop/electron/startup-readiness.mjs");
  const key = `fixture-${randomUUID()}`;
  const model = await modelServer(key);
  const config = fixtureConfig(root, model.port, key);
  config.tools = { profile: "minimal", allow: ["session_status"] };
  const modelConfig = config.models.providers["aifb-fixture"].models[0];
  modelConfig.reasoning = true; modelConfig.compat.supportsTools = true; modelConfig.maxTokens = 2048;
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  const record = { kind: "AIFB_NATIVE_PROGRESS_FIXTURE", recordedAt: new Date().toISOString(), simulatedModel: true, realAI: false,
    coreVersion: "2026.9.1", scopesUnchanged: true, onlyReadOnlyTool: "session_status", checks: [], failures: [], cleanup: {} };
  const logs = []; const log = line => { logs.push(String(line).slice(0, 400)); if (logs.length > 12) logs.shift(); };
  let child; let sessionKey; let run = newChatRun(); const events = [];
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR, nodeExecutable: native.node,
    openclawEntry: native.entry, runDoctor: () => false, logger: { info: log, warn: log, error: log },
    spawnChild: (command, args, options) => { child = spawn(command, args, { ...options, cwd: root, windowsHide: true }); return child; } });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR, Client: GatewayClient,
    logger: { warn() {} }, onEvent: event => {
      if (events.length < 2000) events.push(event);
      if (event.event === "agent") run = reduceAgentProgress(run, event.payload, sessionKey);
      if (event.event === "chat") run = reduceChatRun(run, event.payload, sessionKey);
    } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR, Client: GatewayClient, logger: { warn() {} } });
  let timer; let stop;
  const cancelled = new Promise((_, reject) => { stop = () => reject(new Error("Fixture cancelled")); timer = setTimeout(() => reject(new Error("Fixture deadline")), timeoutMs); });
  const onMessage = message => { if (message?.type === "stop") stop(); }; process.on("message", onMessage);
  try {
    await Promise.race([(async () => {
      const begin = Date.now(); const endpoint = await supervisor.start();
      if (!endpoint) throw new Error("No endpoint");
      const connect = { url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token };
      adapter.connect(connect); setup.connect(connect);
      assert.equal(await waitForGatewayReady({ supervisor, adapter: { get connected() { return adapter.connected && setup.connected; } }, timeoutMs: 240000 }), "ready");
      supervisor.markReady(); record.startupMs = Date.now() - begin;
      const created = await adapter.request("sessions.create", { key: `aifb-progress-${randomUUID()}`, agentId: "fixture", model: MODEL_REF, permissionMode: "read-only" });
      sessionKey = created.key;
      await adapter.request("sessions.messages.subscribe", { key: sessionKey, agentId: "fixture" });
      const first = randomUUID(); run = newChatRun(first);
      const ack = await adapter.request("sessions.send", { key: sessionKey, agentId: "fixture", message: "AIFB_PROGRESS_COMPLETE", idempotencyKey: first, thinking: "medium" });
      assert.equal(ack.runId, first);
      await until(() => run.progress?.reasoning === REASONING, 45000, "public thinking");
      assert.equal(run.text.includes(REASONING), false);
      record.checks.push("public thinking arrives before final answer and remains separate");
      await until(() => run.progress?.tools.some(tool => tool.name === "session_status" && tool.phase === "result"), 45000, "public tool result");
      assert.equal(JSON.stringify(run.progress).includes("args"), false);
      assert.equal(JSON.stringify(run.progress).includes("result\":"), false);
      record.checks.push("native read-only tool start/result projected without arguments or result payload");
      await adapter.disconnect(); adapter.connect(connect);
      await until(() => adapter.connected, 10000, "reconnect");
      await adapter.request("sessions.messages.subscribe", { key: sessionKey, agentId: "fixture" });
      const history = await adapter.request("chat.history", { sessionKey, agentId: "fixture", limit: 30 });
      const recovered = recoverChatRun(newChatRun(), history);
      assert.equal(recovered.runId, first); assert.equal(recovered.busy, true);
      run = recoverChatRun(run, history);
      record.historySnapshotFields = Object.keys(history.inFlightRun ?? {});
      record.checks.push("SDK reconnect/resubscribe and public history restore exact in-flight run during generation");
      model.releaseFinal();
      await until(() => run.terminal, 45000, "final");
      assert.equal(run.state, "final"); assert.equal(run.text, ANSWER);
      assert.ok(events.some(event => event.event === "agent" && event.payload.stream === "lifecycle"));
      const second = randomUUID(); run = newChatRun(second);
      await adapter.request("sessions.send", { key: sessionKey, agentId: "fixture", message: "AIFB_PROGRESS_ABORT", idempotencyKey: second, thinking: "medium" });
      await until(() => run.progress?.reasoning.includes("cancellation"), 45000, "second thinking");
      await adapter.request("chat.abort", { sessionKey, agentId: "fixture", runId: second });
      await until(() => run.terminal, 10000, "abort proof"); assert.equal(run.state, "aborted");
      await until(() => model.observation.aborted > 0, 10000, "HTTP cancellation");
      record.checks.push("Stop during thinking aborts exact native run and model stream");
      assert.equal(model.observation.rejected, 0); assert.equal(model.observation.requests, 3);
      record.eventTypes = [...new Set(events.map(event => event.event === "agent" ? `agent:${event.payload.stream}` : event.event))];
    })(), cancelled]);
  } catch (error) { record.failures.push(String(error?.message ?? error).replaceAll(key, "[fixture]").replaceAll(supervisor.token ?? "<none>", "[gateway]").slice(0, 500)); }
  finally {
    clearTimeout(timer); process.off("message", onMessage);
    await Promise.all([adapter.disconnect(), setup.disconnect()]); await supervisor.stop(); await model.close();
    record.cleanup.gatewayExited = !child || child.exitCode !== null || child.signalCode !== null;
    record.cleanup.modelClosed = true; record.model = model.observation;
    record.childLogTail = logs.map(line => line.replaceAll(key, "[fixture]").replaceAll(supervisor.token ?? "<none>", "[gateway]"));
    if (!record.cleanup.gatewayExited) record.failures.push("Owned gateway cleanup failed");
  }
  record.pass = record.failures.length === 0; process.send?.({ type: "receipt", record }); return record.pass;
}

const value = flag => { const at = process.argv.indexOf(flag); return at < 0 ? undefined : process.argv[at + 1]; };
async function main() {
  if (value("--worker")) { process.exitCode = await worker(JSON.parse(value("--worker"))) ? 0 : 1; process.disconnect?.(); return; }
  const resources = path.resolve(value("--resources") ?? path.join(repo, "apps", "desktop", "resources"));
  const out = path.resolve(value("--out") ?? path.join(repo, "artifacts", "product-completion", "native-progress.json"));
  const native = fixtureRuntime(resources), tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, "aifb-progress-"))), timeoutMs = 330000;
  const env = isolatedEnvironment(root);
  for (const folder of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, "workspace")]) mkdirSync(folder, { recursive: true });
  let receipt; let forced = false;
  const child = spawn(native.node, [self, "--worker", JSON.stringify({ root, resources, timeoutMs })], { cwd: root, env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  child.on("message", message => { if (message?.type === "receipt") receipt = message.record; });
  const timer = setTimeout(() => { if (child.connected) child.send({ type: "stop" }); }, timeoutMs + 5000);
  const force = setTimeout(() => { if (child.exitCode === null) { forced = true; spawnSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } }, timeoutMs + 80000);
  const code = await new Promise(resolve => { child.once("error", () => resolve(-1)); child.once("exit", resolve); });
  clearTimeout(timer); clearTimeout(force);
  receipt ??= { kind: "AIFB_NATIVE_PROGRESS_FIXTURE", pass: false, failures: ["Worker exited without receipt"] };
  receipt.workerExitCode = code; receipt.forcedCleanup = forced; receipt.pass &&= code === 0 && !forced;
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith("aifb-progress-")) throw new Error("Unsafe cleanup path");
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.pass = false; receipt.tempProfileRemoved = false; }
  mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(receipt, null, 2) + "\n");
  console.log(`[native progress] ${receipt.pass ? "PASS" : "FAIL"}; evidence=${out}`); process.exitCode = receipt.pass ? 0 : 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
