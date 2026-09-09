import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createChannelConfigForm } from '../../apps/desktop/electron/channel-config-form.mjs';

const configPath = path.resolve('tmp/form-owned/openclaw.json');
const fakeCredential = 'synthetic-private-token-never-an-account';
const fakeGoogle = JSON.stringify({ type: 'service_account', client_email: 'fixture@example.invalid', private_key: '-----BEGIN ' + 'PRIVATE KEY-----\nsynthetic-only\n-----END PRIVATE KEY-----', token_uri: 'https://oauth2.googleapis.com/token' });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function merge(base, patch) { for (const [key, value] of Object.entries(patch)) { if (value && typeof value === 'object' && !Array.isArray(value)) { base[key] ??= {}; merge(base[key], value); } else base[key] = value; } }
function harness(config = {}) {
  const state = { config: structuredClone(config), hash: 'before', patches: [], calls: [], afterPolls: 0, pendingPolls: 0 };
  state.request = async (method, params) => {
    state.calls.push({ method, ...(method !== 'config.patch' ? { params } : {}) });
    if (method === 'config.schema.lookup') return { path: params.path, schema: { type: 'object' }, children: (params.path.split('.').length === 2 ? ['accounts', 'enabled'] : ['enabled', 'botToken', 'token', 'serviceAccount', 'serviceAccountFile', 'audienceType', 'audience', 'appPrincipal', 'webhookUrl']).filter(key => key !== state.missingField).map(key => ({ key })) };
    if (method === 'config.get') {
      await state.onGet?.();
      const result = structuredClone(state.config);
      for (const channel of Object.values(result.channels ?? {})) for (const account of Object.values(channel.accounts ?? {})) for (const key of ['token', 'botToken', 'serviceAccount']) if (account[key]) account[key] = '__OPENCLAW_REDACTED__';
      const pending = state.hash !== 'before' && state.afterPolls++ < state.pendingPolls;
      return { valid: true, path: state.wrongPath ? path.resolve('tmp/foreign/openclaw.json') : configPath, config: result, hash: state.hash, configRevisionHash: `revision-${state.hash}`, appliedConfigHash: pending ? 'older' : `revision-${state.hash}` };
    }
    if (method === 'config.patch') {
      assert.deepEqual(Object.keys(params).sort(), ['baseHash', 'raw'], 'account saves must not schedule a restart message/model turn');
      assert.equal(params.baseHash, state.hash);
      state.patches.push(JSON.parse(params.raw));
      await state.onPatch?.();
      merge(state.config, JSON.parse(params.raw)); state.hash = 'after';
      return state.ack ?? { ok: true, path: configPath, hash: state.hash };
    }
    throw new Error('Unexpected RPC');
  };
  return state;
}
async function next(form, value, check) { return form.next({ stepId: form.step.id, value }, check); }
async function ready(channel, state, id = 'fixture-account', method = 'inline') {
  const form = await createChannelConfigForm(channel, { request: state.request, configPath });
  await next(form, id);
  if (channel === 'googlechat') await next(form, method);
  if (channel !== 'whatsapp') await next(form, channel === 'googlechat' ? method === 'file' ? path.resolve('tmp/generated-service-account.json') : fakeGoogle : fakeCredential);
  if (channel === 'googlechat') {
    await next(form, 'app-url'); await next(form, 'https://chat.example.invalid/googlechat'); await next(form, '100000000000000000001'); await next(form, 'https://chat.example.invalid/googlechat');
  }
  return form;
}

for (const channel of ['zalo', 'discord', 'googlechat', 'whatsapp']) test(`${channel} commits only explicit account, proves redacted revision and preserves policy/other config`, async () => {
  const original = { tools: { deny: ['*'] }, plugins: { entries: { discord: { enabled: true } } }, channels: { [channel]: { dmPolicy: 'pairing', groupPolicy: 'allowlist', accounts: { retained: { enabled: false, name: 'Keep', dmPolicy: 'disabled' } } }, unrelated: { enabled: false } } };
  const state = harness(original), form = await ready(channel, state);
  assert.match(form.step.message, /chưa xác nhận kết nối/u);
  const result = await next(form, true);
  assert.deepEqual(result.accounts, [{ channel, accountId: 'fixture-account' }]);
  assert.equal(result.status, 'done'); assert.equal(form.step, undefined); assert.equal(form.committing, false);
  assert.equal(state.patches.length, 1);
  assert.deepEqual(Object.keys(state.patches[0]), ['channels']);
  assert.deepEqual(Object.keys(state.patches[0].channels[channel]), ['accounts']);
  assert.deepEqual(Object.keys(state.patches[0].channels[channel].accounts), ['fixture-account']);
  assert.deepEqual(state.config.tools, original.tools); assert.deepEqual(state.config.plugins, original.plugins);
  assert.deepEqual(state.config.channels[channel].accounts.retained, original.channels[channel].accounts.retained);
  assert.equal(state.config.channels[channel].dmPolicy, 'pairing'); assert.equal(state.config.channels[channel].groupPolicy, 'allowlist');
  assert.equal(state.config.channels[channel].accounts['fixture-account'].enabled, true);
  assert.equal(JSON.stringify(result).includes(fakeCredential), false); assert.equal(JSON.stringify(result).includes('PRIVATE KEY'), false);
});

test('disabled root is enabled only after an explicit account/channel confirmation', async () => {
  const state = harness({ channels: { discord: { enabled: false, accounts: { preserved: { enabled: false } } }, zalo: { enabled: false } } });
  const form = await ready('discord', state);
  assert.match(form.step.message, /cũng bật lại kênh/u);
  await next(form, true);
  assert.equal(state.config.channels.discord.enabled, true);
  assert.deepEqual(state.config.channels.discord.accounts.preserved, { enabled: false });
  assert.equal(state.config.channels.zalo.enabled, false);
});

test('Google file method stays a public path reference and does not copy or open the file', async () => {
  const state = harness(), form = await ready('googlechat', state, 'file-account', 'file');
  assert.equal((await next(form, true)).status, 'done');
  const saved = state.config.channels.googlechat.accounts['file-account'];
  assert.equal(saved.serviceAccountFile, path.resolve('tmp/generated-service-account.json'));
  assert.equal(saved.serviceAccount, undefined);
});

test('Google app-url derives numeric app principal from supplied JSON without an extra prompt', async () => {
  const state = harness(), form = await createChannelConfigForm('googlechat', { request: state.request, configPath });
  await next(form, 'app'); await next(form, 'inline');
  await next(form, JSON.stringify({ ...JSON.parse(fakeGoogle), client_id: '100000000000000000001' }));
  await next(form, 'app-url'); await next(form, 'https://chat.example.invalid/googlechat');
  assert.ok(form.step.id.endsWith(':webhookUrl'));
  await next(form, 'https://chat.example.invalid/googlechat'); await next(form, true);
  assert.equal(state.config.channels.googlechat.accounts.app.appPrincipal, '100000000000000000001');
});

test('Google file cannot silently lose to an existing inline credential', async () => {
  const state = harness({ channels: { googlechat: { accounts: { 'fixture-account': { serviceAccount: fakeGoogle } } } } });
  const form = await ready('googlechat', state, 'fixture-account', 'file');
  await assert.rejects(next(form, true), /JSON trực tiếp/u);
  assert.equal(state.patches.length, 0); form.cancel();
});

test('secret inputs have no echo; invalid data stays at the same step and never writes', async () => {
  const state = harness(), form = await createChannelConfigForm('googlechat', { request: state.request, configPath });
  await next(form, 'default'); await next(form, 'inline');
  assert.equal(form.step.sensitive, true); assert.equal(form.step.multiline, true); assert.equal(form.step.initialValue, undefined);
  const id = form.step.id;
  for (const input of ['not-json', '{}', fakeGoogle.replace('https://oauth2.googleapis.com/token', 'https://untrusted.invalid/token'), 'x'.repeat(65537)]) {
    await assert.rejects(next(form, input), error => !error.message.includes(input));
    assert.equal(form.step.id, id);
  }
  assert.equal(state.patches.length, 0); form.cancel();
});

test('only the four fixed channels and a valid owned config path are accepted', async () => {
  for (const channel of ['telegram', 'slack', '__proto__', 'unknown']) await assert.rejects(createChannelConfigForm(channel, { request: harness().request, configPath }), /Bộ chạy/u);
  await assert.rejects(createChannelConfigForm('zalo', { request: harness().request, configPath: 'relative.json' }), /Bộ chạy/u);
  const wrong = harness(); wrong.wrongPath = true;
  await assert.rejects(createChannelConfigForm('zalo', { request: wrong.request, configPath }), /Bộ chạy/u);
});

test('native schema must expose every narrow account field before collecting credentials', async () => {
  const state = harness(), form = await createChannelConfigForm('zalo', { request: state.request, configPath });
  state.missingField = 'botToken';
  await assert.rejects(next(form, 'default'), /Bộ chạy/u);
  assert.match(form.step.id, /:accountId$/u); assert.equal(state.patches.length, 0);
});

test('traversal, object keys, stale step IDs and extra request fields cannot target another account', async () => {
  const state = harness(), form = await createChannelConfigForm('discord', { request: state.request, configPath });
  for (const id of ['../main', 'a.b', '__proto__', 'constructor', 'prototype', 'x'.repeat(65)]) await assert.rejects(next(form, id));
  const stale = form.step.id; await next(form, 'default');
  await assert.rejects(form.next({ stepId: stale, value: fakeCredential }), /đã thay đổi/u);
  await assert.rejects(form.next({ stepId: form.step.id, value: fakeCredential, channel: 'zalo' }));
  assert.equal(state.patches.length, 0);
});

test('cancel/decline clears secrets and never sends a native patch', async () => {
  for (const cancel of [form => form.cancel(), form => next(form, false)]) {
    const state = harness(), form = await ready('zalo', state);
    assert.equal((await cancel(form)).status, 'cancelled'); assert.equal(form.step, undefined);
    await assert.rejects(form.next({ stepId: 'old', value: true }), /đã đóng/u); assert.equal(state.patches.length, 0);
  }
});

test('changed config, even unrelated changes, prevents overwriting state read before confirmation', async () => {
  const state = harness(), form = await ready('discord', state);
  state.hash = 'new-external-revision';
  await assert.rejects(next(form, true), /Cấu hình đã thay đổi/u);
  assert.equal(state.patches.length, 0); assert.match(form.step.id, /:confirm$/u); form.cancel();
});

test('Stop during pre-write read latches cancellation without native submission', async () => {
  const state = harness(), form = await ready('zalo', state), gate = deferred();
  state.onGet = () => gate.promise;
  const pending = next(form, true); await Promise.resolve(); form.cancel(); gate.resolve();
  await assert.rejects(pending, /đã đóng/u); assert.equal(state.patches.length, 0);
});

test('a stale connection check fails before persistence', async () => {
  const state = harness(), form = await ready('zalo', state);
  await assert.rejects(next(form, true, () => { throw new Error('Disconnected'); }), /Disconnected/u);
  assert.equal(state.patches.length, 0); form.cancel();
});

test('only one commit is possible and cancellation cannot claim success while an ACK is outstanding', async () => {
  const state = harness(), form = await ready('discord', state), gate = deferred(), entered = deferred();
  state.onPatch = () => { entered.resolve(); return gate.promise; };
  const pending = next(form, true); await entered.promise;
  assert.equal(form.committing, true);
  assert.throws(() => form.cancel(), /Đang xác nhận/u);
  await assert.rejects(next(form, true), /Đang xử lý/u);
  gate.resolve(); assert.equal((await pending).status, 'done'); assert.equal(state.patches.length, 1);
});

test('native error text, unknown ACK and mismatched readback never expose credentials or claim saved', async () => {
  for (const fault of ['reject', 'ack', 'readback', 'stale-after-write']) {
    const state = harness(), form = await ready('discord', state);
    if (fault === 'reject') state.onPatch = () => { throw new Error(`Secret: ${fakeCredential}`); };
    if (fault === 'ack') state.ack = { ok: true, path: configPath };
    if (fault === 'readback') state.ack = { ok: true, path: configPath, hash: 'unrelated' };
    let current = true;
    if (fault === 'stale-after-write') state.onPatch = () => { current = false; };
    const result = await next(form, true, () => { if (!current) throw new Error('Old connection'); });
    assert.equal(result.status, 'error'); assert.equal(result.done, true); assert.equal(form.step, undefined);
    assert.equal(JSON.stringify(result).includes(fakeCredential), false); assert.match(result.error, /có thể đã được lưu/u);
  }
});

test('a briefly delayed applied revision is polled without submitting the patch twice', async () => {
  const state = harness(), form = await ready('discord', state); state.pendingPolls = 1;
  assert.equal((await next(form, true)).status, 'done');
  assert.equal(state.patches.length, 1); assert.equal(state.afterPolls, 2);
});

test('WhatsApp creates only an enabled account, collects no credential and leaves QR to the explicit login flow', async () => {
  const state = harness(), form = await createChannelConfigForm('whatsapp', { request: state.request, configPath });
  assert.match(form.step.id, /:accountId$/u);
  await next(form, 'phone-fixture');
  assert.match(form.step.id, /:confirm$/u); assert.match(form.step.message, /mã QR/u);
  assert.equal(form.step.sensitive, undefined); assert.equal(state.patches.length, 0);
  const result = await next(form, true);
  assert.equal(result.status, 'done'); assert.match(result.message, /chưa xác nhận đã liên kết/u);
  assert.deepEqual(result.accounts, [{ channel: 'whatsapp', accountId: 'phone-fixture' }]);
  assert.deepEqual(state.patches, [{ channels: { whatsapp: { accounts: { 'phone-fixture': { enabled: true } } } } }]);
  assert.equal(Object.hasOwn(result, 'configured'), false); assert.equal(Object.hasOwn(result, 'linked'), false);
  assert.ok(state.calls.every(call => ['config.schema.lookup', 'config.get', 'config.patch'].includes(call.method)));
});

test('WhatsApp keeps native auth directory, policies and disabled sibling accounts when explicitly enabling the root', async () => {
  const original = { channels: { whatsapp: { enabled: false, defaultAccount: 'retained', dmPolicy: 'pairing', groupPolicy: 'disabled', accounts: {
    retained: { enabled: false, name: 'Retained', authDir: '/native/retained' },
    'phone-fixture': { enabled: false, name: 'Chosen', authDir: '/native/chosen', dmPolicy: 'disabled', selfChatMode: true }
  } } } };
  const state = harness(original), form = await ready('whatsapp', state, 'phone-fixture');
  assert.match(form.step.message, /cũng bật lại kênh/u);
  assert.equal((await next(form, true)).status, 'done');
  assert.deepEqual(state.patches, [{ channels: { whatsapp: { enabled: true, accounts: { 'phone-fixture': { enabled: true } } } } }]);
  original.channels.whatsapp.enabled = true; original.channels.whatsapp.accounts['phone-fixture'].enabled = true;
  assert.deepEqual(state.config, original);
});

test('WhatsApp account setup requires its native enabled schema and confirmed persistence', async () => {
  const missing = harness(), schemaForm = await createChannelConfigForm('whatsapp', { request: missing.request, configPath });
  missing.missingField = 'enabled';
  await assert.rejects(next(schemaForm, 'default'), /Bộ chạy/u); assert.equal(missing.patches.length, 0); schemaForm.cancel();
  const declined = harness(), declinedForm = await ready('whatsapp', declined);
  assert.equal((await next(declinedForm, false)).status, 'cancelled'); assert.equal(declined.patches.length, 0);
  const uncertain = harness(), uncertainForm = await ready('whatsapp', uncertain);
  uncertain.ack = { ok: true, path: configPath };
  const result = await next(uncertainForm, true);
  assert.equal(result.status, 'error'); assert.equal(result.accounts, undefined); assert.match(result.error, /có thể đã được lưu/u);
});
