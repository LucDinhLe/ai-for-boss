export const FIRST_RUN_SCHEMA_VERSION = "0.5.1-preview";

export const GENESIS_STATES = Object.freeze([
  "UNSEEDED",
  "SEEDED",
  "CONVERSING",
  "STAGING",
  "VERIFYING",
  "ACTIVE",
  "PENDING_RESUME"
]);

export const CONNECTION_FIXTURES = Object.freeze([
  Object.freeze({ id: "openai-demo", provider: "OpenAI", model: "GPT demo", live: false }),
  Object.freeze({ id: "anthropic-demo", provider: "Anthropic", model: "Claude demo", live: false }),
  Object.freeze({ id: "google-demo", provider: "Google", model: "Gemini demo", live: false })
]);

export const RUNTIME_EVIDENCE_SOURCE = "trusted-supervisor-runtime";

const REQUIRED_PROMOTION_CHECKS = Object.freeze([
  "contentValid",
  "readbackMatches",
  "identitySyncMatches",
  "snapshotExists",
  "healthPasses",
  "memoryAbsent"
]);

const PLAN_STEP_IDS = Object.freeze([
  "clarify-success",
  "prepare-safe-execution",
  "review-before-handoff"
]);

const ACTIVE_PROMOTION_OPERATIONS = Object.freeze([
  "stage-identity",
  "validate-content",
  "readback",
  "sync-identity",
  "query-back",
  "snapshot",
  "health-check",
  "remove-bootstrap-last"
]);
const FAILED_PROMOTION_OPERATIONS = Object.freeze(["stage-identity", "validation-failed"]);
const PREVIEW_PROMOTION_OPERATIONS = Object.freeze(["stage-identity-preview"]);

const STAGES = Object.freeze(["INSTALL", "CONNECT", "ASSIGN", "COMPLETE"]);
const MAX_IDENTITY_LENGTH = 200;
const MAX_TASK_LENGTH = 1200;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function withError(state, code) {
  return { ...state, lastError: code };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function sameIdentity(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameSequence(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function isAllowedFixtureId(fixtureId) {
  const fixture = CONNECTION_FIXTURES.find((item) => item.id === fixtureId);
  return Boolean(fixture && fixture.live === false);
}

function identityIsValid(identity) {
  const result = normalizeIdentity(identity);
  return result.ok && sameIdentity(result.identity, identity);
}

function promotionChecksPass(checks) {
  return (
    checks?.source === RUNTIME_EVIDENCE_SOURCE &&
    REQUIRED_PROMOTION_CHECKS.every((key) => checks?.[key] === true)
  );
}

function failClosedSnapshot(code) {
  return { ...createInitialFirstRunState(), lastError: code };
}

function isDraftShape(draft) {
  return (
    hasExactKeys(draft, ["goal", "output", "plan", "dataEgress", "permissions", "budgetTokens"]) &&
    clean(draft.goal).length > 0 &&
    clean(draft.goal).length <= MAX_TASK_LENGTH &&
    draft.output === "preview-plan" &&
    Array.isArray(draft.plan) &&
    draft.plan.length === PLAN_STEP_IDS.length &&
    PLAN_STEP_IDS.every((step, index) => draft.plan[index] === step) &&
    draft.dataEgress === "none" &&
    draft.permissions === "none" &&
    draft.budgetTokens === 0
  );
}

function baseSnapshotShapePasses(snapshot) {
  if (
    !hasExactKeys(snapshot, [
      "schemaVersion",
      "safety",
      "stage",
      "install",
      "connection",
      "genesis",
      "task",
      "advisor",
      "lastError"
    ]) ||
    snapshot.schemaVersion !== FIRST_RUN_SCHEMA_VERSION
  ) return false;
  if (!STAGES.includes(snapshot.stage)) return false;
  if (
    !hasExactKeys(snapshot.safety, ["mockMode", "dataEgress", "realCost"]) ||
    snapshot.safety.mockMode !== true ||
    snapshot.safety.dataEgress !== false ||
    snapshot.safety.realCost !== 0
  ) return false;
  if (
    !hasExactKeys(snapshot.install, ["status", "evidence"]) ||
    !["pending", "verified"].includes(snapshot.install.status) ||
    snapshot.install.evidence !== "shell-contract-only"
  ) return false;
  if (
    !hasExactKeys(snapshot.connection, ["status", "fixtureId"]) ||
    !["disconnected", "connected-fixture"].includes(snapshot.connection.status)
  ) return false;
  if (
    snapshot.connection.status === "disconnected" && snapshot.connection.fixtureId !== null
  ) return false;
  if (
    snapshot.connection.status === "connected-fixture" &&
    !isAllowedFixtureId(snapshot.connection.fixtureId)
  ) return false;
  if (
    !hasExactKeys(snapshot.genesis, [
      "state",
      "bootstrapRetained",
      "reportReady",
      "previewApproved",
      "approvedIdentity",
      "lastVerifiedCheckpoint",
      "promotionOperations"
    ]) ||
    !GENESIS_STATES.includes(snapshot.genesis.state) ||
    typeof snapshot.genesis.bootstrapRetained !== "boolean" ||
    typeof snapshot.genesis.reportReady !== "boolean" ||
    typeof snapshot.genesis.previewApproved !== "boolean" ||
    !GENESIS_STATES.includes(snapshot.genesis.lastVerifiedCheckpoint) ||
    !Array.isArray(snapshot.genesis.promotionOperations) ||
    snapshot.genesis.promotionOperations.some((item) => typeof item !== "string")
  ) return false;
  if (
    snapshot.genesis.approvedIdentity !== null &&
    !identityIsValid(snapshot.genesis.approvedIdentity)
  ) return false;
  if (
    !hasExactKeys(snapshot.task, ["status", "requestId", "draft"]) ||
    !["empty", "draft-only"].includes(snapshot.task.status)
  ) return false;
  if (snapshot.task.status === "empty") {
    if (snapshot.task.requestId !== null || snapshot.task.draft !== null) return false;
  } else if (!clean(snapshot.task.requestId) || !isDraftShape(snapshot.task.draft)) {
    return false;
  }
  if (
    !hasExactKeys(snapshot.advisor, ["plan", "final"]) ||
    snapshot.advisor.plan !== "pending-runtime" ||
    snapshot.advisor.final !== "pending-runtime"
  ) return false;
  return snapshot.lastError === null || typeof snapshot.lastError === "string";
}

function stateCombinationPasses(snapshot) {
  const { stage, install, connection, genesis, task } = snapshot;
  const connected = connection.status === "connected-fixture";
  const identityApproved = genesis.approvedIdentity !== null;

  if (stage === "INSTALL") {
    return (
      install.status === "pending" &&
      !connected &&
      genesis.state === "UNSEEDED" &&
      genesis.bootstrapRetained === true &&
      genesis.reportReady === false &&
      genesis.previewApproved === false &&
      !identityApproved &&
      genesis.lastVerifiedCheckpoint === "UNSEEDED" &&
      genesis.promotionOperations.length === 0 &&
      task.status === "empty"
    );
  }

  if (
    install.status !== "verified" ||
    (task.status === "draft-only") !== (stage === "COMPLETE")
  ) {
    return false;
  }

  if (stage === "CONNECT") {
    if (genesis.bootstrapRetained !== true || genesis.reportReady !== false || genesis.previewApproved !== false) {
      return false;
    }
    if (genesis.state === "SEEDED") {
      return (
        !connected &&
        !identityApproved &&
        genesis.lastVerifiedCheckpoint === "SEEDED" &&
        genesis.promotionOperations.length === 0
      );
    }
    if (genesis.state === "CONVERSING") {
      return (
        connected &&
        !identityApproved &&
        genesis.lastVerifiedCheckpoint === "CONVERSING" &&
        genesis.promotionOperations.length === 0
      );
    }
    if (genesis.state === "PENDING_RESUME") {
      if (!identityApproved) {
        return (
          genesis.promotionOperations.length === 0 &&
          genesis.lastVerifiedCheckpoint === (connected ? "CONVERSING" : "SEEDED")
        );
      }
      return (
        connected &&
        genesis.lastVerifiedCheckpoint === "STAGING" &&
        sameSequence(genesis.promotionOperations, FAILED_PROMOTION_OPERATIONS)
      );
    }
    if (genesis.state === "STAGING") {
      return (
        connected &&
        identityApproved &&
        genesis.lastVerifiedCheckpoint === "STAGING" &&
        sameSequence(genesis.promotionOperations, ["stage-identity"])
      );
    }
    if (genesis.state === "VERIFYING") {
      return (
        connected &&
        identityApproved &&
        genesis.lastVerifiedCheckpoint === "STAGING" &&
        sameSequence(genesis.promotionOperations, ["stage-identity"])
      );
    }
    return false;
  }

  if (!connected || !identityApproved || !genesis.previewApproved) return false;
  if (genesis.state === "ACTIVE") {
    return (
      genesis.bootstrapRetained === false &&
      genesis.reportReady === true &&
      genesis.lastVerifiedCheckpoint === "ACTIVE" &&
      sameSequence(genesis.promotionOperations, ACTIVE_PROMOTION_OPERATIONS)
    );
  }
  return (
    genesis.state === "STAGING" &&
    genesis.bootstrapRetained === true &&
    genesis.reportReady === false &&
    genesis.lastVerifiedCheckpoint === "STAGING" &&
    sameSequence(genesis.promotionOperations, PREVIEW_PROMOTION_OPERATIONS)
  );
}

export function validateFirstRunSnapshot(snapshot) {
  if (!baseSnapshotShapePasses(snapshot)) return { ok: false, code: "snapshot-shape-invalid" };
  if (!stateCombinationPasses(snapshot)) return { ok: false, code: "snapshot-invariant-failed" };
  return { ok: true };
}

export function createInitialFirstRunState() {
  return {
    schemaVersion: FIRST_RUN_SCHEMA_VERSION,
    safety: { mockMode: true, dataEgress: false, realCost: 0 },
    stage: "INSTALL",
    install: { status: "pending", evidence: "shell-contract-only" },
    connection: { status: "disconnected", fixtureId: null },
    genesis: {
      state: "UNSEEDED",
      bootstrapRetained: true,
      reportReady: false,
      previewApproved: false,
      approvedIdentity: null,
      lastVerifiedCheckpoint: "UNSEEDED",
      promotionOperations: []
    },
    task: { status: "empty", requestId: null, draft: null },
    advisor: { plan: "pending-runtime", final: "pending-runtime" },
    lastError: null
  };
}

export function verifyInternalInstall(state, shellReady) {
  if (state.install.status === "verified") {
    return state.stage === "INSTALL" ? withError(state, "install-state-inconsistent") : state;
  }
  if (state.stage !== "INSTALL") return withError(state, "install-transition-denied");
  if (!shellReady) return withError(state, "shell-contract-unavailable");

  return {
    ...state,
    stage: "CONNECT",
    install: { status: "verified", evidence: "shell-contract-only" },
    genesis: {
      ...state.genesis,
      state: "SEEDED",
      lastVerifiedCheckpoint: "SEEDED"
    },
    lastError: null
  };
}

export function connectFixture(state, fixtureId) {
  if (state.install.status !== "verified" || state.stage !== "CONNECT") {
    return withError(state, "install-not-verified");
  }
  if (!isAllowedFixtureId(fixtureId)) return withError(state, "fixture-not-allowed");
  if (
    state.connection.status === "connected-fixture" &&
    state.connection.fixtureId === fixtureId &&
    state.genesis.state === "CONVERSING"
  ) return state;

  return {
    ...state,
    connection: { status: "connected-fixture", fixtureId },
    genesis: {
      ...state.genesis,
      state: "CONVERSING",
      bootstrapRetained: true,
      reportReady: false,
      previewApproved: false,
      approvedIdentity: null,
      lastVerifiedCheckpoint: "CONVERSING",
      promotionOperations: []
    },
    lastError: null
  };
}

export function normalizeIdentity(candidate) {
  const identity = {
    name: clean(candidate?.name),
    role: clean(candidate?.role),
    tone: clean(candidate?.tone),
    emoji: clean(candidate?.emoji),
    userAddress: clean(candidate?.userAddress),
    priority: clean(candidate?.priority),
    boundary: clean(candidate?.boundary)
  };

  if (Object.values(identity).some((value) => !value)) {
    return { ok: false, code: "identity-required-fields-missing" };
  }
  if (Object.values(identity).some((value) => value.length > MAX_IDENTITY_LENGTH)) {
    return { ok: false, code: "identity-field-too-long" };
  }
  return { ok: true, identity };
}

export function approvePreviewGenesis(state, candidate) {
  if (
    state.stage === "ASSIGN" &&
    state.genesis.state === "STAGING" &&
    state.genesis.previewApproved === true
  ) {
    const normalized = normalizeIdentity(candidate);
    return normalized.ok && sameIdentity(state.genesis.approvedIdentity, normalized.identity)
      ? state
      : withError(state, "rebirth-required");
  }
  if (
    state.stage !== "CONNECT" ||
    state.connection.status !== "connected-fixture" ||
    state.genesis.state !== "CONVERSING"
  ) return withError(state, "preview-genesis-transition-denied");

  const normalized = normalizeIdentity(candidate);
  if (!normalized.ok) return withError(state, normalized.code);

  return {
    ...state,
    stage: "ASSIGN",
    genesis: {
      ...state.genesis,
      state: "STAGING",
      bootstrapRetained: true,
      reportReady: false,
      previewApproved: true,
      approvedIdentity: normalized.identity,
      lastVerifiedCheckpoint: "STAGING",
      promotionOperations: [...PREVIEW_PROMOTION_OPERATIONS]
    },
    lastError: null
  };
}

function promoteGenesis(state, identity, checks) {
  if (!promotionChecksPass(checks)) {
    return {
      ...state,
      stage: "CONNECT",
      genesis: {
        ...state.genesis,
        state: "PENDING_RESUME",
        bootstrapRetained: true,
        reportReady: false,
        previewApproved: false,
        approvedIdentity: identity,
        lastVerifiedCheckpoint: "STAGING",
        promotionOperations: [...FAILED_PROMOTION_OPERATIONS]
      },
      lastError: "genesis-verification-failed"
    };
  }

  return {
    ...state,
    stage: "ASSIGN",
    genesis: {
      ...state.genesis,
      state: "ACTIVE",
      bootstrapRetained: false,
      reportReady: true,
      previewApproved: true,
      approvedIdentity: identity,
      lastVerifiedCheckpoint: "ACTIVE",
      promotionOperations: [...ACTIVE_PROMOTION_OPERATIONS]
    },
    lastError: null
  };
}

export function approveGenesis(state, candidate, checks) {
  if (state.connection.status !== "connected-fixture") {
    return withError(state, "model-not-connected");
  }

  const normalized = normalizeIdentity(candidate);
  if (!normalized.ok) return withError(state, normalized.code);

  if (state.genesis.state === "ACTIVE") {
    return sameIdentity(state.genesis.approvedIdentity, normalized.identity)
      ? state
      : withError(state, "rebirth-required");
  }

  const runtimeTransitionAllowed =
    state.task.status === "empty" &&
    (state.stage === "CONNECT" ||
      (state.stage === "ASSIGN" &&
        state.genesis.state === "STAGING" &&
        state.genesis.previewApproved === true));
  if (!runtimeTransitionAllowed) return withError(state, "genesis-transition-denied");

  if (!["CONVERSING", "STAGING", "VERIFYING", "PENDING_RESUME"].includes(state.genesis.state)) {
    return withError(state, "genesis-transition-denied");
  }

  const stagingState = {
    ...state,
    stage: "CONNECT",
    genesis: {
      ...state.genesis,
      state: "VERIFYING",
      bootstrapRetained: true,
      reportReady: false,
      previewApproved: false,
      approvedIdentity: normalized.identity,
      lastVerifiedCheckpoint: "STAGING",
      promotionOperations: ["stage-identity"]
    }
  };
  return promoteGenesis(stagingState, normalized.identity, checks);
}

export function restoreFirstRunSnapshot(snapshot, checks) {
  const validation = validateFirstRunSnapshot(snapshot);
  if (!validation.ok) return failClosedSnapshot(validation.code);

  if (snapshot.genesis.state === "ACTIVE") return snapshot;
  if (snapshot.genesis.state === "PENDING_RESUME") {
    if (!snapshot.genesis.approvedIdentity) {
      return {
        ...snapshot,
        stage: "CONNECT",
        genesis: {
          ...snapshot.genesis,
          state: snapshot.connection.status === "connected-fixture" ? "CONVERSING" : "SEEDED",
          lastVerifiedCheckpoint: snapshot.connection.status === "connected-fixture" ? "CONVERSING" : "SEEDED"
        },
        lastError: null
      };
    }
    return approveGenesis(snapshot, snapshot.genesis.approvedIdentity, checks);
  }
  if (
    ["STAGING", "VERIFYING"].includes(snapshot.genesis.state) &&
    snapshot.genesis.previewApproved === false
  ) {
    return approveGenesis(snapshot, snapshot.genesis.approvedIdentity, checks);
  }
  return snapshot;
}

function completedDraftIsConsistent(state, requestId) {
  return (
    validateFirstRunSnapshot(state).ok &&
    state.stage === "COMPLETE" &&
    state.task.status === "draft-only" &&
    state.task.requestId === requestId &&
    isDraftShape(state.task.draft)
  );
}

export function createTaskDraft(state, candidate) {
  const requestId = clean(candidate?.requestId);
  const goal = clean(candidate?.goal);
  if (requestId && completedDraftIsConsistent(state, requestId)) return state;

  const previewReady =
    state.genesis.state === "STAGING" &&
    state.genesis.previewApproved === true &&
    state.genesis.bootstrapRetained === true &&
    state.genesis.reportReady === false;
  const runtimeReady =
    state.genesis.state === "ACTIVE" &&
    state.genesis.previewApproved === true &&
    state.genesis.bootstrapRetained === false &&
    state.genesis.reportReady === true;

  if (
    state.stage !== "ASSIGN" ||
    state.install.status !== "verified" ||
    state.connection.status !== "connected-fixture" ||
    (!previewReady && !runtimeReady)
  ) return withError(state, "first-run-not-ready");

  if (!requestId || !goal) return withError(state, "assignment-input-missing");
  if (goal.length > MAX_TASK_LENGTH) return withError(state, "assignment-too-long");
  if (state.task.status !== "empty") return withError(state, "assignment-already-created");

  return {
    ...state,
    stage: "COMPLETE",
    task: {
      status: "draft-only",
      requestId,
      draft: {
        goal,
        output: "preview-plan",
        plan: [...PLAN_STEP_IDS],
        dataEgress: "none",
        permissions: "none",
        budgetTokens: 0
      }
    },
    advisor: { plan: "pending-runtime", final: "pending-runtime" },
    lastError: null
  };
}
