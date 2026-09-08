import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { waitForGatewayListener } from '../../apps/desktop/electron/startup-listener.mjs';
import { STARTUP_TIMEOUT_MS, STARTUP_SLOW_MS, waitForGatewayReady } from '../../apps/desktop/electron/startup-readiness.mjs';

const source = readFileSync(new URL('../../apps/desktop/electron/main.mjs', import.meta.url), 'utf8');
const start = source.indexOf('async function connectWithRetry(');
const finish = source.indexOf('\nasync function createMainWindow(', start);
assert.ok(start >= 0 && finish > start);

function harness({ listenerAt = 0, chatAt = listenerAt, setupAt = chatAt, stopAt = Infinity,
  staleAt = Infinity, portChangesAt = Infinity } = {}) {
  let time = 0, chatStarted = false, setupStarted = false, stopped = false;
  const calls = [], timers = new Map(), notices = [];
  const sandbox = { STARTUP_TIMEOUT_MS, STARTUP_SLOW_MS, connectionGeneration: 0, shuttingDown: false,
    SUPERVISOR_STATES: { SAFE_MODE: 'safe-mode' }, runtimeStatus: { detail: null, lastError: null },
    Date: { now: () => time },
    setTimeout: (callback, delay) => { const id = {}; timers.set(id, { at: time + delay, callback }); return id; },
    clearTimeout: id => timers.delete(id),
    publishStatus: patch => { Object.assign(sandbox.runtimeStatus, patch); notices.push({ at: time, ...patch }); }
  };
  const advance = async ms => {
    const previous = time; time += ms;
    if (time >= stopAt) sandbox.shuttingDown = true;
    if (previous < staleAt && time >= staleAt) ++sandbox.connectionGeneration;
    for (const [id, timer] of timers) if (time >= timer.at) { timers.delete(id); timer.callback(); }
  };
  const connected = (started, readyAt) => started && time >= readyAt;
  sandbox.adapter = {
    connect: () => { chatStarted = true; calls.push(['chat', time]); },
    get connected() { return connected(chatStarted, chatAt); },
    disconnect: async () => calls.push(['disconnect-chat', time])
  };
  sandbox.setupChannel = {
    connect: () => { setupStarted = true; calls.push(['setup', time]); },
    get connected() { return connected(setupStarted, setupAt); },
    disconnect: async () => calls.push(['disconnect-setup', time])
  };
  sandbox.supervisor = {
    get port() { return time >= portChangesAt ? 43124 : 43123; },
    get url() { return `ws://127.0.0.1:${this.port}`; },
    get state() { return stopped ? 'idle' : sandbox.adapter.connected ? 'ready' : 'starting'; },
    stop: async () => { stopped = true; calls.push(['stop', time]); }
  };
  sandbox.waitForGatewayListener = options => waitForGatewayListener({ ...options,
    now: () => time, sleep: advance, probe: async () => time >= listenerAt });
  sandbox.waitForGatewayReady = options => {
    calls.push(['handshake-budget', options.timeoutMs]);
    return waitForGatewayReady({ ...options, now: () => time, sleep: advance });
  };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, finish), sandbox);
  return { run: (url = 'ws://127.0.0.1:43123') => sandbox.connectWithRetry({ url, token: 'fixture-only' }),
    calls, notices, timers, time: () => time };
}

test('initial SDK connections begin once after listener; two handshakes share the remaining deadline', async () => {
  const h = harness({ listenerAt: 40_000, setupAt: 43_000 });
  assert.equal(await h.run(), true);
  assert.deepEqual(h.calls, [['chat', 40_000], ['setup', 40_000], ['handshake-budget', 200_000]]);
  assert.equal(h.time(), 43_000);
  assert.deepEqual(h.notices.filter(item => item.detail === 'startup-slow').map(item => item.at), [15_000]);
  assert.equal(h.timers.size, 0);
});

test('listener consumes its part of the existing 240 second budget instead of restarting that budget', async () => {
  const h = harness({ listenerAt: 239_000, setupAt: Infinity });
  assert.equal(await h.run(), false);
  assert.equal(h.time(), 240_000);
  assert.ok(h.calls.some(([kind, value]) => kind === 'handshake-budget' && value === 1000));
  assert.equal(h.notices.at(-1).detail, 'startup-timeout');
  assert.equal(h.calls.filter(([kind]) => kind === 'stop').length, 1);
  assert.equal(h.timers.size, 0);
});

test('never-listening owned port times out without starting either SDK', async () => {
  const h = harness({ listenerAt: Infinity });
  assert.equal(await h.run(), false);
  assert.equal(h.time(), 240_000);
  assert.equal(h.calls.some(([kind]) => ['chat', 'setup', 'handshake-budget'].includes(kind)), false);
  assert.equal(h.timers.size, 0);
});

test('quit or superseded connection cancels before SDK start and does not stop a newer owner', async () => {
  for (const change of [{ stopAt: 2000 }, { staleAt: 2000 }]) {
    const h = harness({ listenerAt: 40000, ...change });
    assert.equal(await h.run(), false);
    assert.deepEqual(h.calls, []);
    assert.equal(h.timers.size, 0);
  }
});

test('endpoint mismatch is rejected before connecting credentials to another URL', async () => {
  const h = harness();
  assert.equal(await h.run('ws://127.0.0.1:43124'), false);
  assert.equal(h.calls.some(([kind]) => kind === 'chat' || kind === 'setup'), false);
  assert.equal(h.timers.size, 0);
});
