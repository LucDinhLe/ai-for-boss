import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer, Socket } from "node:net";
import test from "node:test";
import { probeGatewayListener, waitForGatewayListener } from "../../apps/desktop/electron/startup-listener.mjs";
import { waitForGatewayReady } from "../../apps/desktop/electron/startup-readiness.mjs";

function fixture({ openAt = Infinity, probeDuration = 0, timeoutMs = 240_000 } = {}) {
  let time = 0;
  let slow = 0;
  const calls = [];
  const supervisor = { state: "starting", port: 43123 };
  const options = { port: supervisor.port, supervisor, timeoutMs, now: () => time,
    sleep: async (ms) => { time += ms; }, onSlow: () => { slow++; },
    probe: async (args) => { calls.push({ time, ...args }); time += Math.min(probeDuration, args.timeoutMs); return time >= openAt; } };
  return { options, calls, time: () => time, slow: () => slow, advance: (ms) => { time += ms; } };
}

class FakeSocket extends EventEmitter {
  destroyed = false;
  connects = [];
  connect(options) { this.connects.push(options); return this; }
  destroy() { this.destroyed = true; this.emit("close"); return this; }
}

test("invalid endpoints or budgets never open a socket", async () => {
  for (const port of [0, -1, 65_536, 1.5, "43123", undefined, NaN]) {
    assert.equal(await probeGatewayListener({ port, createSocket: () => assert.fail("must not open") }), false);
    assert.equal(await waitForGatewayListener({ port, probe: () => assert.fail("must not probe") }), "failed");
  }
  for (const timeoutMs of [-1, NaN, Infinity]) {
    const f = fixture({ timeoutMs });
    assert.equal(await waitForGatewayListener(f.options), "failed");
    assert.equal(f.calls.length, 0);
  }
});

test("probes only fixed loopback and destroys the socket on connect or refusal", async () => {
  for (const event of ["connect", "error", "close"]) {
    const socket = new FakeSocket();
    const result = probeGatewayListener({ port: 43123, createSocket: () => socket,
      host: "example.com", token: "must-never-be-sent" });
    assert.deepEqual(socket.connects, [{ host: "127.0.0.1", port: 43123 }]);
    socket.emit(event, new Error("synthetic refusal"));
    assert.equal(await result, event === "connect");
    assert.equal(socket.destroyed, true);
    socket.emit("error", new Error("late socket error"));
  }
});

test("a stalled TCP connection is closed at the 500ms cap", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const socket = new FakeSocket();
  const result = probeGatewayListener({ port: 43123, timeoutMs: 90_000, createSocket: () => socket });
  t.mock.timers.tick(499);
  assert.equal(socket.destroyed, false);
  t.mock.timers.tick(1);
  assert.equal(await result, false);
  assert.equal(socket.destroyed, true);
});

test("probe socket construction and synchronous connection failures settle safely", async () => {
  assert.equal(await probeGatewayListener({ port: 43123, createSocket: () => { throw new Error("unavailable"); } }), false);
  const socket = new FakeSocket();
  socket.connect = () => { throw new Error("closed"); };
  assert.equal(await probeGatewayListener({ port: 43123, createSocket: () => socket }), false);
  assert.equal(socket.destroyed, true);
});

test("serial probes start no faster than once per second and stop after first listener", async () => {
  const f = fixture({ openAt: 2_500, probeDuration: 500 });
  let inFlight = 0;
  const probe = f.options.probe;
  f.options.probe = async (args) => {
    assert.equal(inFlight++, 0);
    const result = await probe(args);
    inFlight--;
    return result;
  };
  assert.equal(await waitForGatewayListener(f.options), "ready");
  assert.deepEqual(f.calls.map(({ time }) => time), [0, 1_000, 2_000]);
  assert.equal(f.time(), 2_500);
  assert.equal(inFlight, 0);
});

test("40-second listener avoids SDK scheduling and reports slow startup once", async () => {
  const f = fixture({ openAt: 40_000 });
  assert.equal(await waitForGatewayListener(f.options), "ready");
  assert.equal(f.time(), 40_000);
  assert.equal(f.slow(), 1);
});

test("open TCP listener does not make unauthenticated SDK channels ready", async () => {
  const f = fixture({ openAt: 0, timeoutMs: 2_000 });
  const adapter = { connected: false };
  assert.equal(await waitForGatewayListener(f.options), "ready");
  assert.equal(adapter.connected, false);
  assert.equal(await waitForGatewayReady({ ...f.options, adapter }), "timed-out");
  assert.equal(f.time(), 2_000);
});

test("one deadline bounds sleeps and the final probe; late listener cannot win", async () => {
  const f = fixture({ openAt: 2_250, timeoutMs: 2_250, probeDuration: 500 });
  assert.equal(await waitForGatewayListener(f.options), "timed-out");
  assert.deepEqual(f.calls.map(({ time, timeoutMs }) => [time, timeoutMs]), [[0, 500], [1_000, 500], [2_000, 250]]);
  assert.equal(f.time(), 2_250);
  const zero = fixture({ openAt: 0, timeoutMs: 0 });
  assert.equal(await waitForGatewayListener(zero.options), "timed-out");
  assert.equal(zero.calls.length, 0);
});

test("default startup budget remains capped at 240 seconds", async () => {
  const f = fixture({ timeoutMs: 999_999 });
  assert.equal(await waitForGatewayListener(f.options), "timed-out");
  assert.equal(f.time(), 240_000);
  assert.equal(f.slow(), 1);
});

test("shutdown, stale generation and failed ownership never start a probe", async () => {
  for (const state of ["idle", "safe-mode", "unknown"]) {
    const f = fixture();
    f.options.supervisor.state = state;
    assert.equal(await waitForGatewayListener(f.options), "failed");
    assert.equal(f.calls.length, 0);
  }
  const stale = fixture();
  stale.options.supervisor.port++;
  assert.equal(await waitForGatewayListener(stale.options), "failed");
  assert.equal(stale.calls.length, 0);
  const quit = fixture();
  quit.options.shouldStop = () => true;
  assert.equal(await waitForGatewayListener(quit.options), "stopped");
  assert.equal(quit.calls.length, 0);
});

test("quit, failure and changed port during a successful probe take priority", async () => {
  for (const reason of ["quit", "safe-mode", "port"]) {
    const f = fixture();
    let quitting = false;
    f.options.shouldStop = () => quitting;
    f.options.probe = async () => {
      if (reason === "quit") quitting = true;
      if (reason === "safe-mode") f.options.supervisor.state = "safe-mode";
      if (reason === "port") f.options.supervisor.port++;
      return true;
    };
    assert.equal(await waitForGatewayListener(f.options), reason === "quit" ? "stopped" : "failed");
  }
});

test("quit during retry sleep and unexpected probe failures finish without another probe", async () => {
  const f = fixture();
  f.options.shouldStop = () => f.time() >= 1_000;
  assert.equal(await waitForGatewayListener(f.options), "stopped");
  assert.equal(f.calls.length, 1);
  const broken = fixture();
  broken.options.probe = async () => { throw new Error("unexpected probe failure"); };
  assert.equal(await waitForGatewayListener(broken.options), "failed");
});

test("real loopback TCP probe sends no data and closes both ends", { timeout: 5_000 }, async (t) => {
  let received = 0;
  let peer;
  let peerClosed;
  const closed = new Promise((resolve) => { peerClosed = resolve; });
  const server = createServer((socket) => {
    peer = socket;
    socket.on("data", (data) => { received += data.length; });
    socket.once("close", peerClosed);
  });
  t.after(() => { peer?.destroy(); server.close(); });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const socket = new Socket();
  assert.equal(await probeGatewayListener({ port: server.address().port, createSocket: () => socket }), true);
  assert.equal(socket.destroyed, true);
  await closed;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  assert.equal(peer.destroyed, true);
  assert.equal(received, 0);
});
