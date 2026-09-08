import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { ABORT_PROMPT, COMPLETE_PROMPT, COMPLETE_REPLY, MODEL_ID, MODEL_REF,
  classifyFixtureRequest, fixtureConfig, isolatedEnvironment, startFixtureModel } from "../../scripts/native-chat-fixture.mjs";

test("fixture environment drops inherited account keys, profiles, proxy and Node injection", () => {
  const root = path.resolve("synthetic-fixture-home");
  const env = isolatedEnvironment(root, { SystemRoot: "C:\\Windows", OPENAI_API_KEY: "must-not-copy",
    OPENCLAW_CONFIG_PATH: "real-profile", OPENCLAW_AGENT_DIR: "real-agent", NODE_OPTIONS: "--import injected",
    HTTPS_PROXY: "https://external-proxy.invalid", PATH: "host-bin", HOME: "real-home", USERPROFILE: "real-home" });
  for (const key of ["OPENAI_API_KEY", "OPENCLAW_AGENT_DIR", "NODE_OPTIONS", "HTTPS_PROXY"]) assert.equal(env[key], undefined);
  assert.equal(env.PATH, ""); assert.equal(env.HOME, root); assert.equal(env.USERPROFILE, root);
  assert.equal(env.OPENCLAW_HOME, root); assert.equal(env.OPENCLAW_CONFIG_PATH, path.join(root, "openclaw.json"));
  assert.equal(env.OPENCLAW_NO_AUTO_UPDATE, "1"); assert.equal(env.SystemRoot, "C:\\Windows");
});

test("fixture configuration has one loopback route, no fallback/tool execution or scheduled model work", () => {
  const cfg = fixtureConfig(path.resolve("synthetic-fixture-home"), 31234, "generated-fixture-only");
  assert.equal(cfg.models.mode, "replace"); assert.equal(cfg.models.catalogRefresh.enabled, false);
  const routes = Object.values(cfg.models.providers);
  assert.equal(routes.length, 1); assert.equal(routes[0].baseUrl, "http://127.0.0.1:31234/v1");
  assert.equal(routes[0].agentRuntime.id, "openclaw"); assert.equal(routes[0].models[0].compat.supportsTools, false);
  assert.deepEqual(cfg.agents.defaults.model, { primary: MODEL_REF, fallbacks: [] });
  assert.deepEqual(cfg.tools.deny, ["*"]); assert.equal(cfg.cron.enabled, false);
  assert.equal(cfg.agents.defaults.heartbeat.every, "0m"); assert.equal(cfg.update.checkOnStart, false);
  assert.equal(cfg.plugins.enabled, false); assert.equal(cfg.telemetry.enabled, false);
  assert.throws(() => fixtureConfig("unused", 0, "fixture"), /loopback port/);
});

test("fixture request guard rejects arbitrary paths, credentials, models, prompts and tools", () => {
  const request = { method: "POST", url: "/v1/chat/completions", headers: { authorization: "Bearer fixture" } };
  const body = { model: MODEL_ID, stream: true, messages: [{ role: "user", content: COMPLETE_PROMPT }] };
  assert.equal(classifyFixtureRequest(request, body, "fixture"), "complete");
  assert.equal(classifyFixtureRequest(request, { ...body, messages: [{ role: "user", content: ABORT_PROMPT }] }, "fixture"), "abort");
  assert.throws(() => classifyFixtureRequest({ ...request, url: "http://external.invalid/v1/chat/completions" }, body, "fixture"));
  assert.throws(() => classifyFixtureRequest({ ...request, headers: {} }, body, "fixture"));
  for (const patch of [{ model: "external-model" }, { tools: [{ type: "function" }] }, { stream: false },
    { messages: [{ role: "user", content: "unrecognized task" }] }]) {
    assert.throws(() => classifyFixtureRequest(request, { ...body, ...patch }, "fixture"));
  }
});

test("loopback fixture emits complete SSE and observes cancellation of the held stream without Gateway", async () => {
  const fixture = await startFixtureModel("unit-fixture");
  try {
    const send = (message, signal) => fetch(`http://127.0.0.1:${fixture.port}/v1/chat/completions`, {
      method: "POST", headers: { authorization: "Bearer unit-fixture", "content-type": "application/json" }, signal,
      body: JSON.stringify({ model: MODEL_ID, stream: true, messages: [{ role: "user", content: message }] })
    });
    const response = await send(COMPLETE_PROMPT);
    assert.equal(response.status, 200);
    const text = await response.text();
    const frames = text.split("\n").filter((line) => line.startsWith("data: {")).map((line) => JSON.parse(line.slice(6)));
    assert.equal(frames.map((frame) => frame.choices?.[0]?.delta?.content ?? "").join(""), COMPLETE_REPLY);
    assert.ok(frames.some((frame) => frame.choices?.[0]?.finish_reason === "stop"));
    assert.ok(text.includes("data: [DONE]"));
    const held = await send(ABORT_PROMPT);
    const reader = held.body.getReader(); await reader.read(); await reader.cancel();
    for (let attempt = 0; attempt < 40 && fixture.observation.abortedConnections === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(fixture.observation.requests, 2); assert.equal(fixture.observation.completed, 1);
    assert.equal(fixture.observation.abortedConnections, 1); assert.equal(fixture.observation.rejected, 0);
  } finally { await fixture.close(); }
});
