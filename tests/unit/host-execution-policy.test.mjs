import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { HostExecutionPolicy } from '../../apps/desktop/electron/host-execution-policy.mjs';
const configPath = path.resolve('fixture/openclaw.json'), key = 'agent:fixture:aifb-test';
function fixture(override = {}) {
  let approvals = { hash: 'a1', file: { version: 1, defaults: {}, agents: { prior: { ask: 'off' } } } };
  let config = { path: configPath, valid: true, hash: 'c1', configRevisionHash: 'r1', appliedConfigHash: 'r1', config: { tools: { deny: ['*', 'browser'] } } };
  let session = { key, sessionId: 's1', permissionMode: 'full' };
  const calls = [];
  const request = async (method, params) => {
    calls.push({ method, params });
    if (override[method]) return override[method](params);
    if (method === 'exec.approvals.get') return approvals;
    if (method === 'exec.approvals.set') { assert.equal(params.baseHash, 'a1'); approvals = { hash: 'a2', file: params.file }; return {}; }
    if (method === 'config.get') return config;
    if (method === 'config.patch') { config = { ...config, config: JSON.parse(params.raw) }; return {}; }
    if (method === 'sessions.describe') return { session };
    if (method === 'sessions.patch') { assert.equal(params.expectedSessionId, 's1'); assert.equal(params.expectedPermissionMode, 'full'); session = { ...session, permissionMode: params.permissionMode }; return {}; }
    throw new Error(method);
  };
  return { calls, policy: new HostExecutionPolicy({ request, configPath }) };
}
test('host floor is applied and read back before exposing tools; existing agent overrides are tightened', async () => {
  const f = fixture();
  assert.deepEqual(await f.policy.ensure(key), { verified: true, permissionMode: 'guarded', approval: 'every-command', sandbox: false });
  assert.deepEqual(f.calls.slice(0, 3).map(x => x.method), ['exec.approvals.get', 'exec.approvals.set', 'exec.approvals.get']);
  const file = f.calls[1].params.file;
  assert.deepEqual(file.defaults, file.agents.prior);
  assert.equal(file.defaults.ask, 'always'); assert.equal(file.defaults.askFallback, 'deny');
  const patch = f.calls.find(x => x.method === 'config.patch').params;
  assert.deepEqual(JSON.parse(patch.raw).tools.deny, ['browser']);
  assert.equal(JSON.parse(patch.raw).tools.elevated.enabled, false);
});
test('failed or malformed approval policy cannot enable tools', async () => {
  for (const snapshot of [{}, { hash: 'a', file: { version: 1, agents: [] } }, { hash: '', file: { version: 1 } }]) {
    const f = fixture({ 'exec.approvals.get': () => snapshot });
    await assert.rejects(f.policy.ensure(key)); assert.equal(f.calls.length, 1);
  }
});
test('foreign config, unacknowledged hot reload and changed session fail closed', async () => {
  for (const overrides of [
    { 'config.get': () => ({ valid: true, path: path.resolve('foreign.json'), hash: 'x', config: {} }) },
    { 'sessions.describe': () => ({ session: { key: 'agent:other:wrong', sessionId: 'x', permissionMode: 'guarded' } }) },
    { 'exec.approvals.set': () => { throw new Error('Conflict'); } }
  ]) await assert.rejects(fixture(overrides).policy.ensure(key));
});
test('invalid session identifiers are rejected without any native request', async () => {
  const f = fixture();
  for (const key of ['', 'global', {}, 'agent:bad:two words']) await assert.rejects(f.policy.ensure(key));
  assert.equal(f.calls.length, 0);
});
