/** Native read contracts plus one explicit simulated thinking turn; generated home/files only. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID, MODEL_REF, COMPLETE_PROMPT, COMPLETE_REPLY,
  classifyFixtureRequest } from "./native-chat-fixture.mjs";

const self = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(self), "..");
const NOTE = "AIFB_WORKBENCH_FIXTURE: only generated text. <script>inert</script>\n";
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlWAAAAAASUVORK5CYII=";

async function worker({ root, resources, timeoutMs }) {
  if (process.env.AIFB_NATIVE_CHAT_FIXTURE !== "1" || process.env.OPENCLAW_HOME !== root
    || process.env.OPENCLAW_CONFIG_PATH !== path.join(root, "openclaw.json")) throw new Error("Fixture worker must be isolated");
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor, SUPERVISOR_STATES } = await import("../apps/desktop/electron/supervisor.mjs");
  const { GatewayAdapter } = await import("../apps/desktop/electron/gateway-adapter.mjs");
  const { SetupChannel } = await import("../apps/desktop/electron/setup-channel.mjs");
  const { ConversationService } = await import("../apps/desktop/electron/conversation-service.mjs");
  const { createSessionDraftStore } = await import("../apps/desktop/src/chat-drafts.ts");
  const { waitForGatewayListener } = await import("../apps/desktop/electron/startup-listener.mjs");
  const { waitForGatewayReady } = await import("../apps/desktop/electron/startup-readiness.mjs");
  const api = await import("../apps/desktop/src/workbench-api.ts");
  const apiKey = `fixture-only-${randomUUID()}`;
  let modelRequests = 0, inferenceAuthorized = false;
  const modelObservation = { accepted: 0, rejected: 0, shapes: [] };
  const model = createServer(async (request, response) => {
    try {
      if (++modelRequests !== 1 || !inferenceAuthorized) throw new Error("Unexpected fixture model request");
      let raw = "";
      for await (const chunk of request) { raw += chunk.toString(); if (raw.length > 1048576) throw new Error("Fixture model body too large"); }
      const body = JSON.parse(raw);
      assert.equal(classifyFixtureRequest(request, body, apiKey), "complete");
      modelObservation.shapes.push({ model: body.model, stream: body.stream, roles: body.messages.map(message => message.role),
        toolsAdvertised: body.tools?.length ?? 0, reasoningEffort: body.reasoning_effort ?? null });
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const identity = { id: "chatcmpl-workbench-fixture", object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: MODEL_ID };
      for (const [delta, finish_reason] of [[{ role: "assistant", content: COMPLETE_REPLY }, null], [{}, "stop"]]) {
        response.write(`data: ${JSON.stringify({ ...identity, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      }
      response.write(`data: ${JSON.stringify({ ...identity, choices: [], usage: { prompt_tokens: 24, completion_tokens: 12, total_tokens: 36 } })}\n\n`);
      response.end("data: [DONE]\n\n"); modelObservation.accepted++;
    } catch {
      modelObservation.rejected++;
      if (!response.headersSent) response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Unexpected fixture model request" } }));
    }
  });
  await new Promise((resolve, reject) => { model.once("error", reject); model.listen(0, "127.0.0.1", resolve); });
  const config = fixtureConfig(root, model.address().port, apiKey);
  // Deliberately permissive generated config: production host must close the gate.
  config.tools = { profile: 'full', deny: ['fixture-prior-deny'] };
  config.plugins = { enabled: true, allow: ['document-extract'], entries: { 'document-extract': { enabled: true } } };
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  const workspace = path.join(root, "workspace");
  mkdirSync(path.join(workspace, "nested"), { recursive: true });
  mkdirSync(path.join(workspace, "skills", "fixture-readable"), { recursive: true });
  writeFileSync(path.join(workspace, "fixture-note.txt"), NOTE);
  writeFileSync(path.join(workspace, "nested", "fixture-image.png"), Buffer.from(PNG, "base64"));
  writeFileSync(path.join(workspace, "oversized.txt"), "x".repeat(262145));
  writeFileSync(path.join(root, "outside-fixture.txt"), "AIFB_OUTSIDE_WORKSPACE_MUST_NOT_READ");
  writeFileSync(path.join(workspace, "skills", "fixture-readable", "SKILL.md"), "---\nname: fixture-readable\ndescription: Generated read-only fixture skill.\n---\nOnly generated instructions; never invoke tools.\n");
  const record = { kind: "AIFB_NATIVE_MANAGEMENT_FIXTURE", recordedAt: new Date().toISOString(),
    realAI: false, runtimeVersion: "2026.9.1", nodeVersion: process.version,
    evidenceScope: "Production Supervisor, both public SDK adapters and workbench API projections; no renderer",
    networkEvidence: "Generated loopback model only; one explicit simulated thinking send after read checks; no packet monitoring",
    configuredExternalModelRoutes: 0, toolsDenied: true, configuredCronEnabled: false, configuredChannelsSkipped: true,
    selectedBundleLayout: native.layout, handshake: {}, checks: {}, rpc: [], failures: [], cleanup: {} };
  let gatewayChild, token = "<unset>", stopping = false;
  const logs = [];
  const remember = message => { logs.push(String(message).slice(0, 450)); if (logs.length > 12) logs.shift(); };
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (gatewayChild = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const events = [];
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-workbench-fixture", logger: { warn() {} },
    authorizeWorker: key => setup.authorizeWorker(key),
    onEvent: event => { if (events.length < 500) events.push(event); } });
  const setup = new SetupChannel({
    configPath: process.env.OPENCLAW_CONFIG_PATH,
    catalogue: JSON.parse(readFileSync(new URL("../apps/desktop/electron/native-catalog.json", import.meta.url), "utf8")), stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: "0.0.5-workbench-fixture", logger: { warn() {} } });
  const request = async (method, params = {}) => {
    assert.ok(!["agent", "usage.status", "skills.search", "projects.add"].includes(method), "Read fixture cannot dispatch external/model requests");
    if (method === "sessions.send") assert.equal(inferenceAuthorized, true, "Only the explicit thinking test may send");
    const receipt = { method, parameterFields: Object.keys(params), ...(method === "channels.status" ? { probe: params.probe } : {}) };
    record.rpc.push(receipt);
    try {
      const result = await adapter.request(method, params);
      receipt.ok = true; receipt.resultFields = result && typeof result === "object" ? Object.keys(result) : [];
      return result;
    } catch (error) { receipt.ok = false; throw error; }
  };
  globalThis.window = { aiForBoss: { gateway: { request }, management: { request: payload => setup.manage(payload) } } };
  const cleanError = error => String(error?.message ?? error).replaceAll(apiKey, "[fixture-key]").replaceAll(token, "[gateway-token]").replaceAll(root, "[fixture-home]").slice(0, 600);
  const check = async (name, callback) => {
    try { record.checks[name] = await callback(); }
    catch (error) { record.checks[name] = { pass: false, error: cleanError(error) }; record.failures.push(name); }
  };
  let cancel, timer;
  const cancelled = new Promise((_, reject) => {
    cancel = () => { stopping = true; reject(new Error("Fixture stopped")); };
    timer = setTimeout(cancel, timeoutMs);
  });
  const onMessage = message => { if (message?.type === "stop") cancel(); };
  process.on("message", onMessage);
  try {
    await Promise.race([(async () => {
      const startedAt = Date.now();
      const endpoint = await supervisor.start();
      assert.ok(endpoint, "Gateway start cancelled"); token = endpoint.token;
      const listener = await waitForGatewayListener({ port: endpoint.port, supervisor, shouldStop: () => stopping,
        timeoutMs: Math.max(0, 240000 - (Date.now() - startedAt)) });
      record.handshake.listenerElapsedMs = Date.now() - startedAt;
      assert.equal(listener, "ready", `Gateway listener ${listener}`);
      const connection = { url: `ws://127.0.0.1:${endpoint.port}`, token };
      adapter.connect(connection); setup.connect(connection);
      const readiness = await waitForGatewayReady({ supervisor,
        adapter: { get connected() { return adapter.connected && setup.connected; } },
        timeoutMs: Math.max(0, 240000 - (Date.now() - startedAt)), shouldStop: () => stopping });
      assert.equal(readiness, "ready", `Gateway handshake ${readiness}`);
      supervisor.markReady();
      record.handshake = { ...record.handshake, connected: true, setupReady: true, elapsedMs: Date.now() - startedAt,
        protocol: adapter.hello?.protocol, serverVersion: adapter.hello?.server?.version,
        chatAdminGranted: adapter.hello?.auth?.scopes?.includes("operator.admin") === true };
      assert.equal(record.handshake.chatAdminGranted, false);
      const projects = await api.listProjects();
      record.checks.projects = { pass: true, count: projects.length, fields: projects[0] ? Object.keys(projects[0]) : [] };
      const project = projects.find(item => item.agentId === "fixture" && item.source === "workspace");
      const created = await request("sessions.create", { key: `aifb-workbench-${randomUUID()}`, agentId: "fixture", model: MODEL_REF,
        displayName: "Generated workbench fixture", permissionMode: "read-only", ...(project ? { projectId: project.id } : {}) });
      assert.equal(typeof created.key, "string");
      const sessionKey = created.key;
      await request('sessions.messages.subscribe', { key: sessionKey });
      record.checks.sessionCreate = { pass: true, projectIdUsed: Boolean(project), resultFields: Object.keys(created) };
      const policyBackup = JSON.parse(readFileSync(path.join(process.env.OPENCLAW_STATE_DIR, 'aifb-worker-policy-before-beta21.json'), 'utf8'));
      assert.deepEqual(policyBackup.toolsDeny, ['fixture-prior-deny']);
      assert.equal(JSON.stringify(policyBackup).includes(apiKey), false);
      record.checks.hostWorkerPolicy = { pass: true, initialProfile: 'full', initialDenyAll: false,
        productionAdapterAuthorization: true, priorDenyPreserved: true, policyOnlyBackup: true, permissionMode: 'read-only', sandboxClaim: false };
      await check("effectiveTools", async () => {
        const inventory = await setup.manage({ action: 'tool-inventory', sessionKey });
        assert.equal(inventory.effective, true); assert.equal(inventory.sessionKey, sessionKey);
        assert.equal(inventory.agentId, 'fixture');
        assert.equal(inventory.tools.filter(tool => !tool.deniedBySession).length, 0);
        const catalogue = await setup.manage({ action: 'tool-inventory' });
        assert.equal(catalogue.effective, false);
        return { pass: true, profile: inventory.profile, tools: inventory.tools.map(tool => ({ id: tool.id, source: tool.source, deniedBySession: tool.deniedBySession })),
          catalogueCount: catalogue.tools.length, notices: inventory.notices.map(notice => notice.id), noToolInvocation: true };
      });
      await check("pluginToggle", async () => {
        const before = await setup.manage({ action: 'plugin-inventory' });
        assert.equal(before.mutationAllowed, true);
        const plugin = before.plugins.find(item => item.id === 'document-extract');
        assert.equal(plugin?.installed, true); assert.equal(plugin?.enabled, true);
        const off = await setup.manage({ action: 'plugin-toggle', pluginId: plugin.id, enabled: false });
        assert.equal(off.plugin.enabled, false); assert.equal(typeof off.restartRequired, 'boolean');
        const on = await setup.manage({ action: 'plugin-toggle', pluginId: plugin.id, enabled: true });
        assert.equal(on.plugin.enabled, true);
        return { pass: true, id: plugin.id, disabledReadback: true, enabledReadback: true,
          restartRequired: on.restartRequired, noRestartExecuted: true, diagnosticCount: before.diagnosticCount };
      });
      await check("usage", async () => {
        const usage = await api.readUsage(sessionKey);
        assert.equal(usage.totalTokens, 0); assert.equal(usage.totalCost, 0);
        return { pass: true, totalTokens: usage.totalTokens, totalCost: usage.totalCost, sessions: usage.sessions, cacheStatus: usage.cacheStatus };
      });
      await check("files", async () => {
        const listing = await api.listSessionFiles(sessionKey);
        const note = listing.entries.find(item => item.name === "fixture-note.txt");
        assert.ok(note, "Generated note absent from native session root");
        const preview = await api.getSessionFile(listing, note);
        assert.equal(preview.kind, "text"); assert.equal(preview.content, NOTE);
        const folder = listing.entries.find(item => item.name === "nested");
        assert.equal(folder?.kind, "directory");
        const nested = await api.listSessionFiles(sessionKey, folder.path);
        assert.equal(nested.parentPath, "");
        const image = nested.entries.find(item => item.name === "fixture-image.png"); assert.ok(image);
        const imagePreview = await api.getSessionFile(nested, image);
        assert.equal(imagePreview.kind, "image"); assert.equal(imagePreview.imageUrl, `data:image/png;base64,${PNG}`);
        const search = await api.listSessionFiles(sessionKey, "", "fixture-note");
        assert.ok(search.entries.some(item => item.name === "fixture-note.txt"));
        const large = listing.entries.find(item => item.name === "oversized.txt"); assert.ok(large);
        await assert.rejects(api.getSessionFile(listing, large), /large|lớn|giới hạn/i);
        await assert.rejects(request("sessions.files.get", { sessionKey, path: "../outside-fixture.txt" }));
        return { pass: true, listingFields: Object.keys(listing), entryFields: Object.keys(note), textMatched: true,
          imageMatched: true, nestedNavigation: true, searchMatched: true, oversizedRejected: true, traversalRejected: true,
          touchedFileCount: listing.files.length, truncated: listing.truncated };
      });
      await check("skills", async () => {
        const skills = await api.readSkills(sessionKey);
        assert.ok(skills.some(item => item.name === "fixture-readable"), "Generated skill absent from native status");
        return { pass: true, count: skills.length, fields: skills[0] ? Object.keys(skills[0]) : [], fixtureSkillPresent: true };
      });
      await check("channels", async () => {
        const channels = await api.readChannels();
        return { pass: true, count: channels.channels.length, partial: channels.partial, probe: false };
      });
      await check("cron", async () => {
        const status = await api.readCronStatus(), page = await api.readCronPage(sessionKey);
        const history = await request("cron.runs", { scope: "all", agentId: "fixture", limit: 20, offset: 0 });
        assert.equal(status.enabled, false); assert.ok(Array.isArray(history.entries));
        assert.equal(history.entries.length, 0);
        assert.ok(page.jobs.every(job => typeof job.id === "string" && job.id && typeof job.enabled === "boolean"));
        const selectedHistory = page.jobs[0] ? await api.readCronRuns(page.jobs[0].id, sessionKey) : null;
        if (selectedHistory) assert.equal(selectedHistory.runs.length, 0);
        return { pass: true, status, pageFields: Object.keys(page), historyFields: Object.keys(history),
          nativeDefaultJobCount: page.jobs.length, historyCount: history.entries.length,
          selectedJobHistoryVerified: Boolean(selectedHistory), noCronMutation: true };
      });
      await check("skillToggle", async () => {
        const items = await api.readSkills(sessionKey), skill = items.find(item => item.name === "fixture-readable");
        await setup.manage({ action: "skill-toggle", sessionKey, skillKey: skill.id, enabled: false });
        assert.equal((await api.readSkills(sessionKey)).find(item => item.id === skill.id).disabled, true);
        await setup.manage({ action: "skill-toggle", sessionKey, skillKey: skill.id, enabled: true });
        assert.equal((await api.readSkills(sessionKey)).find(item => item.id === skill.id).disabled, false);
        return { pass: true, disabledReadback: true, enabledReadback: true };
      });
      await check("telegramWizard", async () => {
        const catalogue = await setup.manage({ action: "catalog" });
        assert.ok(catalogue.channels.some(c => c.id === "telegram" && c.bundled));
        const reply = await setup.manage({ action: "channel-setup", channel: "telegram" });
        assert.ok(reply.sessionId); assert.ok(reply.step || reply.done);
        if (!reply.done) {
          const cancelled = await setup.manage({ action: "channel-cancel", sessionId: reply.sessionId });
          assert.equal(cancelled.status, "cancelled");
        }
        return { pass: true, catalogueCount: catalogue.channels.length, stepType: reply.step?.type,
          stepTitle: reply.step?.title, cancelledWithoutCredentials: true, answersSubmitted: 0 };
      });
      await check("cronManagement", async () => {
        const before = await api.readCronPage(sessionKey);
        const draft = { name: "Generated schedule", message: "Generated text-only planning.", frequency: "weekly", time: "08:30", timeZone: "Asia/Ho_Chi_Minh", enabled: false };
        const requestId = randomUUID();
        const created = await setup.manage({ action: "cron-create", sessionKey, requestId, draft });
        assert.ok(created.id); assert.equal(created.enabled, false);
        assert.deepEqual(created.payload.toolsAllow, []); assert.equal(created.delivery.mode, "none");
        const duplicate = await setup.manage({ action: "cron-create", sessionKey, requestId, draft });
        assert.equal(duplicate.id, created.id);
        const saved = await setup.manage({ action: "cron-save", sessionKey, id: created.id, draft: { ...draft, name: "Edited schedule" } });
        assert.equal(saved.name, "Edited schedule");
        const enabled = await setup.manage({ action: "cron-toggle", sessionKey, id: created.id, enabled: true });
        assert.equal(enabled.enabled, true);
        await setup.manage({ action: "cron-toggle", sessionKey, id: created.id, enabled: false });
        if (before.jobs[0]) await assert.rejects(setup.manage({ action: "cron-remove", sessionKey, id: before.jobs[0].id }));
        await setup.manage({ action: "cron-remove", sessionKey, id: created.id });
        const after = await api.readCronPage(sessionKey);
        assert.deepEqual(after.jobs.map(j => j.id).sort(), before.jobs.map(j => j.id).sort());
        return { pass: true, createReadback: true, duplicateSameId: true, editReadback: true, enableDisableReadback: true,
          removeReadback: true, systemJobsPreserved: true, toolsAllowEmpty: true, deliveryNone: true, schedulerDisabledDuringFixture: true };
      });
      await check("pin", async () => {
        const history = await request("chat.history", { sessionKey, agentId: "fixture", limit: 10 });
        const patched = await request("sessions.patch", { key: sessionKey, agentId: "fixture", pinned: true,
          ...(typeof history.sessionId === "string" ? { expectedSessionId: history.sessionId } : {}) });
        assert.equal(patched.ok, true);
        const sessions = await request("sessions.list", { agentId: "fixture", limit: 50 });
        const row = sessions.sessions?.find(item => item.key === sessionKey);
        assert.equal(row?.pinned, true);
        await request("sessions.patch", { key: sessionKey, agentId: "fixture", pinned: false });
        const unpinned = await request("sessions.list", { agentId: "fixture", limit: 50 });
        assert.notEqual(unpinned.sessions?.find(item => item.key === sessionKey)?.pinned, true);
        return { pass: true, pinReadback: true, unpinReadback: true,
          projectRowFields: Object.keys(row ?? {}).filter(name => /project|pinned|thinking/.test(name)) };
      });
      await check("conversationDelete", async () => {
        // A new generated target only; the pre-existing fixture conversation is our preservation control.
        const target = await request('sessions.create', { key: `aifb-delete-${randomUUID()}`, agentId: 'fixture', model: MODEL_REF,
          displayName: 'Generated deletion fixture', permissionMode: 'read-only' });
        assert.equal(typeof target.key, 'string'); assert.notEqual(target.key, sessionKey);
        const [otherBefore, historyBefore, rosterBefore] = await Promise.all([
          request('sessions.describe', { key: sessionKey }), request('chat.history', { sessionKey, limit: 10 }),
          request('sessions.list', { agentId: 'fixture', limit: 100 })]);
        const drafts = createSessionDraftStore();
        drafts.write(sessionKey, 'Generated draft to preserve'); drafts.write(target.key, 'Generated target draft');
        const otherDraft = drafts.read(sessionKey), calls = [];
        const conversations = new ConversationService(async (method, params) => {
          assert.ok(['sessions.describe', 'chat.history', 'sessions.delete'].includes(method));
          if (method === 'sessions.delete') assert.equal(params.key, target.key, 'only this newly generated target may be deleted');
          const item = { method, parameterFields: Object.keys(params) }; calls.push(item);
          const result = await setup.workspaceRequest(method, params);
          item.resultFields = Object.keys(result ?? {}); return result;
        });
        const preview = await conversations.run({ action: 'conversation-inspect', key: target.key });
        assert.equal(preview.key, target.key); assert.equal(typeof preview.ticket, 'string');
        assert.equal(calls.some(item => item.method === 'sessions.delete'), false, 'inspect is read-only');
        const confirmed = await conversations.run({ action: 'conversation-delete', ticket: preview.ticket });
        assert.equal(confirmed.ok, true); assert.equal(confirmed.key, target.key);
        drafts.forget(confirmed.key);
        const [absent, otherAfter, historyAfter, rosterAfter] = await Promise.all([
          request('sessions.describe', { key: target.key }), request('sessions.describe', { key: sessionKey }),
          request('chat.history', { sessionKey, limit: 10 }), request('sessions.list', { agentId: 'fixture', limit: 100 })]);
        assert.equal(absent.session, null, 'native describe confirms exact target absence');
        assert.deepEqual(rosterAfter.sessions.map(row => [row.key, row.sessionId]).sort(),
          rosterBefore.sessions.filter(row => row.key !== target.key).map(row => [row.key, row.sessionId]).sort());
        for (const name of ['key', 'sessionId', 'updatedAt', 'label', 'displayName', 'model', 'pinned']) assert.deepEqual(otherAfter.session[name], otherBefore.session[name]);
        assert.deepEqual(historyAfter.messages, historyBefore.messages);
        assert.strictEqual(drafts.read(sessionKey), otherDraft); assert.equal(drafts.read(target.key).text, '');
        await assert.rejects(conversations.run({ action: 'conversation-delete', ticket: preview.ticket }));
        assert.equal(calls.filter(item => item.method === 'sessions.delete').length, 1);
        assert.equal(modelRequests, 0);
        return { pass: true, generatedTargetOnly: true, hostReceiptInspection: true, oneUseConfirmation: true,
          nativeAbsence: 'sessions.describe -> session:null', nativeRosterExactRemoval: true,
          otherSessionIdentityMetadataHistoryUnchanged: true, productionDraftStoreOtherDraftUnchanged: true,
          draftEvidenceScope: 'production in-memory store, no renderer', modelRequestsDuringDeletion: 0, calls };
      });
      await check("thinkingScopeBoundary", async () => {
        const catalog = await request("models.list", { agentId: "fixture" });
        const model = catalog.models?.find(item => `${item.provider}/${item.id}` === MODEL_REF);
        const choice = model?.thinkingLevels?.find(item => item.id === "off") ?? model?.thinkingLevels?.[0];
        assert.ok(choice, "Fixture model does not publish a thinking choice");
        await assert.rejects(request("sessions.patch", { key: sessionKey, agentId: "fixture", thinkingLevel: choice.id }), /quyền an toàn/);
        return { pass: true, thinkingChoicePublished: choice.id, mutationDeniedWithoutAdmin: true,
          productLimitation: "Changing persistent session thinkingLevel requires operator.admin in the pinned native classifier; no elevated fallback." };
      });
      assert.equal(modelRequests, 0, "Read methods caused a model request");
      record.readPhaseModelRequests = modelRequests;
      await check("thinkingPerTurn", async () => {
        const catalog = await request("models.list", { agentId: "fixture" });
        const model = catalog.models?.find(item => `${item.provider}/${item.id}` === MODEL_REF);
        const choice = model?.thinkingLevels?.find(item => item.id === "off"); assert.ok(choice);
        const before = await request("sessions.list", { agentId: "fixture", limit: 50 });
        const beforeRow = before.sessions?.find(item => item.key === sessionKey); assert.ok(beforeRow);
        const runId = randomUUID();
        inferenceAuthorized = true;
        try {
          const ack = await request("sessions.send", { key: sessionKey, agentId: "fixture", message: COMPLETE_PROMPT,
            thinking: choice.id, idempotencyKey: runId, timeoutMs: 45000 });
          const acceptedRun = ack.runId ?? runId;
          const terminal = () => events.find(event => event.event === "chat" && event.payload?.sessionKey === sessionKey
            && event.payload?.runId === acceptedRun && ["final", "error", "aborted"].includes(event.payload.state));
          const deadline = Date.now() + 60000;
          while (!terminal() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
          assert.equal(terminal()?.payload.state, "final", "One-turn thinking send did not complete");
          const after = await request("sessions.list", { agentId: "fixture", limit: 50 });
          const afterRow = after.sessions?.find(item => item.key === sessionKey); assert.ok(afterRow);
          assert.equal(afterRow.thinkingLevel, beforeRow.thinkingLevel, "One-turn override changed persistent session projection");
          const history = await request("chat.history", { sessionKey, agentId: "fixture", limit: 10 });
          assert.ok(history.messages.some(row => row.role === "assistant" && (typeof row.content === "string" ? row.content
            : row.content?.filter(part => part.type === "text").map(part => part.text).join("")) === COMPLETE_REPLY));
          return { pass: true, parameter: "thinking", choiceFromNative: choice.id, final: true, historyReadback: true,
            persistentThinkingUnchanged: true, modelRequests: modelRequests };
        } finally { inferenceAuthorized = false; }
      });
      assert.equal(modelRequests, 1); assert.equal(modelObservation.accepted, 1); assert.equal(modelObservation.rejected, 0);
    })(), cancelled]);
  } catch (error) { record.failures.push(cleanError(error)); }
  finally {
    stopping = true; clearTimeout(timer); process.off("message", onMessage); delete globalThis.window;
    await Promise.all([adapter.disconnect(), setup.disconnect()]);
    try { await supervisor.stop(); } catch { record.failures.push("Owned Gateway cleanup failed"); }
    record.cleanup.gatewayExited = !gatewayChild || gatewayChild.exitCode !== null || gatewayChild.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await new Promise(resolve => { model.close(resolve); model.closeAllConnections(); });
    record.cleanup.modelServerClosed = true;
    record.modelRequests = modelRequests;
    record.simulatedModel = modelObservation;
    record.childLogTail = logs.map(line => line.replaceAll(apiKey, "[fixture-key]").replaceAll(token, "[gateway-token]").replaceAll(root, "[fixture-home]"));
    if (!record.cleanup.gatewayExited || !record.cleanup.supervisorStopped) record.failures.push("Owned Gateway did not stop");
    if (modelRequests > 1 || modelObservation.rejected) record.failures.push("Unexpected model request");
  }
  record.pass = record.failures.length === 0;
  process.send?.({ type: "receipt", record });
  return record.pass;
}

async function main() {
  const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
  if (process.argv.includes("--worker")) {
    const ok = await worker(JSON.parse(value("--worker"))); process.disconnect?.(); process.exitCode = ok ? 0 : 1; return;
  }
  if (process.platform !== "win32") throw new Error("Fixture requires bundled Windows runtime");
  const resources = path.resolve(value("--resources") ?? path.join(repoRoot, "apps", "desktop", "resources"));
  const output = path.resolve(value("--out") ?? path.join(repoRoot, "artifacts", "native-capabilities", `native-management-${Date.now()}.json`));
  const timeoutMs = 360000;
  const { node } = fixtureRuntime(resources);
  const tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, "aifb-native-management-")));
  const env = isolatedEnvironment(root);
  for (const dir of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, "workspace")]) mkdirSync(dir, { recursive: true });
  let receipt, forcedCleanup = false;
  const child = spawn(node, [self, "--worker", JSON.stringify({ root, resources, timeoutMs })], {
    cwd: root, env, windowsHide: true, stdio: ["ignore", "ignore", "ignore", "ipc"] });
  child.on("message", message => { if (message?.type === "receipt") receipt = message.record; });
  const timer = setTimeout(() => { if (child.connected) child.send({ type: "stop" }, () => {}); }, timeoutMs + 5000);
  const force = setTimeout(() => {
    if (child.exitCode !== null) return; forcedCleanup = true;
    spawnSync(path.join(process.env.SystemRoot, "System32", "taskkill.exe"), ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  }, timeoutMs + 80000);
  const exitCode = await new Promise(resolve => { child.once("error", () => resolve(-1)); child.once("exit", resolve); });
  clearTimeout(timer); clearTimeout(force);
  receipt ??= { kind: "AIFB_NATIVE_MANAGEMENT_FIXTURE", realAI: false, pass: false, failures: ["Worker exited without receipt"] };
  receipt.workerExitCode = exitCode; receipt.forcedCleanup = forcedCleanup;
  receipt.pass = receipt.pass && exitCode === 0 && !forcedCleanup;
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith("aifb-native-management-")) throw new Error("Unsafe temporary cleanup path");
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.tempProfileRemoved = false; receipt.pass = false; receipt.failures.push("Temporary profile cleanup failed"); }
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  console.log(`[native workbench] ${receipt.pass ? "PASS" : "FAIL"}; evidence=${output}`);
  process.exitCode = receipt.pass ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch(error => {
  console.error(`[native workbench] ${error?.message ?? error}`); process.exitCode = 1;
});
