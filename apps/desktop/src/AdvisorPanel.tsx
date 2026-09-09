import type { AdvisorEvidence, AdvisorView } from "./advisor-types";
import type { ModelSummary } from "./gateway-client";

const decisions = { approve: "Đáp ứng tiêu chí đã kiểm", revise: "Cần chỉnh sửa", clarify: "Cần làm rõ", blocked: "Chưa đủ cơ sở để tiếp tục" };
const severity = { low: "Nhẹ", medium: "Cần lưu ý", high: "Quan trọng" };
const sources = { goal: "Mục tiêu", criteria: "Tiêu chí", content: "Nội dung", evidence: "Bằng chứng" };
const modelValue = (model: { id: string; provider: string } | null) => model ? JSON.stringify([model.provider, model.id]) : "";

function Evidence({ entries }: { entries: AdvisorEvidence[] }) {
  return <div className="advisor-evidence">{entries.map((entry, index) => <blockquote key={index}>
    <p>{entry.quote}</p><cite>{sources[entry.source]}</cite>
  </blockquote>)}</div>;
}

export default function AdvisorPanel({ advisor, models, hasSession, latestAnswer, currentDraft, onInsertReview }: {
  advisor: AdvisorView; models: ModelSummary[]; hasSession: boolean; latestAnswer: string; currentDraft: string;
  onInsertReview: () => void;
}) {
  const { form, entry } = advisor;
  const available = models.filter((model) => model.available === true);
  const chosen = modelValue(form.model);
  const missing = chosen && !available.some((model) => modelValue(model) === chosen);
  const result = entry.status === "completed" ? entry.result : undefined;
  const modelLabel = form.model ? `${form.model.provider}/${form.model.id}` : "AI bạn chọn";
  return <section className="advisor-panel" id="advisor-panel" role="region" aria-labelledby="advisor-heading">
    <header><h2 id="advisor-heading" tabIndex={-1}>Cố vấn cho công việc</h2><p>Kiểm kế hoạch hoặc kết quả, rồi quyết định bước tiếp theo.</p></header>
    {!hasSession ? <p className="advisor-guidance">Mở một cuộc trò chuyện ở bên trái để bắt đầu.</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); if (advisor.canReview) void advisor.review(); }}>
      <label className="advisor-field" htmlFor="advisor-checkpoint">Bước cần kiểm
        <select id="advisor-checkpoint" value={form.checkpoint} disabled={!hasSession}
          onChange={(event) => advisor.update({ checkpoint: event.target.value === "final" ? "final" : "plan" })}>
          <option value="plan">Kiểm kế hoạch</option><option value="final">Kiểm kết quả</option>
        </select>
      </label>
      <label className="advisor-field" htmlFor="advisor-model">AI làm Advisor
        <select id="advisor-model" value={chosen} disabled={!hasSession}
          onChange={(event) => { const model = available.find((item) => modelValue(item) === event.target.value);
            advisor.update({ model: model ? { id: model.id, provider: model.provider } : null }); }}>
          <option value="">Chọn AI đã kết nối</option>
          {missing ? <option value={chosen}>{modelLabel} · Chưa sẵn sàng</option> : null}
          {available.map((model) => <option key={modelValue(model)} value={modelValue(model)}>{model.name || model.id} · {model.provider}</option>)}
        </select>
      </label>
      <fieldset className="advisor-source"><legend>Chọn nội dung để xem trước</legend>
        <button type="button" disabled={!hasSession || !latestAnswer} aria-pressed={form.sourceKind === "answer"}
          onClick={() => advisor.chooseSource("answer")}>Dùng câu trả lời mới nhất</button>
        <button type="button" disabled={!hasSession || !currentDraft} aria-pressed={form.sourceKind === "draft"}
          onClick={() => advisor.chooseSource("draft")}>Dùng bản nháp đang soạn</button>
      </fieldset>
      {advisor.sourceChanged ? <p className="advisor-guidance" role="status">Nội dung nguồn đã đổi. Chọn lại nguồn để cập nhật bản xem trước nếu cần.</p> : null}
      <label className="advisor-field" htmlFor="advisor-goal">Mục tiêu
        <textarea id="advisor-goal" rows={2} maxLength={2000} value={form.goal} disabled={!hasSession}
          placeholder="Bạn muốn đạt điều gì?" onChange={(event) => advisor.update({ goal: event.target.value })} />
      </label>
      <label className="advisor-field" htmlFor="advisor-criteria">Tiêu chí hoàn thành
        <textarea id="advisor-criteria" rows={2} maxLength={2000} value={form.criteria} disabled={!hasSession}
          onChange={(event) => advisor.update({ criteria: event.target.value })} />
      </label>
      <label className="advisor-field" htmlFor="advisor-content">Nội dung sẽ gửi để kiểm
        <textarea id="advisor-content" rows={5} maxLength={12000} value={form.content} disabled={!hasSession || !form.sourceKind}
          placeholder="Chọn câu trả lời hoặc bản nháp ở trên, rồi sửa phần cần kiểm tại đây."
          onChange={(event) => advisor.update({ content: event.target.value })} />
        <small>{form.content.length.toLocaleString("vi-VN")}/12.000 ký tự</small>
      </label>
      <label className="advisor-field" htmlFor="advisor-evidence">Bằng chứng bổ sung (nếu có)
        <textarea id="advisor-evidence" rows={2} maxLength={8000} value={form.evidence} disabled={!hasSession}
          placeholder="Dán số liệu, trích dẫn hoặc thông tin đối chiếu."
          onChange={(event) => advisor.update({ evidence: event.target.value })} />
      </label>
      <p className="advisor-disclosure">Các phần trên được gửi tới <strong>{modelLabel}</strong>. Mỗi lần kiểm dùng hạn mức AI đã chọn.
        Tối đa 120 giây/lượt; đây là giới hạn thời gian, không phải trần tiền hoặc token.</p>
      {advisor.validation ? <p className="advisor-guidance" id="advisor-validation">{advisor.validation}</p> : null}
      <div className="advisor-controls">
        <button type="submit" disabled={!advisor.canReview} aria-describedby={advisor.validation ? "advisor-validation" : undefined}>
          {form.checkpoint === "plan" ? "Kiểm kế hoạch" : "Kiểm kết quả"}</button>
        {advisor.busy ? <button type="button" disabled={advisor.cancelling} onClick={() => void advisor.cancel()}>
          {advisor.cancelling ? "Đang hủy…" : "Hủy kiểm tra"}</button> : null}
      </div>
    </form>
    <div className="advisor-progress" role="status" aria-live="polite">
      {advisor.busy ? advisor.cancelling ? "Đang chờ xác nhận hủy lượt kiểm tra…"
        : advisor.runningHere ? entry.status === "error" ? "Chưa xác nhận đã dừng. Bạn có thể thử hủy lại." : "Advisor đang kiểm nội dung đã gửi…"
          : "Advisor đang kiểm một cuộc trò chuyện khác."
        : entry.status === "error" || entry.status === "cancelled" ? "Review chưa hoàn tất."
          : result ? advisor.stale ? "Review cũ — nội dung đã đổi." : "Review hoàn tất." : "Chưa kiểm tra nội dung."}
    </div>
    {entry.message ? <p className="advisor-guidance advisor-guidance--error">{entry.message}</p> : null}
    {result ? <article className="advisor-result" data-advisor-stale={String(advisor.stale)}>
      <header><span>{advisor.stale ? "KẾT QUẢ CỦA BẢN TRƯỚC" : "GÓP Ý CỦA ADVISOR"}</span><h3>{decisions[result.decision]}</h3></header>
      <p>{result.summary}</p>
      <small>Độ tin cậy Advisor tự đánh giá: {Math.round(result.confidence * 100)}%</small>
      <Evidence entries={result.evidence} />
      {result.issues.map((issue, index) => <section className="advisor-issue" key={index}>
        <span className={`advisor-severity advisor-severity--${issue.severity}`}>{severity[issue.severity]}</span>
        <h4>{issue.title}</h4><p>{issue.detail}</p><Evidence entries={issue.evidence} />
        <p><strong>Đề xuất sửa:</strong> {issue.recommended_fix}</p>
      </section>)}
      <button type="button" onClick={onInsertReview} disabled={advisor.stale || !hasSession || advisor.busy}>Đưa góp ý vào ô soạn</button>
      <p className="advisor-disclosure">Giữ bản nháp đang có và không tự gửi. Góp ý chỉ dựa trên nội dung bạn cung cấp,
        chưa xác minh bên ngoài và không phê duyệt hành động.</p>
    </article> : null}
  </section>;
}
