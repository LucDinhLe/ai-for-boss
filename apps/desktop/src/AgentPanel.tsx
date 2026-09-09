import { WorkbenchIcon } from './WorkspaceSidebar';
import { useRef, useState } from 'react';
import { manage } from './workbench-api';
import type { ModelSummary } from './gateway-client';
export type AgentSummary = { id: string; name?: string; identity?: { emoji?: string } };
const AGENT_ICONS = [['🤖', 'Trợ lý'], ['💼', 'Kinh doanh'], ['📊', 'Phân tích'], ['🎯', 'Mục tiêu'], ['✍️', 'Nội dung'], ['🎨', 'Sáng tạo'], ['🔎', 'Nghiên cứu'], ['📚', 'Học tập'], ['🧭', 'Chiến lược'], ['💡', 'Ý tưởng'], ['🛠️', 'Kỹ thuật'], ['🌱', 'Phát triển']] as const;
export default function AgentPanel({ agents, models, ready, onRefresh, onUse }: {
  agents: AgentSummary[]; models: ModelSummary[]; ready: boolean; onRefresh(): Promise<void>; onUse(id: string): void;
}) {
  const [name, setName] = useState(''), [role, setRole] = useState(''), [goal, setGoal] = useState(''), [model, setModel] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [saving, setSaving] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
  return <section className="native-page" aria-label="Agents"><h1><WorkbenchIcon name="agents" />Agents</h1><p>Mô tả người trợ lý anh cần và kết quả muốn đạt. Có thể chọn thêm kỹ năng ngay trong cuộc trò chuyện.</p>
    <ul className="native-list">{agents.map(a => <li key={a.id}><strong><span className="agent-emoji">{a.identity?.emoji || '🤖'}</span>{a.name || a.id}</strong><button disabled={!ready || saving} onClick={() => onUse(a.id)}>Dùng agent</button></li>)}</ul>
    <h2><WorkbenchIcon name="new" />Tạo agent</h2><form className="project-form" onSubmit={async e => {
      e.preventDefault(); if (lock.current) return; lock.current = true; setSaving(true); setError('');
      try { await manage({ action: 'agent-create', name, role, goal, model, emoji }); await onRefresh(); setName(''); setRole(''); setGoal(''); }
      catch (e) { setError(String((e as Error).message)); } finally { lock.current = false; setSaving(false); }
    }}><fieldset className="agent-icons"><legend>Biểu tượng agent</legend>{AGENT_ICONS.map(([icon, label]) => <button type="button" key={icon} aria-label={`Biểu tượng ${label}`} aria-pressed={emoji === icon} disabled={saving} onClick={() => setEmoji(icon)}><span>{icon}</span><small>{label}</small></button>)}</fieldset><label><WorkbenchIcon name="agents" />Tên<input id="agent-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label><WorkbenchIcon name="skills" />Vai trò và năng lực<textarea id="agent-role" required maxLength={2000} value={role} onChange={e => setRole(e.target.value)} placeholder="Ví dụ: chuyên viên lập kế hoạch kinh doanh, phân tích dữ liệu do tôi cung cấp." /></label>
      <label><WorkbenchIcon name="shield" />Mục tiêu<textarea id="agent-goal" required maxLength={2000} value={goal} onChange={e => setGoal(e.target.value)} /></label>
      <label><WorkbenchIcon name="model" />Mô hình mặc định<select id="agent-model" required value={model} onChange={e => setModel(e.target.value)}><option value="">Chọn mô hình</option>{models.filter(m => m.available).map(m => <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>{m.name} · {m.provider}</option>)}</select></label>
      <p>Sau khi tạo, mở chat và giao việc cho trợ lý.</p>
      {error && <p role="alert">{error}</p>}<button disabled={!ready || saving}>{saving ? 'Đang tạo…' : 'Tạo agent'}</button></form>
  </section>;
}
