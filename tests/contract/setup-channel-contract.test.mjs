import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SETUP_METHODS,
  SETUP_SCOPES,
  isForbiddenOnSetupChannel,
  isSetupMethod
} from "../../apps/desktop/electron/setup-channel.mjs";
import { ALLOWED_METHODS, OPERATOR_SCOPES, isAllowedMethod } from "../../apps/desktop/electron/gateway-adapter.mjs";
import { RENDERER_INVOKE_CHANNELS, SETUP_REQUEST_CHANNEL } from "../../apps/desktop/electron/security-policy.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("admin lives on the setup channel and never on the chat adapter", () => {
  assert.equal(SETUP_SCOPES.includes("operator.admin"), true);
  assert.equal(OPERATOR_SCOPES.includes("operator.admin"), false);
  // The setup channel is the chat scopes plus admin, nothing else invented.
  assert.deepEqual([...SETUP_SCOPES].sort(), [...OPERATOR_SCOPES, "operator.admin"].sort());
});

test("the setup allowlist covers provider connection and nothing beyond it", () => {
  for (const method of SETUP_METHODS) assert.ok(isSetupMethod(method));
  assert.equal(new Set(SETUP_METHODS).size, SETUP_METHODS.length);
  for (const method of ["openclaw.setup.detect", "openclaw.setup.auth.start", "wizard.next", "models.authStatus"]) {
    assert.ok(isSetupMethod(method), `${method} must be reachable for connecting a provider`);
  }
  for (const method of [
    "config.patch",
    "config.set",
    "secrets.store.set",
    "plugins.install",
    "tools.invoke",
    "exec.approval.resolve",
    "terminal.open",
    "node.invoke",
    "channels.start",
    "cron.add",
    "skills.install",
    "sessions.send",
    "chat.send"
  ]) {
    assert.equal(isSetupMethod(method), false, `${method} must not be reachable on the setup channel`);
  }
});

test("admin-shaped families stay blocked even if the allowlist were widened", () => {
  // Belt and braces: the prefix guard runs before the allowlist check, so a
  // future edit that adds config.* to the list still cannot reach it.
  for (const method of ["config.patch", "secrets.resolve", "plugins.uninstall", "exec.approvals.set", "terminal.input"]) {
    assert.ok(isForbiddenOnSetupChannel(method), `${method} must be refused by the prefix guard`);
  }
  for (const method of SETUP_METHODS) {
    assert.equal(isForbiddenOnSetupChannel(method), false, `${method} must survive the prefix guard`);
  }
});

test("the channels overlap only on read-only status, never on a mutation", () => {
  // models.authStatus is legitimately on both: the chat window shows whether a
  // provider is connected, and setup reads the same fact. Everything that
  // changes state must live on exactly one channel.
  const shared = SETUP_METHODS.filter((method) => isAllowedMethod(method));
  assert.deepEqual(shared, ["models.authStatus"]);

  for (const method of SETUP_METHODS) {
    if (shared.includes(method)) continue;
    assert.equal(isAllowedMethod(method), false, `${method} must stay off the chat channel`);
  }
  for (const method of ALLOWED_METHODS) {
    if (shared.includes(method)) continue;
    assert.equal(isSetupMethod(method), false, `${method} must stay off the setup channel`);
  }
  // No setup or wizard call may ever be reachable from the chat allowlist.
  for (const method of ALLOWED_METHODS) {
    assert.equal(/^(openclaw\.setup|wizard)\./.test(method), false, `${method} is a setup call on the chat channel`);
  }
});

test("the renderer reaches setup only through its own named channel", () => {
  assert.ok(RENDERER_INVOKE_CHANNELS.includes(SETUP_REQUEST_CHANNEL));
  const preload = read("apps/desktop/electron/preload.cjs");
  assert.ok(preload.includes(`"${SETUP_REQUEST_CHANNEL}"`));
  const main = read("apps/desktop/electron/main.mjs");
  assert.ok(main.includes("SETUP_REQUEST_CHANNEL"));
  assert.ok(main.includes("isTrustedRendererEvent"));
  // Activation restarts the child; the renderer must never be left talking to a dead gateway.
  assert.ok(main.includes("gatewayRestartRequired"));
  assert.ok(main.includes("restartGatewayForSetup"));
});

test("the shell names no provider of its own", () => {
  const connect = read("apps/desktop/src/connect/ConnectScreen.tsx");
  // The catalogue is rendered from what the Gateway reports. Hard-coding a
  // provider here would silently freeze the list the day OpenClaw adds one.
  for (const provider of ["openai", "anthropic", "gemini", "openrouter", "copilot", "ollama", "mistral"]) {
    assert.equal(
      new RegExp(`["'\`][^"'\`]*${provider}`, "i").test(connect),
      false,
      `ConnectScreen must not hard-code ${provider}`
    );
  }
  assert.ok(connect.includes("openclaw.setup.detect"));
  assert.ok(connect.includes("manualProviders"));
});

test("unrecognised wizard text is shown verbatim rather than guessed at", () => {
  const vi = read("apps/desktop/src/connect/wizard-vi.ts");
  assert.ok(vi.includes("recognised"));
  assert.ok(vi.includes("CHROME"));
  const connect = read("apps/desktop/src/connect/ConnectScreen.tsx");
  assert.ok(connect.includes("local.recognised"));
  assert.ok(connect.includes("CHROME.unrecognised"));
});
