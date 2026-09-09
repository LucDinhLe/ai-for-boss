import { useEffect, useRef, useState, type RefObject } from 'react';
import './conversation-dialog.css';
export type DeleteConfirmation = { key: string; title: string; ticket?: string; error?: string; files?: {name:string;bytes:number}[]; fileWarning?:string };
export default function ConversationDeleteDialog({ value, busy, returnFocus, onCancel, onConfirm }: {
  value: DeleteConfirmation; busy: boolean; onCancel(): void; onConfirm(includeFiles:boolean): void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [includeFiles,setIncludeFiles]=useState(false);
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
    <p>Hội thoại sẽ được xóa khỏi danh sách và lịch sử trong ứng dụng.</p>
    <p>Tệp nhập vào, bản sao đã lưu riêng và tệp cũ chưa có thông tin nguồn gốc vẫn được giữ.</p>
    {value.files && value.files.length>0 && <><label><input type="checkbox" checked={includeFiles} disabled={busy} onChange={e=>setIncludeFiles(e.target.checked)}/> Chuyển các tệp được tạo dưới đây vào Thùng rác</label>
      <ul>{value.files.map((file,i)=><li key={i}>{file.name} · {Math.ceil(file.bytes/1024)} KB</li>)}</ul></>}
    {value.ticket && !value.files?.length && <p>Không có tệp đủ thông tin nguồn gốc để xóa kèm.</p>}
    {value.fileWarning && <p role="status">{value.fileWarning}</p>}
    {!value.ticket && !value.error && <p role="status">Đang kiểm tra cuộc trò chuyện…</p>}
    {value.error && <p role="alert">{value.error}</p>}
    <div className="conversation-delete-dialog__actions">
      <button type="button" autoFocus disabled={busy} onClick={onCancel}>Hủy</button>
      <button type="button" className="conversation-delete-dialog__confirm" disabled={busy || !value.ticket || Boolean(value.error)} onClick={()=>onConfirm(includeFiles)}>{busy ? 'Đang xóa…' : includeFiles ? 'Xóa hội thoại và tệp' : 'Xóa hội thoại'}</button>
    </div>
  </dialog>;
}
