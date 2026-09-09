import { useRef, useState } from 'react';
import { manage, type ProjectSummary } from './workbench-api';
import type { SessionSummary } from './gateway-client';
import { conversationTitle } from './workspace-ui';

export default function ProjectPage({ projects, sessions, selectedId, ready, onSelect, onRefresh, onNewChat, onOpenChat }: {
  projects: ProjectSummary[]; sessions: SessionSummary[]; selectedId: string | null; ready: boolean;
  onSelect(id: string | null): void; onRefresh(): Promise<void>; onNewChat(id: string): void; onOpenChat(key: string): void;
}) {
  const [creating, setCreating] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const [saving, setSaving] = useState(false); const lock = useRef(false);
  const project = projects.find(p => p.id === selectedId);
  const scoped = sessions.filter(s => s.projectId === selectedId);
  return <section className="native-page project-page" aria-label="Dự án">
    <header className="native-page-header"><h1>{project?.displayName ?? 'Dự án'}</h1>
      <button disabled={!ready || saving} onClick={() => setCreating(!creating)}>＋ Tạo dự án</button></header>
    {creating && <form className="project-form" onSubmit={async event => {
      event.preventDefault(); if (lock.current) return; lock.current = true; setSaving(true); setError('');
      try { const result = await manage<{ id?: string }>({ action: 'project-create', name });
        if (result.id) { await onRefresh(); onSelect(result.id); setCreating(false); setName(''); }
      } catch (e) { setError(String((e as Error).message)); } finally { lock.current = false; setSaving(false); }
    }}><label>Tên dự án<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <p>Chọn nơi lưu ở bước tiếp theo. Mỗi dự án có thư mục tài liệu, lịch sử và kết quả riêng.</p>
      <button disabled={!ready || saving || !name.trim()}>{saving ? 'Đang tạo…' : 'Chọn nơi lưu và tạo'}</button></form>}
    {error && <p role="alert">{error}</p>}
    {project ? <>
      <button onClick={() => onSelect(null)}>← Tất cả dự án</button>
      <p className="project-path">{project.directory ?? 'Thư mục do OpenClaw quản lý'}</p>
      <div className="project-actions"><button disabled={!ready} onClick={() => onNewChat(project.id)}>＋ Chat trong dự án</button>
        {project.directory && <button onClick={() => { void manage({ action: 'project-open', projectId: project.id }).catch(e => setError(String(e.message))); }}>Mở thư mục</button>}
        <button disabled={!ready} onClick={() => void onRefresh()}>Tải lại</button></div>
      <p>Chọn mô hình, kỹ năng và agent ngay trong phiên. OpenClaw giữ lịch sử gốc; bản xuất trong thư mục dự án được đồng bộ sau lượt chat.</p>
      <h2>Cuộc trò chuyện ({scoped.length})</h2>
      <ul className="native-list">{scoped.map(s => <li key={s.key}><button onClick={() => onOpenChat(s.key)}>{conversationTitle(s.key, sessions)}</button>
        <small>{s.updatedAt ? new Date(s.updatedAt).toLocaleString('vi-VN') : ''}</small></li>)}</ul>
      {!scoped.length && <p>Chưa có cuộc trò chuyện. Tạo chat đầu tiên để bắt đầu.</p>}
    </> : <ul className="native-list">{projects.map(p => <li key={p.id}><div><strong>{p.displayName}</strong><p className="project-path">{p.directory ?? 'Không gian OpenClaw'}</p></div>
      <button onClick={() => onSelect(p.id)}>Mở dự án</button></li>)}</ul>}
  </section>;
}
