import { useEffect, useRef, type RefObject } from 'react';
import './conversation-dialog.css';
export type DeleteConfirmation = { key: string; title: string; ticket?: string; error?: string };
export default function ConversationDeleteDialog({ value, busy, returnFocus, onCancel, onConfirm }: {
  value: DeleteConfirmation; busy: boolean; onCancel(): void; onConfirm(): void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // Capture belongs to the opener: parent may disable it before this effect.
    const previous = returnFocus.current;
    dialog.current?.showModal();
    return () => { requestAnimationFrame(() => {
      if (previous?.isConnected) previous.focus();
      else document.getElementById('composer-input')?.focus();
    }); };
  }, [returnFocus]);
  return <dialog ref={dialog} className="conversation-delete-dialog" aria-labelledby="delete-conversation-title"
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2 id="delete-conversation-title">Xóa cuộc trò chuyện?</h2>
    <p><strong>{value.title}</strong></p>
    <p>Hội thoại sẽ được xóa khỏi danh sách và lịch sử trong ứng dụng. Tệp và bản xuất đã lưu trong thư mục dự án vẫn được giữ.</p>
    {!value.ticket && !value.error && <p role="status">Đang kiểm tra cuộc trò chuyện…</p>}
    {value.error && <p role="alert">{value.error}</p>}
    <div className="conversation-delete-dialog__actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>Hủy</button>
      <button type="button" className="conversation-delete-dialog__confirm" disabled={busy || !value.ticket || Boolean(value.error)} onClick={onConfirm}>{busy ? 'Đang xóa…' : 'Xóa hội thoại'}</button>
    </div>
  </dialog>;
}
