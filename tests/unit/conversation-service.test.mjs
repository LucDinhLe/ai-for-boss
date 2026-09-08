import assert from 'node:assert/strict';
import test from 'node:test';
import { ConversationService } from '../../apps/desktop/electron/conversation-service.mjs';

function fixture() {
  const row = { key: 'agent:fixture:aifb-example', sessionId: 'session-id', updatedAt: 10, label: 'Fixture only' };
  let current = row, time = 100, active = false, deleting;
  const calls = [];
  const service = new ConversationService(async (method, params) => {
    calls.push({ method, params });
    if (method === 'sessions.describe') return { session: current };
    if (method === 'chat.history') return { sessionInfo: { hasActiveRun: active } };
    if (method === 'sessions.delete') {
      if (deleting) await deleting();
      current = null; return { ok: true, key: row.key, deleted: true, archived: ['not-exposed'] };
    }
    throw new Error(method);
  }, { now: () => time });
  return { calls, service, set row(value) { current = value; }, get row() { return current; },
    active: value => { active = value; }, time: value => { time = value; }, deleting: fn => { deleting = fn; } };
}
test('delete requires a current one-use host receipt and verifies native absence; no paths leave host', async () => {
  const f = fixture(), key = f.row.key;
  const preview = await f.service.run({ action: 'conversation-inspect', key });
  assert.equal(f.calls.some(c => c.method === 'sessions.delete'), false);
  const result = await f.service.run({ action: 'conversation-delete', ticket: preview.ticket });
  assert.deepEqual(result, { ok: true, key });
  assert.deepEqual(f.calls.find(c => c.method === 'sessions.delete').params, { key, expectedSessionId: 'session-id', expectedSessionUpdatedAt: 10, deleteTranscript: true });
  await assert.rejects(f.service.run({ action: 'conversation-delete', ticket: preview.ticket }));
});
test('active/main sessions, stale identity or timestamp and expired confirmations do not delete', async () => {
  for (const change of [f => f.active(true), f => { f.row = { ...f.row, isMain: true }; },
    f => { f.row = { ...f.row, sessionId: 'replacement' }; }, f => { f.row = { ...f.row, updatedAt: 11 }; }, f => f.time(300101)]) {
    const f = fixture(), preview = await f.service.run({ action: 'conversation-inspect', key: f.row.key });
    change(f); await assert.rejects(f.service.run({ action: 'conversation-delete', ticket: preview.ticket }));
    assert.equal(f.calls.some(c => c.method === 'sessions.delete'), false);
  }
});
test('renderer cannot override cleanup, target, scopes or lifecycle options', async () => {
  const f = fixture(), preview = await f.service.run({ action: 'conversation-inspect', key: f.row.key });
  for (const extra of [{ key: 'foreign' }, { deleteTranscript: false }, { emitLifecycleHooks: false }, { expectedSessionId: 'anything' }])
    await assert.rejects(f.service.run({ action: 'conversation-delete', ticket: preview.ticket, ...extra }));
  assert.equal(f.calls.some(c => c.method === 'sessions.delete'), false);
});
test('simultaneous confirmation and uncertain native failure never replay mutation', async () => {
  const f = fixture(), preview = await f.service.run({ action: 'conversation-inspect', key: f.row.key });
  let fail; f.deleting(() => new Promise((_, reject) => { fail = reject; }));
  const first = f.service.run({ action: 'conversation-delete', ticket: preview.ticket });
  await assert.rejects(f.service.run({ action: 'conversation-delete', ticket: preview.ticket }));
  while (!fail) await Promise.resolve(); fail(new Error('disconnected'));
  await assert.rejects(first, /disconnected/);
  await assert.rejects(f.service.run({ action: 'conversation-delete', ticket: preview.ticket }));
  assert.equal(f.calls.filter(c => c.method === 'sessions.delete').length, 1);
});

test('a malformed absence readback cannot falsely confirm deletion', async () => {
  for (const malformed of [{}, undefined, { session: undefined }, { session: { key: 'other' } }]) {
    let removed = false;
    const service = new ConversationService(async method => {
      if (method === 'sessions.describe') return removed ? malformed : { session: { key: 'agent:fixture:test', sessionId: 'id', updatedAt: 1 } };
      if (method === 'chat.history') return { sessionInfo: { hasActiveRun: false } };
      removed = true; return { ok: true, key: 'agent:fixture:test', deleted: true };
    });
    const preview = await service.run({ action: 'conversation-inspect', key: 'agent:fixture:test' });
    await assert.rejects(service.run({ action: 'conversation-delete', ticket: preview.ticket }), /Chưa xác nhận/);
  }
});
