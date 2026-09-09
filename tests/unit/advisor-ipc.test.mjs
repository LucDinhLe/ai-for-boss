import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { isTrustedRendererEvent, ADVISOR_REQUEST_CHANNEL } from "../../apps/desktop/electron/security-policy.mjs";

test("Advisor main handler accepts only the trusted renderer and one packet outside smoke/shutdown", () => {
  const source = fs.readFileSync(new URL("../../apps/desktop/electron/main.mjs", import.meta.url), "utf8");
  const handlerSource = source.match(/ipcMain\.handle\(ADVISOR_REQUEST_CHANNEL,[\s\S]*?\n\}\);/)?.[0];
  assert.ok(handlerSource);
  const calls = [];
  const frame = {};
  const mainWindow = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  let handler;
  const context = vm.createContext({ ipcMain: { handle: (channel, value) => {
    assert.equal(channel, ADVISOR_REQUEST_CHANNEL); handler = value;
  } }, ADVISOR_REQUEST_CHANNEL, isTrustedRendererEvent, mainWindow, smoke: false, shuttingDown: false, channelWorkGuard: { busy: false },
  supervisionService: { status: () => null }, advisorService: { request: packet => { calls.push(packet); return "accepted"; } } });
  vm.runInContext(handlerSource, context);
  const event = { sender: mainWindow.webContents, senderFrame: frame };
  const packet = { action: "review" };
  assert.equal(handler(event, packet), "accepted");
  for (const untrusted of [{}, { sender: {}, senderFrame: frame }, { sender: mainWindow.webContents, senderFrame: {} }])
    assert.throws(() => handler(untrusted, packet), /Untrusted/);
  assert.throws(() => handler(event), /unavailable/);
  assert.throws(() => handler(event, packet, packet), /unavailable/);
  context.smoke = true;
  assert.throws(() => handler(event, packet), /unavailable/);
  context.smoke = false; context.shuttingDown = true;
  assert.throws(() => handler(event, packet), /unavailable/);
  assert.deepEqual(calls, [packet]);
});

test("real preload exposes a frozen Advisor packet bridge without renderer-selected RPCs", async () => {
  const source = fs.readFileSync(new URL("../../apps/desktop/electron/preload.cjs", import.meta.url), "utf8");
  const calls = [];
  let bridge;
  const context = vm.createContext({ require: name => {
    assert.equal(name, "electron");
    return { contextBridge: { exposeInMainWorld: (key, value) => {
      assert.equal(key, "aiForBoss"); bridge = value;
    } }, ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve("ok"); } } };
  } });
  vm.runInContext(source, context);
  assert.ok(Object.isFrozen(bridge.advisor));
  assert.deepEqual(Object.keys(bridge.advisor), ["request"]);
  const packet = { action: "cancel", id: "synthetic" };
  assert.equal(await bridge.advisor.request(packet), "ok");
  assert.deepEqual(calls, [[ADVISOR_REQUEST_CHANNEL, packet]]);
});
