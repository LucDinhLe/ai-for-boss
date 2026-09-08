import assert from "node:assert/strict";
import test from "node:test";
import { waitForGatewayReady, isExpectedStartupConnectionError, STARTUP_TIMEOUT_MS, createGatewayRestart }
  from "../../apps/desktop/electron/startup-readiness.mjs";

function setup({ chatReadyAt = Infinity, setupReadyAt = chatReadyAt, failedAt = Infinity, stopAt = Infinity } = {}) {
  let time = 0;
  let slow = 0;
  return {
    options: { adapter: { get connected() { return time >= chatReadyAt && time >= setupReadyAt; } },
      supervisor: { get state() { return time >= failedAt ? "safe-mode" : "starting"; } },
      now: () => time, sleep: async (ms) => { time += ms; }, shouldStop: () => time >= stopAt,
      onSlow: () => { slow++; } },
    time: () => time, slow: () => slow
  };
}
test("cold Windows startup at 160 seconds succeeds without the old 60 second false timeout", async () => {
  const f = setup({ chatReadyAt: 160_000 });
  assert.equal(await waitForGatewayReady(f.options), "ready");
  assert.equal(f.time(), 160_000);
  assert.equal(f.slow(), 1);
});
test("provider setup must wait for its admin channel as well as chat", async () => {
  const f = setup({ chatReadyAt: 2_000, setupReadyAt: 9_000 });
  assert.equal(await waitForGatewayReady(f.options), "ready");
  assert.equal(f.time(), 9_000);
  assert.equal(f.slow(), 0);
});
test("never-ready startup is bounded and reports the slow-start notice once", async () => {
  const f = setup();
  assert.equal(await waitForGatewayReady(f.options), "timed-out");
  assert.equal(f.time(), STARTUP_TIMEOUT_MS);
  assert.equal(f.slow(), 1);
});
test("quit and supervisor failure end the wait before its deadline", async () => {
  for (const [options, result] of [[{ stopAt: 2_000 }, "stopped"], [{ failedAt: 2_000 }, "failed"]]) {
    const f = setup(options);
    assert.equal(await waitForGatewayReady(f.options), result);
    assert.equal(f.time(), 2_000);
  }
});
test("fatal or stopped supervision wins over a stale connected channel", async () => {
  for (const state of ["safe-mode", "idle"]) {
    const f = setup({ chatReadyAt: 0 });
    f.options.supervisor = { state };
    assert.equal(await waitForGatewayReady(f.options), "failed");
    assert.equal(f.time(), 0);
  }
  const f = setup({ chatReadyAt: 0, stopAt: 0 });
  assert.equal(await waitForGatewayReady(f.options), "stopped");
});
test("only connection refusal is pending startup, never authentication/configuration failures", () => {
  assert.equal(isExpectedStartupConnectionError("connect ECONNREFUSED 127.0.0.1:1234"), true);
  for (const message of ["token mismatch", "configuration invalid", "ETIMEDOUT", null]) {
    assert.equal(isExpectedStartupConnectionError(message), false);
  }
});

test("concurrent setup completions share one ordered restart", async () => {
  const calls = [];
  let release;
  const restart = createGatewayRestart({
    disconnect: () => { calls.push("disconnect"); return new Promise((resolve) => { release = resolve; }); },
    stop: async () => { calls.push("stop"); },
    start: async () => { calls.push("start"); return { port: 43123, token: "synthetic" }; },
    connect: async (endpoint) => { calls.push("connect"); assert.equal(endpoint.port, 43123); return true; }
  });
  const first = restart();
  const second = restart();
  assert.equal(first, second);
  assert.deepEqual(calls, ["disconnect"]);
  release();
  assert.equal(await first, true);
  assert.deepEqual(calls, ["disconnect", "stop", "start", "connect"]);
});

test("quit during each restart await prevents subsequent connection or spawn", async () => {
  for (const stopAfter of ["before", "disconnect", "stop", "start"]) {
    let quitting = stopAfter === "before";
    const calls = [];
    const step = async (name) => {
      calls.push(name);
      if (name === stopAfter) quitting = true;
      return { port: 43123, token: "synthetic" };
    };
    const restart = createGatewayRestart({
      shouldStop: () => quitting,
      disconnect: () => step("disconnect"), stop: () => step("stop"), start: () => step("start"),
      connect: () => assert.fail("quit must not reconnect")
    });
    assert.equal(await restart(), false);
    assert.deepEqual(calls, {
      before: [], disconnect: ["disconnect"], stop: ["disconnect", "stop"],
      start: ["disconnect", "stop", "start", "stop"]
    }[stopAfter]);
  }
});

test("cancelled start during shutdown is quiet but genuine restart failure propagates", async () => {
  for (const closing of [false, true]) {
    let quitting = false;
    const restart = createGatewayRestart({
      shouldStop: () => quitting,
      disconnect: async () => {}, stop: async () => {},
      start: async () => { quitting = closing; throw new Error("Gateway start cancelled"); },
      connect: () => assert.fail("failed start must not reconnect")
    });
    if (closing) assert.equal(await restart(), false);
    else await assert.rejects(restart(), /start cancelled/);
  }
});

test("restart does not report success when either channel fails readiness", async () => {
  const restart = createGatewayRestart({
    disconnect: async () => {}, stop: async () => {}, start: async () => ({ port: 43123, token: "synthetic" }),
    connect: async () => false
  });
  assert.equal(await restart(), false);
});
