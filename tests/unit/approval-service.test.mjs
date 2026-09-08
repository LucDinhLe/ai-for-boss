import test from 'node:test';
import assert from 'node:assert/strict';
import { ApprovalService } from '../../apps/desktop/electron/approval-service.mjs';
function fixture() {
  let row = { id: 'fixture-approval', urlPath: '/approve/fixture-approval', createdAtMs: Date.now(), expiresAtMs: Date.now() + 60000,
    status: 'pending', sourceSessionKey: 'agent:fixture:test', presentation: { kind: 'exec', commandText: 'node fixture.cjs', allowedDecisions: ['allow-once', 'allow-always', 'deny'] } };
  const calls = [];
  const service = new ApprovalService(async (method, params) => {
    calls.push({ method, params });
    if (method === 'exec.approval.list') return [{ id: row.id, env: { SECRET: 'never-render' }, command: 'never-trust' }];
    if (method === 'approval.get') return { approval: structuredClone(row) };
    if (method === 'approval.resolve') {
      const { sourceSessionKey, ...rest } = row;
      row = { ...rest, source: { sessionKey: sourceSessionKey }, status: params.decision === 'deny' ? 'denied' : 'allowed', decision: params.decision, reason: 'user', resolvedAtMs: Date.now() };
      return { ok: true };
    }
    throw new Error(method);
  });
  return { service, calls, mutate: fn => { row = fn(row); } };
}
test('inbox uses canonical safe presentation, never legacy command or environment', async () => {
  const f = fixture(), result = await f.service.run({ action: 'approval-list' });
  assert.equal(result.approvals[0].command, 'node fixture.cjs');
  assert.equal(JSON.stringify(result).includes('never-'), false);
});
test('only one-time allow and deny resolve; resolved request cannot be replayed', async () => {
  for (const decision of ['deny', 'allow-once']) {
    const f = fixture(), row = (await f.service.run({ action: 'approval-list' })).approvals[0];
    const input = { action: 'approval-resolve', id: row.id, revision: row.revision, decision };
    assert.equal((await f.service.run(input)).status, decision === 'deny' ? 'denied' : 'allowed');
    await assert.rejects(f.service.run(input));
    assert.equal(f.calls.filter(x => x.method === 'approval.resolve').length, 1);
  }
});
test('changed command, expiry, removed permission and permanent approval are denied before mutation', async () => {
  for (const change of [row => ({ ...row, expiresAtMs: 0 }), row => ({ ...row, presentation: { ...row.presentation, commandText: 'different' } }),
    row => ({ ...row, presentation: { ...row.presentation, allowedDecisions: ['deny'] } }), row => row]) {
    const f = fixture(), row = (await f.service.run({ action: 'approval-list' })).approvals[0];
    f.mutate(change);
    await assert.rejects(f.service.run({ action: 'approval-resolve', id: row.id, revision: row.revision, decision: change.toString().endsWith('=> row') ? 'allow-always' : 'allow-once' }));
    assert.equal(f.calls.some(x => x.method === 'approval.resolve'), false);
  }
});
