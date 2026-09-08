import assert from "node:assert/strict";
import test from "node:test";
import { SetupChannel, SETUP_METHODS } from "../../apps/desktop/electron/setup-channel.mjs";
import { classifyAdvisorFixtureRequest, MODEL_IDENTITY } from "../../scripts/native-advisor-fixture.mjs";

const requestId = "12345678-1234-4123-8123-123456789abc";
const sessionKey = `agent:fixture:explicit:model-run-${requestId}`;
const valid = () => ({ requestId, agentId: "fixture", model: { id: "selected", provider: "fixture-provider" }, prompt: "Review this supplied packet." });

test("native fixture rejects extra context and tools before returning a simulated answer", () => {
  const request = { method: "POST", url: "/v1/chat/completions", headers: { authorization: "Bearer generated-only" } };
  const body = { model: "native-fixture", stream: true, messages: [{ role: "user", content: "exact packet" }] };
  const expected = new Map([["exact packet", "complete"]]);
  const classify = (input, req = request) => classifyAdvisorFixtureRequest(req, input, "generated-only", expected);
  assert.equal(classify(body), "complete");
  assert.equal(classify({ ...body, messages: [{ role: "system", content: MODEL_IDENTITY }, ...body.messages] }), "complete");
  for (const changed of [
    { ...body, tools: [{ type: "function", function: { name: "read" } }] },
    { ...body, functions: [{ name: "write" }] },
    { ...body, messages: [{ role: "system", content: "bootstrap" }, ...body.messages] },
    { ...body, messages: [...body.messages, { role: "assistant", content: "old result" }] },
    { ...body, messages: [{ role: "user", content: "changed packet" }] },
    { ...body, messages: [{ role: "user", content: [{ type: "image", image_url: "external" }] }] }
  ]) assert.throws(() => classify(changed));
  assert.throws(() => classify(body, { ...request, url: "/arbitrary" }));
  assert.throws(() => classify(body, { ...request, headers: { authorization: "Bearer wrong" } }));
});

test("fixture permits only the injected same-run denied-tool continuation", () => {
  const request = { method: "POST", url: "/v1/chat/completions", headers: { authorization: "Bearer generated-only" } };
  const marker = "temporary-fixture-marker";
  const body = { model: "native-fixture", stream: true, messages: [
    { role: "system", content: MODEL_IDENTITY }, { role: "user", content: "exact malicious packet" },
    { role: "assistant", tool_calls: [{ id: "call-fixture-write", type: "function",
      function: { name: "write", arguments: JSON.stringify({ path: marker, content: "SHOULD_NOT_EXIST" }) } }] },
    { role: "tool", tool_call_id: "call-fixture-write", content: "Tool write not found" }
  ] };
  const expected = new Map([["exact malicious packet", "malicious"]]);
  const classify = (input) => classifyAdvisorFixtureRequest(request, input, "generated-only", expected, marker);
  assert.equal(classify(body), "tool-denied");
  for (const tool of [{ role: "tool", tool_call_id: "different", content: "Tool write not found" },
    { role: "tool", tool_call_id: "call-fixture-write", content: "File written successfully" },
    { role: "assistant", content: "Tool write not found" }]) {
    assert.throws(() => classify({ ...body, messages: [...body.messages.slice(0, -1), tool] }));
  }
  assert.throws(() => classify({ ...body, messages: [...body.messages, { role: "user", content: "other history" }] }));
});
function fixture(scopes = ["operator.admin"]) {
  const instances = [];
  class Client {
    constructor(options) { this.options = options; this.calls = []; instances.push(this); }
    start() {}
    async stopAndWait() {}
    request(method, params, options) {
      this.calls.push({ method, params, options });
      if (method === "chat.abort") return this.abortResponder?.() ?? Promise.resolve({ ok: true, aborted: true, runIds: [params.runId] });
      if (method === "agent.wait") return Promise.resolve(this.waitResult ?? { runId: params.runId, status: "timeout" });
      return new Promise((resolve, reject) => {
        this.pending = { params, options, resolve, reject };
        options.signal?.addEventListener("abort", () => reject(new Error("local request aborted")), { once: true });
      });
    }
    accept(patch = {}) { this.pending.options.onAccepted({ runId: requestId, sessionKey, agentId: "fixture", status: "accepted", ...patch }); }
    finish(patch = {}) { const value = { runId: requestId, status: "ok", result: { payloads: [{ text: "{}" }] }, ...patch }; this.pending.resolve(value); return value; }
  }
  const channel = new SetupChannel({ stateDirectory: "/unused-fixture", Client, identityLoader: () => ({ deviceId: "fixture" }) });
  channel.connect({ url: "ws://127.0.0.1:43123", token: "synthetic" });
  const client = instances[0];
  client.options.onHelloOk({ auth: { scopes } });
  return { channel, client };
}

test("fixed Advisor primitive keeps raw RPCs outside the ten generic setup methods", async () => {
  const { channel, client } = fixture();
  assert.equal(SETUP_METHODS.length, 10);
  for (const method of ["agent", "chat.abort", "config.patch", "sessions.create"]) {
    await assert.rejects(channel.request(method, valid()), /not allowed/);
  }
  assert.equal(client.calls.length, 0);
});

test("Advisor dispatch pins raw mode, no delivery, exact fresh key and final-response semantics", async () => {
  const { channel, client } = fixture();
  const accepted = [];
  const promise = channel.runAdvisorModel({ ...valid(), onAccepted: (ack) => accepted.push(ack) });
  assert.deepEqual(client.calls[0].params, { agentId: "fixture", sessionKey, provider: "fixture-provider", model: "selected",
    message: valid().prompt, modelRun: true, promptMode: "none", deliver: false, idempotencyKey: requestId, timeout: 110 });
  assert.equal(client.calls[0].method, "agent");
  assert.equal(client.calls[0].options.expectFinal, true);
  assert.equal(client.calls[0].options.timeoutMs, 120_000);
  client.accept(); client.accept();
  assert.equal(accepted.length, 1);
  const final = client.finish();
  assert.equal(await promise, final, "native final payload remains unchanged");
  await assert.rejects(channel.abortAdvisorModel({ sessionKey, runId: requestId }), /NOT_OWNED/);
});

test("no admin grant, closed connection or invalid host arguments dispatch nothing", async () => {
  for (const scopes of [[], ["operator.write"]]) {
    const { channel, client } = fixture(scopes);
    await assert.rejects(channel.runAdvisorModel(valid()), /ADMIN_UNAVAILABLE/);
    assert.equal(client.calls.length, 0);
  }
  const { channel, client } = fixture();
  for (const patch of [{ requestId: "renderer-id" }, { agentId: "fixture:main" }, { model: { id: "x", provider: "p", tools: true } },
    { model: { id: "bad\nmodel", provider: "p" } }, { prompt: " " }, { prompt: "x".repeat(128001) },
    { timeoutMs: 120001 }, { timeoutMs: 1000 }, { modelRun: false }, { sessionKey: "agent:fixture:main" }, { onAccepted: 1 }, { signal: {} }]) {
    await assert.rejects(channel.runAdvisorModel({ ...valid(), ...patch }), /INVALID_REQUEST/);
  }
  assert.equal(client.calls.length, 0);
  await channel.disconnect();
  await assert.rejects(channel.runAdvisorModel(valid()), /ADMIN_UNAVAILABLE/);
});

test("accepted response must match host UUID, synthetic session and selected agent", async () => {
  for (const patch of [{ runId: "other" }, { sessionKey: "agent:fixture:main" }, { agentId: "other" }, { status: "ok" }]) {
    const { channel, client } = fixture();
    let forwards = 0;
    const promise = channel.runAdvisorModel({ ...valid(), onAccepted: () => { forwards++; } });
    const rejected = assert.rejects(promise, /ACCEPTANCE_MISMATCH/);
    client.accept(patch);
    await rejected;
    assert.equal(forwards, 0);
  }
});

test("native abort is restricted to the exact in-memory owned run and cannot target the worker", async () => {
  const { channel, client } = fixture();
  const promise = channel.runAdvisorModel(valid());
  await assert.rejects(channel.runAdvisorModel(valid()), /REQUEST_UNAVAILABLE/);
  for (const args of [{ sessionKey: "agent:fixture:main", runId: requestId }, { sessionKey, runId: "other" }]) {
    await assert.rejects(channel.abortAdvisorModel(args), /NOT_OWNED/);
  }
  assert.equal(client.calls.length, 1);
  assert.equal((await channel.abortAdvisorModel({ sessionKey, runId: requestId })).aborted, true);
  assert.deepEqual(client.calls[1].params, { sessionKey, runId: requestId });
  client.finish({ status: "timeout" });
  assert.equal((await promise).status, "timeout");
});

test("local cancellation dispatches no implicit RPC but retains the native cancellation target", async () => {
  const { channel, client } = fixture();
  const controller = new globalThis.AbortController();
  controller.abort();
  await assert.rejects(channel.runAdvisorModel({ ...valid(), signal: controller.signal }), /CANCELLED/);
  assert.equal(client.calls.length, 0);
  const active = new globalThis.AbortController();
  const promise = channel.runAdvisorModel({ ...valid(), signal: active.signal });
  const rejected = assert.rejects(promise, /aborted/);
  active.abort(); await rejected;
  assert.equal(client.calls.length, 1);
  await channel.abortAdvisorModel({ sessionKey, runId: requestId });
  assert.equal(client.calls[1].method, "chat.abort");
});

test("disconnect prevents old acceptance/final from attaching to a new connection", async () => {
  const { channel, client } = fixture();
  let forwards = 0;
  const promise = channel.runAdvisorModel({ ...valid(), onAccepted: () => { forwards++; } });
  await channel.disconnect();
  client.accept(); client.finish();
  await assert.rejects(promise, /CANCELLED/);
  assert.equal(forwards, 0);
  await assert.rejects(channel.abortAdvisorModel({ sessionKey, runId: requestId }), /NOT_OWNED/);
});

test("foreign final run is rejected and valid native errors remain errors for the broker", async () => {
  const { channel, client } = fixture();
  const promise = channel.runAdvisorModel(valid());
  client.finish({ runId: "other" });
  await assert.rejects(promise, /RESULT_MISMATCH/);
  const next = fixture();
  const failed = next.channel.runAdvisorModel(valid());
  const final = next.client.finish({ status: "error", summary: "fixture native error" });
  assert.equal(await failed, final);
  const malformed = fixture();
  const acceptedAsFinal = malformed.channel.runAdvisorModel(valid());
  malformed.client.finish({ status: "accepted" });
  await assert.rejects(acceptedAsFinal, /RESULT_MISMATCH/);
  assert.equal((await malformed.channel.getAdvisorRunState({ sessionKey, runId: requestId })).status, "timeout");
});

test("terminal recovery reads only an exact owned run and leaves missing/pending state unknown", async () => {
  const { channel, client } = fixture();
  for (const method of ["agent.wait", "agent"]) await assert.rejects(channel.request(method, {}), /not allowed/);
  await assert.rejects(channel.getAdvisorRunState({ sessionKey, runId: requestId }), /NOT_OWNED/);
  const controller = new globalThis.AbortController();
  const pending = channel.runAdvisorModel({ ...valid(), signal: controller.signal });
  const cancelled = assert.rejects(pending, /aborted/);
  controller.abort(); await cancelled;
  await assert.rejects(channel.getAdvisorRunState({ sessionKey: "agent:fixture:main", runId: requestId }), /NOT_OWNED/);
  const unknown = await channel.getAdvisorRunState({ sessionKey, runId: requestId });
  assert.equal(unknown.status, "timeout");
  assert.deepEqual(client.calls.at(-1), { method: "agent.wait", params: { runId: requestId, timeoutMs: 0 }, options: { timeoutMs: 5000 } });
  for (const patch of [{ status: "pending" }, { status: "error", pendingError: true }, { status: "ok", yielded: true }, { status: "ok", endedAt: undefined }]) {
    client.waitResult = { runId: requestId, endedAt: 1000, ...patch };
    assert.equal(await channel.getAdvisorRunState({ sessionKey, runId: requestId }), client.waitResult);
  }
  client.waitResult = { runId: "foreign", status: "ok", endedAt: 1000 };
  await assert.rejects(channel.getAdvisorRunState({ sessionKey, runId: requestId }), /MISMATCH/);
  client.waitResult = { runId: requestId, status: "error", endedAt: 1000 };
  assert.equal(await channel.getAdvisorRunState({ sessionKey, runId: requestId }), client.waitResult);
  await assert.rejects(channel.getAdvisorRunState({ sessionKey, runId: requestId }), /NOT_OWNED/);
});

test("owned recovery expires after ten minutes without claiming completion", async () => {
  const originalNow = Date.now;
  let time = 1_000_000;
  Date.now = () => time;
  try {
    const { channel, client } = fixture();
    const controller = new globalThis.AbortController();
    const pending = channel.runAdvisorModel({ ...valid(), signal: controller.signal });
    const cancelled = assert.rejects(pending, /aborted/);
    controller.abort(); await cancelled;
    time += 599_999;
    assert.equal((await channel.getAdvisorRunState({ sessionKey, runId: requestId })).status, "timeout");
    time += 1;
    const count = client.calls.length;
    await assert.rejects(channel.getAdvisorRunState({ sessionKey, runId: requestId }), /NOT_OWNED/);
    await assert.rejects(channel.abortAdvisorModel({ sessionKey, runId: requestId }), /NOT_OWNED/);
    assert.equal(client.calls.length, count);
  } finally { Date.now = originalNow; }
});

test("nine confirmed native cancellations retire ownership and never exhaust the eight-run bound", async () => {
  const { channel } = fixture();
  for (let index = 0; index < 9; index++) {
    const id = `12345678-1234-4123-8123-123456789ab${index}`;
    const key = `agent:fixture:explicit:model-run-${id}`;
    const controller = new globalThis.AbortController();
    const pending = channel.runAdvisorModel({ ...valid(), requestId: id, signal: controller.signal });
    const cancelled = assert.rejects(pending, /aborted/);
    assert.equal((await channel.abortAdvisorModel({ sessionKey: key, runId: id })).aborted, true);
    controller.abort(); await cancelled;
    await assert.rejects(channel.getAdvisorRunState({ sessionKey: key, runId: id }), /NOT_OWNED/);
  }
});

test("late abort reply from a retired connection cannot remove a new owned run", async () => {
  const { channel, client } = fixture();
  let reply;
  client.abortResponder = () => new Promise((resolve) => { reply = resolve; });
  const oldController = new globalThis.AbortController();
  const oldRun = channel.runAdvisorModel({ ...valid(), signal: oldController.signal });
  const oldCancelled = assert.rejects(oldRun, /aborted/);
  const oldAbort = channel.abortAdvisorModel({ sessionKey, runId: requestId });
  await channel.disconnect();
  oldController.abort(); await oldCancelled;
  // The same UUID intentionally stresses object/generation fencing; normal host
  // requests always use fresh UUIDs.
  const next = fixture();
  channel.Client = class extends next.channel.Client {
    start() { this.options.onHelloOk({ auth: { scopes: ["operator.admin"] } }); }
  };
  channel.connect({ url: "ws://127.0.0.1:43123", token: "synthetic" });
  const newController = new globalThis.AbortController();
  const newRun = channel.runAdvisorModel({ ...valid(), signal: newController.signal });
  const newCancelled = assert.rejects(newRun, /aborted/);
  reply({ aborted: true });
  await assert.rejects(oldAbort, /MISMATCH/);
  assert.equal((await channel.getAdvisorRunState({ sessionKey, runId: requestId })).status, "timeout");
  newController.abort(); await newCancelled;
});
