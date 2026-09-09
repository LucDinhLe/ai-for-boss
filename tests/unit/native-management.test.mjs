import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeManagement, scheduleDraft, isManagedJob } from '../../apps/desktop/electron/native-management.mjs';

const sessionKey = 'agent:fixture:test';
const requestId = '12345678-1234-4123-8123-123456789012';
const draft = { name: 'Planning', message: 'Generated planning text.', frequency: 'weekdays', time: '08:30', timeZone: 'Asia/Ho_Chi_Minh', enabled: false };
const catalogue = { version: '2026.9.1', channels: [{ id: 'telegram', bundled: true }] };
const job = () => ({ ...scheduleDraft(draft), id: 'job', agentId: 'fixture', declarationKey: `aifb-schedule:${requestId}`, configRevision: 'rev1' });
function fixture(impl = () => ({})) { const calls = []; return { calls, service: new NativeManagement(async (method, params) => { calls.push({ method, params }); return impl(method, params); }, catalogue) }; }

test('management rejects arbitrary methods, credentials, commands, recipients and unknown fields before dispatch', async () => {
  const f = fixture();
  for (const input of [null, { action: 'config.patch' }, { action: 'catalog', path: 'private' },
    { action: 'skill-toggle', sessionKey, skillKey: 'test', enabled: true, apiKey: 'secret' },
    { action: 'channel-setup', channel: 'signal' },
    { action: 'cron-create', sessionKey, requestId, draft: { ...draft, command: 'exec' } },
    { action: 'cron-create', sessionKey, requestId, draft: { ...draft, delivery: { to: 'other' } } },
    { action: 'cron-create', sessionKey: 'other-session', requestId, draft }]) await assert.rejects(f.service.run(input));
  assert.equal(f.calls.length, 0);
});
test('schedule is bounded text-only, isolated, explicit timezone and no delivery or tools', () => {
  const result = scheduleDraft(draft);
  assert.equal(result.schedule.expr, '30 8 * * 1-5'); assert.equal(result.schedule.tz, draft.timeZone);
  assert.deepEqual(result.payload.toolsAllow, []); assert.deepEqual(result.delivery, { mode: 'none' });
  assert.equal(result.failureAlert, false); assert.equal(result.sessionTarget, 'isolated');
  for (const update of [{ time: '25:00' }, { time: '12:60' }, { frequency: 'command' }, { timeZone: 'bad/time' }, { enabled: 'true' }, { message: '' }]) assert.throws(() => scheduleDraft({ ...draft, ...update }));
});
test('skill toggle requires native membership, requirements and post-write readback', async () => {
  let disabled = true;
  const f = fixture((method, params) => {
    if (method === 'skills.status') return { skills: [{ skillKey: 'test', disabled, missing: {} }] };
    disabled = !params.enabled; return { ok: true, config: { neverExpose: 'value' } };
  });
  assert.deepEqual(await f.service.run({ action: 'skill-toggle', sessionKey, skillKey: 'test', enabled: true }), { ok: true });
  assert.deepEqual(f.calls.map(c => c.method), ['skills.status', 'skills.update', 'skills.status']);
  assert.deepEqual(f.calls[1].params, { skillKey: 'test', enabled: true });
  const blocked = fixture(() => ({ skills: [{ skillKey: 'test', disabled: true, missing: { bins: ['binary'] } }] }));
  await assert.rejects(blocked.service.run({ action: 'skill-toggle', sessionKey, skillKey: 'test', enabled: true }));
  assert.equal(blocked.calls.length, 1);
});
test('Telegram wizard is targeted, owned and rejects stale steps or foreign wizard IDs', async () => {
  const f = fixture(method => method === 'wizard.start' ? { sessionId: 'owned', step: { id: 'step', type: 'text', sensitive: true } }
    : { status: 'cancelled' });
  await f.service.run({ action: 'channel-setup', channel: 'telegram' });
  assert.deepEqual(f.calls[0], { method: 'wizard.start', params: { flow: 'channels', channel: 'telegram' } });
  for (const input of [{ action: 'channel-next', sessionId: 'foreign' }, { action: 'channel-next', sessionId: 'owned', answer: { stepId: 'stale', value: 'x' } }]) await assert.rejects(f.service.run(input));
  assert.equal(f.calls.length, 1);
  await f.service.run({ action: 'channel-cancel', sessionId: 'owned' });
  await assert.rejects(f.service.run({ action: 'channel-next', sessionId: 'owned' }));
});
test('channel start requires exact configured account and cannot select another account', async () => {
  const f = fixture(method => method === 'channels.start' ? { started: true } : ({ channelAccounts: { telegram: [{ accountId: 'known', configured: true, running: true }] } }));
  await assert.rejects(f.service.run({ action: 'channel-start', channel: 'telegram', accountId: 'foreign' }));
  assert.equal((await f.service.run({ action: 'channel-start', channel: 'telegram', accountId: 'known' })).ok, true);
  assert.deepEqual(f.calls.at(-2), { method: 'channels.start', params: { channel: 'telegram', accountId: 'known' } });
});

test('channel retry is not a success and only exact-account readback confirms stop', async () => {
  const f = fixture(method => method === 'channels.start' ? { started: false, outcome: { status: 'retry', reason: 'account-not-ready' } }
    : { channelAccounts: { telegram: [{ accountId: 'known', configured: true, running: false }] } });
  const result = await f.service.run({ action: 'channel-start', channel: 'telegram', accountId: 'known' });
  assert.equal(result.ok, false); assert.equal(result.status, 'retry'); assert.equal(result.reason, 'account-not-ready'); assert.ok(result.error);
  assert.equal((await f.service.run({ action: 'channel-stop', channel: 'telegram', accountId: 'known' })).ok, true);
});

test('channel wizard accepts installed catalogue channels and rejects missing or arbitrary plugins', async () => {
  const calls = [], catalog = { channels: [{ id: 'slack', bundled: false, packageName: '@openclaw/slack' }] };
  let installed = false;
  const service = new NativeManagement(async (method, params) => { calls.push({ method, params });
    return method === 'plugins.list' ? { plugins: [{ id: 'slack', packageName: '@openclaw/slack', installed, enabled: true }] }
      : { sessionId: 'native', step: { id: 's', type: 'text' } }; }, catalog);
  await assert.rejects(service.run({ action: 'channel-setup', channel: 'slack' }), /cài plugin/);
  installed = true; await service.run({ action: 'channel-setup', channel: 'slack' });
  assert.deepEqual(calls.at(-1), { method: 'wizard.start', params: { flow: 'channels', channel: 'slack' } });
  const before = calls.length; await assert.rejects(service.run({ action: 'channel-setup', channel: 'arbitrary' })); assert.equal(calls.length, before);
});

test('plugin enable is an explicit installed-only write with readback and restart truth', async () => {
  let enabled = false;
  const plugin = () => ({ id: 'document-extract', name: 'Document extract', installed: true, enabled, state: enabled ? 'enabled' : 'disabled' });
  const f = fixture((method, params) => {
    if (method === 'plugins.list') return { plugins: [plugin()], mutationAllowed: true, diagnostics: [] };
    assert.equal(method, 'plugins.setEnabled'); enabled = params.enabled;
    return { ok: true, plugin: plugin(), restartRequired: true, warnings: ['Restart needed'], config: 'PRIVATE' };
  });
  const result = await f.service.run({ action: 'plugin-toggle', pluginId: 'document-extract', enabled: true });
  assert.equal(result.plugin.enabled, true); assert.equal(result.restartRequired, true); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.deepEqual(f.calls.map(item => item.method), ['plugins.list', 'plugins.setEnabled', 'plugins.list']);
  assert.deepEqual(f.calls[1].params, { pluginId: 'document-extract', enabled: true });
  const repeat = await f.service.run({ action: 'plugin-toggle', pluginId: 'document-extract', enabled: true }); assert.equal(repeat.restartRequired, true);
});

test('plugin writes refuse read-only installs, unknown entries, failed readback and capability overrides', async () => {
  for (const row of [{ plugins: [], mutationAllowed: true }, { plugins: [{ id: 'test', installed: true, enabled: false }], mutationAllowed: false }]) {
    const f = fixture(() => row); await assert.rejects(f.service.run({ action: 'plugin-toggle', pluginId: 'test', enabled: true })); assert.equal(f.calls.length, 1);
  }
  const stale = fixture(method => method === 'plugins.setEnabled'
    ? { ok: true, plugin: { id: 'test', enabled: true }, restartRequired: true }
    : { mutationAllowed: true, plugins: [{ id: 'test', installed: true, enabled: false }] });
  await assert.rejects(stale.service.run({ action: 'plugin-toggle', pluginId: 'test', enabled: true }), /xác nhận/);
  const none = fixture();
  for (const value of [{ acknowledgeCapabilities: { reviewToken: 'x' } }, { method: 'plugins.install' }, { path: 'x' }]) {
    await assert.rejects(none.service.run({ action: 'plugin-toggle', pluginId: 'test', enabled: true, ...value }));
  }
  assert.equal(none.calls.length, 0);
});

test('effective tools stay scoped, expose permission truth and omit raw schema/arguments/secrets', async () => {
  const f = fixture(() => ({ agentId: 'fixture', profile: 'full', groups: [{ label: 'MCP', tools: [
    { id: 'read-report', label: 'Read report', description: 'Read permitted reports', rawDescription: 'PRIVATE', source: 'mcp', mcpServer: 'reports',
      deniedBySession: true, risk: 'low', schema: { token: 'PRIVATE' }, arguments: 'PRIVATE' }] }],
    notices: [{ id: 'mcp-stale-catalog', severity: 'warning', message: 'Needs connection' }] }));
  const result = await f.service.run({ action: 'tool-inventory', sessionKey });
  assert.deepEqual(f.calls, [{ method: 'tools.effective', params: { agentId: 'fixture', sessionKey } }]);
  assert.equal(result.effective, true); assert.equal(result.sessionKey, sessionKey); assert.equal(result.tools[0].deniedBySession, true);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  const count = f.calls.length;
  await assert.rejects(f.service.run({ action: 'tool-inventory', sessionKey, probe: true })); assert.equal(f.calls.length, count);
  f.service.request = async () => ({ agentId: 'other', groups: [] }); await assert.rejects(f.service.run({ action: 'tool-inventory', sessionKey }));
  f.service.request = async () => ({ agentId: 'fixture', sessionKey: 'agent:fixture:foreign', groups: [] }); await assert.rejects(f.service.run({ action: 'tool-inventory', sessionKey }));
  const catalogueOnly = await f.service.run({ action: 'tool-inventory' }); assert.equal(catalogueOnly.effective, false);
});
test('cron create carries stable declaration key; changes read actual revision and reject system/cross-agent jobs', async () => {
  let native = job();
  const f = fixture(() => native);
  await f.service.run({ action: 'cron-create', sessionKey, requestId, draft });
  assert.equal(f.calls[0].params.declarationKey, `aifb-schedule:${requestId}`);
  assert.equal(f.calls[0].params.agentId, 'fixture');
  await f.service.run({ action: 'cron-toggle', id: 'job', sessionKey, enabled: true });
  assert.deepEqual(f.calls.at(-2), { method: 'cron.update', params: { id: 'job', expectedConfigRevision: 'rev1', patch: { enabled: true } } });
  for (const patch of [{ declarationKey: 'native-system' }, { agentId: 'other' }, { payload: { kind: 'command', argv: ['danger'] } }, { delivery: { mode: 'announce' } }, { failureAlert: { to: 'person' } }]) {
    native = { ...job(), ...patch };
    await assert.rejects(f.service.run({ action: 'cron-remove', id: 'job', sessionKey }));
    assert.equal(f.calls.at(-1).method, 'cron.get');
  }
  native = job(); await f.service.run({ action: 'cron-remove', id: 'job', sessionKey });
  assert.deepEqual(f.calls.at(-1), { method: 'cron.remove', params: { id: 'job' } });
  assert.equal(isManagedJob(job()), true);
});
test('a pending mutation blocks duplicate actions immediately and releases after failure', async () => {
  let release;
  const f = fixture(() => new Promise((_, reject) => { release = reject; }));
  const first = f.service.run({ action: 'skill-toggle', sessionKey, skillKey: 'test', enabled: true });
  await assert.rejects(f.service.run({ action: 'channel-setup', channel: 'telegram' }), /Đang xử lý/);
  release(new Error('lost ACK')); await assert.rejects(first);
  assert.equal(f.calls.length, 1); assert.deepEqual(await f.service.run({ action: 'catalog' }), catalogue);
});

test('session skill selection uses CAS, keeps unrelated tool limits, and restores native defaults', async () => {
  let overlay = { exec: { host: 'sandbox' }, skills: { Old: false } }, active = false;
  const calls = [], key = 'agent:fixture:skills';
  const service = new NativeManagement(async (method, params) => {
    calls.push({ method, params });
    if (method === 'skills.status') return { skills: [{ name: 'Writing', eligible: true }, { name: 'Missing', eligible: false }] };
    if (method === 'chat.history') return { inFlightRun: active ? { runId: 'busy' } : null };
    if (method === 'sessions.describe') return { session: { key, sessionId: 'native-session', toolOverrides: structuredClone(overlay) } };
    if (method === 'sessions.patch') { assert.deepEqual(params.expectedToolOverrides, overlay); assert.equal(params.expectedSessionId, 'native-session'); overlay = params.toolOverrides; return { ok: true }; }
    throw new Error(method);
  }, {});
  await service.run({ action: 'session-skills', sessionKey: key, skills: ['Writing'] });
  assert.deepEqual(overlay, { exec: { host: 'sandbox' }, skills: { Writing: true } });
  await service.run({ action: 'session-skills', sessionKey: key, skills: [] }); assert.deepEqual(overlay, { exec: { host: 'sandbox' } });
  const before = calls.filter(c => c.method === 'sessions.patch').length;
  await assert.rejects(service.run({ action: 'session-skills', sessionKey: key, skills: ['Missing'] }));
  active = true; await assert.rejects(service.run({ action: 'session-skills', sessionKey: key, skills: ['Writing'] }));
  assert.equal(calls.filter(c => c.method === 'sessions.patch').length, before);
});

test('opening session skills reads two independent projections and never reserves the mutation lock', async () => {
  let releaseStatus, releaseDescribe;
  const key = 'agent:fixture:skills', calls = [];
  const service = new NativeManagement(async (method, params) => {
    calls.push({ method, params });
    if (method === 'skills.status') return new Promise(resolve => { releaseStatus = resolve; });
    if (method === 'sessions.describe') return new Promise(resolve => { releaseDescribe = resolve; });
    if (method === 'wizard.start') return { sessionId: 'fixture-wizard', step: { id: 'name', type: 'text' } };
    throw new Error(`Unexpected read: ${method}`);
  }, catalogue);
  const opening = service.run({ action: 'session-skills', sessionKey: key });
  assert.deepEqual(calls.map(row => row.method), ['skills.status', 'sessions.describe']);
  assert.equal((await service.run({ action: 'channel-setup', channel: 'telegram' })).sessionId, 'fixture-wizard', 'unrelated explicit action completes while skill reads remain delayed');
  releaseDescribe({ session: { key, sessionId: 'native', toolOverrides: { skills: { Writing: true } } } });
  releaseStatus({ skills: [{ name: 'Writing', eligible: true, description: 'Write' }] });
  assert.deepEqual(await opening, { skills: [{ name: 'Writing', description: 'Write' }], selected: ['Writing'] });
  assert.equal(calls.some(row => row.method === 'chat.history'), false);
  const count = calls.length;
  await assert.rejects(service.run({ action: 'session-skills', sessionKey: key, arbitrary: true }));
  await assert.rejects(service.run({ action: 'session-skills', sessionKey: 'foreign' }));
  assert.equal(calls.length, count);
});

test('read-only skill chooser stays available during another mutation; skill changes retain the lock', async () => {
  let releaseWizard;
  const key = 'agent:fixture:skills';
  const service = new NativeManagement(async method => {
    if (method === 'wizard.start') return new Promise(resolve => { releaseWizard = resolve; });
    if (method === 'skills.status') return { skills: [] };
    if (method === 'sessions.describe') return { session: { key, sessionId: 'native' } };
    throw new Error(`Unexpected read: ${method}`);
  }, catalogue);
  const mutation = service.run({ action: 'channel-setup', channel: 'telegram' });
  assert.deepEqual(await service.run({ action: 'session-skills', sessionKey: key }), { skills: [], selected: [] });
  await assert.rejects(service.run({ action: 'session-skills', sessionKey: key, skills: [] }), /Đang xử lý/);
  releaseWizard({ done: true }); await mutation;
});
