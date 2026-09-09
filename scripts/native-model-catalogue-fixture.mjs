/** Public model discovery with generated credentials and loopback routes; never sends a model turn. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, realpathSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig } from './native-chat-fixture.mjs';
import { loadModelCatalogue, findSelectableModel } from '../apps/desktop/electron/model-catalogue.mjs';

const self = fileURLToPath(import.meta.url);
async function worker({ root, resources, settings = false }) {
  assert.equal(process.env.AIFB_NATIVE_CHAT_FIXTURE, '1'); assert.equal(process.env.OPENCLAW_HOME, root);
  assert.equal(process.env.OPENCLAW_CONFIG_PATH, path.join(root, 'openclaw.json'));
  const native = fixtureRuntime(resources), { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor, SUPERVISOR_STATES } = await import('../apps/desktop/electron/supervisor.mjs');
  const { GatewayAdapter } = await import('../apps/desktop/electron/gateway-adapter.mjs');
  const { SetupChannel } = await import('../apps/desktop/electron/setup-channel.mjs');
  const { waitForGatewayListener } = await import('../apps/desktop/electron/startup-listener.mjs');
  const { waitForGatewayReady } = await import('../apps/desktop/electron/startup-readiness.mjs');
  const record = { kind: 'AIFB_NATIVE_MODEL_CATALOGUE_FIXTURE', recordedAt: new Date().toISOString(), realAI: false,
    credentialScope: 'Generated keys only; all authored provider endpoints are loopback', runtimeVersion: '2026.9.1',
    evidenceScope: 'Actual pinned Gateway public models.list plus production catalogue and membership helpers; no messages or account entitlement proof',
    sourceHash: createHash('sha256').update(readFileSync(new URL('../apps/desktop/electron/model-catalogue.mjs', import.meta.url))).digest('hex'),
    rpc: [], checks: {}, cleanup: {}, failures: [] };
  let requests = 0;
  const server = createServer((_request, response) => { requests++; response.writeHead(403); response.end('No inference or discovery HTTP allowed'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const apiKey = `fixture-only-${randomUUID()}`, config = fixtureConfig(root, server.address().port, apiKey);
  const openclawRoot = path.dirname(native.entry);
  const providerRows = ['openai', 'anthropic'].map(provider => {
    const manifest = JSON.parse(readFileSync(path.join(openclawRoot, 'dist/extensions', provider, 'openclaw.plugin.json'), 'utf8'));
    const definition = manifest.modelCatalog.providers[provider], first = definition.models.find(model => !model.status);
    assert.ok(first?.id);
    return { provider, definition, first };
  });
  config.models.mode = 'merge'; config.models.providers = {};
  for (const { provider, definition, first } of providerRows) config.models.providers[provider] = {
    baseUrl: `http://127.0.0.1:${server.address().port}/${provider}`, api: definition.api, apiKey,
    agentRuntime: { id: 'openclaw' }, models: [{ id: first.id, name: first.name || first.id, reasoning: Boolean(first.reasoning),
      input: ['text'], contextWindow: first.contextWindow || 128000, maxTokens: 1024 }]
  };
  const primary = `${providerRows[0].provider}/${providerRows[0].first.id}`;
  config.agents.defaults.model = { primary, fallbacks: [] }; config.agents.defaults.utilityModel = primary;
  config.agents.defaults.models = { [primary]: {} }; config.meta = { migrations: { modelPolicyAllowlist: true } };
  config.agents.ownership = 'explicit';
  config.agents.entries.restricted = { name: 'Restricted fixture', workspace: path.join(root, 'restricted'), modelPolicy: { allow: [primary] } };
  config.plugins = { enabled: true, allow: ['openai', 'anthropic'], entries: { openai: { enabled: true }, anthropic: { enabled: true } } };
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  let gatewayChild, stopping = false, token = '', timer;
  const logs = [], remember = value => { logs.push(String(value).slice(0, 500)); if (logs.length > 10) logs.shift(); };
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (gatewayChild = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR, Client: GatewayClient,
    appVersion: '0.0.5-model-catalogue-fixture', logger: { warn() {} } });
  const setup = settings ? new SetupChannel({ stateDirectory: process.env.OPENCLAW_STATE_DIR, Client: GatewayClient, logger: { warn() {} } }) : null;
  const request = async (method, params) => {
    assert.equal(method, 'models.list'); record.rpc.push({ method, params }); return adapter.request(method, params);
  };
  try {
    await Promise.race([(async () => {
      const started = Date.now(), endpoint = await supervisor.start(); token = endpoint.token;
      assert.equal(await waitForGatewayListener({ port: endpoint.port, supervisor, timeoutMs: 240000, shouldStop: () => stopping }), 'ready');
      adapter.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token });
      assert.equal(await waitForGatewayReady({ supervisor, adapter, timeoutMs: 240000, shouldStop: () => stopping }), 'ready');
      supervisor.markReady(); record.startupMs = Date.now() - started;
      if (setup) {
        setup.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token });
        const deadline = Date.now() + 60000;
        while (!setup.connected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
        assert.equal(setup.connected, true);
        const initial = await setup.manage({ action: 'model-settings' });
        const saved = await setup.manage({ action: 'model-settings-save', revision: initial.revision, cacheRetention: 'short', catalogRefresh: false });
        assert.equal(saved.cacheRetention, 'short'); assert.equal(saved.catalogRefresh, false);
        const readback = await setup.manage({ action: 'model-settings' });
        assert.equal(readback.revision, saved.revision);
        await assert.rejects(setup.manage({ action: 'model-settings-save', revision: 'stale', cacheRetention: 'long', catalogRefresh: false }));
        record.checks.settings = { retention: saved.cacheRetention, catalogRefresh: saved.catalogRefresh, applied: saved.applied,
          staleWriteRejected: true, sourceHash: createHash('sha256').update(readFileSync(new URL('../apps/desktop/electron/model-settings.mjs', import.meta.url))).digest('hex') };
      }
      const before = await request('models.list', { agentId: 'fixture', preparedOnly: true });
      const full = await loadModelCatalogue(request, { agentId: 'fixture', refresh: true });
      record.checks.discovery = { preparedCount: before.models.length, fullCount: full.models.length,
        selectableCount: full.models.filter(model => model.selectable).length,
        providers: providerRows.map(({ provider }) => ({ provider, models: full.models.filter(model => model.provider === provider)
          .map(model => ({ id: model.id, available: model.available, selectable: model.selectable, selectionReason: model.selectionReason })) })) };
      assert.ok(full.models.filter(model => model.selectable).length > 2, 'Full discovery must yield more than the two configured starter models');
      assert.ok(full.models.filter(model => model.provider === 'anthropic' && model.selectable).length > 1,
        'Native Anthropic metadata discovery must expand beyond the authored starter');
      assert.deepEqual(full.models.filter(model => model.provider === 'openai' && model.selectable).map(model => model.id),
        config.models.providers.openai.models.map(model => model.id), 'An authored custom OpenAI route must not invent extra model availability');
      record.checks.discovery.openAIAuthoredRouteRespected = true;
      const restricted = await loadModelCatalogue(request, { agentId: 'restricted' });
      const extra = restricted.models.find(model => model.available && !model.selectable);
      assert.ok(extra); assert.equal(await findSelectableModel(request, extra, { agentId: 'restricted' }), null);
      record.checks.policy = { fullRows: restricted.models.length, selectable: restricted.models.filter(model => model.selectable).map(model => `${model.provider}/${model.id}`),
        excludedAvailableRowRejected: true, noPolicyMutation: true };
      assert.deepEqual(record.checks.policy.selectable, [primary]);
      const after = JSON.parse(readFileSync(process.env.OPENCLAW_CONFIG_PATH, 'utf8'));
      assert.equal(after.meta.migrations.modelPolicyAllowlist, true);
      assert.deepEqual(after.agents.defaults.models, config.agents.defaults.models);
      assert.deepEqual(after.agents.entries.restricted.modelPolicy, config.agents.entries.restricted.modelPolicy);
      assert.equal(requests, 0); record.checks.noInference = true;
    })(), new Promise((_, reject) => { timer = setTimeout(() => { stopping = true; reject(new Error('Fixture deadline')); }, 360000); })]);
  } catch (error) { record.failures.push(String(error?.message ?? error).replaceAll(apiKey, '[fixture-key]').replaceAll(token, '[gateway-token]').replaceAll(root, '[fixture-home]')); }
  finally {
    clearTimeout(timer); stopping = true; await setup?.disconnect(); await adapter.disconnect(); await supervisor.stop();
    record.cleanup.gatewayExited = !gatewayChild || gatewayChild.exitCode !== null || gatewayChild.signalCode !== null;
    record.cleanup.supervisorStopped = supervisor.state === SUPERVISOR_STATES.IDLE;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); record.httpRequests = requests;
    record.logTail = logs.map(line => line.replaceAll(apiKey, '[fixture-key]').replaceAll(token, '[gateway-token]').replaceAll(root, '[fixture-home]'));
  }
  record.pass = !record.failures.length && record.cleanup.gatewayExited && record.cleanup.supervisorStopped && requests === 0;
  process.send?.({ type: 'receipt', record }); return record.pass;
}

async function main() {
  const value = name => process.argv[process.argv.indexOf(name) + 1];
  if (process.argv.includes('--worker')) { process.exitCode = await worker(JSON.parse(value('--worker'))) ? 0 : 1; process.disconnect?.(); return; }
  const resources = path.resolve(value('--resources')), output = path.resolve(value('--out'));
  const native = fixtureRuntime(resources), tempParent = realpathSync.native(os.tmpdir());
  const root = realpathSync.native(mkdtempSync(path.join(tempParent, 'aifb-native-models-'))), env = isolatedEnvironment(root);
  for (const dir of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, 'workspace'), path.join(root, 'restricted')]) mkdirSync(dir, { recursive: true });
  const child = spawn(native.node, [self, '--worker', JSON.stringify({ root, resources, settings: process.argv.includes('--settings') })], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let receipt, stderr = '', forced = false; child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-2000); });
  child.on('message', message => { if (message?.type === 'receipt') receipt = message.record; });
  const timer = setTimeout(() => { forced = true; spawnSync(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); }, 440000);
  const exitCode = await new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('exit', resolve); }); clearTimeout(timer);
  receipt ??= { pass: false, failures: [stderr.replaceAll(root, '[fixture-home]') || 'No fixture receipt'] };
  receipt.workerExitCode = exitCode; receipt.forcedCleanup = forced; receipt.pass = receipt.pass && exitCode === 0 && !forced;
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith('aifb-native-models-')) throw new Error('Unsafe fixture cleanup');
  try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; }
  catch { receipt.tempProfileRemoved = false; receipt.pass = false; }
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(`[native model catalogue] ${receipt.pass ? 'PASS' : 'FAIL'} ${output}`); process.exitCode = receipt.pass ? 0 : 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
