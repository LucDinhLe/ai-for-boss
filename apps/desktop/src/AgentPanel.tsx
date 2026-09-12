import { WorkbenchIcon } from './WorkspaceSidebar';
import { useEffect, useRef, useState } from 'react';
import { manage } from './workbench-api';
import type { ModelSummary } from './gateway-client';
export type AgentSummary = { id: string; name?: string; identity?: { emoji?: string } };
export type AgentTemplate = { id: string; label: string; forWhom: string; role: string; goal: string; emoji: string; skills: string[]; defaultMode: string; permission: string; permissionLabel: string };
const AGENT_ICONS = [['🤖', 'Trợ lý'], ['💼', 'Kinh doanh'], ['📊', 'Phân tích'], ['🎯', 'Mục tiêu'], ['✍️', 'Nội dung'], ['🎨', 'Sáng tạo'], ['🔎', 'Nghiên cứu'], ['📚', 'Học tập'], ['🧭', 'Chiến lược'], ['💡', 'Ý tưởng'], ['🛠️', 'Kỹ thuật'], ['🌱', 'Phát triển']] as const;
const MODE_LABEL: Record<string, string> = { nhanh: 'Nhanh', ky: 'Kỹ', 'quyet-dinh': 'Quyết định quan trọng' };

/**
 * Agent creation starts from a role template (spec 0058): two plain questions
 * suggest a role, the role brings its skills, permission level and default
 * mode, and the user only names the agent and says what it should take care of.
 * "Tự mô tả" keeps the previous free-form path.
 */
export default function AgentPanel({ agents, models, ready, onRefresh, onUse }: {
  agents: AgentSummary[]; models: ModelSummary[]; ready: boolean; onRefresh(): Promise<void>; onUse(id: string): void;
}) {
  const [name, setName] = useState(''), [role, setRole] = useState(''), [goal, setGoal] = useState(''), [model, setModel] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [template, setTemplate] = useState<string | null>(null);
  const [work, setWork] = useState(''), [need, setNeed] = useState(''), [suggested, setSuggested] = useState<string | null>(null);
  const [saving, setSaving] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void manage<{ templates?: AgentTemplate[] }>({ action: 'agent-templates' }).then(result => { if (!cancelled && Array.isArray(result?.templates)) setTemplates(result.templates); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const chosen = templates.find(item => item.id === template) ?? null;
  const pick = (item: AgentTemplate | null) => {
    setTemplate(item?.id ?? null);
    if (item) { setEmoji(item.emoji); if (!role.trim() || templates.some(t => t.role === role)) setRole(item.role); if (!goal.trim() || templates.some(t => t.goal === goal)) setGoal(item.goal); }
  };
  const suggest = async () => {
    if (!work.trim() && !need.trim()) return;
    try {
      const result = await manage<{ suggested?: string | null }>({ action: 'agent-templates', work: work.trim() || undefined, need: need.trim() || undefined });
      const id = typeof result?.suggested === 'string' ? result.suggested : null;
      setSuggested(id); const item = templates.find(t => t.id === id); if (item) pick(item);
    } catch { setSuggested(null); }
  };
  return <section className="native-page" aria-label="Agents"><h1><WorkbenchIcon name="agents" />Agents</h1><p>Chọn một vai có sẵn hoặc tự mô tả người trợ lý anh chị cần. Vai có sẵn mang theo kỹ năng, mức quyền và chế độ làm việc mặc định; anh chị vẫn chỉnh được vai trò và mục tiêu.</p>
    <ul className="native-list">{agents.map(a => <li key={a.id}><strong><span className="agent-emoji">{a.identity?.emoji || '🤖'}</span>{a.name || a.id}</strong><button disabled={!ready || saving} onClick={() => onUse(a.id)}>Dùng agent</button></li>)}</ul>
    <h2><WorkbenchIcon name="new" />Tạo agent</h2>
    {templates.length ? <div className="agent-intake">
      <p>Hai câu hỏi để gợi ý vai phù hợp.</p>
      <label>Anh chị đang làm gì?<input maxLength={500} value={work} onChange={e => setWork(e.target.value)} placeholder="Ví dụ: chủ tiệm spa 6 nhân viên ở Đà Lạt" /></label>
      <label>Muốn trợ lý này lo việc gì?<input maxLength={500} value={need} onChange={e => setNeed(e.target.value)} placeholder="Ví dụ: theo khách sau khi báo giá, đừng để quên ai" /></label>
      <button type="button" disabled={saving || (!work.trim() && !need.trim())} onClick={() => void suggest()}>Gợi ý vai</button>
      {suggested && <span className="agent-intake__hint">Gợi ý: {templates.find(t => t.id === suggested)?.label ?? suggested}</span>}
    </div> : null}
    {templates.length ? <div className="agent-templates" role="radiogroup" aria-label="Mẫu vai">
      {templates.map(item => <button type="button" key={item.id} role="radio" aria-checked={template === item.id} className={template === item.id ? 'agent-template agent-template--active' : 'agent-template'} disabled={saving} onClick={() => pick(item)}>
        <span className="agent-emoji">{item.emoji}</span><strong>{item.label}</strong><small>{item.forWhom}</small>
        <small>{item.skills.filter(s => s !== 'quy-tac-dieu-hanh').length} kỹ năng · {item.permissionLabel} · Chế độ {MODE_LABEL[item.defaultMode] ?? item.defaultMode}</small>
      </button>)}
      <button type="button" role="radio" aria-checked={template === null} className={template === null ? 'agent-template agent-template--active' : 'agent-template'} disabled={saving} onClick={() => pick(null)}>
        <span className="agent-emoji">🤖</span><strong>Tự mô tả</strong><small>Không dùng mẫu, tự viết vai trò và chọn biểu tượng.</small>
      </button>
    </div> : null}
    <form className="project-form" onSubmit={async e => {
      e.preventDefault(); if (lock.current) return; lock.current = true; setSaving(true); setError('');
      try { await manage({ action: 'agent-create', name, role, goal, model, ...(chosen ? { template: chosen.id } : { emoji }) }); await onRefresh(); setName(''); setRole(''); setGoal(''); }
      catch (e) { setError(String((e as Error).message)); } finally { lock.current = false; setSaving(false); }
    }}>
      {chosen ? <p className="agent-template__summary"><span className="agent-emoji">{chosen.emoji}</span>Vai {chosen.label}. Kỹ năng: {chosen.skills.filter(s => s !== 'quy-tac-dieu-hanh').join(', ')}. Quyền: {chosen.permissionLabel}.</p>
        : <fieldset className="agent-icons"><legend>Biểu tượng agent</legend>{AGENT_ICONS.map(([icon, label]) => <button type="button" key={icon} aria-label={`Biểu tượng ${label}`} aria-pressed={emoji === icon} disabled={saving} onClick={() => setEmoji(icon)}><span>{icon}</span><small>{label}</small></button>)}</fieldset>}
      <label><WorkbenchIcon name="agents" />Tên<input id="agent-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label><WorkbenchIcon name="skills" />Vai trò và năng lực<textarea id="agent-role" required maxLength={2000} value={role} onChange={e => setRole(e.target.value)} placeholder="Ví dụ: chuyên viên lập kế hoạch kinh doanh, phân tích dữ liệu do tôi cung cấp." /></label>
      <label><WorkbenchIcon name="shield" />Mục tiêu<textarea id="agent-goal" required maxLength={2000} value={goal} onChange={e => setGoal(e.target.value)} /></label>
      <label><WorkbenchIcon name="model" />Mô hình mặc định<select id="agent-model" required value={model} onChange={e => setModel(e.target.value)}><option value="">Chọn mô hình</option>{models.filter(m => m.available).map(m => <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`}>{m.name} · {m.provider}</option>)}</select></label>
      <p>Sau khi tạo, mở chat và giao việc cho trợ lý.</p>
      {error && <p role="alert">{error}</p>}<button disabled={!ready || saving}>{saving ? 'Đang tạo…' : 'Tạo agent'}</button></form>
  </section>;
}
