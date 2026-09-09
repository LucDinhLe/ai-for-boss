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

test("provider ordering does not replace native connection discovery", () => {
  const connect = read("apps/desktop/src/connect/ConnectScreen.tsx");
  // D0056 explicitly permits brand labels/order; callable routes remain native.
  assert.ok(connect.includes('(detect?.authOptions ?? [])'));
  assert.ok(connect.includes('(detect?.candidates ?? [])'));
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

test("the Connect screen waits for a wizard step instead of ending the flow", () => {
  const connect = fs.readFileSync(path.join(repoRoot, "apps/desktop/src/connect/ConnectScreen.tsx"), "utf8");
  assert.ok(connect.includes('"wizard.next", { sessionId }'), "a pending step must be retrieved without fabricating an answer");
  assert.equal(connect.includes("wizard.status"), false, "native status returns lifecycle only, never the pending step");
  assert.ok(
    /done === true && reply.status === "done"/.test(connect) && connect.includes('reply.modelActivation?.modelRef'),
    "completion requires the native activation receipt; queued progress can already carry status done"
  );
});

test("the Connect screen passes the exact native choice to both activation shapes", () => {
  const connect = fs.readFileSync(path.join(repoRoot, "apps/desktop/src/connect/ConnectScreen.tsx"), "utf8");
  assert.ok(connect.includes('kind: "api-key"'), "a pasted key must use the api-key activation");
  assert.ok(connect.includes("openclaw.setup.auth.start"), "browser sign-in must stay available");
  assert.ok(connect.includes('authChoice: provider.id'));
  assert.equal(/authChoice:\s*["']/u.test(connect), false);
});

test("only an activation receipt explicitly requiring restart restarts the Gateway", () => {
  const main = fs.readFileSync(path.join(repoRoot, "apps/desktop/electron/main.mjs"), "utf8");
  assert.ok(main.includes("finishesSetup"), "no restart trigger for a wizard that reports done");
  assert.ok(main.includes('method === "wizard.cancel"'), "a cancelled wizard must not restart the Gateway");
  assert.ok(main.includes("restartGatewayForSetup"));
  const source = main.slice(main.indexOf('function finishesSetup('), main.indexOf('\n}', main.indexOf('function finishesSetup(')) + 2);
  const evaluate = new Function(`${source}; return finishesSetup;`)();
  const receipt = { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } };
  assert.equal(evaluate('wizard.next', receipt), false, 'hot-applied activation needs no restart');
  assert.equal(evaluate('wizard.next', { ...receipt, modelActivation: { ...receipt.modelActivation, gatewayRestartRequired: true } }), true);
  assert.equal(evaluate('wizard.next', { ...receipt, done: false, gatewayRestartRequired: true }), false);
  assert.equal(evaluate('wizard.next', { ...receipt, status: 'error', gatewayRestartRequired: true }), false);
  assert.equal(evaluate('wizard.cancel', { ...receipt, gatewayRestartRequired: true }), false);
  assert.equal(evaluate('wizard.status', { status: 'done' }), false);
});
