export type AdvisorCheckpoint = "plan" | "final";
export type AdvisorModel = { id: string; provider: string };
export type AdvisorEvidence = { source: "goal" | "criteria" | "content" | "evidence"; quote: string };
export interface AdvisorResult {
  decision: "approve" | "revise" | "clarify" | "blocked";
  pass: boolean;
  summary: string;
  confidence: number;
  evidence: AdvisorEvidence[];
  issues: { title: string; detail: string; severity: "low" | "medium" | "high";
    evidence: AdvisorEvidence[]; recommended_fix: string }[];
}
export interface ReviewInput {
  id: string;
  sourceSessionKey: string;
  checkpoint: AdvisorCheckpoint;
  model: AdvisorModel;
  goal: string;
  criteria: string;
  content: string;
  evidence: string;
}
export type AdvisorRequest = ({ action: "review" } & ReviewInput) | { action: "cancel"; id: string };
export type AdvisorResponse = { id: string; status: "completed" | "cancelled" | "error"; result?: AdvisorResult; message?: string };
export type AdvisorForm = Omit<ReviewInput, "id" | "sourceSessionKey" | "model"> & {
  model: AdvisorModel | null;
  sourceKind: "answer" | "draft" | null;
  sourceSnapshot: string;
};
export type AdvisorEntry = { form: AdvisorForm; status: "idle" | "running" | AdvisorResponse["status"];
  result?: AdvisorResult; message?: string; reviewedForm?: string };
export type AdvisorView = {
  form: AdvisorForm;
  entry: AdvisorEntry;
  stale: boolean;
  sourceChanged: boolean;
  busy: boolean;
  runningHere: boolean;
  cancelling: boolean;
  canReview: boolean;
  validation: string | null;
  update: (patch: Partial<AdvisorForm>) => void;
  chooseSource: (source: "answer" | "draft") => void;
  review: () => Promise<void>;
  cancel: () => Promise<void>;
};
