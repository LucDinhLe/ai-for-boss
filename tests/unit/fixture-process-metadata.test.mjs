import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeProcessObservations, parseProcessSnapshot, reconcileProcessSnapshot, sameProcessIdentity } from '../../scripts/fixture-process-metadata.mjs';

const processRow = (pid, parent, created = '2026-09-08T00:00:00.000Z') => ({ pid, parent, created, executable: 'C:\\fixture\\app.exe' });

test('process scanner requires an explicit successful envelope, including an empty result', () => {
  assert.deepEqual(parseProcessSnapshot('{"ok":true,"processes":[]}'), []);
  for (const invalid of ['', 'null', '[]', '{"ok":false,"processes":[]}', '{"ok":true}', '{"ok":true,"processes":[{"pid":1}]}']) {
    assert.throws(() => parseProcessSnapshot(invalid));
  }
  const row = processRow(1, 0);
  assert.deepEqual(parseProcessSnapshot(JSON.stringify({ ok: true, processes: [row] })), [row]);
  assert.throws(() => parseProcessSnapshot(JSON.stringify({ ok: true, processes: [row, row] })));
});

test('retained identities detect a surviving grandchild after both ancestors exit', () => {
  const root = processRow(10, 1), parent = processRow(11, 10), orphan = processRow(12, 11);
  const result = reconcileProcessSnapshot([root, parent, orphan], [orphan]);
  assert.deepEqual(result.remainingPids, [12]);
  assert.deepEqual(result.remainingObserved, [orphan]);
});

test('final new descendants and PID reuse stay unresolved rather than falsely clean or owned', () => {
  const prior = processRow(10, 1), reused = processRow(10, 99, '2026-09-08T00:01:00.000Z'), lateChild = processRow(12, 10);
  assert.equal(sameProcessIdentity(prior, reused), false);
  const result = reconcileProcessSnapshot([prior], [reused, lateChild]);
  assert.deepEqual(result.remainingObserved, []);
  assert.deepEqual(result.newlyObserved, [reused, lateChild]);
  assert.deepEqual(result.remainingPids, [10, 12]);
});

test('observations retain past identities across empty samples without merging a reused PID', () => {
  const row = processRow(10, 1), reused = processRow(10, 99, '2026-09-08T00:01:00.000Z');
  const first = mergeProcessObservations([row], []);
  assert.deepEqual(first, [row]);
  assert.deepEqual(mergeProcessObservations(first, [row, reused]), [row, reused]);
  assert.deepEqual(reconcileProcessSnapshot(first, []).remainingPids, []);
});
