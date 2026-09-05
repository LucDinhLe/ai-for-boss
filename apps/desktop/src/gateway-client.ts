/**
 * Renderer-side wrapper over the preload bridge. The renderer never opens a
 * socket of its own; every call crosses IPC and is re-checked in the main
 * process against the adapter allowlist.
 */

export type RuntimeStatus = {
  supervisor: "idle" | "starting" | "ready" | "restarting" | "safe-mode";
  detail: string | null;
  connected: boolean;
  setupReady: boolean;
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
  unavailableReason?: string;
  contextWindow?: number;
};

export type SessionSummary = {
  key: string;
  displayName?: string;
  label?: string;
  updatedAt?: number;
  model?: string;
  archived?: boolean;
};

export type TranscriptMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  pending?: boolean;
  error?: boolean;
};

export const IDLE_STATUS: RuntimeStatus = {
  supervisor: "idle",
  detail: null,
  connected: false,
  setupReady: false,
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
  __openclaw?: { id?: string; seq?: number };
};

function readText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
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
  const content = readText(raw.content);
  if (!content) return null;
  return {
    id: raw.__openclaw?.id ?? fallbackId,
    role,
    content,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now()
  };
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
};

export function readContextUsage(history: Record<string, unknown> | null): ContextUsage {
  const defaults = (history?.defaults ?? null) as Record<string, unknown> | null;
  const usage = (history?.usage ?? null) as Record<string, unknown> | null;
  const contextTokens = typeof defaults?.contextTokens === "number" ? defaults.contextTokens : null;
  const used =
    typeof usage?.contextTokens === "number"
      ? usage.contextTokens
      : typeof usage?.totalTokens === "number"
        ? usage.totalTokens
        : null;
  const model = typeof defaults?.model === "string" ? defaults.model : null;
  return { usedTokens: used, contextTokens, model };
}
