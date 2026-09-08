import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers';
import { ChannelSetupService } from '../../apps/desktop/electron/channel-setup-service.mjs';

async function fixture(t, overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-channel-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const plugins = ['zalo', 'whatsapp', 'discord', 'googlechat'].map(id => ({ id, name: `@openclaw/${id}`, version: '2026.9.1', spec: `@openclaw/${id}@2026.9.1`, integrity: `sha512-${id}` }));
  await fs.writeFile(path.join(root, 'channel-installer.json'), JSON.stringify({ coreVersion: '2026.9.1', plugins }));
  await fs.mkdir(path.join(root, 'npm/node_modules/npm/bin'), { recursive: true }); await fs.writeFile(path.join(root, 'npm/node_modules/npm/bin/npm-cli.js'), '');
  await fs.mkdir(path.join(root, 'cache'));
  const configPath = path.join(root, 'openclaw.json'); const calls = []; let installed = false; let enabled = false; let restarts = 0;
  const config = { plugins: { load: { paths: ['/prior'] }, allow: ['prior'], deny: ['blocked'], entries: { prior: { enabled: true, config: { preserve: true } } } }, channels: { prior: { token: 'secret' } } };
  const request = async (method, params) => {
    calls.push({ method, params });
    if (overrides[method]) return overrides[method](params);
    if (method === 'config.get') return { valid: true, config, path: configPath, hash: 'revision' };
    if (method === 'config.schema.lookup') return { path: params.path, children: ['accounts', 'enabled', 'botToken', 'token', 'serviceAccount', 'serviceAccountFile', 'audienceType', 'audience', 'webhookUrl'].map(key => ({ key })) };
    if (method === 'config.patch') { const patch = JSON.parse(params.raw); config.plugins.load.paths = patch.plugins.load.paths; Object.assign(config.plugins.entries, patch.plugins.entries); return { ok: true }; }
    if (method === 'plugins.list') return { plugins: [{ id: 'zalo', installed, enabled }] };
    if (method === 'plugins.inspect') return { plugin: { installed, version: '2026.9.1', origin: 'global' }, source: { kind: 'npm', spec: '@openclaw/zalo@2026.9.1', packageName: '@openclaw/zalo', integrity: 'sha512-zalo' } };
    if (method === 'plugins.setEnabled') { enabled = true; return { restartRequired: false }; }
    if (method === 'wizard.start') return { sessionId: 'owned', done: false, step: { id: 'token', type: 'text', sensitive: true, initialValue: 'never-return-this-token' } };
    if (method === 'wizard.cancel') return { status: 'cancelled' };
    return {};
  };
  const service = new ChannelSetupService({ request, bundleRoot: root, configPath, restartRuntime: async () => { restarts++; service.clear(); },
    installPlugin: async id => { calls.push({ method: 'native-exact-install', params: { id } }); installed = true; } });
  return { service, calls, config, root, restarts: () => restarts };
}
test('bundle read is offline, projects only available official identities and never exposes installation paths', async t => {
  const f = await fixture(t); const value = await f.service.run({ action: 'channel-bundle-status' });
  assert.equal(value.channels.length, 5); assert.ok(value.channels.every(row => row.available)); assert.equal(f.calls.length, 0);
  assert.equal(JSON.stringify(value).includes(f.root), false);
});
test('native exact installation preserves other config, verifies public source and planned restart survives clear', async t => {
  const f = await fixture(t); const result = await f.service.run({ action: 'channel-setup', channel: 'zalo' });
  assert.equal(result.step.initialValue, 'default'); assert.equal(result.step.sensitive, false); assert.equal(f.restarts(), 1);
  assert.equal(result.setupRoute, 'native-config'); assert.ok(result.step.id.endsWith(':accountId'));
  assert.deepEqual(f.config.plugins.allow, ['prior']); assert.deepEqual(f.config.plugins.deny, ['blocked']);
  assert.deepEqual(f.config.plugins.entries.prior, { enabled: true, config: { preserve: true } }); assert.equal(f.config.channels.prior.token, 'secret');
  assert.deepEqual(f.calls.filter(call => call.method === 'plugins.setEnabled').map(call => call.params), [{ pluginId: 'zalo', enabled: true }]);
  assert.deepEqual(f.config.plugins.load.paths, ['/prior']);
  assert.equal(f.calls.filter(call => call.method === 'native-exact-install').length, 1);
  assert.equal(f.calls.some(call => call.method === 'config.patch'), false);
  assert.equal(f.service.handles({ action: 'channel-next', sessionId: result.sessionId }), true);
  assert.equal(f.service.handles({ action: 'channel-next', sessionId: 'other' }), false);
  assert.equal(f.service.handles({ action: 'channel-setup', channel: 'slack' }), false);
  await f.service.run({ action: 'channel-cancel', sessionId: result.sessionId });
  assert.equal(f.calls.some(call => call.method.startsWith('wizard.')), false, 'compatibility form must never re-enter native installer wizard');
  await f.service.run({ action: 'channel-setup', channel: 'zalo' }); assert.equal(f.restarts(), 1, 'already registered bundle must not restart again');
});

test('existing plugin from a local source is never mistaken for a trusted official installation or overwritten', async t => {
  const f = await fixture(t, { 'plugins.list': () => ({ plugins: [{ id: 'zalo', installed: true, enabled: true }] }),
    'plugins.inspect': () => ({ plugin: { installed: true, origin: 'config', version: '2026.9.1' }, source: { kind: 'path' } }) });
  await assert.rejects(f.service.run({ action: 'channel-setup', channel: 'zalo' }), /nguồn/u);
  assert.equal(f.calls.some(call => call.method === 'native-exact-install' || call.method === 'wizard.start'), false);
});

test('installed WhatsApp uses schema-checked account and confirmation steps without re-entering native plugin installation', async t => {
  const f = await fixture(t, { 'plugins.list': () => ({ plugins: [{ id: 'whatsapp', installed: true, enabled: true }] }),
    'plugins.inspect': () => ({ plugin: { installed: true, origin: 'global', version: '2026.9.1' },
      source: { kind: 'npm', spec: '@openclaw/whatsapp@2026.9.1', packageName: '@openclaw/whatsapp', integrity: 'sha512-whatsapp' } }) });
  const first = await f.service.run({ action: 'channel-setup', channel: 'whatsapp' });
  assert.equal(first.setupRoute, 'native-config'); assert.ok(first.step.id.endsWith(':accountId'));
  const confirm = await f.service.run({ action: 'channel-next', sessionId: first.sessionId, answer: { stepId: first.step.id, value: 'new-account' } });
  assert.equal(confirm.step.type, 'confirm'); assert.equal(confirm.step.confirmLabel, 'Lưu và bật tài khoản');
  await f.service.run({ action: 'channel-cancel', sessionId: first.sessionId });
  assert.equal(f.calls.some(call => call.method.startsWith('wizard.') || call.method.startsWith('web.login.') || call.method === 'config.patch'), false);
});

test('installer exit alone cannot authorize a wizard without exact native integrity readback', async t => {
  const f = await fixture(t, { 'plugins.inspect': () => ({ plugin: { installed: true, origin: 'global', version: '2026.9.1' },
    source: { kind: 'npm', spec: '@openclaw/zalo@2026.9.1', packageName: '@openclaw/zalo', integrity: 'sha512-changed' } }) });
  await assert.rejects(f.service.run({ action: 'channel-setup', channel: 'zalo' }), /nguồn chính thức/u);
  assert.equal(f.calls.some(call => call.method === 'wizard.start'), false);
});

test('only old exact app bundle paths are removed; unrelated paths and policy remain', async t => {
  const f = await fixture(t);
  f.config.plugins.load.paths.push(path.join(path.dirname(f.root), 'channel-plugins/node_modules/@openclaw/zalo'));
  await f.service.run({ action: 'channel-setup', channel: 'zalo' });
  assert.deepEqual(f.config.plugins.load.paths, ['/prior']); assert.deepEqual(f.config.plugins.allow, ['prior']);
  assert.equal(f.restarts(), 2, 'one migration restart and one managed installation restart');
  assert.deepEqual(Object.keys(f.calls.find(call => call.method === 'config.patch').params).sort(), ['baseHash', 'raw'], 'migration must not wake the system model');
});
test('Telegram uses existing core and unplanned connection change rejects stale wizard', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { 'wizard.start': () => pending });
  const task = f.service.run({ action: 'channel-setup', channel: 'telegram' }); await new Promise(resolve => setImmediate(resolve));
  f.service.clear(); release({ sessionId: 'stale', done: false, step: { id: 'x', type: 'note' } });
  await assert.rejects(task); assert.deepEqual(f.calls.map(call => call.method), ['wizard.start', 'wizard.cancel']);
});
test('deny and global disabled policies cannot be bypassed; arbitrary package/config/path denied', async t => {
  const f = await fixture(t); f.config.plugins.deny.push('zalo');
  await assert.rejects(f.service.run({ action: 'channel-setup', channel: 'zalo' }), /chặn/u);
  f.config.plugins.deny = []; f.config.plugins.enabled = false;
  await assert.rejects(f.service.run({ action: 'channel-setup', channel: 'zalo' }), /chặn/u);
  for (const payload of [{ action: 'plugins.install', packageName: 'x' }, { action: 'channel-setup', channel: 'zalo', path: 'x' }, { action: 'channel-qr-start', channel: 'zalo', accountId: 'default' }]) await assert.rejects(f.service.run(payload));
  assert.equal(f.calls.filter(call => call.method !== 'config.get').length, 0);
});
test('native terminal race is recovered by no-answer next; raw done:false/status:done is not premature success', async t => {
  let count = 0; const f = await fixture(t, { 'wizard.next': params => {
    count++; if (params.answer) throw new Error('wizard not running');
    return { done: true, status: 'done', accounts: [{ channel: 'telegram', accountId: 'default' }] };
  } });
  await f.service.run({ action: 'channel-setup', channel: 'telegram' });
  const result = await f.service.run({ action: 'channel-next', sessionId: 'owned', answer: { stepId: 'token', value: 'generated-not-real' } });
  assert.equal(result.done, true); assert.equal(count, 2); assert.deepEqual(result.accounts, [{ channel: 'telegram', accountId: 'default' }]);
});
test('QR is WhatsApp-only, PNG-only, ticket-owned and stale results cannot restore a closed QR', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { 'channels.status': () => ({ channelAccounts: { whatsapp: [{ accountId: 'default', configured: true }] } }),
    'web.login.start': () => ({ qrDataUrl: 'data:text/html;base64,AAAA', connected: false }), 'web.login.wait': () => pending });
  const started = await f.service.run({ action: 'channel-qr-start', channel: 'whatsapp', accountId: 'default' }); assert.equal(started.qrDataUrl, null);
  await assert.rejects(f.service.run({ action: 'channel-qr-wait', ticket: 'foreign' }));
  const waiting = f.service.run({ action: 'channel-qr-wait', ticket: started.ticket }); await new Promise(resolve => setImmediate(resolve));
  await f.service.run({ action: 'channel-qr-clear', ticket: started.ticket }); release({ connected: true }); await assert.rejects(waiting, /đóng/u);
  assert.equal(f.calls.find(call => call.method === 'web.login.start').params.force, false);
});

test('unpaired WhatsApp account can request its first QR; configured is not a login prerequisite', async t => {
  const f = await fixture(t, { 'channels.status': () => ({ channelAccounts: { whatsapp: [{ accountId: 'new-account', configured: false, linked: false, enabled: true }] } }),
    'web.login.start': () => ({ qrDataUrl: 'data:image/png;base64,AAAA', connected: false }) });
  const started = await f.service.run({ action: 'channel-qr-start', channel: 'whatsapp', accountId: 'new-account' });
  assert.equal(started.connected, false); assert.equal(started.qrDataUrl, 'data:image/png;base64,AAAA');
  assert.deepEqual(f.calls.at(-1).params, { accountId: 'new-account', timeoutMs: 20000, force: false });
  await assert.rejects(f.service.run({ action: 'channel-qr-start', channel: 'whatsapp', accountId: 'unknown' }), /thiết lập/u);
  assert.equal(f.calls.filter(call => call.method === 'web.login.start').length, 1);
});

test('disabled account or disconnected status read cannot start a QR login', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { 'channels.status': () => pending });
  const start = f.service.run({ action: 'channel-qr-start', channel: 'whatsapp', accountId: 'default' });
  await new Promise(resolve => setImmediate(resolve)); f.service.clear();
  release({ channelAccounts: { whatsapp: [{ accountId: 'default', configured: false, enabled: true }] } });
  await assert.rejects(start, /thay đổi/u); assert.equal(f.calls.some(call => call.method === 'web.login.start'), false);
  const disabled = await fixture(t, { 'channels.status': () => ({ channelAccounts: { whatsapp: [{ accountId: 'default', enabled: false }] } }) });
  await assert.rejects(disabled.service.run({ action: 'channel-qr-start', channel: 'whatsapp', accountId: 'default' }), /bật tài khoản/u);
  assert.equal(disabled.calls.some(call => call.method === 'web.login.start'), false);
});

test('owned cancellation can interrupt pending next and late response cannot restore the wizard', async t => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { 'wizard.next': () => pending });
  await f.service.run({ action: 'channel-setup', channel: 'telegram' });
  const next = f.service.run({ action: 'channel-next', sessionId: 'owned' });
  await new Promise(resolve => setImmediate(resolve));
  const cancelled = await f.service.run({ action: 'channel-cancel', sessionId: 'owned' });
  assert.equal(cancelled.status, 'cancelled');
  release({ done: false, step: { id: 'later', type: 'text' } });
  await assert.rejects(next, /thay đổi/u);
  assert.equal(f.service.handles({ action: 'channel-next', sessionId: 'owned' }), false);
  await f.service.run({ action: 'channel-setup', channel: 'telegram' });
});

test('unexpected disconnect retains only cancel ownership and cleans the old native wizard before new setup', async t => {
  const f = await fixture(t);
  await f.service.run({ action: 'channel-setup', channel: 'telegram' }); f.service.clear();
  assert.equal(f.service.handles({ action: 'channel-next', sessionId: 'owned' }), false);
  assert.equal(f.service.handles({ action: 'channel-cancel', sessionId: 'owned' }), true);
  const previousCount = f.calls.length;
  await f.service.run({ action: 'channel-setup', channel: 'telegram' });
  assert.deepEqual(f.calls.slice(previousCount).map(call => call.method), ['wizard.cancel', 'wizard.start']);
});

test('only authoritative missing wizard releases retired ownership; ambiguous cancellation failure stays retryable', async t => {
  let missing = false;
  const f = await fixture(t, { 'wizard.cancel': () => { throw new Error(missing ? 'wizard not found' : 'disconnected'); } });
  await f.service.run({ action: 'channel-setup', channel: 'telegram' }); f.service.clear();
  await assert.rejects(f.service.run({ action: 'channel-cancel', sessionId: 'owned' }), /disconnected/u);
  assert.equal(f.service.handles({ action: 'channel-cancel', sessionId: 'owned' }), true);
  missing = true; assert.equal((await f.service.run({ action: 'channel-cancel', sessionId: 'owned' })).done, true);
  assert.equal(f.service.handles({ action: 'channel-cancel', sessionId: 'owned' }), false);
});
test('pairing approval verifies exact native request/account and sends no notification or owner bootstrap', async t => {
  const f = await fixture(t, { 'channels.pairing.list': () => ({ requests: [{ requestId: 'request', channel: 'telegram', accountId: 'default', senderId: '123' }] }),
    'channels.pairing.approve': () => ({ requestId: 'request' }) });
  await assert.rejects(f.service.run({ action: 'channel-pairing-approve', channel: 'telegram', accountId: 'other', requestId: 'request' }));
  assert.deepEqual(await f.service.run({ action: 'channel-pairing-approve', channel: 'telegram', accountId: 'default', requestId: 'request' }), { ok: true });
  assert.deepEqual(f.calls.at(-1).params, { channel: 'telegram', accountId: 'default', requestId: 'request', notify: false, bootstrapCommandOwner: false });
});
