import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { WorkerPolicy, restrictSessionCreate, restrictSessionPatch, WorkerNotSubmittedError } from '../../apps/desktop/electron/worker-policy.mjs';
import { GatewayAdapter } from '../../apps/desktop/electron/gateway-adapter.mjs';
import { SetupChannel } from '../../apps/desktop/electron/setup-channel.mjs';

const require = createRequire(new URL('../../apps/desktop/package.json', import.meta.url));
const protocol = await import(pathToFileURL(require.resolve('@openclaw/gateway-protocol')));
const validators = { 'config.get': protocol.validateConfigGetParams, 'config.patch': protocol.validateConfigPatchParams,
  'sessions.describe': protocol.validateSessionsDescribeParams, 'sessions.patch': protocol.validateSessionsPatchParams,
  'tools.effective': protocol.validateToolsEffectiveParams };
const key = 'agent:fixture:aifb-generated';
const ownedConfig = path.resolve('generated-owned-state/openclaw.json');
const snapshot = () => ({ valid: true, path: ownedConfig, hash: 'hash1', configRevisionHash: 'revision1', appliedConfigHash: 'revision1',
  config: { tools: { profile: 'full', deny: ['*'] }, providers: { private: 'NEVER_COPY' } } });

function fixture(overrides = {}) {
  let config = snapshot(), session = { key, sessionId: 'native-id', permissionMode: 'read-only', model: 'preserve-model', label: 'preserve-label' };
  const calls = [];
  const request = async (method, params) => {
    calls.push({ method, params });
    assert.equal(validators[method]?.(params), true, `${method}: ${JSON.stringify(validators[method]?.errors)}`);
    if (overrides[method]) return overrides[method](params);
    if (method === 'config.get') return config;
    if (method === 'config.patch') { config = { ...config, config: { ...config.config, tools: { ...config.config.tools, ...JSON.parse(params.raw).tools } } }; return { ok: true }; }
    if (method === 'sessions.describe') return { session };
    if (method === 'sessions.patch') { session = { ...session, permissionMode: params.permissionMode }; return { ok: true }; }
    if (method === 'tools.effective') return { agentId: 'fixture', profile: 'full', groups: [] };
    throw new Error('Unexpected method');
  };
  return { calls, request, setConfig: next => { config = next; }, setSession: next => { session = next; },
    service: new WorkerPolicy({ request, configPath: ownedConfig }) };
}

test('host policy verifies applied native deny-all and scoped effective tools before a worker turn', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.ensure(key), { verified: true, toolsAllowed: 0, permissionMode: 'read-only', sandbox: false });
  assert.deepEqual(f.calls.map(call => call.method), ['config.get', 'sessions.describe', 'tools.effective']);
});

test('permissive owned config receives a hash-fenced minimal patch and a policy-only backup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'aifb-policy-unit-'));
  try {
    const f = fixture(); f.setConfig({ ...snapshot(), config: { tools: { profile: 'full', deny: ['prior-deny'] }, providerSecret: 'NEVER_COPY' } });
    const backupPath = path.join(root, 'before.json');
    const service = new WorkerPolicy({ request: f.request, configPath: ownedConfig, backupPath });
    await service.ensure();
    const patch = f.calls.find(call => call.method === 'config.patch').params;
    assert.deepEqual(JSON.parse(patch.raw), { tools: { deny: ['prior-deny', '*'] } });
    assert.equal(patch.baseHash, 'hash1'); assert.equal('replacePaths' in patch, false);
    const backup = await readFile(backupPath, 'utf8'); assert.equal(backup.includes('NEVER_COPY'), false);
    assert.deepEqual(JSON.parse(backup).toolsDeny, ['prior-deny']);
    await service.ensure(); assert.equal(f.calls.filter(call => call.method === 'config.patch').length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('foreign path, invalid config and unapplied revision fail without writes or inference', async () => {
  for (const altered of [{ path: path.resolve('another-openclaw/openclaw.json') }, { valid: false }, { hash: '' },
    { appliedConfigHash: 'previous' }, { configRevisionHash: null }, { config: { tools: { deny: 'not-an-array' } } }]) {
    const f = fixture(); f.setConfig({ ...snapshot(), ...altered });
    await assert.rejects(f.service.ensure(key)); assert.deepEqual(f.calls.map(call => call.method), ['config.get']);
  }
});

test('permission tightening uses native session identity and CAS without rewriting model or other metadata', async () => {
  const f = fixture(); f.setSession({ key, sessionId: 'native-id', permissionMode: 'full', model: 'preserve-model' });
  await f.service.ensure(key);
  assert.deepEqual(f.calls.find(call => call.method === 'sessions.patch').params, {
    key, expectedSessionId: 'native-id', expectedPermissionMode: 'full', permissionMode: 'read-only' });
  assert.equal(f.calls.filter(call => call.method === 'sessions.describe').length, 2);
});

test('unknown session, mismatched agent, malformed or available effective tools cannot authorize a send', async () => {
  for (const inventory of [{}, { agentId: 'other', groups: [] }, { agentId: 'fixture', groups: [{}] },
    { agentId: 'fixture', groups: [{ tools: [{ id: 'exec' }] }] }]) {
    const f = fixture({ 'tools.effective': () => inventory }); await assert.rejects(f.service.ensure(key));
  }
  const missing = fixture({ 'sessions.describe': () => ({ session: null }) }); await assert.rejects(missing.service.ensure(key));
  const denied = fixture({ 'tools.effective': () => ({ agentId: 'fixture', groups: [{ tools: [{ id: 'exec', deniedBySession: true }] }] }) });
  assert.equal((await denied.service.ensure(key)).verified, true);
  for (const invalid of ['global', '', 'agent:fixture:', { key }]) await assert.rejects(denied.service.ensure(invalid));
});

test('creation and renderer patch cannot smuggle a task, command, placement or permission escalation', () => {
  assert.deepEqual(restrictSessionCreate({ key: 'aifb-generated', model: 'provider/model' }), { key: 'aifb-generated', model: 'provider/model', permissionMode: 'read-only' });
  for (const field of ['message', 'task', 'fork', 'execNode', 'cwd', 'toolOverrides']) assert.throws(() => restrictSessionCreate({ key, [field]: 'unsafe' }));
  assert.throws(() => restrictSessionCreate({ key, permissionMode: 'full' }));
  assert.equal(restrictSessionCreate({ key, cwd: '/host-owned-project' }, true).permissionMode, 'read-only');
  for (const field of ['permissionMode', 'elevatedLevel', 'execSecurity', 'toolOverrides', 'agentId', 'sendPolicy']) assert.throws(() => restrictSessionPatch({ key, [field]: 'unsafe' }));
  assert.deepEqual(restrictSessionPatch({ key, model: 'provider/model', pinned: true }), { key, model: 'provider/model', pinned: true });
});

test('production adapter calls the host guard and never submits a rejected worker request', async () => {
  let client; const calls = [], guarded = [];
  class Client { constructor(options) { client = { options }; } start() {} async stopAndWait() {}
    async request(method, params) { calls.push({ method, params }); return { ok: true }; } }
  const adapter = new GatewayAdapter({ stateDirectory: '/unused-generated', Client, identityLoader: () => ({ deviceId: 'test' }),
    authorizeWorker: async sessionKey => { guarded.push(sessionKey); if (sessionKey) throw new Error('Policy not verified'); } });
  adapter.connect({ url: 'ws://127.0.0.1:43123', token: 'generated' }); client.options.onHelloOk({ protocol: 4 });
  await adapter.request('sessions.create', { key: 'aifb-generated' });
  assert.equal(calls[0].params.permissionMode, 'read-only');
  await assert.rejects(adapter.request('sessions.send', { key, message: 'generated', idempotencyKey: 'generated' }),
    error => error instanceof WorkerNotSubmittedError && error.code === 'AIFB_WORKER_NOT_SUBMITTED' && /Policy not verified/.test(error.message));
  assert.deepEqual(guarded, [undefined, key]); assert.equal(calls.some(call => call.method === 'sessions.send'), false);
  await assert.rejects(adapter.request('sessions.patch', { key, permissionMode: 'full' })); await adapter.disconnect();
});

test('Stop during host policy verification prevents the still-pending model submission', async () => {
  let options, release; const calls = [];
  class Client { constructor(value) { options = value; } start() {} async stopAndWait() {}
    async request(method, params) { calls.push({ method, params }); return { ok: true }; } }
  const adapter = new GatewayAdapter({ stateDirectory: '/unused-generated', Client, identityLoader: () => ({ deviceId: 'test' }),
    authorizeWorker: () => new Promise(resolve => { release = resolve; }) });
  adapter.connect({ url: 'ws://127.0.0.1:43123', token: 'generated' }); options.onHelloOk({ protocol: 4 });
  const send = adapter.request('sessions.send', { key, message: 'generated', idempotencyKey: 'pending-id' });
  await adapter.request('chat.abort', { sessionKey: key, runId: 'pending-id' }); release();
  await assert.rejects(send, /Đã dừng/); assert.equal(calls.some(call => call.method === 'sessions.send'), false);
  await adapter.disconnect();
});

test('project creation cannot cross a Gateway reconnect during policy verification', async () => {
  let release; const clients = [], calls = [];
  class Client { constructor(options) { clients.push({ options }); } start() {} async stopAndWait() {}
    async request(method) { calls.push(method); return {}; } }
  const setup = new SetupChannel({ stateDirectory: '/unused-generated', Client, identityLoader: () => ({ deviceId: 'test' }) });
  setup.authorizeWorker = () => new Promise(resolve => { release = resolve; });
  setup.connect({ url: 'ws://127.0.0.1:43123', token: 'generated' }); clients[0].options.onHelloOk({ protocol: 4 });
  const created = setup.workspaceRequest('sessions.create', { key, cwd: '/owned-generated-project' });
  await setup.disconnect(); setup.connect({ url: 'ws://127.0.0.1:43124', token: 'generated-new' });
  clients[1].options.onHelloOk({ protocol: 4 }); release();
  await assert.rejects(created, /kết nối lại/); assert.equal(calls.length, 0); await setup.disconnect();
});

test('adapter never labels an ambiguous worker RPC error as not submitted', async () => {
  let options;
  const nativeError = Object.assign(new Error('Connection lost after submission'), { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  class Client { constructor(value) { options = value; } start() {} async stopAndWait() {}
    async request() { throw nativeError; } }
  const adapter = new GatewayAdapter({ stateDirectory: '/unused-generated', Client, identityLoader: () => ({ deviceId: 'test' }),
    authorizeWorker: async () => ({ verified: true }) });
  adapter.connect({ url: 'ws://127.0.0.1:43123', token: 'generated' }); options.onHelloOk({ protocol: 4 });
  await assert.rejects(adapter.request('sessions.send', { key, message: 'generated', idempotencyKey: 'generated' }),
    error => error === nativeError && !(error instanceof WorkerNotSubmittedError));
  await adapter.disconnect();
});
