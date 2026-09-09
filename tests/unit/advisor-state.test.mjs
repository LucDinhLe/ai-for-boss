import assert from "node:assert/strict";
import test from "node:test";
import { createAdvisorController, defaultAdvisorForm, advisorFormSignature, advisorSourceSnapshot, advisorValidation, reviewDraftText }
  from "../../apps/desktop/src/use-advisor.ts";

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const form = () => ({ ...defaultAdvisorForm({ id: "model", provider: "fixture" }, "Prepare a plan"),
  sourceKind: "answer", sourceSnapshot: "Plan", content: "Plan" });
const result = { decision: "revise", pass: false, summary: "Add a deadline", confidence: 0.8,
  evidence: [{ source: "content", quote: "Plan" }],
  issues: [{ title: "Missing deadline", detail: "No deadline is stated", severity: "medium",
    evidence: [{ source: "content", quote: "Plan" }], recommended_fix: "Specify a date" }] };

test("review is explicit, single flight, and a late result belongs to its source form only", async () => {
  const pending = deferred(), requests = [];
  const state = createAdvisorController(async (request) => { requests.push(request); return pending.promise; }, () => "test-id");
  state.update("A", {}, form()); state.update("B", { goal: "Other goal" }, form());
  assert.equal(requests.length, 0);
  const start = state.review("A", form()); await state.review("B", form());
  assert.equal(requests.length, 1); assert.equal(requests[0].sourceSessionKey, "A");
  state.update("A", { criteria: "Changed during review" }, form());
  pending.resolve({ id: "test-id", status: "completed", result }); await start;
  const view = state.getSnapshot();
  assert.equal(view.entries.A.status, "completed"); assert.equal(view.entries.B.status, "idle");
  assert.notEqual(view.entries.A.reviewedForm, advisorFormSignature(view.entries.A.form));
  assert.equal(view.active, null);
});

test("manual cancellation fences a late success and holds the global slot until cancel returns", async () => {
  const pending = deferred(), cancel = deferred(), requests = [];
  const state = createAdvisorController((request) => { requests.push(request); return request.action === "cancel" ? cancel.promise : pending.promise; }, () => "test-id");
  const start = state.review("A", form());
  const stop = state.cancel(); await state.review("B", form());
  assert.equal(requests.length, 2); assert.deepEqual(requests[1], { action: "cancel", id: "test-id" });
  pending.resolve({ id: "test-id", status: "completed", result }); await start;
  assert.equal(state.getSnapshot().entries.A.status, "running", "no cancellation claim before host acknowledgment");
  assert.equal(state.getSnapshot().active.cancelling, true);
  assert.equal(state.getSnapshot().entries.A.result, undefined);
  cancel.resolve({ id: "test-id", status: "cancelled" }); await stop;
  assert.equal(state.getSnapshot().entries.A.status, "cancelled");
  assert.equal(state.getSnapshot().active, null);
});

test("unconfirmed or failed cancellation stays incomplete, fences late output, and permits an explicit abort retry", async () => {
  for (const outcome of ["host-error", "ipc-error", "wrong-id"]) {
    const pending = deferred(), requests = [];
    let cancels = 0;
    const state = createAdvisorController(async (request) => {
      requests.push(request);
      if (request.action === "review") return pending.promise;
      if (++cancels > 1) return { id: request.id, status: "cancelled", message: "Đã dừng lượt kiểm tra." };
      if (outcome === "ipc-error") throw new Error("IPC unavailable");
      return { id: outcome === "wrong-id" ? "other" : request.id, status: "error", message: "Chưa xác nhận model đã dừng." };
    }, () => "active-id");
    const start = state.review("A", form());
    await state.cancel();
    assert.equal(state.getSnapshot().entries.A.status, "error");
    assert.match(state.getSnapshot().entries.A.message, /Chưa xác nhận/);
    assert.equal(state.getSnapshot().active.cancelling, false, "manual cancel retry remains possible");
    await state.review("B", form());
    pending.resolve({ id: "active-id", status: "completed", result }); await start;
    assert.equal(state.getSnapshot().entries.A.result, undefined);
    assert.equal(requests.filter((request) => request.action === "review").length, 1);
    await state.cancel();
    assert.equal(state.getSnapshot().entries.A.status, "cancelled");
    assert.equal(state.getSnapshot().active, null);
  }
});

test("malformed acknowledgments never become completed reviews", async () => {
  const requests = [];
  const state = createAdvisorController(async (request) => { requests.push(request); return { id: "wrong", status: "completed", result }; }, () => "expected");
  await state.review("A", form());
  assert.equal(state.getSnapshot().entries.A.status, "error");
  assert.equal(state.getSnapshot().entries.A.result, undefined);
  assert.equal(requests.length, 1);
  await state.cancel("Mất kết nối");
  assert.equal(requests.length, 1, "cancel without an active review creates no request");
});

test("disconnect-style cancellation preserves the form and reconnect does not retry the review", async () => {
  const pending = deferred(), requests = [];
  const state = createAdvisorController((request) => {
    requests.push(request);
    return request.action === "cancel" ? Promise.resolve({ id: request.id, status: "cancelled" }) : pending.promise;
  }, () => "active-id");
  const start = state.review("A", form());
  await state.cancel("Mất kết nối. Review chưa hoàn tất.");
  pending.resolve({ id: "active-id", status: "completed", result }); await start;
  assert.equal(state.getSnapshot().entries.A.status, "cancelled");
  assert.match(state.getSnapshot().entries.A.message, /Mất kết nối/);
  assert.equal(state.getSnapshot().entries.A.form.content, "Plan");
  assert.equal(state.getSnapshot().entries.A.result, undefined);
  assert.deepEqual(requests.map((request) => request.action), ["review", "cancel"]);
});

test("input limits reject overlong content without truncating the preview or dispatching", async () => {
  let requests = 0;
  const state = createAdvisorController(async () => { requests++; return {}; });
  const long = { ...form(), content: "x".repeat(12001) };
  assert.match(advisorValidation(long), /12.000/);
  await state.review("A", long);
  assert.equal(requests, 0);
  assert.equal(advisorValidation({ ...form(), model: null }) !== null, true);
  assert.equal(advisorValidation({ ...form(), sourceKind: null }) !== null, true);
  assert.equal(advisorValidation(form()), null);
  const feedback = reviewDraftText(result);
  assert.match(feedback, /Add a deadline/); assert.match(feedback, /Specify a date/);
});

test("a different native answer with equal text invalidates the selected review source", () => {
  assert.notEqual(advisorSourceSnapshot("answer", "Equal text", "row-1"), advisorSourceSnapshot("answer", "Equal text", "row-2"));
  assert.notEqual(advisorSourceSnapshot("answer", "Equal text", "row-1"), advisorSourceSnapshot("draft", "Equal text", "row-1"));
  assert.equal(advisorSourceSnapshot("draft", "Draft", "old-answer"), advisorSourceSnapshot("draft", "Draft", "new-answer"));
});
