import type { ModelSummary, ContextUsage } from "./gateway-client";

export type SessionThinking = { level: string | null; levels: { id: string; label: string }[] };
export function readSessionThinking(history: Record<string, unknown> | null, usage: ContextUsage,
  models: ModelSummary[]): SessionThinking {
  const info = history?.sessionInfo as Record<string, unknown> | null | undefined;
  const defaults = history?.defaults as Record<string, unknown> | null | undefined;
  const selected = models.filter(item => item.provider === usage.modelProvider
    && (item.id === usage.model || `${item.provider}/${item.id}` === usage.model));
  const model = selected.length === 1 ? selected[0] : undefined;
  // History defaults describe the default model, which may differ from this
  // session. Never borrow another model's advertised reasoning capabilities.
  const matchingDefaults = typeof defaults?.model === "string" && typeof defaults.modelProvider === "string"
    && defaults.modelProvider === usage.modelProvider
    && (defaults.model === usage.model || `${defaults.modelProvider}/${defaults.model}` === usage.model
      || defaults.model === `${usage.modelProvider}/${usage.model}`) ? defaults : undefined;
  const raw = info?.thinkingLevels ?? model?.thinkingLevels ?? matchingDefaults?.thinkingLevels;
  const levels: SessionThinking["levels"] = [];
  if (Array.isArray(raw)) for (const option of raw.slice(0, 30)) {
    if (typeof option?.id !== "string" || !option.id || typeof option.label !== "string" || !option.label
      || option.id.length > 100 || option.label.length > 100 || levels.some(item => item.id === option.id)) continue;
    levels.push({ id: option.id, label: option.label });
  }
  const level = info?.thinkingLevel ?? info?.thinkingDefault ?? model?.thinkingDefault ?? matchingDefaults?.thinkingDefault;
  return { level: typeof level === "string" && level ? level : null, levels };
}
