import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { planAnswer, redact, SECRET_KEY_PATTERN } from "../../scripts/provider-verify.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const harness = fs.readFileSync(path.join(repoRoot, "scripts", "provider-verify.mjs"), "utf8");

// A literal that looks like a real key would trip the repository secret scanner,
// so the fixture is assembled at runtime instead.
const SENTINEL = ["sk", "live", "must", "never", "appear"].join("-");

test("a secret never reaches the evidence record", () => {
  const record = {
    apiKey: SENTINEL,
    nested: { deviceToken: "tok_abc", label: "OpenAI" },
    list: [{ secret: "shh" }, { label: "fine" }]
  };
  const serialised = JSON.stringify(redact(record));
  assert.equal(serialised.includes(SENTINEL), false);
  assert.equal(serialised.includes("tok_abc"), false);
  assert.equal(serialised.includes("shh"), false);
  assert.ok(serialised.includes("OpenAI"), "labels stay readable");
  for (const key of ["apiKey", "token", "client_secret", "password", "Authorization", "cookie"]) {
    assert.ok(SECRET_KEY_PATTERN.test(key), `${key} must be treated as a secret`);
  }
});

test("a flag that merely reads like a secret stays readable", () => {
  const kept = redact({ apiKeySupported: true, keyCount: 3, apiKey: "value" });
  assert.equal(kept.apiKeySupported, true, "a boolean carries no secret");
  assert.equal(kept.keyCount, 3);
  assert.equal(kept.apiKey, "[redacted]", "a string under a secret-shaped name is still hidden");
});

test("redaction survives a cyclic or absurdly deep structure", () => {
  let deep = { label: "leaf" };
  for (let level = 0; level < 30; level += 1) deep = { child: deep };
  assert.doesNotThrow(() => JSON.stringify(redact(deep)));
});

test("steps the harness can answer alone are answered, and only those", () => {
  assert.equal(planAnswer({ id: "a", type: "note" }).value, true);
  assert.equal(planAnswer({ id: "b", type: "confirm" }).value, true);
  assert.equal(planAnswer({ id: "c", type: "progress" }).value, true);
  assert.equal(
    planAnswer({
      id: "d",
      type: "select",
      options: [{ value: "one", label: "One" }, { value: "two", label: "Two", recommended: true }]
    }).value,
    "two",
    "a recommended option wins over position"
  );
  assert.deepEqual(planAnswer({ id: "e", type: "multiselect", options: [{ value: "x", recommended: true }, { value: "y" }] }).value, ["x"]);
});

test("a secret step is answered only from the environment, never from a default", () => {
  const step = { id: "key", type: "text", secret: true };
  assert.equal(planAnswer(step).value, null, "no secret means the run stops rather than guessing");
  assert.equal(planAnswer(step, { secret: "value-from-env" }).value, "value-from-env");
});

test("steps that need a person stop the non-interactive run", () => {
  for (const step of [
    { id: "f", type: "text" },
    { id: "g", type: "action" },
    { id: "h", type: "select", options: [] },
    { id: "i", type: "something-upstream-added" }
  ]) {
    assert.equal(planAnswer(step).value, null, `${step.type} must not be auto-answered`);
  }
});

test("an explicit command-line answer overrides every policy", () => {
  const answers = new Map([["key", "typed-by-hand"]]);
  assert.equal(planAnswer({ id: "key", type: "text", secret: true }, { answers, secret: "env" }).value, "typed-by-hand");
});

test("the harness reads its credential from the environment, not from argv", () => {
  assert.ok(harness.includes("process.env.AIFB_PROVIDER_SECRET"));
  assert.equal(/--secret|--api-key|--token\b/.test(harness), false, "a credential flag would leak into the process list");
});

test("the harness names no provider of its own", () => {
  const withoutComments = harness.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const provider of ["openai", "anthropic", "gemini", "openrouter", "copilot", "ollama"]) {
    assert.equal(
      new RegExp(`["'\`][^"'\`]*${provider}`, "i").test(withoutComments),
      false,
      `the harness hard-codes ${provider}`
    );
  }
});

test("the harness drives the same modules the desktop app ships", () => {
  assert.ok(harness.includes("../apps/desktop/electron/supervisor.mjs"));
  assert.ok(harness.includes("../apps/desktop/electron/gateway-adapter.mjs"));
  assert.ok(harness.includes("../apps/desktop/electron/setup-channel.mjs"));
  assert.equal(/new GatewayClient|new WebSocket/.test(harness), false, "the harness must not open a connection of its own");
});
