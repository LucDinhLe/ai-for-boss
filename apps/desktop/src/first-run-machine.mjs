export const FIRST_RUN_SCHEMA_VERSION = "0.5.0-preview";

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

const REQUIRED_PROMOTION_CHECKS = Object.freeze([
  "contentValid",
  "readbackMatches",
  "identitySyncMatches",
  "snapshotExists",
  "healthPasses",
  "memoryAbsent"
]);

const MAX_IDENTITY_LENGTH = 200;
const MAX_TASK_LENGTH = 1200;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function withError(state, code) {
  return { ...state, lastError: code };
}

function sameIdentity(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  if (state.install.status === "verified") return state;
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

  const fixture = CONNECTION_FIXTURES.find((item) => item.id === fixtureId);
  if (!fixture || fixture.live) return withError(state, "fixture-not-allowed");
  if (state.connection.status === "connected-fixture" && state.connection.fixtureId === fixtureId) {
    return state;
  }

  return {
    ...state,
    connection: { status: "connected-fixture", fixtureId },
    genesis: {
      ...state.genesis,
      state: "CONVERSING",
      lastVerifiedCheckpoint: "CONVERSING"
    },
    lastError: null
  };
}

export function normalizeIdentity(candidate) {
  const identity = {
    name: clean(candidate?.name),
    role: clean(candidate?.role),
    tone: clean(candidate?.tone),
    userAddress: clean(candidate?.userAddress),
    boundary: clean(candidate?.boundary)
  };

  if (!identity.name || !identity.role) {
    return { ok: false, code: "identity-required-fields-missing" };
  }
  if (Object.values(identity).some((value) => value.length > MAX_IDENTITY_LENGTH)) {
    return { ok: false, code: "identity-field-too-long" };
  }
  return { ok: true, identity };
}

function promotionChecksPass(checks) {
  return REQUIRED_PROMOTION_CHECKS.every((key) => checks?.[key] === true);
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
        approvedIdentity: identity,
        lastVerifiedCheckpoint: "STAGING",
        promotionOperations: ["stage-identity", "validation-failed"]
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
      approvedIdentity: identity,
      lastVerifiedCheckpoint: "ACTIVE",
      promotionOperations: [
        "stage-identity",
        "validate-content",
        "readback",
        "sync-identity",
        "query-back",
        "snapshot",
        "health-check",
        "remove-bootstrap-last"
      ]
    },
    lastError: null
  };
}

export function approveGenesis(state, candidate, checks) {
  if (state.connection.status !== "connected-fixture") {
    return withError(state, "model-not-connected");
  }

  const normalized = normalizeIdentity(candidate);
  if (!normalized.ok) {
    return {
      ...withError(state, normalized.code),
      genesis: {
        ...state.genesis,
        state: "PENDING_RESUME",
        bootstrapRetained: true,
        reportReady: false
      }
    };
  }

  if (state.genesis.state === "ACTIVE") {
    return sameIdentity(state.genesis.approvedIdentity, normalized.identity)
      ? state
      : withError(state, "rebirth-required");
  }

  if (!["CONVERSING", "PENDING_RESUME"].includes(state.genesis.state)) {
    return withError(state, "genesis-transition-denied");
  }

  const stagingState = {
    ...state,
    genesis: {
      ...state.genesis,
      state: "VERIFYING",
      bootstrapRetained: true,
      reportReady: false,
      approvedIdentity: normalized.identity,
      lastVerifiedCheckpoint: "STAGING",
      promotionOperations: ["stage-identity"]
    }
  };
  return promoteGenesis(stagingState, normalized.identity, checks);
}

export function restoreFirstRunSnapshot(snapshot, checks) {
  const fallback = createInitialFirstRunState();
  if (
    !snapshot ||
    snapshot.schemaVersion !== FIRST_RUN_SCHEMA_VERSION ||
    !GENESIS_STATES.includes(snapshot.genesis?.state)
  ) {
    return {
      ...fallback,
      stage: "CONNECT",
      genesis: { ...fallback.genesis, state: "PENDING_RESUME" },
      lastError: "snapshot-invalid"
    };
  }

  if (snapshot.genesis.state === "ACTIVE") {
    if (snapshot.genesis.bootstrapRetained === false && snapshot.genesis.reportReady === true) {
      return snapshot;
    }
    return {
      ...snapshot,
      stage: "CONNECT",
      genesis: {
        ...snapshot.genesis,
        state: "PENDING_RESUME",
        bootstrapRetained: true,
        reportReady: false
      },
      lastError: "active-invariant-failed"
    };
  }

  if (snapshot.genesis.state !== "PENDING_RESUME") return snapshot;
  if (!snapshot.genesis.approvedIdentity) {
    return {
      ...snapshot,
      stage: "CONNECT",
      genesis: { ...snapshot.genesis, state: "CONVERSING" },
      lastError: null
    };
  }
  return promoteGenesis(snapshot, snapshot.genesis.approvedIdentity, checks);
}

export function createTaskDraft(state, candidate) {
  const requestId = clean(candidate?.requestId);
  const goal = clean(candidate?.goal);
  if (state.task.requestId === requestId && requestId) return state;

  if (
    state.stage !== "ASSIGN" ||
    state.install.status !== "verified" ||
    state.connection.status !== "connected-fixture" ||
    state.genesis.state !== "ACTIVE" ||
    state.genesis.reportReady !== true
  ) {
    return withError(state, "first-run-not-ready");
  }

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
        output: "Bản nháp nội bộ, chưa có artifact runtime",
        dataEgress: "Không gửi dữ liệu trong preview",
        permissions: "Không có tool hoặc quyền thật",
        budget: "0 token trong preview"
      }
    },
    advisor: { plan: "pending-runtime", final: "pending-runtime" },
    lastError: null
  };
}

export const PASSING_PROMOTION_CHECKS = Object.freeze(
  Object.fromEntries(REQUIRED_PROMOTION_CHECKS.map((key) => [key, true]))
);
