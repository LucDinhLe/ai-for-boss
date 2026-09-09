import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { createCapabilityCatalogReader } from '../../apps/desktop/src/capability-catalog-data.ts';

const catalogue = { version: 'fixture', providers: [], plugins: [], channels: [] };
const plugin = enabled => ({ id: 'fixture', label: 'Fixture', installed: true, enabled });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('catalogue starts independent live reads immediately and shares only the immutable catalogue request', async context => {
  const calls = [], staticRead = deferred(), pending = [], started = performance.now();
  const reader = createCapabilityCatalogReader({
    catalogue: () => { calls.push('catalogue'); return staticRead.promise; },
    live: kind => { calls.push(kind); const wait = deferred(); pending.push(wait); return wait.promise; }
  });
  const first = reader.read('plugins', true), second = reader.read('mcp', true);
  assert.deepEqual(calls, ['catalogue', 'plugins', 'mcp'], 'neither live read waits for the catalogue or another feature');
  pending[0].resolve({ entries: [plugin(false)], mutationAllowed: true });
  assert.equal((await first.live).entries[0].enabled, false, 'live data can render while the catalogue remains pending');
  assert.deepEqual(reader.snapshot('plugins').entries, [plugin(false)]);
  assert.equal('mutationAllowed' in reader.snapshot('plugins'), false, 'display snapshots never carry mutation authorization');
  pending[1].resolve({ entries: [] }); staticRead.resolve(catalogue);
  await Promise.all([first.catalogue, second.catalogue, second.live]);
  const revisit = reader.read('plugins', true);
  assert.deepEqual(calls, ['catalogue', 'plugins', 'mcp', 'plugins'], 'a revisit rechecks live state but never rereads immutable catalogue');
  pending[2].resolve({ entries: [plugin(true)], mutationAllowed: false }); await revisit.live;
  assert.equal((await revisit.catalogue).version, 'fixture');
  const offline = reader.read('mcp', false); assert.equal(await offline.live, null);
  assert.equal(calls.length, 4, 'no native live request while disconnected');
  context.diagnostic(`Controlled pending RPC test: 1 catalogue request for 4 reads; 3 independent live reads. Wall time ${Math.round(performance.now() - started)} ms is fixture overhead, not host latency.`);
});

test('delayed stale read cannot replace newer display state or verified plugin readback', async () => {
  const waiting = [];
  const reader = createCapabilityCatalogReader({ catalogue: async () => catalogue, live: async () => { const wait = deferred(); waiting.push(wait); return wait.promise; } });
  const older = reader.read('plugins', true), newer = reader.read('plugins', true);
  waiting[1].resolve({ entries: [plugin(true)] }); await newer.live;
  waiting[0].resolve({ entries: [plugin(false)] }); await older.live;
  assert.equal(reader.snapshot('plugins').entries[0].enabled, true);
  const pending = reader.read('plugins', true);
  reader.updatePlugin(plugin(false));
  waiting[2].resolve({ entries: [plugin(true)] }); await pending.live;
  assert.equal(reader.snapshot('plugins').entries[0].enabled, false);
});

test('failed catalogue read retries, live failures retain display snapshot and do not suppress independent reads', async () => {
  let attempts = 0, failLive = false;
  const reader = createCapabilityCatalogReader({
    catalogue: async () => { attempts++; if (attempts === 1) throw new Error('fixture catalogue failure'); return catalogue; },
    live: async () => { if (failLive) throw new Error('fixture live failure'); return { entries: [plugin(false)], mutationAllowed: true }; }
  });
  const first = reader.read('plugins', true);
  await assert.rejects(first.catalogue, /fixture catalogue/); await first.live;
  failLive = true;
  const next = reader.read('plugins', true); await next.catalogue; await assert.rejects(next.live, /fixture live/);
  assert.equal(attempts, 2); assert.deepEqual(reader.snapshot('plugins').entries, [plugin(false)]);
});

test('injected delayed RPCs overlap instead of adding their waits', async context => {
  const started = performance.now(), starts = [], finished = [];
  const delayed = (name, ms, result) => { starts.push(name); return new Promise(resolve => setTimeout(() => { finished.push(name); resolve(result); }, ms)); };
  const reader = createCapabilityCatalogReader({ catalogue: () => delayed('catalogue', 30, catalogue), live: () => delayed('live', 80, { entries: [] }) });
  const reads = reader.read('providers', true);
  assert.deepEqual(starts, ['catalogue', 'live']); assert.deepEqual(finished, []);
  await Promise.all([reads.catalogue, reads.live]);
  context.diagnostic(`Injected waits 30 ms + 80 ms started concurrently; observed ${Math.round(performance.now() - started)} ms. Assertions use dispatch order, not a hardware-dependent time threshold.`);
});
