import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_METHODS,
  CLIENT_NAME,
  FORWARDED_EVENTS,
  OPERATOR_ROLE,
  OPERATOR_SCOPES,
  READ_METHODS,
  WRITE_METHODS,
  isAllowedMethod,
  isForwardedEvent
} from "../../apps/desktop/electron/gateway-adapter.mjs";
import {
  GATEWAY_EVENT_CHANNEL,
  GATEWAY_REQUEST_CHANNEL,
  GATEWAY_STATUS_CHANNEL,
  GATEWAY_STATUS_EVENT_CHANNEL,
  MAIN_TO_RENDERER_CHANNELS,
  RENDERER_INVOKE_CHANNELS,
  SETUP_REQUEST_CHANNEL,
  SHELL_STATUS_CHANNEL
} from "../../apps/desktop/electron/security-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("the renderer method allowlist is closed and read-heavy", () => {
  assert.deepEqual(ALLOWED_METHODS, [...READ_METHODS, ...WRITE_METHODS]);
  assert.equal(new Set(ALLOWED_METHODS).size, ALLOWED_METHODS.length);
  for (const method of ALLOWED_METHODS) assert.ok(isAllowedMethod(method));
  assert.equal(isAllowedMethod("config.patch"), false);
  assert.equal(isAllowedMethod("secrets.store.set"), false);
  assert.equal(isAllowedMethod(""), false);
  assert.equal(isAllowedMethod("sessions.send "), false, "method names are matched exactly");
});

test("capabilities this gate has not built stay unreachable from the renderer", () => {
  const unbuilt = [
    "tools.invoke",
    "tools.catalog",
    "exec.approval.resolve",
    "exec.approval.request",
    "terminal.open",
    "terminal.input",
    "browser.request",
    "plugins.install",
    "plugins.setEnabled",
    "skills.install",
    "cron.add",
    "node.invoke",
    "secrets.store.set",
    "config.set",
    "config.patch",
    "channels.start",
    "talk.speak",
    "sessions.delete"
  ];
  for (const method of unbuilt) {
    assert.equal(isAllowedMethod(method), false, `${method} must stay blocked in beta 0`);
  }
});

test("event forwarding covers the transcript and nothing that implies an unbuilt capability", () => {
  assert.ok(isForwardedEvent("session.message"));
  assert.ok(isForwardedEvent("chat"));
  assert.equal(isForwardedEvent("exec.approval.requested"), false);
  assert.equal(isForwardedEvent("terminal.data"), false);
  assert.equal(isForwardedEvent("question.requested"), false);
  assert.equal(new Set(FORWARDED_EVENTS).size, FORWARDED_EVENTS.length);
});

test("the adapter asks for the chat scopes only", () => {
  assert.equal(OPERATOR_ROLE, "operator");
  assert.deepEqual([...OPERATOR_SCOPES].sort(), ["operator.approvals", "operator.read", "operator.write"]);
  assert.equal(OPERATOR_SCOPES.includes("operator.admin"), false);
  assert.equal(OPERATOR_SCOPES.includes("operator.pairing"), false);
});

test("the client identifies with a registry-valid id", () => {
  const registry = [
    "webchat-ui",
    "openclaw-control-ui",
    "openclaw-browser-copilot",
    "openclaw-tui",
    "webchat",
    "cli",
    "gateway-client",
    "openclaw-macos",
    "openclaw-linux",
    "openclaw-ios",
    "openclaw-watchos",
    "openclaw-android",
    "node-host",
    "openclaw-worker",
    "test",
    "fingerprint",
    "openclaw-probe"
  ];
  assert.ok(registry.includes(CLIENT_NAME));
});

test("the IPC surface is exactly the documented channels", () => {
  assert.deepEqual(RENDERER_INVOKE_CHANNELS, [
    SHELL_STATUS_CHANNEL,
    GATEWAY_REQUEST_CHANNEL,
    GATEWAY_STATUS_CHANNEL,
    SETUP_REQUEST_CHANNEL
  ]);
  assert.deepEqual(MAIN_TO_RENDERER_CHANNELS, [GATEWAY_STATUS_EVENT_CHANNEL, GATEWAY_EVENT_CHANNEL]);

  const preload = read("apps/desktop/electron/preload.cjs");
  for (const channel of [...RENDERER_INVOKE_CHANNELS, ...MAIN_TO_RENDERER_CHANNELS]) {
    assert.ok(preload.includes(`"${channel}"`), `preload is missing ${channel}`);
  }
  const declared = [...preload.matchAll(/"aifb:[a-z-]+"/g)].map((match) => match[0].slice(1, -1));
  for (const channel of new Set(declared)) {
    assert.ok(
      [...RENDERER_INVOKE_CHANNELS, ...MAIN_TO_RENDERER_CHANNELS].includes(channel),
      `preload declares an undocumented channel ${channel}`
    );
  }
});

test("every main-process IPC handler checks the sender", () => {
  const main = read("apps/desktop/electron/main.mjs");
  const handlers = [...main.matchAll(/ipcMain\.handle\(([^,]+),\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\n\}\);/g)];
  assert.equal(handlers.length, RENDERER_INVOKE_CHANNELS.length);
  for (const [, channel, , body] of handlers) {
    assert.ok(body.includes("isTrustedRendererEvent"), `${channel.trim()} does not verify the sender`);
  }
  assert.equal(/ipcMain\.on\s*\(/.test(main), false, "main exposes a fire-and-forget channel");
});

test("the renderer bridge never opens transport or storage of its own", () => {
  const sources = ["apps/desktop/src/App.tsx", "apps/desktop/src/gateway-client.ts"].map(read).join("\n");
  assert.equal(/new WebSocket\s*\(|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB/.test(sources), false);
  assert.equal(/require\s*\(|from "node:/.test(sources), false, "renderer imports a Node builtin");
});

test("the Gateway child is never started without loopback binding and a token", () => {
  const supervisor = read("apps/desktop/electron/supervisor.mjs");
  assert.ok(supervisor.includes('"--bind",\n      "loopback"'));
  assert.ok(supervisor.includes('"--auth",\n      "token"'));
  assert.equal(/"--bind",\s*"(?:lan|tailnet|auto|custom)"/.test(supervisor), false);
  assert.equal(/OPENCLAW_ALLOW_INSECURE_PRIVATE_WS/.test(supervisor), false);
});
