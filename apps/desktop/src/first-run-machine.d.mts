export type GenesisState =
  | "UNSEEDED"
  | "SEEDED"
  | "CONVERSING"
  | "STAGING"
  | "VERIFYING"
  | "ACTIVE"
  | "PENDING_RESUME";

export type FirstRunState = {
  schemaVersion: string;
  safety: { mockMode: true; dataEgress: false; realCost: 0 };
  stage: "INSTALL" | "CONNECT" | "ASSIGN" | "COMPLETE";
  install: { status: string; evidence: string };
  connection: { status: string; fixtureId: string | null };
  genesis: {
    state: GenesisState;
    bootstrapRetained: boolean;
    reportReady: boolean;
    approvedIdentity: Record<string, string> | null;
    lastVerifiedCheckpoint: string;
    promotionOperations: string[];
  };
  task: { status: string; requestId: string | null; draft: Record<string, string> | null };
  advisor: { plan: string; final: string };
  lastError: string | null;
};

export const FIRST_RUN_SCHEMA_VERSION: string;
export const GENESIS_STATES: readonly GenesisState[];
export const CONNECTION_FIXTURES: readonly Readonly<{ id: string; provider: string; model: string; live: false }>[];
export const PASSING_PROMOTION_CHECKS: Readonly<Record<string, true>>;
export function createInitialFirstRunState(): FirstRunState;
export function verifyInternalInstall(state: FirstRunState, shellReady: boolean): FirstRunState;
export function connectFixture(state: FirstRunState, fixtureId: string): FirstRunState;
export function normalizeIdentity(candidate: Record<string, string>): { ok: true; identity: Record<string, string> } | { ok: false; code: string };
export function approveGenesis(state: FirstRunState, candidate: Record<string, string>, checks: Record<string, boolean>): FirstRunState;
export function restoreFirstRunSnapshot(snapshot: FirstRunState | unknown, checks: Record<string, boolean>): FirstRunState;
export function createTaskDraft(state: FirstRunState, candidate: { requestId: string; goal: string }): FirstRunState;
