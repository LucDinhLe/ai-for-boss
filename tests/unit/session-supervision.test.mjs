import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionSupervision } from '../../apps/desktop/electron/session-supervision.mjs';

test('parallel supervision routes status and cancellation to the exact session, maintenance sees any busy job', async () => {
  const entries = [], registry = new SessionSupervision({}, () => {
    const entry = { state: null, cancelled: 0, stopped: 0, restored: 0, shutdown: 0 };
    entries.push(entry);
    return { advisor: { connectionRestored() { entry.restored++; }, cancelForShutdown() { entry.shutdown++; }, ownedRuntimeStopped() { entry.stopped++; } },
      service: { run(input) { if (entry.state?.busy) throw new Error('busy'); entry.state = { key: input.key, busy: true }; return new Promise(resolve => { entry.resolve = resolve; }); },
        status: () => entry.state, cancel() { entry.cancelled++; entry.state.busy = false; entry.resolve(entry.state); return { stopped: true }; },
        ownedRuntimeStopped() { if (entry.state) entry.state.busy = false; } } };
  });
  const a = registry.run({ key: 'agent:main:a' }), b = registry.run({ key: 'agent:main:b' });
  assert.equal(entries.length, 2); assert.equal(registry.status('agent:main:a').busy, true);
  assert.throws(() => registry.run({ key: 'agent:main:a' }), /busy/);
  assert.throws(() => registry.cancel(), /phiên/);
  await registry.cancel('agent:main:a'); await a;
  assert.equal(entries[0].cancelled, 1); assert.equal(entries[1].cancelled, 0);
  assert.equal(registry.status().key, 'agent:main:b');
  await registry.connectionRestored(); registry.cancelForShutdown(); registry.ownedRuntimeStopped();
  for (const entry of entries) { assert.equal(entry.restored, 1); assert.equal(entry.shutdown, 1); assert.equal(entry.stopped, 1); }
  assert.equal(registry.status(), null); entries[1].resolve(entries[1].state); await b;
});
