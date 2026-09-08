import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createGatewayRestart, createStartupRetry } from "../../apps/desktop/electron/startup-readiness.mjs";
import { isTrustedRendererEvent } from "../../apps/desktop/electron/security-policy.mjs";

const failed = () => ({ supervisor: "safe-mode", connected: false, setupReady: false });

test("startup retry cannot dispatch in smoke, shutdown, without an owner, or outside safe mode", async () => {
  for (const change of [
    { isSmoke: () => true }, { shouldStop: () => true }, { hasSupervisor: () => false },
    ...["idle", "starting", "restarting", "ready"].map(supervisor => ({ getRuntimeStatus: () => ({ ...failed(), supervisor }) })),
    { getRuntimeStatus: () => ({ ...failed(), connected: true }) },
    { getRuntimeStatus: () => ({ ...failed(), setupReady: true }) }
  ]) {
    let calls = 0;
    const retry = createStartupRetry({ restart: () => { calls++; return true; }, getRuntimeStatus: failed,
      hasSupervisor: () => true, ...change });
    await assert.rejects(retry(), /STARTUP_RETRY_UNAVAILABLE/u);
    assert.equal(calls, 0);
  }
});

test("startup retry refuses every supplied payload, including an explicit undefined", async () => {
  let calls = 0;
  const retry = createStartupRetry({ restart: () => { calls++; return true; }, getRuntimeStatus: failed,
    hasSupervisor: () => true });
  for (const payload of [undefined, null, {}, { path: "untrusted", token: "untrusted" }, "restart"])
    await assert.rejects(retry(payload), /STARTUP_RETRY_UNAVAILABLE/u);
  assert.equal(calls, 0);
});

test("repeated user clicks share one stop-before-start attempt through both handshakes", async () => {
  const calls = [];
  let state = failed();
  let release;
  const restart = createGatewayRestart({
    onRestart: () => { state = { ...failed(), supervisor: "restarting" }; },
    disconnect: () => { calls.push("disconnect"); return new Promise(resolve => { release = resolve; }); },
    stop: async () => { calls.push("stop"); },
    start: async () => { calls.push("start"); return { port: 43123, token: "synthetic" }; },
    connect: async endpoint => {
      assert.equal(endpoint.port, 43123);
      calls.push("connect-both"); state = { supervisor: "ready", connected: true, setupReady: true }; return true;
    }
  });
  const retry = createStartupRetry({ restart, getRuntimeStatus: () => state, hasSupervisor: () => true });
  const first = retry();
  const second = retry();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(state.supervisor, "restarting");
  assert.equal(retry(), first, "a click during the accepted attempt joins it rather than creating another start");
  assert.deepEqual(calls, ["disconnect"]);
  release();
  assert.equal(await first, true);
  assert.deepEqual(calls, ["disconnect", "stop", "start", "connect-both"]);
  await assert.rejects(retry(), /STARTUP_RETRY_UNAVAILABLE/u);
});

test("failed stop never creates a replacement and exposes only a failure result", async () => {
  const calls = [];
  let failures = 0;
  const retry = createStartupRetry({
    getRuntimeStatus: failed, hasSupervisor: () => true, onFailure: () => { failures++; },
    restart: createGatewayRestart({ disconnect: async () => { calls.push("disconnect"); },
      stop: async () => { calls.push("stop"); throw new Error("SECRET_NATIVE_PATH"); },
      start: () => assert.fail("a process with unverified stop must not be replaced"),
      connect: () => assert.fail("failed stop must not connect") })
  });
  assert.equal(await retry(), false);
  assert.equal(failures, 1);
  assert.deepEqual(calls, ["disconnect", "stop"]);
});

test("shutdown or a late ready update before the queued retry prevents any dispatch", async () => {
  for (const transition of ["quit", "ready", "owner-gone"]) {
    let quitting = false;
    let owner = true;
    let state = failed();
    let calls = 0;
    const retry = createStartupRetry({ restart: () => { calls++; return true; },
      getRuntimeStatus: () => state, hasSupervisor: () => owner, shouldStop: () => quitting });
    const pending = retry();
    if (transition === "quit") quitting = true;
    if (transition === "ready") state = { ...failed(), supervisor: "ready", connected: true };
    if (transition === "owner-gone") owner = false;
    assert.equal(await pending, false);
    assert.equal(calls, 0);
  }
});

test("failed readiness does not retry automatically and shutdown cannot trigger failure UI", async () => {
  let attempts = 0;
  let quitting = false;
  let failures = 0;
  const retry = createStartupRetry({ restart: async () => { attempts++; return false; },
    getRuntimeStatus: failed, hasSupervisor: () => true, shouldStop: () => quitting,
    onFailure: () => { failures++; } });
  assert.equal(await retry(), false);
  await Promise.resolve();
  assert.equal(attempts, 1);
  assert.equal(await retry(), false, "a fresh user click can retry after the previous attempt ended");
  assert.equal(attempts, 2);
  quitting = true;
  await assert.rejects(retry());
  assert.equal(failures, 0);
});

test("the actual retry IPC handler checks the exact main frame and refuses all arguments", async () => {
  const source = fs.readFileSync(new URL("../../apps/desktop/electron/main.mjs", import.meta.url), "utf8");
  const match = source.match(/ipcMain\.handle\(GATEWAY_RETRY_CHANNEL, ([\s\S]*?)\n\}\);/u);
  assert.ok(match, "main must register the dedicated retry handler");
  let calls = 0;
  const mainFrame = {};
  const mainContents = { mainFrame };
  const window = { isDestroyed: () => false, webContents: mainContents };
  const event = { sender: mainContents, senderFrame: mainFrame };
  const handler = vm.runInNewContext(`(${match[1]}\n})`, {
    mainWindow: window, isTrustedRendererEvent, retryStartup: () => { calls++; return Promise.resolve(true); }
  });
  for (const foreign of [{}, { ...event, sender: {} }, { ...event, senderFrame: {} }])
    assert.throws(() => handler(foreign), /Untrusted/u);
  for (const payload of [undefined, null, {}, "arbitrary"])
    assert.throws(() => handler(event, payload), /no arguments/u);
  assert.equal(calls, 0);
  assert.equal(await handler(event), true);
  assert.equal(calls, 1);
  window.isDestroyed = () => true;
  assert.throws(() => handler(event), /Untrusted/u);
});

test("the preload's dedicated retry sends no method, token, endpoint or payload", async () => {
  const source = fs.readFileSync(new URL("../../apps/desktop/electron/preload.cjs", import.meta.url), "utf8");
  const calls = [];
  let exposed;
  vm.runInNewContext(source, { require: name => {
    assert.equal(name, "electron");
    return { contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api; } },
      ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve(true); } } };
  } });
  assert.equal(calls.length, 0, "loading the bridge cannot retry startup");
  assert.equal(await exposed.gateway.retryStartup(), true);
  assert.deepEqual(calls, [["aifb:gateway-retry-startup"]]);
});
