import assert from "node:assert/strict";
import test from "node:test";
import {
  approveGenesis,
  approvePreviewGenesis,
  connectFixture,
  createInitialFirstRunState,
  createTaskDraft,
  normalizeIdentity,
  restoreFirstRunSnapshot,
  RUNTIME_EVIDENCE_SOURCE,
  validateFirstRunSnapshot,
  verifyInternalInstall
} from "../../apps/desktop/src/first-run-machine.mjs";

const identity = {
  name: "Tôm",
  role: "Đối tác tư duy của chủ doanh nghiệp",
  tone: "Rõ, thẳng và thực tế",
  emoji: "🦐",
  userAddress: "Đại ca",
  priority: "Ưu tiên việc quan trọng và giải thích ngắn gọn",
  boundary: "Không gửi hoặc công bố khi chưa duyệt"
};

const passingEvidence = Object.freeze({
  source: RUNTIME_EVIDENCE_SOURCE,
  contentValid: true,
  readbackMatches: true,
  identitySyncMatches: true,
  snapshotExists: true,
  healthPasses: true,
  memoryAbsent: true
});

function installedState() {
  return verifyInternalInstall(createInitialFirstRunState(), true);
}

function connectedState() {
  return connectFixture(installedState(), "openai-demo");
}

function previewReadyState() {
  return approvePreviewGenesis(connectedState(), identity);
}

function activeState() {
  return approveGenesis(connectedState(), identity, passingEvidence);
}

test("initial state is offline, retains bootstrap, and cannot claim readiness", () => {
  const state = createInitialFirstRunState();
  assert.equal(state.stage, "INSTALL");
  assert.equal(state.connection.status, "disconnected");
  assert.equal(state.genesis.bootstrapRetained, true);
  assert.equal(state.genesis.reportReady, false);
  assert.equal(state.genesis.previewApproved, false);
  assert.equal(state.advisor.plan, "pending-runtime");
  assert.deepEqual(validateFirstRunSnapshot(state), { ok: true });
});

test("install verification fails closed and is idempotent", () => {
  const blocked = verifyInternalInstall(createInitialFirstRunState(), false);
  assert.equal(blocked.stage, "INSTALL");
  assert.equal(blocked.lastError, "shell-contract-unavailable");

  const verified = installedState();
  assert.equal(verified.stage, "CONNECT");
  assert.strictEqual(verifyInternalInstall(verified, true), verified);
  assert.deepEqual(validateFirstRunSnapshot(verified), { ok: true });
});

test("only allowlisted offline fixtures can be selected after install", () => {
  const initial = createInitialFirstRunState();
  assert.equal(connectFixture(initial, "openai-demo").lastError, "install-not-verified");

  const installed = installedState();
  assert.equal(connectFixture(installed, "live-provider").lastError, "fixture-not-allowed");
  const connected = connectFixture(installed, "google-demo");
  assert.equal(connected.connection.status, "connected-fixture");
  assert.equal(connected.connection.fixtureId, "google-demo");
  assert.equal(connected.genesis.state, "CONVERSING");
  assert.strictEqual(connectFixture(connected, "google-demo"), connected);

  const changed = connectFixture(connected, "anthropic-demo");
  assert.equal(changed.connection.fixtureId, "anthropic-demo");
  assert.equal(changed.genesis.approvedIdentity, null);
});

test("identity validation preserves all locked fields and accepts Unicode", () => {
  const result = normalizeIdentity({ ...identity, name: "Sếp's Tôm 🦐" });
  assert.equal(result.ok, true);
  assert.deepEqual(result.identity, { ...identity, name: "Sếp's Tôm 🦐" });
});

test("identity validation rejects empty and overlong values", () => {
  for (const field of Object.keys(identity)) {
    assert.equal(
      normalizeIdentity({ ...identity, [field]: "   " }).code,
      "identity-required-fields-missing",
      `${field} must be required`
    );
  }
  assert.equal(normalizeIdentity({ ...identity, priority: "a".repeat(201) }).code, "identity-field-too-long");
});

test("preview approval stays STAGING and never claims runtime readiness", () => {
  const state = previewReadyState();
  assert.equal(state.stage, "ASSIGN");
  assert.equal(state.genesis.state, "STAGING");
  assert.equal(state.genesis.bootstrapRetained, true);
  assert.equal(state.genesis.reportReady, false);
  assert.equal(state.genesis.previewApproved, true);
  assert.equal(state.genesis.promotionOperations.at(-1), "stage-identity-preview");
  assert.deepEqual(validateFirstRunSnapshot(state), { ok: true });
  assert.strictEqual(approvePreviewGenesis(state, identity), state);
  assert.equal(approvePreviewGenesis(state, { ...identity, name: "Agent khác" }).lastError, "rebirth-required");
});

test("invalid preview identity stays conversational without partial promotion", () => {
  const state = approvePreviewGenesis(connectedState(), { ...identity, role: "   " });
  assert.equal(state.stage, "CONNECT");
  assert.equal(state.genesis.state, "CONVERSING");
  assert.equal(state.genesis.approvedIdentity, null);
  assert.equal(state.genesis.previewApproved, false);
  assert.equal(state.lastError, "identity-required-fields-missing");
});

test("runtime promotion rejects checks without a trusted evidence source", () => {
  const untrustedChecks = { ...passingEvidence, source: "renderer-self-asserted" };
  const state = approveGenesis(connectedState(), identity, untrustedChecks);
  assert.equal(state.genesis.state, "PENDING_RESUME");
  assert.equal(state.genesis.bootstrapRetained, true);
  assert.equal(state.genesis.reportReady, false);
  assert.equal(state.lastError, "genesis-verification-failed");
});

test("Genesis failure retains bootstrap and moves to resumable state", () => {
  const failedChecks = { ...passingEvidence, healthPasses: false };
  const state = approveGenesis(connectedState(), identity, failedChecks);
  assert.equal(state.stage, "CONNECT");
  assert.equal(state.genesis.state, "PENDING_RESUME");
  assert.equal(state.genesis.bootstrapRetained, true);
  assert.equal(state.genesis.reportReady, false);
  assert.equal(state.lastError, "genesis-verification-failed");
  assert.deepEqual(validateFirstRunSnapshot(state), { ok: true });
});

test("trusted runtime promotion removes bootstrap last and is idempotent", () => {
  const state = activeState();
  assert.equal(state.stage, "ASSIGN");
  assert.equal(state.genesis.state, "ACTIVE");
  assert.equal(state.genesis.bootstrapRetained, false);
  assert.equal(state.genesis.reportReady, true);
  assert.equal(state.genesis.promotionOperations.at(-1), "remove-bootstrap-last");
  assert.deepEqual(validateFirstRunSnapshot(state), { ok: true });
  assert.strictEqual(approveGenesis(state, identity, passingEvidence), state);
  assert.equal(approveGenesis(state, { ...identity, name: "Agent khác" }, passingEvidence).lastError, "rebirth-required");
});

test("resumable Genesis continues idempotently only with trusted complete evidence", () => {
  const pending = approveGenesis(connectedState(), identity, { ...passingEvidence, readbackMatches: false });
  const stillPending = restoreFirstRunSnapshot(pending, { ...passingEvidence, healthPasses: false });
  assert.equal(stillPending.genesis.state, "PENDING_RESUME");
  assert.equal(stillPending.genesis.bootstrapRetained, true);

  const resumed = restoreFirstRunSnapshot(pending, passingEvidence);
  assert.equal(resumed.stage, "ASSIGN");
  assert.equal(resumed.genesis.state, "ACTIVE");
  assert.equal(resumed.genesis.promotionOperations.at(-1), "remove-bootstrap-last");
  assert.strictEqual(restoreFirstRunSnapshot(resumed, passingEvidence), resumed);
});

test("snapshot validator rejects every previously exploitable inconsistent combination", () => {
  const wrongSchema = { ...createInitialFirstRunState(), schemaVersion: "wrong" };
  const impossibleSeeded = structuredClone(installedState());
  impossibleSeeded.stage = "COMPLETE";
  impossibleSeeded.genesis.bootstrapRetained = false;
  impossibleSeeded.genesis.reportReady = true;

  const invalidApprovedIdentity = approveGenesis(connectedState(), identity, { ...passingEvidence, healthPasses: false });
  invalidApprovedIdentity.genesis.approvedIdentity = { ...identity, name: "" };

  const safetyDrift = structuredClone(previewReadyState());
  safetyDrift.safety.dataEgress = true;

  const unknownFixture = structuredClone(connectedState());
  unknownFixture.connection.fixtureId = "unknown-demo";

  const incompletePromotion = structuredClone(activeState());
  incompletePromotion.genesis.promotionOperations = ["remove-bootstrap-last"];

  const poisonedSeededState = structuredClone(installedState());
  poisonedSeededState.genesis.promotionOperations = ["remove-bootstrap-last"];

  const unexpectedTopLevelField = { ...createInitialFirstRunState(), injected: true };

  for (const snapshot of [
    wrongSchema,
    impossibleSeeded,
    invalidApprovedIdentity,
    safetyDrift,
    unknownFixture,
    incompletePromotion,
    poisonedSeededState,
    unexpectedTopLevelField
  ]) {
    assert.equal(validateFirstRunSnapshot(snapshot).ok, false);
    const restored = restoreFirstRunSnapshot(snapshot, passingEvidence);
    assert.equal(restored.stage, "INSTALL");
    assert.equal(restored.genesis.state, "UNSEEDED");
    assert.equal(restored.genesis.bootstrapRetained, true);
    assert.equal(restored.genesis.reportReady, false);
    assert.equal(restored.genesis.previewApproved, false);
    assert.match(restored.lastError, /^snapshot-/);
  }
});

test("valid reachable snapshots pass the complete invariant matrix", () => {
  const pending = approveGenesis(connectedState(), identity, { ...passingEvidence, snapshotExists: false });
  const previewComplete = createTaskDraft(previewReadyState(), { requestId: "preview", goal: "Lập kế hoạch tuần" });
  const runtimeComplete = createTaskDraft(activeState(), { requestId: "runtime", goal: "Lập kế hoạch tháng" });
  for (const snapshot of [
    createInitialFirstRunState(),
    installedState(),
    connectedState(),
    previewReadyState(),
    pending,
    activeState(),
    previewComplete,
    runtimeComplete
  ]) assert.deepEqual(validateFirstRunSnapshot(snapshot), { ok: true });
});

test("pending resume without approved identity returns to the last safe conversation gate", () => {
  const pending = structuredClone(connectedState());
  pending.genesis.state = "PENDING_RESUME";
  pending.genesis.lastVerifiedCheckpoint = "CONVERSING";
  assert.deepEqual(validateFirstRunSnapshot(pending), { ok: true });
  const restored = restoreFirstRunSnapshot(pending);
  assert.equal(restored.genesis.state, "CONVERSING");
  assert.equal(restored.stage, "CONNECT");
});

test("task draft is gated, offline, cost-free, localized by plan ids, and accepts Unicode", () => {
  const blocked = createTaskDraft(connectedState(), { requestId: "early", goal: "Đi tắt" });
  assert.equal(blocked.lastError, "first-run-not-ready");

  const complete = createTaskDraft(previewReadyState(), {
    requestId: "first-assignment-preview",
    goal: "Lập kế hoạch 30 ngày cho lớp AI của Đại ca 🦐"
  });
  assert.equal(complete.stage, "COMPLETE");
  assert.equal(complete.task.status, "draft-only");
  assert.deepEqual(complete.task.draft.plan, [
    "clarify-success",
    "prepare-safe-execution",
    "review-before-handoff"
  ]);
  assert.equal(complete.task.draft.dataEgress, "none");
  assert.equal(complete.task.draft.permissions, "none");
  assert.equal(complete.task.draft.budgetTokens, 0);
  assert.equal(complete.advisor.plan, "pending-runtime");
  assert.equal(complete.advisor.final, "pending-runtime");
});

test("task submit is idempotent only for a consistent completed draft", () => {
  const first = createTaskDraft(previewReadyState(), { requestId: "same", goal: "Việc đầu" });
  assert.strictEqual(createTaskDraft(first, { requestId: "same", goal: "Việc khác" }), first);

  const corrupted = structuredClone(first);
  corrupted.genesis.previewApproved = false;
  assert.equal(createTaskDraft(corrupted, { requestId: "same", goal: "Việc khác" }).lastError, "first-run-not-ready");
  assert.equal(createTaskDraft(first, { requestId: "different", goal: "Việc thứ hai" }).lastError, "first-run-not-ready");
});

test("runtime promotion cannot rewrite a completed preview draft", () => {
  const complete = createTaskDraft(previewReadyState(), { requestId: "complete", goal: "Việc đầu" });
  const denied = approveGenesis(complete, identity, passingEvidence);
  assert.equal(denied.stage, "COMPLETE");
  assert.equal(denied.genesis.state, "STAGING");
  assert.equal(denied.lastError, "genesis-transition-denied");
});

test("empty and extreme task values are rejected without partial draft", () => {
  const empty = createTaskDraft(previewReadyState(), { requestId: "empty", goal: "   " });
  const long = createTaskDraft(previewReadyState(), { requestId: "long", goal: "a".repeat(1201) });
  assert.equal(empty.lastError, "assignment-input-missing");
  assert.equal(empty.task.status, "empty");
  assert.equal(long.lastError, "assignment-too-long");
  assert.equal(long.task.status, "empty");
});
