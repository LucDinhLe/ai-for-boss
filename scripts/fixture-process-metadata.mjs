import assert from 'node:assert/strict';

// A missing/failed scanner response must never become an authoritative empty set.
export function parseProcessSnapshot(raw) {
  const value = JSON.parse(raw);
  assert.equal(value?.ok, true, 'Process scanner did not return a success envelope');
  assert.ok(Array.isArray(value.processes), 'Process scanner omitted its process array');
  const ids = new Set();
  for (const item of value.processes) {
    assert.ok(Number.isSafeInteger(item.pid) && item.pid > 0 && !ids.has(item.pid), 'Invalid or duplicate process identity');
    assert.ok(Number.isSafeInteger(item.parent) && item.parent >= 0, 'Invalid process parent');
    assert.ok(typeof item.created === 'string' && Number.isFinite(Date.parse(item.created)), 'Missing process creation time');
    assert.ok(item.executable === null || typeof item.executable === 'string', 'Invalid process executable metadata');
    ids.add(item.pid);
  }
  return value.processes;
}

export function sameProcessIdentity(left, right) {
  return Boolean(left && right && left.pid === right.pid && left.created === right.created);
}

export function mergeProcessObservations(observed, current) {
  const merged = [...observed];
  for (const item of current) if (!merged.some(prior => sameProcessIdentity(prior, item))) merged.push(item);
  return merged;
}

export function reconcileProcessSnapshot(observed, current) {
  // Current includes a direct lookup of retained sampled PIDs as well as their
  // descendants. This still works when an intermediate parent has already exited.
  const remainingObserved = current.filter(item => observed.some(prior => sameProcessIdentity(prior, item)));
  const newlyObserved = current.filter(item => !remainingObserved.includes(item));
  return { remainingObserved, newlyObserved, remainingPids: current.map(item => item.pid) };
}
