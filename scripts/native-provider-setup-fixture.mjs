/** Public wizard RPCs against unchanged pinned Windows core. Generated profile,
 * loopback simulated provider only; never a real account or provider endpoint. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID, MODEL_REF } from './native-chat-fixture.mjs';

const self = fileURLToPath(import.meta.url), repo = path.resolve(path.dirname(self), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function worker({ root, resources, timeoutMs }) {
  assert.equal(process.env.OPENCLAW_HOME, root);
  assert.equal(process.env.OPENCLAW_CONFIG_PATH, path.join(root, 'openclaw.json'));
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor, SUPERVISOR_STATES } = await import('../apps/desktop/electron/supervisor.mjs');
  const { SetupChannel } = await import('../apps/desktop/electron/setup-channel.mjs');
  const { waitForGatewayReady } = await import('../apps/desktop/electron/startup-readiness.mjs');
  const apiKey = `fixture-only-${randomUUID()}`;
  const record = { kind: 'AIFB_NATIVE_PROVIDER_SETUP_FIXTURE', recordedAt: new Date().toISOString(),
    coreVersion: '2026.9.1', coreUnchanged: true, realAI: false, generatedCredentialsOnly: true,
    configuredExternalModelRoutes: 0, scope: 'production SetupChannel and native wizard; loopback simulated model; no renderer or real sign-in',
    networkEvidence: 'only loopback model configured, remote catalogue/update disabled; no packet capture',
    modelRequests: 0, rejectedRequests: 0, scenarios: [], cleanup: {}, failures: [] };
  const model = createServer(async (request, response) => {
    try {
      let raw = '';
      for await (const chunk of request) { raw += chunk; assert.ok(raw.length < 128000); }
      assert.ok(++record.modelRequests <= 2);
      assert.equal(request.method, 'POST'); assert.equal(request.url, '/v1/chat/completions');
      assert.equal(request.headers.authorization, `Bearer ${apiKey}`);
      const body = JSON.parse(raw);
      assert.equal(body.model, MODEL_ID); assert.equal(body.stream, true);
      assert.ok(!body.tools?.length && !body.functions?.length);
      const message = body.messages.findLast(item => item.role === 'user');
      const text = typeof message?.content === 'string' ? message.content
        : message?.content?.filter(part => part.type === 'text').map(part => part.text).join('');
      assert.equal(text, 'Reply with the single word OK. Do not use tools.');
      const base = { id: 'setup-fixture', object: 'chat.completion.chunk', model: MODEL_ID, created: Math.floor(Date.now() / 1000) };
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }] })}\n\n`);
      response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 1, total_tokens: 13 } })}\n\n`);
      response.end('data: [DONE]\n\n');
    } catch {
      ++record.rejectedRequests;
      if (!response.headersSent) response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Synthetic setup fixture rejected request', type: 'fixture_error' } }));
    }
  });
  await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(fixtureConfig(root, model.address().port, apiKey)));
  let child, token = '', timer, cancel;
  const logs = [];
  const remember = message => { logs.push(String(message)); if (logs.length > 8) logs.shift(); };
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => { child = spawn(command, args, { ...options, cwd: root, windowsHide: true }); return child; } });
  const rpc = [];
  class ObservedClient extends GatewayClient {
    async request(method, params, options) {
      const entry = { method, answer: Boolean(params?.answer) }; rpc.push(entry);
      try { const result = await super.request(method, params, options); entry.status = result?.status; entry.done = result?.done; return result; }
      catch (error) { entry.errorCode = error.code; entry.errorMessage = error.message; throw error; }
    }
  }
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    Client: ObservedClient, logger: { warn() {} } });
  const interrupted = new Promise((_, reject) => { cancel = () => reject(new Error('Fixture cancelled')); timer = setTimeout(cancel, timeoutMs); });
  const onMessage = message => { if (message?.type === 'stop') cancel(); };
  process.on('message', onMessage);
  try {
    await Promise.race([(async () => {
      const endpoint = await supervisor.start(); assert.ok(endpoint); token = endpoint.token;
      setup.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token });
      assert.equal(await waitForGatewayReady({ adapter: setup, supervisor, timeoutMs: 240000 }), 'ready');
      supervisor.markReady();
      for (const delayedAnswer of [false, true]) {
        const sessionId = randomUUID(), start = rpc.length;
        let reply = await setup.request('openclaw.setup.activate.start', { kind: 'existing-model', modelRef: MODEL_REF, sessionId });
        if (delayedAnswer) await sleep(4000);
        const steps = [];
        for (let count = 0; count < 20 && reply.done !== true; count++) {
          if (reply.step) {
            steps.push({ type: reply.step.type, executor: reply.step.executor, status: reply.status });
            assert.equal(reply.step.type, 'progress', 'existing-model probe must not need a fabricated user decision');
          }
          const params = { sessionId };
          // This deliberately reproduces beta21 only after the native runner
          // reports done while a progress step is still queued. The production
          // host must recover the terminal result, never assume success.
          if (delayedAnswer && reply.status === 'done' && reply.step) params.answer = { stepId: reply.step.id, value: true };
          reply = await setup.request('wizard.next', params);
        }
        assert.equal(reply.done, true); assert.equal(reply.status, 'done');
        assert.equal(reply.modelActivation?.modelRef, MODEL_REF);
        assert.notEqual(reply.modelActivation?.gatewayRestartRequired, true, 'native hot apply should not require restarting this fixture');
        const calls = rpc.slice(start);
        if (delayedAnswer) assert.ok(calls.some(call => call.errorCode === 'INVALID_REQUEST' && call.errorMessage === 'wizard not running'));
        else assert.equal(calls.some(call => call.answer), false);
        const auth = await setup.request('models.authStatus', { refresh: false });
        assert.ok(Array.isArray(auth.providers));
        const detected = await setup.request('openclaw.setup.detect', {});
        assert.equal(detected.setupComplete, true);
        record.scenarios.push({ name: delayedAnswer ? 'native-late-answer-terminal-recovery' : 'native-progress-without-answer',
          pass: true, steps, calls, modelActivation: { modelRef: reply.modelActivation.modelRef, gatewayRestartRequired: false },
          credentialMetadataReadback: true, setupCompleteReadback: true });
      }
      assert.equal(record.modelRequests, 2); assert.equal(record.rejectedRequests, 0);
    })(), interrupted]);
  } catch (error) { record.failures.push(String(error?.message ?? error).replaceAll(apiKey, '[fixture-key]').replaceAll(root, '[fixture-home]').slice(0, 500)); }
  finally {
    clearTimeout(timer); process.off('message', onMessage); await setup.disconnect();
    try { await supervisor.stop(); } catch { record.failures.push('Owned gateway cleanup failed'); }
    record.cleanup.gatewayExited = !child || child.exitCode !== null || child.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await new Promise(resolve => { model.close(resolve); model.closeAllConnections(); });
    record.cleanup.modelServerClosed = true;
    if (record.failures.length) record.childLogTail = logs.map(line => line.replaceAll(apiKey, '[fixture-key]').replaceAll(token, '[gateway-token]').replaceAll(root, '[fixture-home]').slice(0, 400));
    if (!record.cleanup.gatewayExited || !record.cleanup.supervisorStopped) record.failures.push('Owned gateway did not stop');
  }
  record.pass = record.failures.length === 0;
  process.send?.({ type: 'receipt', record }); return record.pass;
}

async function main() {
  const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
  if (process.argv.includes('--worker')) { const ok = await worker(JSON.parse(value('--worker'))); process.disconnect?.(); process.exitCode = ok ? 0 : 1; return; }
  assert.equal(process.platform, 'win32');
  const resources = path.resolve(value('--resources') ?? path.join(repo, 'apps', 'desktop', 'resources'));
  const output = path.resolve(value('--out') ?? path.join(repo, 'artifacts', 'product-completion', 'native-provider-setup.json'));
  const { node } = fixtureRuntime(resources), timeoutMs = 330000;
  const parent = realpathSync.native(os.tmpdir()), root = realpathSync.native(mkdtempSync(path.join(parent, 'aifb-provider-setup-')));
  const env = isolatedEnvironment(root);
  for (const directory of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, 'workspace')]) mkdirSync(directory, { recursive: true });
  let receipt, forcedCleanup = false;
  const child = spawn(node, [self, '--worker', JSON.stringify({ root, resources, timeoutMs })], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  child.on('message', message => { if (message?.type === 'receipt') receipt = message.record; });
  const timer = setTimeout(() => { if (child.connected) child.send({ type: 'stop' }, () => {}); }, timeoutMs + 5000);
  const force = setTimeout(() => {
    if (child.exitCode !== null) return; forcedCleanup = true;
    spawnSync(path.join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }, timeoutMs + 80000);
  const code = await new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('exit', resolve); });
  clearTimeout(timer); clearTimeout(force);
  receipt ??= { kind: 'AIFB_NATIVE_PROVIDER_SETUP_FIXTURE', realAI: false, pass: false, failures: ['No isolated worker receipt'] };
  receipt.workerExitCode = code; receipt.forcedCleanup = forcedCleanup;
  receipt.pass = receipt.pass && code === 0 && !forcedCleanup;
  assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-provider-setup-'));
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.tempProfileRemoved = false; receipt.pass = false; receipt.failures.push('Temporary fixture cleanup failed'); }
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(`[native provider setup] ${receipt.pass ? 'PASS' : 'FAIL'}; evidence=${output}`); process.exitCode = receipt.pass ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch(error => { console.error(error?.message ?? error); process.exitCode = 1; });
