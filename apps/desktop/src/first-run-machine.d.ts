export type GenesisState =
  | "UNSEEDED"
  | "SEEDED"
  | "CONVERSING"
  | "STAGING"
  | "VERIFYING"
  | "ACTIVE"
  | "PENDING_RESUME";

export type Identity = {
  name: string;
  role: string;
  tone: string;
  emoji: string;
  userAddress: string;
  priority: string;
  boundary: string;
};

export type PromotionEvidence = {
  source: typeof RUNTIME_EVIDENCE_SOURCE;
  contentValid: boolean;
  readbackMatches: boolean;
  identitySyncMatches: boolean;
  snapshotExists: boolean;
  healthPasses: boolean;
  memoryAbsent: boolean;
};

export type TaskDraft = {
  goal: string;
  output: "preview-plan";
  plan: ["clarify-success", "prepare-safe-execution", "review-before-handoff"];
  dataEgress: "none";
  permissions: "none";
  budgetTokens: 0;
};

export type FirstRunState = {
  schemaVersion: "0.5.1-preview";
  safety: { mockMode: true; dataEgress: false; realCost: 0 };
  stage: "INSTALL" | "CONNECT" | "ASSIGN" | "COMPLETE";
  install: { status: "pending" | "verified"; evidence: "shell-contract-only" };
  connection: { status: "disconnected" | "connected-fixture"; fixtureId: string | null };
  genesis: {
    state: GenesisState;
    bootstrapRetained: boolean;
    reportReady: boolean;
    previewApproved: boolean;
    approvedIdentity: Identity | null;
    lastVerifiedCheckpoint: GenesisState;
    promotionOperations: string[];
  };
  task: {
    status: "empty" | "draft-only";
    requestId: string | null;
    draft: TaskDraft | null;
  };
  advisor: { plan: "pending-runtime"; final: "pending-runtime" };
  lastError: string | null;
};

export const FIRST_RUN_SCHEMA_VERSION: "0.5.1-preview";
export const GENESIS_STATES: readonly GenesisState[];
export const RUNTIME_EVIDENCE_SOURCE: "trusted-supervisor-runtime";
export const CONNECTION_FIXTURES: readonly Readonly<{
  id: string;
  provider: string;
  model: string;
  live: false;
}>[];
export function createInitialFirstRunState(): FirstRunState;
export function verifyInternalInstall(state: FirstRunState, shellReady: boolean): FirstRunState;
export function connectFixture(state: FirstRunState, fixtureId: string): FirstRunState;
export function normalizeIdentity(candidate: Partial<Identity>):
  | { ok: true; identity: Identity }
  | { ok: false; code: string };
export function approvePreviewGenesis(state: FirstRunState, candidate: Partial<Identity>): FirstRunState;
export function approveGenesis(
  state: FirstRunState,
  candidate: Partial<Identity>,
  checks: Partial<PromotionEvidence>
): FirstRunState;
export function validateFirstRunSnapshot(snapshot: unknown): { ok: true } | { ok: false; code: string };
export function restoreFirstRunSnapshot(
  snapshot: FirstRunState | unknown,
  checks?: Partial<PromotionEvidence>
): FirstRunState;
export function createTaskDraft(
  state: FirstRunState,
  candidate: { requestId: string; goal: string }
): FirstRunState;
