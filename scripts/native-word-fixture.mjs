/** Native Word CONTENT proof. Generated DOCX, isolated Gateway, local model only.
 * --docx-module names the installed docx generator module (no dependency install).
 * Existing native-document-fixture.mjs remains the historical transport test. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID } from './native-chat-fixture.mjs';

const self = fileURLToPath(import.meta.url), repo = path.resolve(path.dirname(self), '..');
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PROMPT = 'Đọc số tiền, ngày, nội dung đầu trang và chú thích trong tài liệu Word đính kèm.';
const DATA = [
  { name: 'Bao-cao-thu-nghiem.docx', body: 'AIFB_WORD_BODY_731948', amount: '98.765.432 đồng', date: '21/09/2031', header: 'AIFB_WORD_HEADER_831946', footer: 'AIFB_WORD_FOOTER_951648', footnote: 'AIFB_WORD_FOOTNOTE_417936' },
  { name: 'Phu-luc-thu-nghiem.docx', body: 'AIFB_WORD_BODY_629174', amount: '12.345.678 đồng', date: '06/10/2032', header: 'AIFB_WORD_HEADER_187426', footer: 'AIFB_WORD_FOOTER_367429', footnote: 'AIFB_WORD_FOOTNOTE_827316' },
];
const markers = data => [data.body, data.amount, data.date, data.header, data.footer, data.footnote];
const hash = value => createHash('sha256').update(value).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const textContent = content => typeof content === 'string' ? content : Array.isArray(content)
  ? content.filter(part => part?.type === 'text').map(part => part.text ?? '').join('\n') : '';
async function until(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) { if (Date.now() >= deadline) throw new Error(`${label} timed out`); await sleep(100); }
}

export async function makeWordDocument(data, docxModule) {
  const { Document, Packer, Paragraph, TextRun, Header, Footer, FootnoteReferenceRun, Table, TableRow, TableCell, WidthType } = await import(pathToFileURL(docxModule));
  const cell = text => new TableCell({ width: { size: 4500, type: WidthType.DXA }, children: [new Paragraph(text)] });
  const document = new Document({ creator: 'Generated AI for Boss fixture', title: 'Báo cáo Word tổng hợp',
    footnotes: { 1: { children: [new Paragraph(`Chú thích kiểm chứng: ${data.footnote}. Đây là dữ liệu tổng hợp.`)] } },
    sections: [{ headers: { default: new Header({ children: [new Paragraph(`Đầu trang — ${data.header}`)] }) },
      footers: { default: new Footer({ children: [new Paragraph(`Chân trang — ${data.footer}`)] }) },
      children: [
        new Paragraph({ children: [new TextRun({ text: 'Báo cáo thử nghiệm tiếng Việt', bold: true })] }),
        new Paragraph({ children: [new TextRun('Đây là đoạn văn có dấu, kiểm tra nội dung Word: '), new TextRun({ text: data.body, bold: true }), new FootnoteReferenceRun(1)] }),
        new Paragraph('Mọi số liệu bên dưới chỉ dành cho kiểm thử, không phải dữ liệu khách hàng.'),
        new Table({ width: { size: 9000, type: WidthType.DXA }, columnWidths: [4500, 4500], rows: [
          new TableRow({ children: [cell('Số tiền duy nhất'), cell('Ngày thực hiện')] }),
          new TableRow({ children: [cell(data.amount), cell(data.date)] }),
        ] }),
      ] }],
  });
  return Packer.toBuffer(document);
}

async function startModel(apiKey) {
  const observation = { requests: 0, completed: 0, rejected: 0, received: [], failures: [] };
  const server = createServer(async (request, response) => {
    try {
      let raw = '';
      for await (const chunk of request) { raw += chunk.toString(); assert.ok(raw.length <= 1048576, 'Generated model request exceeded limit'); }
      const index = observation.requests++; assert.ok(index < DATA.length, 'Unexpected additional model request');
      assert.equal(request.method, 'POST'); assert.equal(request.url, '/v1/chat/completions');
      assert.equal(request.headers.authorization, `Bearer ${apiKey}`);
      const body = JSON.parse(raw); assert.equal(body.model, MODEL_ID); assert.equal(body.stream, true);
      assert.ok(Array.isArray(body.messages)); assert.equal(body.tools?.length ?? 0, 0); assert.equal(body.functions?.length ?? 0, 0);
      const data = DATA[index], userTexts = body.messages.filter(row => row.role === 'user').map(row => textContent(row.content));
      const content = userTexts.find(text => text.includes(data.body)) ?? '';
      const witnesses = markers(data).map(marker => {
        const at = content.indexOf(marker), opening = content.lastIndexOf('<<<EXTERNAL_UNTRUSTED_CONTENT', at), closing = content.indexOf('<<<END_EXTERNAL_UNTRUSTED_CONTENT', at);
        return { marker, present: at >= 0, untrustedBoundary: at >= 0 && opening >= 0 && opening < at && closing > at };
      });
      const shape = { fileOnly: index === 1, model: body.model, advertisedTools: body.tools?.length ?? 0,
        userMessageCount: userTexts.length, currentDocumentTextLength: content.length, witnesses, externalSourceLabel: content.includes('Source: External') };
      observation.received.push(shape);
      assert.ok(witnesses.every(item => item.present && item.untrustedBoundary), 'Word content markers must arrive inside native untrusted boundaries');
      assert.equal(shape.externalSourceLabel, true);
      if (index === 0) assert.ok(userTexts.some(text => text.includes(PROMPT)));
      // Construct the reply only from substrings actually witnessed in this HTTP request.
      const reply = 'Đã đọc dữ liệu Word: ' + markers(data).map(marker => content.slice(content.indexOf(marker), content.indexOf(marker) + marker.length)).join(' | ');
      shape.reply = reply;
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      const identity = { id: `chatcmpl-word-${index}`, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: MODEL_ID };
      const frame = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...identity, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      frame({ role: 'assistant', content: reply.slice(0, 30) }); await sleep(80); frame({ content: reply.slice(30) }); frame({}, 'stop');
      response.write(`data: ${JSON.stringify({ ...identity, choices: [], usage: { prompt_tokens: 220, completion_tokens: 80, total_tokens: 300 } })}\n\n`);
      response.end('data: [DONE]\n\n'); observation.completed++;
    } catch (error) {
      observation.rejected++; observation.failures.push(String(error.message).slice(0, 400));
      if (!response.headersSent) response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Generated Word fixture rejected missing or invalid document content' } }));
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { observation, port: server.address().port, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

async function worker({ root, resources, timeoutMs, docxModule }) {
  assert.equal(process.env.AIFB_NATIVE_CHAT_FIXTURE, '1'); assert.equal(process.env.OPENCLAW_HOME, root);
  assert.equal(process.env.OPENCLAW_CONFIG_PATH, path.join(root, 'openclaw.json'));
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor, SUPERVISOR_STATES } = await import('../apps/desktop/electron/supervisor.mjs');
  const { GatewayAdapter } = await import('../apps/desktop/electron/gateway-adapter.mjs');
  const { SetupChannel } = await import('../apps/desktop/electron/setup-channel.mjs');
  const { ProjectService } = await import('../apps/desktop/electron/project-service.mjs');
  const { waitForGatewayListener } = await import('../apps/desktop/electron/startup-listener.mjs');
  const { waitForGatewayReady } = await import('../apps/desktop/electron/startup-readiness.mjs');
  const { extractDocxAttachment } = await import('../apps/desktop/electron/docx-extract.mjs');
  const { prepareAttachments, readAttachment, toOriginalAttachments, toNativeAttachments } = await import('../apps/desktop/src/chat-attachments.ts');
  const apiKey = `fixture-only-${randomUUID()}`, model = await startModel(apiKey);
  const config = fixtureConfig(root, model.port, apiKey);
  config.plugins = { enabled: true, allow: ['document-extract'], entries: { 'document-extract': { enabled: true } } };
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2));
  const record = { kind: 'AIFB_NATIVE_WORD_CONTENT_FIXTURE', recordedAt: new Date().toISOString(), realAI: false, simulatedModel: true,
    runtimeVersion: '2026.9.1', nodeVersion: process.version, selectedBundleLayout: native.layout, sdkFromSelectedBundle: true,
    evidenceScope: 'Production DOCX extractor, renderer attachment functions, ProjectService, Supervisor, both public SDK adapters, and unchanged native core; no renderer UI',
    generatedDocumentProducer: 'docx library; Vietnamese paragraphs, table, header, footer, footnote',
    documentExtractionPluginEnabled: true, configuredExternalModelRoutes: 0, toolsDenied: true,
    networkEvidence: 'Generated loopback model routes only; no real accounts or packet monitoring',
    limitations: ['Content transport and marker recognition only; simulated model, not AI comprehension', 'No Word images, layout, visual rendering, field execution, or legacy DOC proof', 'Source shell modules with selected bundled core; no full packaged UI launch'],
    sourceHashes: Object.fromEntries(['docx-extract.mjs', 'project-service.mjs'].map(name => [name, hash(readFileSync(new URL(`../apps/desktop/electron/${name}`, import.meta.url)))])),
    handshake: {}, sends: [], project: {}, cleanup: {}, failures: [] };
  const events = [], logs = [], statuses = []; let gatewayChild, gatewayToken = '<unset>', stopping = false, sessionKey;
  const remember = text => { logs.push(String(text).slice(0, 450)); if (logs.length > 15) logs.shift(); };
  const status = channel => value => { if (statuses.length < 40) statuses.push({ channel, phase: value.phase, at: Date.now() }); };
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false, logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (gatewayChild = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR, Client: GatewayClient, appVersion: '0.0.5-word-fixture', logger: { warn() {} },
    authorizeWorker: key => setup.authorizeWorker(key), onStatus: status('chat'), onEvent: event => { if (events.length < 1000) events.push(event); } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: GatewayClient, appVersion: '0.0.5-word-fixture', logger: { warn() {} }, onStatus: status('setup') });
  let cancel, timer;
  const cancellation = new Promise((_, reject) => { cancel = () => { stopping = true; reject(new Error('Word fixture cancelled')); }; timer = setTimeout(cancel, timeoutMs); });
  const onMessage = message => { if (message?.type === 'stop') cancel(); }; process.on('message', onMessage);
  try {
    await Promise.race([(async () => {
      const started = Date.now(), endpoint = await supervisor.start(); assert.ok(endpoint, 'Gateway startup cancelled'); gatewayToken = endpoint.token;
      const listener = await waitForGatewayListener({ port: endpoint.port, supervisor, shouldStop: () => stopping }); assert.equal(listener, 'ready');
      const connection = { url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token }; adapter.connect(connection); setup.connect(connection);
      const ready = await waitForGatewayReady({ supervisor, adapter: { get connected() { return adapter.connected && setup.connected; } },
        timeoutMs: Math.max(0, 240000 - (Date.now() - started)), shouldStop: () => stopping }); assert.equal(ready, 'ready'); supervisor.markReady();
      const nativePolicy = adapter.hello?.policy, policy = { ...nativePolicy?.attachments, maxPayload: nativePolicy?.maxPayload };
      record.handshake = { connected: true, setupReady: true, elapsedMs: Date.now() - started, serverVersion: adapter.hello?.server?.version,
        protocol: adapter.hello?.protocol, attachmentPolicy: policy, chatAdminGranted: adapter.hello?.auth?.scopes?.includes('operator.admin') === true };
      assert.equal(record.handshake.chatAdminGranted, false);
      const catalogue = await adapter.request('models.list', { agentId: 'fixture' });
      assert.ok(catalogue.models?.some(item => item.id === MODEL_ID && item.available === true));
      const projectParent = path.join(root, 'projects'); mkdirSync(projectParent);
      const projectService = new ProjectService({ directory: path.join(root, 'product-metadata'), request: (method, params) => setup.workspaceRequest(method, params),
        chooseDirectory: async () => projectParent, openDirectory: async () => {} });
      const project = await projectService.run({ action: 'project-create', name: 'Word tổng hợp' });
      const created = await projectService.run({ action: 'project-session', projectId: project.id, agentId: 'fixture', requestId: randomUUID() });
      sessionKey = created.key; assert.equal(typeof sessionKey, 'string');
      await adapter.request('sessions.messages.subscribe', { key: sessionKey, agentId: 'fixture' });
      record.project = { created: true, boundSession: true, documents: [] };
      for (const [index, data] of DATA.entries()) {
        const bytes = await makeWordDocument(data, docxModule), file = new globalThis.File([bytes], data.name, { type: DOCX_MIME });
        const prepared = prepareAttachments([file], policy, [], () => randomUUID())[0];
        const content = await readAttachment(file, prepared, policy); assert.equal(content, bytes.toString('base64'));
        const readyFile = { ...prepared, status: 'ready', content };
        const original = toOriginalAttachments([readyFile], policy)[0];
        const extraction = await extractDocxAttachment(original);
        for (const marker of markers(data)) assert.ok(extraction.text.includes(marker), `Extractor missing ${marker}`);
        const payloadFiles = toNativeAttachments([{ ...prepared, status: 'ready', content, extractedText: extraction.text }], policy);
        assert.equal(payloadFiles.length, 1); const textFile = payloadFiles[0];
        assert.equal(textFile.mimeType, 'text/plain'); assert.equal(textFile.fileName, data.name + '.txt');
        assert.equal(Buffer.from(textFile.content, 'base64').toString('utf8'), extraction.text);
        const saved = await projectService.run({ action: 'project-attachments', sessionKey, files: [original] }); assert.equal(saved.saved, true);
        const originalPath = path.join(project.directory, 'Tai lieu', readdirSync(path.join(project.directory, 'Tai lieu')).find(name => name.endsWith('-' + data.name)));
        assert.deepEqual(readFileSync(originalPath), bytes);
        const runId = randomUUID(), payload = { key: sessionKey, agentId: 'fixture', message: index === 0 ? PROMPT : '', attachments: payloadFiles,
          idempotencyKey: runId, thinking: 'off' };
        const wireBytes = Buffer.byteLength(JSON.stringify({ type: 'req', id: randomUUID(), method: 'sessions.send', params: payload }));
        assert.ok(wireBytes < policy.maxPayload); assert.ok(textFile.sizeBytes <= policy.maxBytes);
        const ack = await adapter.request('sessions.send', payload), acceptedRun = ack.runId ?? runId;
        const runEvents = () => events.filter(event => event.event === 'chat' && event.payload?.sessionKey === sessionKey && event.payload.runId === acceptedRun);
        await until(() => runEvents().some(event => ['final', 'error', 'aborted'].includes(event.payload.state)), 60000, 'Word native terminal event');
        const terminal = runEvents().find(event => ['final', 'error', 'aborted'].includes(event.payload.state));
        assert.equal(terminal?.payload.state, 'final', terminal?.payload.errorMessage ?? 'Word turn did not finish');
        const history = await adapter.request('chat.history', { sessionKey, agentId: 'fixture', limit: 20 });
        const expectedReply = model.observation.received[index]?.reply; assert.equal(typeof expectedReply, 'string');
        const assistant = history.messages?.filter(row => row.role === 'assistant' && textContent(row.content) === expectedReply) ?? [];
        assert.equal(assistant.length, 1, 'Model content reply must be read back from canonical history');
        const currentUser = history.messages?.filter(row => row.role === 'user').at(-1), publicUser = JSON.stringify(currentUser ?? {});
        assert.ok(publicUser.includes('media://inbound/'), 'Native managed attachment reference missing');
        assert.deepEqual(readFileSync(originalPath), bytes);
        record.sends.push({ fileOnly: index === 1, originalFile: data.name, originalBytes: bytes.length, originalSha256: hash(bytes),
          extraction: { characters: extraction.characters, paragraphs: extraction.paragraphs, tables: extraction.tables, parts: extraction.parts,
            includesImages: extraction.includesImages, warnings: extraction.warnings, textSha256: hash(extraction.text) },
          nativeAttachment: { type: textFile.type, mimeType: textFile.mimeType, fileName: textFile.fileName, sizeBytes: textFile.sizeBytes, hostPathPassed: false },
          wireBytes, terminal: terminal.payload.state, history: { matchingAssistantRows: assistant.length, managedMediaPresent: true, allReplyMarkersPresent: markers(data).every(marker => textContent(assistant[0].content).includes(marker)) } });
        record.project.documents.push({ originalFile: data.name, beforeAndAfterSendBytesEqual: true, sha256: hash(readFileSync(originalPath)) });
      }
      const synced = await projectService.run({ action: 'project-sync', sessionKey }); assert.equal(synced.saved, true);
      const historyFolder = path.join(project.directory, 'Lich su'), exported = readdirSync(historyFolder).find(name => name.endsWith('.json'));
      const projectedHistory = JSON.parse(readFileSync(path.join(historyFolder, exported), 'utf8'));
      assert.ok(model.observation.received.every(row => projectedHistory.messages.some(message => message.role === 'assistant' && textContent(message.content) === row.reply)));
      record.project.historyExportContainsBothReplies = true;
      assert.equal(model.observation.requests, 2); assert.equal(model.observation.completed, 2); assert.equal(model.observation.rejected, 0);
    })(), cancellation]);
  } catch (error) { record.failures.push(String(error.message).replaceAll(apiKey, '[fixture-key]').replaceAll(gatewayToken, '[gateway-token]').slice(0, 600)); }
  finally {
    stopping = true; clearTimeout(timer); process.off('message', onMessage);
    if (sessionKey && adapter.connected) await adapter.request('sessions.messages.unsubscribe', { key: sessionKey, agentId: 'fixture' }).catch(() => {});
    await Promise.allSettled([adapter.disconnect(), setup.disconnect()]);
    try { await supervisor.stop(); } catch (error) { record.failures.push(`Owned Gateway cleanup failed: ${error.message}`); }
    record.cleanup.gatewayExited = !gatewayChild || gatewayChild.exitCode !== null || gatewayChild.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await model.close(); record.cleanup.modelServerClosed = true; record.simulatedModelRequests = model.observation; record.channelStatuses = statuses;
    record.childLogTail = logs.map(line => line.replaceAll(apiKey, '[fixture-key]').replaceAll(gatewayToken, '[gateway-token]'));
    if (!record.cleanup.gatewayExited || !record.cleanup.supervisorStopped) record.failures.push('Owned Gateway did not stop');
  }
  record.pass = record.failures.length === 0; process.send?.({ type: 'receipt', record }); return record.pass;
}

async function main() {
  const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
  if (process.argv.includes('--worker')) { const ok = await worker(JSON.parse(value('--worker'))); process.disconnect?.(); process.exitCode = ok ? 0 : 1; return; }
  assert.equal(process.platform, 'win32');
  const resources = path.resolve(value('--resources') ?? path.join(repo, 'apps/desktop/resources'));
  const output = path.resolve(value('--out') ?? path.join(repo, 'artifacts/word-chat/native-word.json')); assert.equal(existsSync(output), false, 'Preserve prior evidence');
  const docxModule = realpathSync.native(value('--docx-module') ?? createRequire(import.meta.url).resolve('docx'));
  const timeoutMs = Number(value('--timeout') ?? 360) * 1000; assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 60000 && timeoutMs <= 360000);
  const { node } = fixtureRuntime(resources), parent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(parent, 'aifb-native-word-'))), env = isolatedEnvironment(root);
  for (const folder of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, 'workspace')]) mkdirSync(folder, { recursive: true });
  let receipt, forcedCleanup = false;
  const child = spawn(node, [self, '--worker', JSON.stringify({ root, resources, timeoutMs, docxModule })], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  child.on('message', message => { if (message?.type === 'receipt') receipt = message.record; });
  const timer = setTimeout(() => { if (child.connected) child.send({ type: 'stop' }, () => {}); }, timeoutMs + 5000);
  const force = setTimeout(() => { if (child.exitCode !== null) return; forcedCleanup = true;
    spawnSync(path.join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }, timeoutMs + 80000);
  const exitCode = await new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('exit', resolve); }); clearTimeout(timer); clearTimeout(force);
  receipt ??= { kind: 'AIFB_NATIVE_WORD_CONTENT_FIXTURE', realAI: false, pass: false, failures: ['Worker exited without receipt'], cleanup: {} };
  receipt.workerExitCode = exitCode; receipt.forcedCleanup = forcedCleanup; receipt.pass = receipt.pass && exitCode === 0 && !forcedCleanup;
  assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-native-word-'));
  if (!forcedCleanup && receipt.cleanup.gatewayExited && receipt.cleanup.supervisorStopped && receipt.cleanup.modelServerClosed) {
    try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
    catch { receipt.tempProfileRemoved = false; receipt.pass = false; receipt.failures.push('Generated temporary profile cleanup failed'); }
  } else { receipt.tempProfileRemoved = false; receipt.isolatedHomeRetained = root; receipt.pass = false; receipt.failures.push('Temporary profile retained because cleanup was not confirmed'); }
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(`[native Word content] ${receipt.pass ? 'PASS' : 'FAIL'}; evidence=${output}`); process.exitCode = receipt.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch(error => { console.error(`[native Word fixture] ${error.message}`); process.exitCode = 1; });
