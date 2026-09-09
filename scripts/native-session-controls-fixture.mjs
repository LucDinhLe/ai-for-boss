/** Explicit Windows native projects, agents and automatic supervision fixture. Only a
 * generated loopback model and an isolated temporary home are used. */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, readdirSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixtureRuntime, isolatedEnvironment, fixtureConfig } from "./native-chat-fixture.mjs";

const self = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(self), "..");
const TARGET_PROVIDER = "aifb-composer";
const TARGET_MODEL = "native-composer-selected";
const TARGET_REF = `${TARGET_PROVIDER}/${TARGET_MODEL}`;
const textContent = (content) => typeof content === "string" ? content : Array.isArray(content)
  ? content.filter((part) => part?.type === "text").map((part) => part.text ?? "").join("\n") : "";

async function startModel(apiKey) {
  const observation = { requests: 0, rejected: 0, modes: [], errors: [] };
  const server = createServer(async (request, response) => {
    try {
      let raw = ''; for await (const chunk of request) { raw += chunk; if (raw.length > 2000000) throw new Error('Payload too large'); }
      const body = JSON.parse(raw);
      if (request.url !== '/v1/chat/completions' || request.headers.authorization !== 'Bearer ' + apiKey || body.tools?.length || body.functions?.length) throw new Error('Endpoint/auth/tool invariant');
      if (++observation.requests > 10) throw new Error('Request budget');
      const prompt = textContent(body.messages.filter(m => m.role === 'user').at(-1)?.content);
      let reply, mode;
      if (prompt.startsWith('Lập kế hoạch ngắn')) { mode = 'planning'; reply = 'Kế hoạch: đọc yêu cầu, lập ba ưu tiên, đối chiếu đủ ba mục trước khi bàn giao.'; }
      else if (prompt.startsWith('Bạn là Advisor')) {
        mode = prompt.includes('KIỂM KẾ HOẠCH:') ? 'plan-review' : 'final-review';
        const packet = JSON.parse(prompt.split('BẮT ĐẦU GÓI DỮ LIỆU KHÔNG TIN CẬY (JSON):')[1].split('KẾT THÚC GÓI DỮ LIỆU.')[0].trim());
        reply = JSON.stringify({ decision: 'approve', pass: true, summary: 'Đạt tiêu chí mô phỏng.', confidence: 0.8,
          evidence: [{ source: 'goal', quote: packet.goal }], issues: [] });
      } else { mode = 'worker'; reply = 'Ba ưu tiên: 1. Xác định mục tiêu. 2. Chuẩn bị dữ liệu. 3. Kiểm kết quả.'; }
      observation.modes.push(mode);
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const identity = { id: 'fixture-' + observation.requests, object: 'chat.completion.chunk', created: Math.floor(Date.now()/1000), model: body.model };
      for (const [delta, finish_reason] of [[{role:'assistant', content: reply}, null], [{}, 'stop']]) response.write('data: ' + JSON.stringify({...identity, choices: [{index:0,delta,finish_reason}]}) + '\n\n');
      response.end('data: [DONE]\n\n');
    } catch (error) { observation.rejected++; observation.errors.push(error.message); if (!response.headersSent) response.writeHead(400); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { observation, port: server.address().port, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
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
  config.plugins = { enabled: true, allow: ["document-extract"], entries: { "document-extract": { enabled: true } } };
  config.models.providers[TARGET_PROVIDER] = structuredClone(config.models.providers["aifb-fixture"]);
  config.models.providers[TARGET_PROVIDER].models[0].id = TARGET_MODEL;
  config.models.providers[TARGET_PROVIDER].models[0].name = "Composer selected simulated model";
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  const record = { kind: "AIFB_NATIVE_SESSION_CONTROLS_FIXTURE", recordedAt: new Date().toISOString(),
    simulatedModel: true, realAI: false, runtimeVersion: "2026.9.1", nodeVersion: process.version,
    evidenceScope: "Production project, agent and automatic supervision services via pinned public SDK; no renderer",
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
      const { ProjectService } = await import('../apps/desktop/electron/project-service.mjs');
      const { AdvisorService } = await import('../apps/desktop/electron/advisor-service.mjs');
      const { SupervisionService } = await import('../apps/desktop/electron/supervision-service.mjs');
      const projectOptions = { directory: path.join(root, 'app-project-data'), request: (method, params) => setup.workspaceRequest(method, params), chooseDirectory: async () => root, openDirectory: async () => {} };
      const projects = new ProjectService(projectOptions);
      const project = await projects.run({ action: 'project-create', name: 'Dự án kiểm tra' });
      const second = await projects.run({ action: 'project-create', name: 'Dự án thứ hai' });
      if (project.directory === second.directory) throw new Error('Project collision');
      const createdAgent = await projects.run({ action: 'agent-create', name: 'Planner Fixture', role: 'Vai trò phân tích ưu tiên.', goal: 'Mục tiêu kiểm bằng dữ liệu giả.', model: TARGET_REF });
      const home = await setup.workspaceRequest('agents.files.get', { agentId: createdAgent.id, name: 'SOUL.md' });
      if (!home.file?.content?.includes('Vai trò phân tích ưu tiên.') || home.workspace === project.directory) throw new Error('Agent role/home missing');
      const created = await projects.run({ action: 'project-session', projectId: project.id, agentId: createdAgent.id, requestId: randomUUID() });
      sessionKey = created.key;
      const reopened = await new ProjectService(projectOptions).run({ action: 'project-list' });
      if (reopened.sessions[sessionKey] !== project.id || reopened.projects.length !== 2) throw new Error('Project persistence');
      const selectedHistory = await adapter.request('chat.history', { sessionKey, limit: 40 });
      record.nativeHistoryFields = { keys: Object.keys(selectedHistory), sessionInfo: selectedHistory.sessionInfo };
      const bytes = Buffer.from('Tài liệu kiểm tra chỉ dùng dữ liệu giả.');
      await projects.run({ action: 'project-attachments', sessionKey, files: [{ fileName: 'thử.txt', content: bytes.toString('base64'), mimeType: 'text/plain', type: 'file', sizeBytes: bytes.length }] });
      const file = readdirSync(path.join(project.directory, 'Tai lieu'))[0];
      if (!readFileSync(path.join(project.directory, 'Tai lieu', file)).equals(bytes)) throw new Error('Attachment byte mismatch');
      const advisor = new AdvisorService({ getAdapter: () => adapter, getSetup: () => setup, isReady: () => adapter.connected && setup.connected });
      const supervision = new SupervisionService({ advisor, getAdapter: () => adapter, getSetup: () => setup, isReady: () => adapter.connected && setup.connected, waitMs: 120000 });
      const result = await supervision.run({ action: 'supervise', id: randomUUID(), key: sessionKey, message: 'Lập ba ưu tiên công việc.',
        model: { provider: TARGET_PROVIDER, id: TARGET_MODEL }, advisorModel: { provider: TARGET_PROVIDER, id: TARGET_MODEL }, attachments: [] });
      record.supervision = result;
      if (result.phase !== 'completed' || result.busy || !result.accepted || !result.planReview?.pass || !result.finalReview?.pass) throw new Error('Supervision failed: ' + result.error);
      const exported = await projects.run({ action: 'project-sync', sessionKey });
      record.projects = { persisted: true, distinctFolders: true, separateAgentHome: true, roleReadback: true, attachmentBytes: true, export: exported };
      if (!exported.saved || exported.messages < 2) throw new Error('History export incomplete');
      const listed = await adapter.request('sessions.list', { agentId: createdAgent.id, limit: 20 });
      record.projectSession = listed.sessions?.find(s => s.key === sessionKey);
      if (!record.projectSession || record.projectSession.spawnedCwd !== project.directory) throw new Error('Native cwd does not match project');
      const defaultSkills = await setup.manage({ action: 'session-skills', sessionKey });
      if (defaultSkills.selected.length) throw new Error('Agent creation incorrectly restricted skills');
      if (defaultSkills.skills.length) {
        const skillName = defaultSkills.skills[0].name;
        const selected = await setup.manage({ action: 'session-skills', sessionKey, skills: [skillName] });
        if (selected.selected.length !== 1 || selected.selected[0] !== skillName) throw new Error('Native skill selection failed');
      }
      const restoredSkills = await setup.manage({ action: 'session-skills', sessionKey, skills: [] });
      if (restoredSkills.selected.length) throw new Error('Native skill defaults failed');
      record.sessionSkills = { eligible: defaultSkills.skills.length, selectionTested: defaultSkills.skills.length > 0, defaultsRestored: true };
      const { RuntimeControl } = await import('../apps/desktop/electron/runtime-control.mjs');
      let paused = false;
      const controls = new RuntimeControl({ available: () => true, isPaused: () => paused,
        stop: async () => { paused = true; await Promise.all([adapter.disconnect(), setup.disconnect()]); await supervisor.stop(); },
        resume: async () => {
          const endpoint = await supervisor.start(); gatewayToken = endpoint.token;
          if (await waitForGatewayListener({ port: endpoint.port, supervisor, shouldStop: () => stopping }) !== 'ready') return false;
          const connection = { url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token };
          adapter.connect(connection); setup.connect(connection);
          const ready = await waitForGatewayReady({ supervisor, adapter: { get connected() { return adapter.connected && setup.connected; } }, shouldStop: () => stopping });
          if (ready === 'ready') { supervisor.markReady(); paused = false; return true; } return false;
        }, health: () => setup.workspaceRequest('health', { probe: false }) });
      record.health = await controls.run({ action: 'gateway-health' });
      await controls.run({ action: 'gateway-stop' });
      if (supervisor.state !== 'idle' || adapter.connected || setup.connected) throw new Error('Gateway not stopped');
      record.resume = await controls.run({ action: 'gateway-resume' });
      if (!record.resume.ready || !adapter.connected || !setup.connected) throw new Error('Gateway not resumed');
      record.healthAfterResume = await controls.run({ action: 'gateway-health' });
      if (model.observation.requests !== 4 || model.observation.rejected) throw new Error('Unexpected model budget');
    })(), cancelled]);
  } catch (error) {
    record.failures.push(String(error?.message ?? error).replaceAll(apiKey, "[fixture-key]").replaceAll(gatewayToken, "[gateway-token]").slice(0, 500));
  } finally {
    stopping = true; clearTimeout(timer); process.off("message", onMessage);
    if (sessionKey && adapter.connected) await adapter.request("sessions.messages.unsubscribe", { key: sessionKey }).catch(() => {});
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
  const output = path.resolve(value("--out") ?? path.join(repoRoot, "artifacts", "simple-session-controls", `native-session-${Date.now()}.json`));
  const timeoutMs = Number(value("--timeout") ?? 360) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 60_000 || timeoutMs > 600_000) throw new Error("Invalid fixture deadline");
  const { node } = fixtureRuntime(resources);
  const tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, "aifb-native-session-")));
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
  receipt ??= { kind: "AIFB_NATIVE_SESSION_CONTROLS_FIXTURE", simulatedModel: true, realAI: false, pass: false, failures: ["Worker exited without receipt"] };
  receipt.workerExitCode = exitCode; receipt.forcedCleanup = forcedCleanup;
  receipt.pass = receipt.pass && exitCode === 0 && !forcedCleanup;
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith("aifb-native-session-")) throw new Error("Unsafe fixture cleanup path");
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
