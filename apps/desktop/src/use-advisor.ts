import { useEffect, useState, useSyncExternalStore } from "react";
import type { AdvisorEntry, AdvisorForm, AdvisorModel, AdvisorRequest, AdvisorResponse, AdvisorResult, AdvisorView } from "./advisor-types";
import type { ContextUsage, ModelSummary } from "./gateway-client";

export function defaultAdvisorForm(model: AdvisorModel | null, goal = ""): AdvisorForm {
  return { checkpoint: "plan", model, goal, criteria: "Đúng mục tiêu; chỉ rõ giả định, rủi ro và thông tin còn thiếu.",
    content: "", evidence: "", sourceKind: null, sourceSnapshot: "" };
}

export function advisorFormSignature(form: AdvisorForm): string {
  return JSON.stringify([form.checkpoint, form.model?.provider, form.model?.id, form.goal, form.criteria,
    form.content, form.evidence, form.sourceKind, form.sourceSnapshot]);
}

export function advisorSourceSnapshot(kind: "answer" | "draft", content: string, answerId: string): string {
  return JSON.stringify([kind, kind === "answer" ? answerId : null, content]);
}

export function advisorValidation(form: AdvisorForm): string | null {
  if (!form.model) return "Chọn AI đã kết nối để kiểm tra.";
  if (!form.sourceKind) return "Chọn câu trả lời hoặc bản nháp cần kiểm tra.";
  if (!form.goal.trim() || !form.criteria.trim() || !form.content.trim()) return "Điền mục tiêu, tiêu chí và nội dung cần kiểm tra.";
  if (form.goal.length > 2000 || form.criteria.length > 2000) return "Mục tiêu và tiêu chí tối đa 2.000 ký tự mỗi phần.";
  if (form.content.length > 12000) return "Rút nội dung cần kiểm tra xuống tối đa 12.000 ký tự.";
  if (form.evidence.length > 8000) return "Bằng chứng tối đa 8.000 ký tự.";
  return null;
}

export function reviewDraftText(result: AdvisorResult): string {
  return ["Hãy xem xét góp ý của Advisor và sửa nội dung phù hợp:", result.summary,
    ...result.issues.map((issue) => `- ${issue.title}: ${issue.detail}\n  Đề xuất: ${issue.recommended_fix}`)].join("\n\n");
}

type ActiveReview = { id: string; key: string; cancelling: boolean; cancelRequested: boolean };
type AdvisorState = { entries: Record<string, AdvisorEntry>; active: ActiveReview | null };

/** Per-conversation renderer memory; the host owns model calls and validation. */
export function createAdvisorController(request: (payload: AdvisorRequest) => Promise<AdvisorResponse>,
  makeId = () => crypto.randomUUID()) {
  let state: AdvisorState = { entries: {}, active: null };
  const listeners = new Set<() => void>();
  const publish = (next: AdvisorState) => { state = next; for (const listener of listeners) listener(); };
  const entryFor = (key: string, fallback: AdvisorForm): AdvisorEntry => state.entries[key] ?? { form: fallback, status: "idle" };
  const write = (key: string, entry: AdvisorEntry, active = state.active) => publish({ entries: { ...state.entries, [key]: entry }, active });
  const isActive = (active: ActiveReview) => state.active === active && !active.cancelRequested;
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    update(key: string, patch: Partial<AdvisorForm>, fallback: AdvisorForm) {
      const entry = entryFor(key, fallback);
      write(key, { ...entry, form: { ...entry.form, ...patch } });
    },
    async review(key: string, fallback: AdvisorForm) {
      if (!key || state.active) return;
      const entry = entryFor(key, fallback), form = entry.form;
      const validation = advisorValidation(form);
      if (validation || !form.model) return;
      const active = { id: makeId(), key, cancelling: false, cancelRequested: false };
      const reviewedForm = advisorFormSignature(form);
      write(key, { ...entry, status: "running", result: undefined, message: undefined, reviewedForm }, active);
      try {
        const response = await request({ action: "review", id: active.id, sourceSessionKey: key,
          checkpoint: form.checkpoint, model: { ...form.model }, goal: form.goal, criteria: form.criteria,
          content: form.content, evidence: form.evidence });
        if (!isActive(active)) return;
        if (response.id !== active.id || !["completed", "cancelled", "error"].includes(response.status)
          || (response.status === "completed" && !response.result)) throw new Error("Chưa nhận được kết quả Advisor hợp lệ.");
        write(key, { ...state.entries[key], status: response.status,
          result: response.status === "completed" ? response.result : undefined, message: response.message, reviewedForm }, null);
      } catch (error) {
        if (isActive(active)) write(key, { ...state.entries[key], status: "error",
          result: undefined, message: String((error as Error)?.message ?? error), reviewedForm }, null);
      }
    },
    async cancel(message = "Đã hủy kiểm tra. Nội dung chưa được review hoàn tất.") {
      const active = state.active;
      if (!active || active.cancelling) return;
      active.cancelRequested = true;
      active.cancelling = true;
      write(active.key, { ...state.entries[active.key], status: "running", result: undefined,
        message: "Đang chờ xác nhận dừng từ AI…" }, active);
      try {
        const response = await request({ action: "cancel", id: active.id });
        if (state.active !== active) return;
        if (response.id !== active.id || !["cancelled", "error"].includes(response.status)) throw new Error("Unconfirmed cancellation");
        active.cancelling = false;
        if (response.status === "cancelled") {
          write(active.key, { ...state.entries[active.key], status: "cancelled", result: undefined,
            message: response.message ?? message }, null);
        } else {
          write(active.key, { ...state.entries[active.key], status: "error", result: undefined,
            message: response.message ?? "Chưa xác nhận lượt AI đã dừng. Bạn có thể thử hủy lại." }, active);
        }
      } catch {
        if (state.active !== active) return;
        active.cancelling = false;
        write(active.key, { ...state.entries[active.key], status: "error", result: undefined,
          message: "Chưa xác nhận lượt AI đã dừng. Kiểm tra kết nối rồi thử hủy lại." }, active);
      }
    }
  };
}

export function useAdvisor({ sessionKey, connected, sourceReady = true, models, currentModel, draft, latestAnswer, latestAnswerId, latestGoal }: {
  sessionKey: string | null; connected: boolean; models: ModelSummary[]; currentModel: ContextUsage;
  sourceReady?: boolean; draft: string; latestAnswer: string; latestAnswerId: string; latestGoal: string;
}): AdvisorView {
  const [controller] = useState(() => createAdvisorController(async (payload) => {
    if (!window.aiForBoss?.advisor) throw new Error("Advisor chưa kết nối. Hãy mở lại ứng dụng rồi thử lại.");
    return window.aiForBoss.advisor.request(payload);
  }));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const matched = models.find((model) => model.available === true && model.provider === currentModel.modelProvider
    && (model.id === currentModel.model || `${model.provider}/${model.id}` === currentModel.model));
  const fallback = defaultAdvisorForm(matched ? { id: matched.id, provider: matched.provider } : null, latestGoal);
  const entry = (sessionKey && state.entries[sessionKey]) || { form: fallback, status: "idle" as const };
  const form = entry.form;
  const source = form.sourceKind === "answer" ? latestAnswer : form.sourceKind === "draft" ? draft : "";
  const sourceChanged = form.sourceKind !== null && form.sourceSnapshot !== advisorSourceSnapshot(form.sourceKind, source, latestAnswerId);
  const stale = Boolean(entry.reviewedForm && (entry.reviewedForm !== advisorFormSignature(form) || sourceChanged));
  const modelReady = form.model !== null && models.some((model) => model.available === true
    && model.id === form.model?.id && model.provider === form.model.provider);
  const validation = !sessionKey ? "Mở một cuộc trò chuyện để dùng Advisor." : !connected ? "Chờ kết nối AI để kiểm tra."
    : !sourceReady ? "Chờ tải xong cuộc trò chuyện và danh sách AI."
    : advisorValidation(form) ?? (!modelReady ? "AI đã chọn chưa sẵn sàng. Chọn kết nối khả dụng." : null);
  const canReview = !state.active && validation === null;
  useEffect(() => {
    let current = true;
    if (!connected) void Promise.resolve().then(() => { if (current) return controller.cancel("Mất kết nối. Review chưa hoàn tất; bạn có thể kiểm tra lại khi kết nối trở lại."); });
    return () => { current = false; };
  }, [connected, controller]);
  useEffect(() => () => { void controller.cancel(); }, [controller]);
  return { form, entry, stale, sourceChanged, busy: state.active !== null,
    runningHere: state.active?.key === sessionKey, cancelling: state.active?.cancelling ?? false, canReview, validation,
    update: (patch) => { if (sessionKey) controller.update(sessionKey, patch, fallback); },
    chooseSource: (sourceKind) => {
      if (!sessionKey) return;
      const content = sourceKind === "answer" ? latestAnswer : draft;
      controller.update(sessionKey, { sourceKind, sourceSnapshot: advisorSourceSnapshot(sourceKind, content, latestAnswerId), content }, fallback);
    },
    review: async () => { if (canReview && sessionKey) await controller.review(sessionKey, fallback); },
    cancel: () => controller.cancel() };
}
