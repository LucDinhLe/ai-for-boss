/**
 * Renderer-side wrapper over the preload bridge. The renderer never opens a
 * socket of its own; every call crosses IPC and is re-checked in the main
 * process against the adapter allowlist.
 */

import type { AttachmentPolicy } from "./chat-attachments";

export type RuntimeStatus = {
  paused?: boolean;
  supervisor: "idle" | "starting" | "ready" | "restarting" | "safe-mode";
  detail: string | null;
  connected: boolean;
  setupReady: boolean;
  attachmentPolicy: AttachmentPolicy | null;
  serverVersion: string | null;
  protocol: number | null;
  nodeRuntime: string | null;
  stateDirectory: string | null;
  lastError: string | null;
};

export type GatewayEvent = {
  event: string;
  payload: Record<string, unknown> | null;
  seq: number | null;
};

export type ModelSummary = {
  id: string;
  name: string;
  provider: string;
  available?: boolean;
  /** Full catalogue membership does not grant the native agent's model permission. */
  selectable?: boolean;
  selectionReason?: 'not-offered';
  unavailableReason?: string;
  contextWindow?: number;
  thinkingLevels?: { id: string; label: string }[];
  thinkingDefault?: string;
};

export type SessionSummary = {
  key: string;
  displayName?: string;
  derivedTitle?: string;
  label?: string;
  updatedAt?: number;
  model?: string;
  archived?: boolean;
  pinned?: boolean;
  pinnedAt?: number;
  /** Shell association from a successful create(projectId), not a guessed native row field. */
  projectId?: string;
};

export type TranscriptMessage = {
  id: string;
  anchorId?: string;
  anchorSeq?: number;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: string;
  timestamp: number;
  pending?: boolean;
  error?: boolean;
  artifacts?: { artifactId: string; label: string; sizeBytes?: number }[];
};

export const IDLE_STATUS: RuntimeStatus = {
  supervisor: "idle",
  detail: null,
  connected: false,
  setupReady: false,
  attachmentPolicy: null,
  serverVersion: null,
  protocol: null,
  nodeRuntime: null,
  stateDirectory: null,
  lastError: null
};

function bridge() {
  return typeof window === "undefined" ? undefined : window.aiForBoss?.gateway;
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const api = bridge();
  if (!api) return IDLE_STATUS;
  try {
    return await api.getStatus();
  } catch {
    return IDLE_STATUS;
  }
}

/** Only an explicit user click should invoke the host's bounded startup retry. */
export async function retryRuntimeStartup(): Promise<boolean> {
  const api = bridge();
  if (!api) throw new Error("Cầu nối khởi động lại chưa sẵn sàng.");
  return api.retryStartup();
}

export async function call<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = bridge();
  if (!api) throw new Error("Cầu nối tới Gateway chưa sẵn sàng.");
  return (await api.request(method, params)) as T;
}

export function onRuntimeStatus(listener: (status: RuntimeStatus) => void): () => void {
  return bridge()?.onStatus(listener) ?? (() => {});
}

export function onGatewayEvent(listener: (event: GatewayEvent) => void): () => void {
  return bridge()?.onEvent(listener) ?? (() => {});
}

/** Session keys arrive namespaced (`agent:main:my-key`); the tail is what a person typed. */
export function shortSessionKey(key: string): string {
  const parts = key.split(":");
  return parts.length > 1 ? parts[parts.length - 1] : key;
}

type RawMessage = {
  role?: string;
  content?: unknown;
  timestamp?: number;
  isReasoning?: boolean;
  openclawDisplayContent?: unknown;
  __openclaw?: { id?: string; seq?: number };
};

function readText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "type" in part && ["thinking", "reasoning"].includes(String(part.type))) return "";
        if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
        if (part && typeof part === "object" && "type" in part && part.type === "image") return "\n[Ảnh đính kèm]\n";
        return "";
      })
      .join("");
  }
  if (content && typeof content === "object" && "text" in content) {
    return String((content as { text: unknown }).text ?? "");
  }
  return "";
}

export function toTranscriptMessage(raw: RawMessage, fallbackId: string): TranscriptMessage | null {
  const role = raw.role === "assistant" || raw.role === "system" ? raw.role : raw.role === "user" ? "user" : null;
  if (!role) return null;
  const reasoning = role === "assistant" ? raw.isReasoning === true ? readText(raw.content).slice(0, 24_000)
    : Array.isArray(raw.content) ? raw.content.flatMap(part => {
      if (!part || typeof part !== "object" || !["thinking", "reasoning"].includes(String(part.type))) return [];
      return typeof part.thinking === "string" ? [part.thinking] : typeof part.text === "string" ? [part.text] : [];
    }).join("\n").slice(0, 24_000) : "" : "";
  const content = raw.isReasoning === true ? "" : readText(raw.content);
  const attachmentParts = [...(Array.isArray(raw.openclawDisplayContent) ? raw.openclawDisplayContent : []), ...(Array.isArray(raw.content) ? raw.content : [])];
  const artifacts = attachmentParts.flatMap(part => {
    const a = part?.type === 'attachment' ? part.attachment : null;
    return a && typeof a.artifactId === 'string' && /^artifact_managed_media_[0-9a-f-]{36}$/u.test(a.artifactId) && typeof a.label === 'string'
      ? [{ artifactId: a.artifactId, label: a.label.slice(0, 240), ...(Number.isSafeInteger(a.sizeBytes) && a.sizeBytes >= 0 ? { sizeBytes: a.sizeBytes } : {}) }] : [];
  }).filter((a,index,all)=>all.findIndex(other=>other.artifactId===a.artifactId)===index).slice(0,20);
  if (!content && !reasoning && !artifacts.length) return null;
  return {
    id: fallbackId,
    anchorId: typeof raw.__openclaw?.id === "string" && raw.__openclaw.id ? raw.__openclaw.id : undefined,
    anchorSeq: Number.isSafeInteger(raw.__openclaw?.seq) && (raw.__openclaw?.seq ?? 0) > 0 ? raw.__openclaw!.seq : undefined,
    role,
    content,
    ...(artifacts.length ? { artifacts } : {}),
    ...(reasoning ? { reasoning } : {}),
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now()
  };
}

function transcriptAnchor(message: Pick<TranscriptMessage, "anchorId" | "anchorSeq">): string | null {
  return message.anchorId ? JSON.stringify(["id", message.anchorId])
    : message.anchorSeq !== undefined ? JSON.stringify(["seq", message.anchorSeq]) : null;
}

/** Native anchors identify stored records, which can project into several rows. */
export function toTranscriptMessages(raw: RawMessage[], sessionKey: string): TranscriptMessage[] {
  const occurrences = new Map<string, number>();
  return raw.flatMap((entry, index) => {
    const message = toTranscriptMessage(entry, JSON.stringify([sessionKey, "row", index]));
    if (!message) return [];
    const anchor = transcriptAnchor(message);
    if (anchor !== null) {
      const ordinal = occurrences.get(anchor) ?? 0;
      occurrences.set(anchor, ordinal + 1);
      message.id = JSON.stringify([sessionKey, anchor, ordinal]);
    }
    return [message];
  });
}

/** Even equal-text events may be siblings, so existing anchors need history. */
export function upsertTranscriptEvent(current: TranscriptMessage[], payload: Record<string, unknown>, sessionKey: string):
  { messages: TranscriptMessage[]; refresh: boolean } {
  const raw = (payload.message ?? {}) as RawMessage;
  const message = toTranscriptMessage({ ...raw, __openclaw: {
    id: raw.__openclaw?.id ?? (typeof payload.messageId === "string" ? payload.messageId : undefined),
    seq: raw.__openclaw?.seq ?? (typeof payload.messageSeq === "number" ? payload.messageSeq : undefined)
  } }, "event");
  if (!message) return { messages: current, refresh: false };
  const anchor = transcriptAnchor(message);
  if (anchor === null) return { messages: current, refresh: true };
  const exists = current.some((entry) => message.anchorId && entry.anchorId
    ? message.anchorId === entry.anchorId
    : message.anchorSeq !== undefined && message.anchorSeq === entry.anchorSeq);
  if (exists) return { messages: current, refresh: true };
  return { messages: [...current, { ...message, id: JSON.stringify([sessionKey, anchor, 0]) }], refresh: false };
}

/**
 * Context usage for the meter. `usedTokens` is unknown until a run reports it,
 * so the meter shows the ceiling and a "chưa có số liệu" state rather than a
 * made-up percentage.
 */
export type ContextUsage = {
  usedTokens: number | null;
  contextTokens: number | null;
  model: string | null;
  modelProvider: string | null;
};

export function readContextUsage(history: Record<string, unknown> | null): ContextUsage {
  const defaults = (history?.defaults ?? null) as Record<string, unknown> | null;
  const info = (history?.sessionInfo ?? null) as Record<string, unknown> | null;
  const selected = info ?? defaults;
  const contextTokens = typeof selected?.contextTokens === "number" && Number.isSafeInteger(selected.contextTokens) && selected.contextTokens > 0 ? selected.contextTokens : null;
  const usedTokens = info?.totalTokensFresh === true && typeof info?.totalTokens === "number" && Number.isSafeInteger(info.totalTokens) && info.totalTokens >= 0 ? info.totalTokens : null;
  const model = typeof selected?.model === "string" && selected.model ? selected.model : null;
  const modelProvider = typeof selected?.modelProvider === "string" && selected.modelProvider ? selected.modelProvider : null;
  return { usedTokens, contextTokens, model, modelProvider };
}
