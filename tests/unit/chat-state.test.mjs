import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeChatRun, canApplyHistory, canSendChat, newChatRun, recoverChatRun, reduceChatRun }
  from "../../apps/desktop/src/chat-state.ts";

const delta = (seq, deltaText, extra = {}) => ({ sessionKey: "session-a", runId: "run-a", state: "delta", seq, deltaText, ...extra });
const apply = (run, event, message) => reduceChatRun(run, event, "session-a", message);

test("canonical ACK IDs are adopted without finishing admission; cached terminal ACKs do finish", () => {
  const started = acknowledgeChatRun(newChatRun("submission"), "submission", { runId: "run-a", status: "started" });
  assert.equal(started.runId, "run-a"); assert.equal(started.busy, true);
  assert.equal(apply(started, delta(1, "First")).text, "First");
  for (const status of ["ok", "timeout", "error"]) {
    const terminal = acknowledgeChatRun(newChatRun("run-a"), "run-a", { runId: "run-a", status });
    assert.equal(terminal.busy, false); assert.equal(terminal.terminal, true);
  }
  const newer = newChatRun("newer");
  assert.equal(acknowledgeChatRun(newer, "old", { runId: "old", status: "ok" }), newer);
  const streaming = apply(newChatRun("run-a"), delta(1, "Current"));
  assert.equal(acknowledgeChatRun(streaming, "run-a", { runId: "other" }), streaming);
});

test("native deltas append once, replace non-prefix text, and prefer cumulative snapshots", () => {
  let run = newChatRun("run-a");
  run = apply(run, delta(1, "Xin "));
  run = apply(run, delta(2, "chào"));
  assert.equal(run.text, "Xin chào");
  const seen = run;
  assert.equal(apply(run, delta(2, "chào")), seen);
  assert.equal(apply(run, delta(1, "Xin ")), seen);
  run = apply(run, delta(3, "Đã sửa", { replace: true }));
  assert.equal(run.text, "Đã sửa");
  run = apply(run, delta(4, " nữa"), "Đã sửa nữa");
  assert.equal(run.text, "Đã sửa nữa");
});

test("old sessions, old runs and malformed sequences cannot alter the selected run", () => {
  const run = newChatRun("run-a");
  for (const event of [delta(1, "wrong", { sessionKey: "session-b" }), delta(1, "wrong", { runId: "old-run" }),
    delta(-1, "wrong"), delta(1.2, "wrong"), delta(1, "wrong", { state: "unknown" })]) {
    assert.equal(apply(run, event), run);
  }
});

test("all terminal outcomes release busy and late packets cannot resurrect the run", () => {
  for (const state of ["final", "error", "aborted"]) {
    const running = apply(newChatRun("run-a"), delta(1, "partial"));
    const finished = apply(running, { sessionKey: "session-a", runId: "run-a", seq: 2, state });
    assert.equal(finished.busy, false);
    assert.equal(finished.terminal, true);
    assert.equal(finished.text, "partial");
    assert.equal(apply(finished, delta(3, "late")), finished);
  }
});

test("reconnect adopts an exact in-flight run even before its first text", () => {
  let recovered = recoverChatRun(newChatRun(), { inFlightRun: { runId: "run-a", text: "" } });
  assert.equal(recovered.busy, true);
  recovered = apply(recovered, delta(4, "Resumed"));
  assert.equal(recovered.text, "Resumed");
  const idle = recoverChatRun(recovered, { sessionInfo: { hasActiveRun: false, activeRunIds: [] } });
  assert.equal(idle.busy, false);
  assert.equal(apply(idle, delta(5, "late")), idle);
});

test("aggregate activity never chooses an unrelated first run ID for stop", () => {
  const recovered = recoverChatRun(newChatRun(), { sessionInfo: { hasActiveRun: true, activeRunIds: ["someone-else"] } });
  assert.equal(recovered.busy, true);
  assert.equal(recovered.runId, null);
});

test("a new aggregate run discards completed or excluded ownership and accepts only a fresh exact event", () => {
  const running = apply(newChatRun("run-a"), delta(1, "Old"));
  const finished = apply(running, { sessionKey: "session-a", runId: "run-a", seq: 2, state: "final" });
  for (const old of [running, finished]) {
    const recovered = recoverChatRun(old, { sessionInfo: { hasActiveRun: true, activeRunIds: ["run-b"] } });
    assert.equal(recovered.busy, true); assert.equal(recovered.terminal, false); assert.equal(recovered.runId, null);
    assert.equal(apply(recovered, delta(3, "Late old")), recovered);
    assert.equal(apply(recovered, delta(1, "Unrelated", { runId: "run-c" })), recovered);
    const next = apply(recovered, delta(1, "New", { runId: "run-b" }));
    assert.equal(next.text, "New"); assert.equal(next.runId, "run-b");
    assert.equal(apply(next, { sessionKey: "session-a", runId: "run-b", seq: 2, state: "final" }).busy, false);
  }
  const unknown = recoverChatRun(finished, { sessionInfo: { hasActiveRun: true } });
  assert.equal(unknown.runId, null); assert.equal(unknown.terminal, false);
  assert.equal(apply(unknown, delta(3, "Late old")), unknown);
  assert.equal(apply(unknown, delta(1, "New", { runId: "run-b" })).runId, "run-b");
});

test("history replies are rejected after switching away and back, a newer request, or live changes", () => {
  const request = { key: "session-a", epoch: 1, revision: 4 };
  assert.equal(canApplyHistory(request, "session-a", 1, 4), true);
  assert.equal(canApplyHistory(request, "session-b", 1, 4), false);
  assert.equal(canApplyHistory(request, "session-a", 3, 4), false);
  assert.equal(canApplyHistory(request, "session-a", 1, 5), false);
});

test("send stays closed without an available model, either channel, session, text, or while busy", () => {
  const valid = { connected: true, setupReady: true, activeKey: "session-a", busy: false, text: "Hello",
    selectedModel: { model: "test", modelProvider: "fixture" },
    models: [{ id: "test", name: "Test", provider: "fixture", available: true }] };
  assert.equal(canSendChat(valid), true);
  for (const patch of [{ connected: false }, { setupReady: false }, { activeKey: null }, { busy: true },
    { text: "  " }, { models: [] }, { models: [{ ...valid.models[0], available: false }] },
    { selectedModel: { model: "different", modelProvider: "fixture" } },
    { selectedModel: { model: "test", modelProvider: "other-provider" } }]) {
    assert.equal(canSendChat({ ...valid, ...patch }), false);
  }
});
