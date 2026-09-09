import type { ChatRun } from "./chat-state";
import MessageContent from "./MessageContent";
import { WorkbenchIcon } from "./WorkspaceSidebar";
import "./run-progress.css";

const PHASES: Record<string, string> = {
  start: "Trợ lý đã bắt đầu", thinking: "Đang suy nghĩ", tool: "Đang dùng công cụ", working: "Đang xử lý",
  planning: "Đang lập kế hoạch", end: "Đang hoàn tất", error: "Đang cập nhật kết quả",
  preparing_workspace: "Đang chuẩn bị không gian làm việc", naming_worktree: "Đang đặt tên không gian làm việc",
  creating_worktree: "Đang tạo không gian làm việc", running_setup: "Đang chuẩn bị công việc",
  provisioning_environment: "Đang chuẩn bị môi trường", preparing_context: "Đang đọc ngữ cảnh", starting_model: "Đang gọi mô hình"
};
const TOOL_LABELS: Record<string, string> = { session_status: "Kiểm tra trạng thái phiên", read: "Đọc tệp", write: "Ghi tệp",
  edit: "Chỉnh sửa tệp", web_search: "Tìm kiếm web", web_fetch: "Đọc trang web", browser: "Trình duyệt", image: "Phân tích hình ảnh",
  memory_search: "Tìm trong bộ nhớ", memory_get: "Đọc bộ nhớ", sessions_spawn: "Giao việc cho subagent", sessions_send: "Trao đổi với agent", subagents: "Theo dõi các subagent" };

export default function RunProgress({ run, connected, reasoningInTranscript = false, presentation = "compact" }: {
  run: ChatRun; connected: boolean; reasoningInTranscript?: boolean; presentation?: "compact" | "full";
}) {
  const full = presentation === "full";
  const progress = run.progress;
  if (!full && !run.busy && !progress) return null;
  const reasoning = reasoningInTranscript ? "" : progress?.reasoning;
  const hasDetails = Boolean(reasoning || progress?.reasoningTokens !== undefined || progress?.plan.length || progress?.explanation || progress?.tools.length);
  const completed = !run.busy && run.terminal;
  const exceptional = run.state === "aborted" || run.state === "error";
  if (!full && completed && !exceptional && !hasDetails) return null;
  const label = run.terminal ? run.state === "aborted" ? "Đã dừng" : run.state === "error" ? "Lượt làm việc gặp lỗi" : full && run.state !== "final" ? "Lượt làm việc đã kết thúc" : "Hoạt động đã hoàn tất"
    : full && !run.busy ? "Hoạt động đã ghi nhận"
    : !connected ? "Đang nối lại để cập nhật tiến trình" : run.state === 'delta' && run.text.trim() && (!progress || ['start', 'starting_model'].includes(progress.phase)) ? 'Đang viết câu trả lời'
      : progress ? PHASES[progress.phase] ?? "Đang xử lý" : PHASES[run.state ?? ""] ?? (full ? "Đang chờ mô hình xác nhận" : "Đã gửi yêu cầu · đang chờ mô hình");
  const icon = <WorkbenchIcon name={run.terminal ? run.state === "aborted" ? "stop" : run.state === "error" ? "info" : "check" : "thinking"} />;
  const details = <>
    {full && run.busy && run.text.length > 0 && <p className="run-progress__hint">Đã nhận {run.text.length.toLocaleString('vi-VN')} ký tự trả lời.</p>}
    {reasoning ? <details className="run-progress__reasoning" open={full}>
      <summary>Suy nghĩ từ mô hình</summary>
      <div><MessageContent content={reasoning} /></div>
    </details> : null}
    {progress?.reasoningTokens !== undefined && <p className="run-progress__hint">{progress.reasoningTokens.toLocaleString("vi-VN")} token suy nghĩ do mô hình báo</p>}
    {progress?.explanation && <details open={full}><summary>Lý do điều chỉnh kế hoạch</summary>
      <MessageContent content={progress.explanation} /></details>}
    {progress && progress.plan.length > 0 && <details open={full}><summary>Kế hoạch · {progress.plan.filter(step => step.status === "completed").length}/{progress.plan.length}</summary>
      <ol>{progress.plan.map((step, index) => <li key={index} data-status={step.status}><WorkbenchIcon name={step.status === "completed" ? "check" : "context"} />{step.step}</li>)}</ol>
    </details>}
    {progress && progress.tools.length > 0 && <details open={full}><summary>Công cụ · {progress.tools.length}</summary>
      <ul>{progress.tools.map(tool => <li key={tool.id}><WorkbenchIcon name={tool.activity?.kind === 'skill' ? 'skills' : tool.activity?.kind === 'agent' ? 'agents' : tool.failed ? "info" : tool.phase === "result" ? "check" : "context"} />
        <span className="run-progress__tool"><span>{tool.activity?.kind === 'skill' ? 'Đọc hướng dẫn kỹ năng' : TOOL_LABELS[tool.name] ?? tool.name}</span>
          {tool.activity && <p>{tool.activity.label}{tool.activity.agentId && `${tool.activity.label ? ' · ' : ''}${tool.activity.agentId}`}</p>}
          {full && TOOL_LABELS[tool.name] && <code>{tool.name}</code>}</span>
        <small>{tool.phase !== "result" ? run.terminal ? "Chưa có kết quả" : !connected ? "Chờ cập nhật" : "Đang chạy" : tool.failed ? "Có lỗi" : tool.name === 'sessions_spawn' || tool.name === 'sessions_send' ? "Lệnh đã trả kết quả" : "Hoàn tất"}</small></li>)}</ul>
    </details>}
  </>;
  return <section className="run-progress" aria-label="Tiến trình thực tế" data-presentation={presentation} data-active={run.busy && connected} data-completed={completed}>
    {completed && hasDetails && !full ? <details className="run-progress__completed">
      <summary className="run-progress__headline">{icon}<span>{label}</span>
        {progress?.tools.length ? <small>{progress.tools.length} công cụ</small> : null}
      </summary>{details}
    </details> : <><div className="run-progress__headline" role="status">{icon}<span>{label}</span></div>{details}</>}
    {full && !hasDetails && <p className="run-progress__hint">{reasoningInTranscript
      ? "Suy nghĩ của lượt này có trong phần nội dung mô hình bên dưới."
      : run.busy ? "Chưa nhận được kế hoạch, công cụ hoặc nội dung suy nghĩ công khai."
        : "Lượt này không có kế hoạch, công cụ hoặc nội dung suy nghĩ công khai được ghi nhận."}</p>}
    {full && !hasDetails && !reasoningInTranscript && <p className="run-progress__hint">Một số mô hình chỉ gửi câu trả lời cuối. Thinking hiển thị dữ liệu được mô hình chia sẻ; mức suy nghĩ được chọn trong ô chat cho lượt tiếp theo.</p>}
  </section>;
}
