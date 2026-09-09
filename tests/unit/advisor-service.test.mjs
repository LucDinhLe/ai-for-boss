import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { AdvisorService } from "../../apps/desktop/electron/advisor-service.mjs";

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const input = (patch = {}) => ({ action: "review", id: randomUUID(), sourceSessionKey: "private-source-session",
  checkpoint: "plan", model: { id: "review-model", provider: "fixture" },
  goal: "Lập kế hoạch tuần.", criteria: "Có người phụ trách và hạn chót.",
  content: "Lan phụ trách, hoàn thành thứ Sáu.", evidence: "", ...patch });
const validReview = () => ({ decision: "approve", pass: true, summary: "Có người phụ trách và hạn chót.",
  confidence: 0.8, evidence: [{ source: "content", quote: "Lan phụ trách" }], issues: [] });

function harness(t, { timeoutMs = 1000 } = {}) {
  const requests = [], runs = [], aborts = [], states = [];
  let ready = true;
  const handlers = {};
  const defaults = { "models.list": { models: [{ id: "review-model", provider: "fixture", available: true }] },
    "agents.list": { defaultId: "main", agents: [{ id: "main" }] } };
  const adapter = { request: async (method, params) => {
    requests.push({ method, params });
    return handlers[method] ? handlers[method](params) : defaults[method];
  } };
  const setup = {
    runAdvisorModel(options) { const pending = deferred(); runs.push({ options, ...pending }); return pending.promise; },
    async abortAdvisorModel(options) {
      aborts.push(options); return handlers.abort ? handlers.abort(options) : { aborted: true };
    },
    async getAdvisorRunState(options) {
      states.push(options); return handlers.state ? handlers.state(options) : { runId: options.runId, status: "timeout" };
    }
  };
  let currentSetup = setup;
  const service = new AdvisorService({ getAdapter: () => adapter, getSetup: () => currentSetup,
    isReady: () => ready, timeoutMs });
  t.after(async () => { service.ownedRuntimeStopped(); for (const run of runs) run.reject(new Error("fixture cleanup")); await flush(); });
  return { service, requests, runs, aborts, states, handlers,
    setReady(value) { ready = value; }, replaceSetup() { currentSetup = {}; },
    finish(index = runs.length - 1, result = validReview(), patch = {}) {
      runs[index].resolve({ runId: runs[index].options.requestId, status: "ok",
        result: { payloads: [{ text: JSON.stringify(result) }] }, ...patch });
    }
  };
}

test('model activity requires native acceptance and ends on terminal, connection change or cancellation', async t => {
  const h = harness(t), packet = input(), catalogue = deferred();
  h.handlers['models.list'] = () => catalogue.promise;
  const pending = h.service.request(packet);
  assert.equal(h.service.isModelActive(packet.id), false);
  catalogue.resolve({ models: [{ id: 'review-model', provider: 'fixture', available: true }] }); await flush();
  assert.equal(h.runs.length, 1); assert.equal(h.service.isModelActive(packet.id), false, 'SDK dispatch is not acceptance');
  h.runs[0].options.onAccepted(); assert.equal(h.service.isModelActive(packet.id), true);
  assert.equal(h.service.isModelActive(randomUUID()), false);
  h.setReady(false); assert.equal(h.service.isModelActive(packet.id), false);
  h.setReady(true); h.finish(); await pending; assert.equal(h.service.isModelActive(packet.id), false);
  const next = input(), second = h.service.request(next); await flush();
  h.runs[1].options.onAccepted(); assert.equal(h.service.isModelActive(next.id), true);
  h.handlers.abort = async () => ({ aborted: false });
  const cancelling = h.service.request({ action: 'cancel', id: next.id }); await flush();
  assert.equal(h.service.isModelActive(next.id), false, 'uncertain cancellation keeps ownership but cannot claim model is running');
  h.finish(); await second; await cancelling;
});

test('worker planning must issue a bounded ask_advisor handoff; plain text and extra authority are rejected', async t => {
  const h = harness(t);
  const valid = {action:'ask_advisor', plan:'Đọc yêu cầu và đặt thời hạn.', question:'Kế hoạch có thiếu bước không?'};
  for (const [result, accepted] of [[valid,true], [{...valid,action:'execute'},false], [{...valid,tools:['exec']},false], [{...valid,question:''},false], ['plain plan',false]]) {
    const running = h.service.request(input({action:'plan',sourceSessionKey:'agent:main:source'})); await flush(); h.finish(h.runs.length-1,result);
    const response=await running; assert.equal(response.status,accepted?'completed':'error');
    if(accepted) {assert.equal(response.plan,valid.plan);assert.equal(response.consultation,valid.question);}
  }
});

test('planning follows verified worker policy while review follows default policy, without cross-role admission', async t => {
  const h = harness(t), worker = { id: 'work-model', provider: 'fixture', available: true }, reviewer = { id: 'review-model', provider: 'fixture', available: true };
  h.handlers['agents.list'] = () => ({ defaultId: 'main', agents: [{ id: 'main' }, { id: 'worker' }] });
  h.handlers['models.list'] = params => ({ models: params.view === 'all' ? [worker, reviewer] : params.agentId === 'worker' ? [worker] : [reviewer] });
  const plan = h.service.request(input({ action: 'plan', sourceSessionKey: 'agent:worker:source', model: { id: worker.id, provider: worker.provider } }));
  assert.equal(h.service.busy, true); await flush();
  assert.equal(h.runs.length, 1); assert.equal(h.runs[0].options.agentId, 'worker');
  assert.equal(h.requests.find(request => request.method === 'models.list').params.agentId, 'worker');
  h.finish(0, { action: 'ask_advisor', plan: 'Read the goal and prepare the result.', question: 'Does the plan satisfy the goal?' });
  assert.equal((await plan).status, 'completed'); assert.equal(h.service.busy, false);
  const review = h.service.request(input({ sourceSessionKey: 'agent:worker:source' })); await flush();
  assert.equal(h.runs[1].options.agentId, 'main'); h.finish(1); assert.equal((await review).status, 'completed');
  assert.equal((await h.service.request(input({ action: 'plan', sourceSessionKey: 'agent:worker:source' }))).status, 'error');
  assert.equal((await h.service.request(input({ sourceSessionKey: 'agent:worker:source', model: { id: worker.id, provider: worker.provider } }))).status, 'error');
  assert.equal((await h.service.request(input({ action: 'plan', sourceSessionKey: 'agent:missing:source' }))).status, 'error');
  assert.equal((await h.service.request(input({ action: 'plan', sourceSessionKey: 'not-an-agent-session' }))).status, 'error');
  assert.equal(h.runs.length, 2, 'full discovery and unverified source keys never widen permission');
});

test('Advisor ownership stays busy after an uncertain cancellation until terminal readback', async t => {
  const h = harness(t), packet = input();
  const running = h.service.request(packet); await flush(); assert.equal(h.service.busy, true);
  h.runs[0].options.onAccepted(); h.handlers.abort = async () => ({ aborted: false });
  const cancelling = h.service.request({ action: 'cancel', id: packet.id }); await flush();
  assert.equal(h.service.isModelActive(packet.id), false); assert.equal(h.service.busy, true);
  h.finish(); await running; await cancelling; assert.equal(h.service.busy, false);
});

test("Advisor binds one immutable data packet to a host-owned raw model run without worker history", async (t) => {
  const h = harness(t), catalogue = deferred(), packet = input();
  h.handlers["models.list"] = () => catalogue.promise;
  const response = h.service.request(packet);
  packet.content = "Changed after request"; packet.model.id = "another-model";
  catalogue.resolve({ models: [{ id: "review-model", provider: "fixture", available: true }] }); await flush();
  assert.equal(h.runs.length, 1);
  const options = h.runs[0].options;
  assert.notEqual(options.requestId, packet.id); assert.match(options.requestId, /^[\da-f-]{36}$/u);
  assert.equal(options.agentId, "main"); assert.deepEqual(options.model, { id: "review-model", provider: "fixture" });
  assert.ok(options.prompt.includes("Lan phụ trách, hoàn thành thứ Sáu."));
  assert.equal(options.prompt.includes("Changed after request"), false);
  assert.equal(options.prompt.includes(packet.sourceSessionKey), false);
  assert.deepEqual(h.requests.map((request) => request.method).sort(), ["agents.list", "models.list"]);
  assert.equal(Object.hasOwn(options, "sourceSessionKey"), false); assert.equal(options.signal.aborted, false);
  h.finish(); assert.equal((await response).status, "completed");
});

test('Advisor accepts a newly discovered allowed model but never a browse-only row', async t => {
  const h = harness(t); let count = 0;
  h.handlers['models.list'] = () => ({ models: ++count === 1 ? [] : [{ id: 'review-model', provider: 'fixture', available: true }] });
  const pending = h.service.request(input()); await flush();
  assert.equal(count, 3); assert.equal(h.runs.length, 1); h.finish(); assert.equal((await pending).status, 'completed');
  count = 0;
  h.handlers['models.list'] = params => ({ models: params.view === 'all' ? [{ id: 'review-model', provider: 'fixture', available: true }] : [] });
  const rejected = await h.service.request(input());
  assert.equal(rejected.status, 'error'); assert.equal(h.runs.length, 1, 'full discovery cannot bypass native default policy');
});

test('cancel during full catalogue discovery cannot dispatch an Advisor run', async t => {
  const h = harness(t), full = deferred(), packet = input(); let count = 0;
  h.handlers['models.list'] = params => params.view === 'all' ? full.promise
    : { models: ++count === 1 ? [] : [{ id: 'review-model', provider: 'fixture', available: true }] };
  const pending = h.service.request(packet); await flush();
  await h.service.request({ action: 'cancel', id: packet.id });
  full.resolve({ models: [{ id: 'review-model', provider: 'fixture', available: true }] }); await flush();
  assert.equal((await pending).status, 'cancelled'); assert.equal(h.runs.length, 0);
});

test("duplicate UUID and parallel review never dispatch a second model call", async (t) => {
  const h = harness(t), packet = input();
  const first = h.service.request(packet); await flush();
  assert.equal((await h.service.request(packet)).status, "error");
  assert.equal((await h.service.request(input())).status, "error");
  assert.equal(h.runs.length, 1); h.finish(); await first;
  assert.equal((await h.service.request(packet)).status, "error");
  assert.equal(h.runs.length, 1);
});

test("unready connection, unavailable model, bad agent owner and changed setup cannot start inference", async (t) => {
  const h = harness(t);
  h.setReady(false); assert.equal((await h.service.request(input())).status, "error");
  assert.equal(h.requests.length, 0); h.setReady(true);
  for (const model of [{ id: "review-model", provider: "fixture", available: false },
    { id: "review-model", provider: "fixture" }, { id: "review-model", provider: "different", available: true }]) {
    h.handlers["models.list"] = async () => ({ models: [model] });
    assert.equal((await h.service.request(input())).status, "error");
  }
  delete h.handlers["models.list"];
  h.handlers["agents.list"] = async () => ({ defaultId: "missing", agents: [{ id: "main" }] });
  assert.equal((await h.service.request(input())).status, "error"); delete h.handlers["agents.list"];
  const catalogue = deferred(); h.handlers["models.list"] = () => catalogue.promise;
  const changed = h.service.request(input()); h.replaceSetup();
  catalogue.resolve({ models: [{ id: "review-model", provider: "fixture", available: true }] });
  assert.equal((await changed).status, "error"); assert.equal(h.runs.length, 0);
});

test("cancelling while catalogue is pending never dispatches inference or cancels a later review", async (t) => {
  const h = harness(t), catalogue = deferred(), packet = input();
  h.handlers["models.list"] = () => catalogue.promise;
  const first = h.service.request(packet); await flush();
  assert.equal((await h.service.request({ action: "cancel", id: packet.id })).status, "cancelled");
  assert.equal((await first).status, "cancelled"); assert.equal(h.aborts.length, 0);
  delete h.handlers["models.list"];
  const second = h.service.request(input()); await flush();
  catalogue.resolve({ models: [{ id: "review-model", provider: "fixture", available: true }] }); await flush();
  assert.equal(h.runs.length, 1); h.finish(); assert.equal((await second).status, "completed");
});

test("accepted frame during an unconfirmed abort queues an exact retry, and late final cannot revive cancellation", async (t) => {
  const h = harness(t), packet = input(), firstAbort = deferred(), secondAbort = deferred();
  h.handlers.abort = () => h.aborts.length === 1 ? firstAbort.promise : secondAbort.promise;
  const review = h.service.request(packet); await flush();
  const cancel = h.service.request({ action: "cancel", id: packet.id }); await flush();
  assert.equal(h.aborts.length, 1);
  h.runs[0].options.onAccepted(); await flush();
  assert.equal(h.aborts.length, 1, "accepted frame does not fan out an in-flight abort");
  firstAbort.resolve({ aborted: false }); await flush();
  assert.equal(h.aborts.length, 2, "accepted native work still needs its exact stop after the first abort missed it");
  const expected = { sessionKey: `agent:main:explicit:model-run-${h.runs[0].options.requestId}`, runId: h.runs[0].options.requestId };
  for (const request of h.aborts) assert.deepEqual(request, expected);
  secondAbort.resolve({ aborted: true }); await flush();
  assert.equal((await cancel).status, "cancelled"); assert.equal((await review).status, "cancelled");
  assert.equal(h.runs[0].options.signal.aborted, true);
  h.finish(0); await flush();
  const next = h.service.request(input()); await flush(); h.finish(1);
  assert.equal((await next).status, "completed");
});

test("lost SDK response after an unconfirmed cancel stays error and keeps the run reserved until owned stop", async (t) => {
  const h = harness(t), packet = input();
  h.handlers.abort = async () => { throw new Error("abort transport unavailable"); };
  const review = h.service.request(packet); await flush();
  const cancel = h.service.request({ action: "cancel", id: packet.id }); await flush();
  h.runs[0].reject(new Error("response transport lost")); await flush();
  assert.equal((await review).status, "error", "SDK failure cannot prove the server cancelled");
  assert.equal((await cancel).status, "error");
  assert.equal((await h.service.request(input())).status, "error"); assert.equal(h.runs.length, 1);
  h.service.ownedRuntimeStopped();
  const next = h.service.request(input()); await flush(); h.finish(1);
  assert.equal((await next).status, "completed");
});

test("timeout with unconfirmed abort never says cancelled and retains ownership until a final frame", async (t) => {
  const h = harness(t, { timeoutMs: 15 }), packet = input();
  h.handlers.abort = async () => ({ aborted: false });
  const review = h.service.request(packet); await flush();
  const reply = await review;
  assert.equal(reply.status, "error"); assert.equal(h.aborts.length, 1);
  assert.equal((await h.service.request({ action: "cancel", id: packet.id })).status, "error");
  assert.equal((await h.service.request(input())).status, "error");
  h.finish(0); await flush();
  const next = h.service.request(input()); await flush(); h.finish(1);
  assert.equal((await next).status, "completed");
});

test("shutdown retires the UI result but only owned runtime stop releases unconfirmed inference", async (t) => {
  const h = harness(t), packet = input();
  h.handlers.abort = async () => ({ aborted: false });
  const first = h.service.request(packet); await flush(); h.service.cancelForShutdown();
  assert.equal((await first).status, "error");
  assert.equal((await h.service.request(input())).status, "error"); assert.equal(h.runs.length, 1);
  h.service.ownedRuntimeStopped();
  const second = h.service.request(input()); await flush();
  h.finish(0); await flush();
  assert.equal((await h.service.request(input())).status, "error", "late old final does not release the new run");
  h.finish(1); assert.equal((await second).status, "completed");
});

test("valid review JSON cannot override native errors, partial completion or reported tool use", async (t) => {
  const h = harness(t);
  const states = [
    { error: { message: "synthetic" } }, { failureSignal: {} }, { terminalToolFailure: {} },
    { aborted: true }, { yielded: true }, { continuationPending: true },
    { pendingToolCalls: [{}] }, { toolSummary: { calls: 1, failures: 1 } },
    ...["blocked", "abandoned"].map(livenessState => ({ livenessState })),
    ...["tool_calls", "toolUse", "error", "aborted", "length", "timeout"].map(stopReason => ({ stopReason }))
  ];
  for (const meta of states) {
    const pending = h.service.request(input()); await flush();
    h.finish(h.runs.length - 1, validReview(), { result: { meta, payloads: [{ text: JSON.stringify(validReview()) }] } });
    assert.equal((await pending).status, "error");
  }
  const pending = h.service.request(input()); await flush();
  h.finish(h.runs.length - 1, validReview(), { result: { payloads: [{ text: JSON.stringify(validReview()), isError: true }] } });
  assert.equal((await pending).status, "error");
});

test("wrong native run and invalid schema/evidence stay unreviewed and never become completed", async (t) => {
  const h = harness(t);
  for (const [review, patch] of [[validReview(), { runId: randomUUID() }], [validReview(), { status: "error" }],
    [{ ...validReview(), evidence: [] }, {}], [{ ...validReview(), execute: "shell" }, {}],
    [{ ...validReview(), evidence: [{ source: "content", quote: "fabricated" }] }, {}]]) {
    const pending = h.service.request(input()); await flush(); h.finish(h.runs.length - 1, review, patch);
    assert.equal((await pending).status, "error");
  }
  const pending = h.service.request(input()); await flush();
  h.runs.at(-1).resolve({ runId: h.runs.at(-1).options.requestId, status: "ok", result: { payloads: [{ text: "invalid JSON" }] } });
  assert.equal((await pending).status, "error");
});

test("reconnect recovery leaves a healthy review untouched and never sends while disconnected", async (t) => {
  const h = harness(t), packet = input();
  const review = h.service.request(packet); await flush();
  assert.equal(await h.service.connectionRestored(), false);
  assert.equal(h.aborts.length, 0); assert.equal(h.runs.length, 1);
  h.setReady(false);
  h.handlers.abort = async () => { throw new Error("socket disconnected"); };
  h.runs[0].reject(new Error("SDK response lost"));
  assert.equal((await review).status, "error"); await flush();
  assert.equal(h.aborts.length, 1);
  assert.equal(await h.service.connectionRestored(), false);
  assert.equal((await h.service.request(input())).status, "error");
  assert.equal(h.aborts.length, 1, "offline recovery does not send another abort");
  assert.equal(h.runs.length, 1, "connection changes never retry inference");
});

test("reconnect and new admission coalesce exact abort recovery, retaining the gate until confirmed", async (t) => {
  const h = harness(t), packet = input();
  h.handlers.abort = async () => { throw new Error("socket disconnected"); };
  const review = h.service.request(packet); await flush();
  h.runs[0].reject(new Error("SDK response lost"));
  assert.equal((await review).status, "error"); await flush();
  const retry = deferred(); h.handlers.abort = () => retry.promise;
  const recovered = h.service.connectionRestored();
  const duplicateRecovery = h.service.connectionRestored();
  const denied = h.service.request(input()); await flush();
  assert.equal(h.aborts.length, 2, "parallel recovery shares one in-flight abort");
  assert.equal(h.runs.length, 1);
  const expected = { sessionKey: `agent:main:explicit:model-run-${h.runs[0].options.requestId}`, runId: h.runs[0].options.requestId };
  for (const request of h.aborts) assert.deepEqual(request, expected);
  retry.resolve({ aborted: false });
  assert.equal(await recovered, false); assert.equal(await duplicateRecovery, false);
  assert.equal((await denied).status, "error");
  assert.equal(h.runs.length, 1, "unconfirmed abort cannot release the slot");

  h.handlers.abort = async () => ({ aborted: true });
  const next = h.service.request(input()); await flush();
  assert.equal(h.aborts.length, 3);
  assert.equal(h.runs.length, 2, "an explicit new review starts only after old stop confirmation");
  h.finish(1); assert.equal((await next).status, "completed");
  assert.equal(await h.service.connectionRestored(), true);
  assert.equal(h.runs.length, 2);
});

test("recovery for an old job cannot abort through a replacement setup or release a newer job", async (t) => {
  const h = harness(t);
  h.handlers.abort = async () => { throw new Error("socket disconnected"); };
  const first = h.service.request(input()); await flush();
  h.runs[0].reject(new Error("SDK response lost")); await first; await flush();
  const recovery = deferred(); h.handlers.abort = () => recovery.promise;
  const restored = h.service.connectionRestored(); await flush();
  h.service.ownedRuntimeStopped();
  const second = h.service.request(input()); await flush();
  recovery.resolve({ aborted: true }); await restored;
  assert.equal((await h.service.request(input())).status, "error", "old recovery cannot release the newer active review");
  h.finish(1); assert.equal((await second).status, "completed");

  h.handlers.abort = async () => { throw new Error("socket disconnected"); };
  const third = h.service.request(input()); await flush();
  h.runs[2].reject(new Error("SDK response lost")); await third; await flush();
  const count = h.aborts.length; h.replaceSetup();
  assert.equal(await h.service.connectionRestored(), false);
  assert.equal(h.aborts.length, count, "ownership is not transferred to a new setup channel");
});

test("exact terminal state recovers an old failed run without reviewing again or completing its UI result", async (t) => {
  const h = harness(t);
  h.handlers.abort = async () => ({ aborted: false });
  for (const status of ["ok", "error"]) {
    const before = h.runs.length;
    const review = h.service.request(input()); await flush();
    h.runs[before].reject(new Error("final response lost"));
    const reply = await review; assert.equal(reply.status, "error"); await flush();
    const state = deferred(); h.handlers.state = () => state.promise;
    const recovered = h.service.connectionRestored();
    const duplicate = h.service.connectionRestored(); await flush();
    const pair = { sessionKey: `agent:main:explicit:model-run-${h.runs[before].options.requestId}`, runId: h.runs[before].options.requestId };
    assert.equal(h.states.length, before + 1, "concurrent recovery shares a single status request");
    assert.deepEqual(h.states.at(-1), pair);
    state.resolve({ runId: pair.runId, status, endedAt: Date.now(), pendingError: false, yielded: false });
    assert.equal(await recovered, true); assert.equal(await duplicate, true);
    assert.equal(h.runs.length, before + 1, "terminal lookup never dispatches inference");
    assert.equal(reply.status, "error", "recovered ownership cannot turn a failed UI review green");
    delete h.handlers.state;
  }
});

test("missing, nonterminal, yielded and mismatched state cannot release unconfirmed ownership", async (t) => {
  const h = harness(t); h.handlers.abort = async () => ({ aborted: false });
  const review = h.service.request(input()); await flush();
  h.runs[0].reject(new Error("final response lost")); await review; await flush();
  const runId = h.runs[0].options.requestId;
  for (const state of [null, { runId, status: "timeout", endedAt: Date.now() },
    { runId, status: "ok" }, { runId, status: "ok", endedAt: Infinity },
    { runId, status: "ok", endedAt: Date.now(), yielded: true },
    { runId, status: "error", endedAt: Date.now(), pendingError: true },
    { runId: randomUUID(), status: "ok", endedAt: Date.now() }]) {
    h.handlers.state = async () => state;
    assert.equal(await h.service.connectionRestored(), false);
    assert.equal(h.runs.length, 1);
  }
  h.handlers.state = async () => { throw new Error("status unavailable"); };
  assert.equal((await h.service.request(input())).status, "error");
  assert.equal(h.runs.length, 1);
});

test("cancel retry reports current terminal proof instead of replaying the old failed response", async (t) => {
  const h = harness(t), packet = input(); h.handlers.abort = async () => ({ aborted: false });
  const review = h.service.request(packet); await flush();
  h.runs[0].reject(new Error("final response lost"));
  assert.equal((await review).status, "error"); await flush();
  assert.equal((await h.service.request({ action: "cancel", id: packet.id })).status, "error");
  h.handlers.state = async ({ runId }) => ({ runId, status: "ok", endedAt: Date.now() });
  assert.equal((await h.service.request({ action: "cancel", id: packet.id })).status, "cancelled");
  assert.equal(await h.service.connectionRestored(), true);
  assert.equal(h.runs.length, 1);
});
