import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelWorkGuard } from '../../apps/desktop/electron/channel-work-guard.mjs';
import { WorkerNotSubmittedError } from '../../apps/desktop/electron/worker-policy.mjs';

const idle = { sessionInfo: { hasActiveRun: false, activeRunIds: [] } };
const active = { sessionInfo: { hasActiveRun: true, activeRunIds: ['native-run'] } };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const waitMessage = /chờ công việc hoàn tất hoặc dừng/u;

test('send ACK remains tracked until explicit native completion; channel changes never use ACK as idle', async () => {
  let history = active, mutations = 0; const reads = [];
  const guard = new ChannelWorkGuard({ requestHistory: async key => { reads.push(key); return history; } });
  assert.deepEqual(await guard.send('worker-a', async () => ({ runId: 'native-run' })), { runId: 'native-run' });
  await assert.rejects(guard.run(async () => mutations++), waitMessage);
  assert.equal(mutations, 0); assert.deepEqual(reads, ['worker-a']); assert.equal(guard.busy, false);
  history = idle;
  assert.equal(await guard.run(async () => ++mutations), 1);
  assert.deepEqual(reads, ['worker-a', 'worker-a']); assert.equal(guard.busy, false);
});

test('pending authentication/submission cannot race an idle history read or channel mutation', async () => {
  const pending = deferred(); let reads = 0, mutations = 0;
  const guard = new ChannelWorkGuard({ requestHistory: async () => { reads++; return idle; } });
  const sending = guard.send('worker-a', () => pending.promise);
  guard.observeHistory('worker-a', idle);
  await assert.rejects(guard.run(async () => mutations++), waitMessage);
  assert.equal(reads, 0); assert.equal(mutations, 0);
  pending.resolve({ accepted: true }); await sending;
  await guard.run(async () => mutations++);
  assert.equal(reads, 1); assert.equal(mutations, 1);
});

test('lost send ACK remains tracked; proven pre-send errors remove only new non-dispatched ownership', async () => {
  const reads = [];
  const guard = new ChannelWorkGuard({ requestHistory: async key => { reads.push(key); return active; } });
  await assert.rejects(guard.send('unknown', async () => { throw new Error('ACK lost'); }), /ACK lost/u);
  await assert.rejects(guard.send('unknown', async () => { throw new WorkerNotSubmittedError(); }), { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  await assert.rejects(guard.send('never-sent', async () => { throw new WorkerNotSubmittedError(); }), { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  await assert.rejects(guard.run(async () => assert.fail('active run must block')), waitMessage);
  assert.deepEqual(reads, ['unknown']);
});

test('new sends are rejected before native dispatch while native idle readback or restart is pending', async () => {
  const read = deferred(), restart = deferred(); let sends = 0, started = false;
  const guard = new ChannelWorkGuard({ requestHistory: () => read.promise });
  await guard.send('worker-a', async () => true);
  const changing = guard.run(async () => { started = true; guard.assertExclusive(); return restart.promise; });
  assert.equal(guard.busy, true);
  await assert.rejects(guard.send('worker-b', async () => sends++), { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  await assert.rejects(guard.run(async () => assert.fail('duplicate channel operation')), /thiết lập kênh/u);
  read.resolve(idle); await Promise.resolve(); await Promise.resolve();
  assert.equal(started, true); assert.equal(guard.busy, true);
  await assert.rejects(guard.send('worker-b', async () => sends++), { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  restart.resolve('restarted'); assert.equal(await changing, 'restarted'); assert.equal(guard.busy, false); assert.equal(sends, 0);
});

test('missing, ambiguous, contradictory and failed history cannot prove worker idle', async () => {
  for (const history of [null, {}, { sessionInfo: {} }, { sessionInfo: { hasActiveRun: null } },
    { sessionInfo: { hasActiveRun: false, activeRunIds: ['still-running'] } },
    { inFlightRun: { runId: 'running' }, sessionInfo: { hasActiveRun: false, activeRunIds: [] } }, new Error('read failed')]) {
    const guard = new ChannelWorkGuard({ requestHistory: async () => { if (history instanceof Error) throw history; return history; } });
    await guard.send('worker-a', async () => true);
    await assert.rejects(guard.run(async () => assert.fail('unproven idle')), waitMessage);
    assert.equal(guard.busy, false);
  }
});

test('native observed active sessions are retained and explicit idle reconciles them without probing unrelated sessions', async () => {
  const reads = []; const guard = new ChannelWorkGuard({ requestHistory: async key => { reads.push(key); return idle; } });
  guard.observeHistory('external-a', { inFlightRun: { runId: 'native-a' } });
  guard.observeHistory('external-b', active); guard.observeHistory('external-a', {});
  guard.observeHistory('external-b', { sessionInfo: { activeRunIds: [] } });
  await guard.run(async () => guard.assertExclusive());
  assert.deepEqual(reads, ['external-a']);
  assert.throws(() => guard.assertExclusive(), waitMessage);
});

test('observed native activity survives a simultaneous preflight rejection', async () => {
  const pending = deferred(), reads = [];
  const guard = new ChannelWorkGuard({ requestHistory: async key => { reads.push(key); return active; } });
  const sending = guard.send('worker-a', () => pending.promise);
  guard.observeHistory('worker-a', active);
  pending.reject(new WorkerNotSubmittedError()); await assert.rejects(sending, { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  await assert.rejects(guard.run(async () => assert.fail('observed activity retained')), waitMessage);
  assert.deepEqual(reads, ['worker-a']);
});

test('multiple pending sends retain shared ownership until every submission settles', async () => {
  const a = deferred(), b = deferred(); let reads = 0;
  const guard = new ChannelWorkGuard({ requestHistory: async () => { reads++; return idle; } });
  const first = guard.send('worker-a', () => a.promise), second = guard.send('worker-a', () => b.promise);
  a.reject(new WorkerNotSubmittedError()); await assert.rejects(first);
  guard.observeHistory('worker-a', idle);
  await assert.rejects(guard.run(async () => assert.fail('second still pending')), waitMessage);
  b.resolve(true); await second; await guard.run(async () => true); assert.equal(reads, 1);
});

test('other supervised work and new observed activity rechecked before channel mutation; errors unlock', async () => {
  let otherBusy = true;
  const guard = new ChannelWorkGuard({ requestHistory: async () => idle, otherBusy: () => otherBusy });
  await assert.rejects(guard.run(async () => assert.fail('supervision busy')), waitMessage);
  otherBusy = false;
  await assert.rejects(guard.run(async () => { otherBusy = true; guard.assertExclusive(); }), waitMessage);
  assert.equal(guard.busy, false); otherBusy = false;
  await assert.rejects(guard.run(async () => { throw new Error('restart failed'); }), /restart failed/u);
  assert.equal(guard.busy, false);
  const read = deferred(); const tracking = new ChannelWorkGuard({ requestHistory: key => key === 'first' ? read.promise : Promise.resolve(active) });
  await tracking.send('first', async () => true);
  const changing = tracking.run(async () => assert.fail('new active session must be reconciled'));
  tracking.observeHistory('arrived-during-read', active); read.resolve(idle);
  await assert.rejects(changing, waitMessage);
});
