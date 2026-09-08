import type { ChatRun } from './chat-state';
import type { SupervisionState } from './supervision-api';

const phases: Record<string, string> = {
  start: 'Đã bắt đầu', started: 'Đã bắt đầu', thinking: 'Đang suy nghĩ', tool: 'Đang dùng công cụ',
  working: 'Đang xử lý', planning: 'Đang lập kế hoạch', end: 'Đang hoàn tất', delta: 'Đang trả lời',
  preparing_workspace: 'Đang chuẩn bị không gian làm việc', naming_worktree: 'Đang đặt tên không gian làm việc',
  creating_worktree: 'Đang tạo không gian làm việc', running_setup: 'Đang chuẩn bị công việc',
  provisioning_environment: 'Đang chuẩn bị môi trường', preparing_context: 'Đang đọc ngữ cảnh', starting_model: 'Đang gọi mô hình'
};
const advisorPhases: Record<string, string> = {
  planning: 'Đang lập kế hoạch', 'revising-plan': 'Đang chỉnh kế hoạch', 'plan-review': 'Advisor đang kiểm kế hoạch',
  working: 'Đang thực hiện kế hoạch', 'revising-result': 'Đang chỉnh kết quả', 'final-review': 'Advisor đang kiểm kết quả',
  completed: 'Đã hoàn tất', 'needs-changes': 'Kết quả cần chỉnh sửa', error: 'Lượt làm việc gặp lỗi', cancelled: 'Đã dừng'
};

/** A compact projection of public lifecycle state, never reasoning text or tool arguments. */
export function thinkingStatus({ activeKey, connected, historyReady, run, supervision, pending, stopping }: {
  activeKey: string | null; connected: boolean; historyReady: boolean; run: ChatRun;
  supervision: SupervisionState | null; pending: boolean; stopping: boolean;
}): string {
  if (!activeKey) return 'Chọn cuộc trò chuyện';
  if (!connected) return 'Đang chờ kết nối';
  if (!historyReady) return 'Đang tải hoạt động';
  if (stopping) return 'Đang dừng…';
  const current = supervision?.key === activeKey ? supervision : null;
  if (current?.busy) {
    if (['working', 'revising-result'].includes(current.phase) && run.busy && run.progress?.phase)
      return phases[run.progress.phase] ?? advisorPhases[current.phase];
    return advisorPhases[current.phase] ?? 'Đang chuẩn bị yêu cầu';
  }
  if (run.busy) {
    if (run.state === 'delta' && run.text.trim() && (!run.progress || ['start', 'starting_model'].includes(run.progress.phase))) return 'Đang viết câu trả lời';
    if (run.nativeActive === false && run.seq < 0 && !run.progress) return 'Đang chờ mô hình xác nhận';
    return phases[run.progress?.phase ?? ''] ?? phases[run.state ?? ''] ?? 'Đang chờ mô hình xác nhận';
  }
  if (pending) return 'Đang chuẩn bị yêu cầu';
  if (current) return advisorPhases[current.phase] ?? 'Xem hoạt động của phiên';
  if (run.terminal) return run.state === 'aborted' ? 'Đã dừng' : run.state === 'error' ? 'Lượt làm việc gặp lỗi' : 'Đã hoàn tất';
  return 'Xem hoạt động của phiên';
}
