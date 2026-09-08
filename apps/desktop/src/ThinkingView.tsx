import type { ChatRun } from './chat-state';
import type { TranscriptMessage } from './gateway-client';
import type { SupervisionState } from './supervision-api';
import MessageContent from './MessageContent';
import RunProgress from './RunProgress';
import { SupervisionProgress } from './WorkspaceControls';
import { WorkbenchIcon } from './WorkspaceSidebar';
import './thinking-view.css';

export type ThinkingViewProps = {
  activeKey: string | null;
  sessionTitle?: string;
  /** The caller keeps these snapshots scoped to activeKey while navigation changes. */
  messages: readonly TranscriptMessage[];
  run: ChatRun;
  connected: boolean;
  supervision?: SupervisionState | null;
  /** True only after native same-run anchors prove this reasoning is in messages. */
  reasoningInTranscript?: boolean;
  onClose(): void;
  status?: string;
  onStop?(): void;
  stopping?: boolean;
  stopDisabled?: boolean;
  /** A local submission lock, not evidence that a model is running. */
  pendingBusy?: boolean;
};

function messageTime(timestamp: number): string | null {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? null : date.toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
  });
}

// This view owns no run controller, subscriptions or private reasoning. Unmounting
// it cannot cancel work; all displayed activity comes from the selected session.
export default function ThinkingView({ activeKey, sessionTitle, messages, run, connected, supervision,
  reasoningInTranscript = false, onClose, status, onStop, stopping = false, stopDisabled = false, pendingBusy = false }: ThinkingViewProps) {
  const currentSupervision = activeKey && supervision?.key === activeKey ? supervision : null;
  const reasoning = activeKey ? messages.filter(message => message.role === 'assistant' && message.reasoning?.trim()) : [];
  const hasRun = Boolean(activeKey && (run.runId || run.busy || run.terminal || run.progress));
  const busy = Boolean(activeKey && (pendingBusy || run.busy || currentSupervision?.busy));
  const preparing = Boolean(activeKey && pendingBusy && !run.busy && !currentSupervision?.busy);
  const hasActivity = hasRun || reasoning.length > 0 || Boolean(currentSupervision) || preparing;
  const recordedRun = hasRun && !run.busy && Boolean(currentSupervision);
  const runDetails = hasRun ? <RunProgress run={run} connected={connected}
    presentation="full" reasoningInTranscript={reasoningInTranscript && reasoning.length > 0} /> : null;
  return <section className="thinking-view" aria-labelledby="thinking-heading">
    <header className="thinking-view__header">
      <div className="thinking-view__title"><WorkbenchIcon name="thinking" /><div>
        <h2 id="thinking-heading">Thinking</h2>
        <p>{activeKey ? sessionTitle || 'Cuộc trò chuyện hiện tại' : 'Hoạt động của mô hình'}</p>
      </div></div>
      <div className="thinking-view__actions">
        {busy && onStop && <button type="button" className="thinking-view__stop" disabled={stopping || stopDisabled}
          onClick={onStop}><WorkbenchIcon name="stop" />{stopping ? 'Đang dừng…' : 'Dừng'}</button>}
        <button type="button" aria-label="Thu gọn Thinking" title="Thu gọn Thinking" onClick={onClose}><WorkbenchIcon name="close" /></button>
      </div>
    </header>
    {status && <p id="thinking-status" className="thinking-view__status" role="status">{status}</p>}
    <p className="thinking-view__intro">Kế hoạch, công cụ, kỹ năng, agent và nội dung suy luận được mô hình chia sẻ trong phiên này.</p>
    {!activeKey ? <div className="thinking-view__empty"><WorkbenchIcon name="thinking" />
      <h3>Chưa chọn cuộc trò chuyện</h3><p>Mở một cuộc trò chuyện để xem hoạt động của mô hình.</p></div>
      : !hasActivity ? <div className="thinking-view__empty"><WorkbenchIcon name="thinking" />
        <h3>Chưa có hoạt động được ghi nhận</h3><p>Gửi yêu cầu trong ô chat để bắt đầu. Thinking sẽ hiển thị thông tin khi mô hình cung cấp.</p></div>
        : <div className="thinking-view__activity">
          {preparing && <div className="thinking-view__card"><p role="status">Đang chuẩn bị yêu cầu</p>
            <p className="thinking-view__intro">Yêu cầu chưa được mô hình xác nhận.</p></div>}
          {preparing && (hasRun || currentSupervision) && <h3 className="thinking-view__previous">Hoạt động trước đó</h3>}
          {currentSupervision && <section className="thinking-view__card" aria-label="Giám sát của Advisor">
            <SupervisionProgress state={currentSupervision} /></section>}
          {recordedRun ? <div className="thinking-view__card"><details className="thinking-view__recorded">
            <summary>Hoạt động mô hình đã ghi nhận</summary>{runDetails}</details></div>
            : runDetails && <div className="thinking-view__card">{runDetails}</div>}
          {reasoning.length > 0 && <section className="thinking-view__history" aria-labelledby="thinking-reasoning-heading">
            <h3 id="thinking-reasoning-heading"><WorkbenchIcon name="thinking" />Nội dung mô hình chia sẻ</h3>
            <ol>{reasoning.map((message, index) => {
              const time = messageTime(message.timestamp);
              return <li key={message.id} className="thinking-view__card" data-message-id={message.id}>
                <details open={index === reasoning.length - 1}>
                  <summary><span>Suy nghĩ từ mô hình</span>{time && <time dateTime={new Date(message.timestamp).toISOString()}>{time}</time>}
                    {message.pending && <small>Đang cập nhật</small>}{message.error && <small>Chưa hoàn tất</small>}</summary>
                  <div className="thinking-view__reasoning"><MessageContent content={message.reasoning!} /></div>
                </details>
              </li>;
            })}</ol>
          </section>}
        </div>}
  </section>;
}
