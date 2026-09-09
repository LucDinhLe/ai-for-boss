import type { ContextUsage, ModelSummary } from "./gateway-client";

const NON_MODEL_PHASES = new Set(['end', 'error', 'preparing_workspace', 'naming_worktree', 'creating_worktree',
  'running_setup', 'provisioning_environment', 'preparing_context']);
const MODEL_PHASES = new Set(['start', 'started', 'running', 'thinking', 'tool', 'working', 'planning', 'starting_model']);

export type ChatRun = {
  runId: string | null;
  seq: number;
  text: string;
  state: string | null;
  busy: boolean;
  terminal: boolean;
  nativeActive?: boolean;
  retiredRunId?: string | null;
  activeRunIds?: readonly string[];
  progress?: RunProgressState;
};

export type RunProgressState = {
  seq: number;
  updatedAt: number;
  phase: string;
  reasoning: string;
  reasoningTokens?: number;
  tools: { id: string; name: string; phase: "start" | "update" | "result"; failed: boolean;
    activity?: { kind: "skill" | "agent"; label?: string; agentId?: string } }[];
  plan: { step: string; status: "pending" | "in_progress" | "completed" }[];
  explanation?: string;
};

function readProgressPlan(value: unknown): RunProgressState["plan"] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).flatMap((item: unknown) => {
    const step = item as Record<string, unknown> | null;
    return typeof step?.step === "string" && ["pending", "in_progress", "completed"].includes(String(step.status))
      ? [{ step: step.step.slice(0, 600), status: step.status as "pending" | "in_progress" | "completed" }] : [];
  });
}

/** Public progress is informational. Only chat ACK/terminal/history can change
 * run ownership or release the send/stop lock. Agent and chat sequences differ. */
export function reduceAgentProgress(current: ChatRun, payload: Record<string, unknown>, sessionKey: string): ChatRun {
  if (!current.runId || current.terminal || payload.sessionKey !== sessionKey || payload.runId !== current.runId
    || typeof payload.seq !== "number" || !Number.isSafeInteger(payload.seq) || payload.seq < 0
    || typeof payload.ts !== "number" || !Number.isSafeInteger(payload.ts) || payload.ts < 0
    || !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) return current;
  const prior = current.progress;
  if (prior && payload.seq <= prior.seq) return current;
  const data = payload.data as Record<string, unknown>;
  const progress: RunProgressState = { seq: payload.seq, updatedAt: payload.ts, phase: prior?.phase ?? "start",
    reasoning: prior?.reasoning ?? "", reasoningTokens: prior?.reasoningTokens,
    tools: prior?.tools ?? [], plan: prior?.plan ?? [], explanation: prior?.explanation };
  if (payload.stream === "thinking") {
    if (typeof data.text === "string") progress.reasoning = data.text.slice(0, 24_000);
    else if (typeof data.delta === "string") progress.reasoning = (data.replace === true ? data.delta : progress.reasoning + data.delta).slice(0, 24_000);
    else if (typeof data.progressTokens !== "number") return current;
    if (typeof data.progressTokens === "number" && Number.isSafeInteger(data.progressTokens) && data.progressTokens >= 0) progress.reasoningTokens = data.progressTokens;
    progress.phase = "thinking";
  } else if (payload.stream === "tool") {
    if (typeof data.toolCallId !== "string" || !data.toolCallId || data.toolCallId.length > 512
      || typeof data.name !== "string" || !/^[\w.:-]{1,100}$/u.test(data.name)
      || !["start", "update", "result"].includes(String(data.phase))) return current;
    const previous = progress.tools.find(item => item.id === data.toolCallId);
    if (previous && (previous.name !== data.name || (previous.phase === "result" && data.phase !== "result"))) return current;
    const raw = data.activity as Record<string, unknown> | undefined;
    const validName = (value: unknown): value is string => typeof value === 'string' && /^[\p{L}\p{N} _().-]{1,120}$/u.test(value);
    const kind = raw?.kind === 'skill' && data.name === 'read' ? 'skill'
      : raw?.kind === 'agent' && ['sessions_spawn', 'sessions_send'].includes(data.name) ? 'agent' : null;
    const activity: RunProgressState['tools'][number]['activity'] = kind && raw && (validName(raw.label) || (kind === 'agent' && validName(raw.agentId)))
      ? { kind, ...(validName(raw.label) ? { label: raw.label } : {}), ...(kind === 'agent' && validName(raw.agentId) ? { agentId: raw.agentId } : {}) }
      : previous?.activity;
    const tool: RunProgressState['tools'][number] = { id: data.toolCallId, name: data.name, phase: data.phase as "start" | "update" | "result", failed: data.isError === true,
      ...(activity ? { activity } : {}) };
    progress.tools = previous ? progress.tools.map(item => item.id === tool.id ? tool : item) : [...progress.tools, tool].slice(-20);
    progress.phase = tool.phase === "result" ? "working" : "tool";
  } else if (payload.stream === "plan") {
    if (!Array.isArray(data.steps)) return current;
    progress.plan = readProgressPlan(data.steps);
    progress.explanation = typeof data.explanation === 'string' ? data.explanation.slice(0, 2000) : undefined;
    progress.phase = "planning";
  } else if (payload.stream === "lifecycle" || payload.stream === "run_status") {
    if (!["start", "end", "error", "preparing_workspace", "naming_worktree", "creating_worktree", "running_setup",
      "provisioning_environment", "preparing_context", "starting_model"].includes(String(data.phase))) return current;
    progress.phase = String(data.phase);
  } else return current;
  return { ...current, progress, nativeActive: current.busy && MODEL_PHASES.has(progress.phase) };
}

export function newChatRun(runId: string | null = null): ChatRun {
  return { runId, seq: -1, text: "", state: runId ? "started" : null, busy: Boolean(runId), terminal: false, nativeActive: false };
}

/** Admission ACKs stay busy; a cached terminal result may have no new event. */
export function acknowledgeChatRun(current: ChatRun, submissionId: string, ack: Record<string, unknown>): ChatRun {
  if (current.runId !== submissionId || current.terminal) return current;
  const runId = typeof ack.runId === "string" && ack.runId.trim() ? ack.runId : current.runId;
  if (current.seq >= 0 && runId !== current.runId) return current;
  const status = typeof ack.status === "string" ? ack.status.trim().toLowerCase() : "";
  const terminal = status === "ok" || status === "timeout" || status === "error";
  return { ...current, runId, busy: !terminal, terminal,
    nativeActive: !terminal && (current.nativeActive === true || (!NON_MODEL_PHASES.has(current.progress?.phase ?? '') && !NON_MODEL_PHASES.has(current.state ?? '')
      && ['started', 'accepted', 'running'].includes(status))),
    state: terminal ? status === "ok" ? "final" : "error" : current.state };
}

/** Sequence numbers belong to a run, not to the socket's event envelope. */
export function reduceChatRun(current: ChatRun, payload: Record<string, unknown>, sessionKey: string,
  messageText?: string): ChatRun {
  if (payload.sessionKey !== sessionKey || typeof payload.runId !== "string" || !payload.runId
    || typeof payload.seq !== "number" || !Number.isSafeInteger(payload.seq) || payload.seq < 0) return current;
  if (payload.runId === current.retiredRunId || (current.activeRunIds && !current.activeRunIds.includes(payload.runId))) return current;
  if ((current.runId !== null && current.runId !== payload.runId) || current.terminal || payload.seq <= current.seq) return current;
  const state = payload.state;
  if (!["status", "delta", "final", "error", "aborted"].includes(String(state))) return current;
  const terminal = state === "final" || state === "error" || state === "aborted";
  let text = current.text;
  if (state === "delta") {
    if (typeof payload.deltaText !== "string") return current;
    text = payload.replace === true ? payload.deltaText : messageText ?? current.text + payload.deltaText;
  } else if (messageText !== undefined) text = messageText;
  return { ...current, runId: payload.runId, seq: payload.seq, text,
    state: state === "status" && typeof payload.phase === "string" ? payload.phase : String(state),
    busy: !terminal, terminal, nativeActive: state === 'delta' || (state === 'status' && MODEL_PHASES.has(String(payload.phase))) };
}

/** A reconnect snapshot can prove idle or name the exact run to resume. */
export function recoverChatRun(current: ChatRun, history: Record<string, unknown>): ChatRun {
  const inFlight = history.inFlightRun as { runId?: unknown; text?: unknown; events?: unknown; plan?: { steps?: unknown } } | null | undefined;
  if (inFlight && typeof inFlight.runId === "string" && inFlight.runId) {
    let recovered: ChatRun = { ...newChatRun(inFlight.runId), nativeActive: current.runId !== inFlight.runId || current.nativeActive !== false
      || (!NON_MODEL_PHASES.has(current.progress?.phase ?? '') && !NON_MODEL_PHASES.has(current.state ?? '')),
      seq: current.runId === inFlight.runId ? current.seq : -1,
      progress: current.runId === inFlight.runId ? current.progress : undefined,
      text: typeof inFlight.text === "string" ? inFlight.text : "" };
    const key = typeof history.sessionKey === "string" ? history.sessionKey : typeof history.key === "string" ? history.key : null;
    if (key && Array.isArray(inFlight.events)) for (const event of inFlight.events.slice(-100)) {
      if (event && typeof event === "object") recovered = reduceAgentProgress(recovered, event, key);
    }
    if (inFlight.plan && Array.isArray(inFlight.plan.steps)) recovered.progress = {
      seq: recovered.progress?.seq ?? -1, updatedAt: recovered.progress?.updatedAt ?? 0,
      phase: recovered.progress?.phase ?? "planning", reasoning: recovered.progress?.reasoning ?? "",
      reasoningTokens: recovered.progress?.reasoningTokens, tools: recovered.progress?.tools ?? [], plan: readProgressPlan(inFlight.plan.steps),
      explanation: recovered.progress?.explanation
    };
    return recovered;
  }
  const info = history.sessionInfo as { hasActiveRun?: unknown; activeRunIds?: unknown } | null | undefined;
  if (info?.hasActiveRun === false || (Array.isArray(info?.activeRunIds) && info.activeRunIds.length === 0)) {
    return { ...current, busy: false, terminal: current.runId !== null, text: "", nativeActive: false };
  }
  // Aggregate activity is not permission to pick someone else's run ID for abort.
  if (info?.hasActiveRun === true) {
    const activeRunIds = Array.isArray(info.activeRunIds) ? info.activeRunIds.filter((id): id is string => typeof id === "string") : undefined;
    if (current.terminal || (current.runId !== null && activeRunIds && !activeRunIds.includes(current.runId))) {
      return { ...newChatRun(), busy: true, nativeActive: true, retiredRunId: current.runId ?? current.retiredRunId, activeRunIds };
    }
    return { ...current, busy: true, nativeActive: true, activeRunIds };
  }
  // No public activity evidence: retain ownership, but stop claiming a model is active.
  return current.nativeActive === true ? { ...current, nativeActive: false } : current;
}

export function canApplyHistory(request: { key: string; epoch: number; revision: number },
  activeKey: string | null, epoch: number, revision: number): boolean {
  return request.key === activeKey && request.epoch === epoch && request.revision === revision;
}

export function availableChatModels(models: ModelSummary[]): ModelSummary[] {
  return models.filter(isSelectableModel);
}

export function isSelectableModel(model: ModelSummary): boolean {
  return model.available === true && model.selectable !== false;
}

export function selectedChatModel(selected: Pick<ContextUsage, "model" | "modelProvider">, models: ModelSummary[]):
  { status: "ready" | "unavailable" | "unknown"; label: string } {
  const { model, modelProvider } = selected;
  const label = model ? modelProvider && !model.startsWith(`${modelProvider}/`) ? `${modelProvider}/${model}` : model
    : "Chưa xác định AI của cuộc trò chuyện";
  if (!model || !modelProvider) return { status: "unknown", label };
  const matches = models.filter((entry) => entry.provider === modelProvider
    && (entry.id === model || `${entry.provider}/${entry.id}` === model));
  if (matches.length === 0) return { status: "unavailable", label };
  if (matches.length !== 1 || typeof matches[0].available !== "boolean") return { status: "unknown", label };
  return { status: isSelectableModel(matches[0]) ? "ready" : "unavailable", label };
}

export function canSendChat({ connected, setupReady, activeKey, busy, text, models, selectedModel, attachmentCount = 0 }:
  { connected: boolean; setupReady: boolean; activeKey: string | null; busy: boolean; text: string; models: ModelSummary[];
    selectedModel: Pick<ContextUsage, "model" | "modelProvider">; attachmentCount?: number }): boolean {
  return connected && setupReady && Boolean(activeKey) && !busy && (Boolean(text.trim()) || attachmentCount > 0)
    && selectedChatModel(selectedModel, models).status === "ready";
}
