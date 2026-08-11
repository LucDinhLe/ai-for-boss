import assert from "node:assert/strict";
import test from "node:test";
import {
  approveGenesis,
  connectFixture,
  createInitialFirstRunState,
  createTaskDraft,
  normalizeIdentity,
  PASSING_PROMOTION_CHECKS,
  restoreFirstRunSnapshot,
  verifyInternalInstall
} from "../../apps/desktop/src/first-run-machine.mjs";

const identity = {
  name: "Tôm 🦐",
  role: "Đối tác tư duy của chủ doanh nghiệp",
  tone: "Rõ, thẳng và thực tế",
  userAddress: "Đại ca",
  boundary: "Không gửi hoặc công bố khi chưa duyệt"
};

function connectedState() {
  return connectFixture(verifyInternalInstall(createInitialFirstRunState(), true), "openai-demo");
}

function activeState() {
  return approveGenesis(connectedState(), identity, PASSING_PROMOTION_CHECKS);
}

test("initial state is offline, retains bootstrap, and cannot claim readiness", () => {
  const state = createInitialFirstRunState();
  assert.equal(state.stage, "INSTALL");
  assert.equal(state.connection.status, "disconnected");
  assert.equal(state.genesis.bootstrapRetained, true);
  assert.equal(state.genesis.reportReady, false);
  assert.equal(state.advisor.plan, "pending-runtime");
});

test("install verification fails closed and is idempotent", () => {
  const blocked = verifyInternalInstall(createInitialFirstRunState(), false);
  assert.equal(blocked.stage, "INSTALL");
  assert.equal(blocked.lastError, "shell-contract-unavailable");

  const verified = verifyInternalInstall(createInitialFirstRunState(), true);
  assert.equal(verified.stage, "CONNECT");
  assert.strictEqual(verifyInternalInstall(verified, true), verified);
});

test("only allowlisted offline fixtures can be selected after install", () => {
  const initial = createInitialFirstRunState();
  assert.equal(connectFixture(initial, "openai-demo").lastError, "install-not-verified");

  const installed = verifyInternalInstall(initial, true);
  assert.equal(connectFixture(installed, "live-provider").lastError, "fixture-not-allowed");
  const connected = connectFixture(installed, "google-demo");
  assert.equal(connected.connection.status, "connected-fixture");
  assert.equal(connected.genesis.state, "CONVERSING");
  assert.strictEqual(connectFixture(connected, "google-demo"), connected);
});

test("identity validation accepts Vietnamese, emoji, and apostrophes", () => {
  const result = normalizeIdentity({ ...identity, name: "Sếp's Tôm 🦐" });
  assert.equal(result.ok, true);
  assert.equal(result.identity.name, "Sếp's Tôm 🦐");
});

test("identity validation rejects empty and overlong values", () => {
  assert.equal(normalizeIdentity({ ...identity, name: "   " }).code, "identity-required-fields-missing");
  assert.equal(normalizeIdentity({ ...identity, boundary: "a".repeat(201) }).code, "identity-field-too-long");
});

test("Genesis failure retains bootstrap and moves to resumable state", () => {
  const failedChecks = { ...PASSING_PROMOTION_CHECKS, healthPasses: false };
  const state = approveGenesis(connectedState(), identity, failedChecks);
  assert.equal(state.stage, "CONNECT");
  assert.equal(state.genesis.state, "PENDING_RESUME");
  assert.equal(state.genesis.bootstrapRetained, true);
  assert.equal(state.genesis.reportReady, false);
  assert.equal(state.lastError, "genesis-verification-failed");
});

test("Genesis promotion removes bootstrap last and duplicate submit is idempotent", () => {
  const state = activeState();
  assert.equal(state.stage, "ASSIGN");
  assert.equal(state.genesis.state, "ACTIVE");
  assert.equal(state.genesis.bootstrapRetained, false);
  assert.equal(state.genesis.reportReady, true);
  assert.equal(state.genesis.promotionOperations.at(-1), "remove-bootstrap-last");
  assert.strictEqual(approveGenesis(state, identity, PASSING_PROMOTION_CHECKS), state);
  assert.equal(approveGenesis(state, { ...identity, name: "Agent khác" }, PASSING_PROMOTION_CHECKS).lastError, "rebirth-required");
});

test("resumable Genesis continues idempotently after all checks pass", () => {
  const pending = approveGenesis(connectedState(), identity, { ...PASSING_PROMOTION_CHECKS, readbackMatches: false });
  const resumed = restoreFirstRunSnapshot(pending, PASSING_PROMOTION_CHECKS);
  assert.equal(resumed.stage, "ASSIGN");
  assert.equal(resumed.genesis.state, "ACTIVE");
  assert.equal(resumed.genesis.promotionOperations.at(-1), "remove-bootstrap-last");
});

test("invalid or inconsistent snapshots fail closed", () => {
  const invalid = restoreFirstRunSnapshot({ schemaVersion: "wrong" }, PASSING_PROMOTION_CHECKS);
  assert.equal(invalid.genesis.state, "PENDING_RESUME");
  assert.equal(invalid.genesis.bootstrapRetained, true);
  assert.equal(invalid.genesis.reportReady, false);

  const inconsistent = structuredClone(activeState());
  inconsistent.genesis.bootstrapRetained = true;
  const restored = restoreFirstRunSnapshot(inconsistent, PASSING_PROMOTION_CHECKS);
  assert.equal(restored.genesis.state, "PENDING_RESUME");
  assert.equal(restored.lastError, "active-invariant-failed");
});

test("task draft is gated, offline, cost-free, and accepts Unicode", () => {
  const blocked = createTaskDraft(connectedState(), { requestId: "early", goal: "Đi tắt" });
  assert.equal(blocked.lastError, "first-run-not-ready");

  const complete = createTaskDraft(activeState(), {
    requestId: "first-assignment-preview",
    goal: "Lập kế hoạch 30 ngày cho lớp AI của Đại ca 🦐"
  });
  assert.equal(complete.stage, "COMPLETE");
  assert.equal(complete.task.status, "draft-only");
  assert.equal(complete.task.draft.dataEgress, "Không gửi dữ liệu trong preview");
  assert.equal(complete.task.draft.permissions, "Không có tool hoặc quyền thật");
  assert.equal(complete.task.draft.budget, "0 token trong preview");
  assert.equal(complete.advisor.plan, "pending-runtime");
  assert.equal(complete.advisor.final, "pending-runtime");
});

test("task submit is idempotent by request id and rejects duplicate mutation", () => {
  const first = createTaskDraft(activeState(), { requestId: "same", goal: "Việc đầu" });
  assert.strictEqual(createTaskDraft(first, { requestId: "same", goal: "Việc khác" }), first);
  assert.equal(createTaskDraft(first, { requestId: "different", goal: "Việc thứ hai" }).lastError, "first-run-not-ready");
});

test("empty and extreme task values are rejected without partial draft", () => {
  const empty = createTaskDraft(activeState(), { requestId: "empty", goal: "   " });
  const long = createTaskDraft(activeState(), { requestId: "long", goal: "a".repeat(1201) });
  assert.equal(empty.lastError, "assignment-input-missing");
  assert.equal(empty.task.status, "empty");
  assert.equal(long.lastError, "assignment-too-long");
  assert.equal(long.task.status, "empty");
});
