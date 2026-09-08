import test from 'node:test';
import assert from 'node:assert/strict';
import { RuntimeControl } from '../../apps/desktop/electron/runtime-control.mjs';
test('owned Gateway stop/resume is single-flight and health does not expose native account details', async () => {
  let paused = false, release, starts = 0;
  const control = new RuntimeControl({ available: () => true, isPaused: () => paused,
    stop: async () => { paused = true; await new Promise(resolve => { release = resolve; }); },
    resume: async () => { starts++; paused = false; return true; }, health: async () => ({ ok: true, token: 'synthetic-private-field' }) });
  const stopping = control.run({ action: 'gateway-stop' });
  await assert.rejects(control.run({ action: 'gateway-resume' }), /thao tác trước/);
  release(); assert.deepEqual(await stopping, { stopped: true });
  assert.equal((await control.run({ action: 'gateway-health' })).paused, true);
  assert.deepEqual(await control.run({ action: 'gateway-resume' }), { ready: true });
  assert.equal(starts, 1);
  const health = await control.run({ action: 'gateway-health' }); assert.equal(health.healthy, true); assert.equal('token' in health, false);
  await assert.rejects(control.run({ action: 'gateway-stop', pid: 1 }), /hợp lệ/);
  await assert.rejects(control.run({ action: 'gateway-resume' }), /chưa tạm dừng/);
});
test('shutdown/smoke ownership guard prevents any Gateway control callback', async () => {
  const denied = () => assert.fail('must not execute');
  const control = new RuntimeControl({ available: () => false, isPaused: () => true, stop: denied, resume: denied, health: denied });
  for (const action of ['gateway-stop', 'gateway-resume', 'gateway-health']) await assert.rejects(control.run({ action }));
});
