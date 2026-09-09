import { useRef, useState } from 'react';
import { manage } from './workbench-api';
import { WorkbenchIcon } from './WorkspaceSidebar';
type Choices = { skills: { name: string; description: string }[]; selected: string[] };
export default function SessionSkills({ sessionKey, disabled, onBusy }: { sessionKey: string; disabled: boolean; onBusy(value: boolean): void }) {
  const [choices, setChoices] = useState<Choices | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const load = async (selected?: string[]) => {
    if (lock.current) return; lock.current = true; setLoading(true); setError(''); if (selected) onBusy(true);
    try { setChoices(await manage<Choices>({ action: 'session-skills', sessionKey, ...(selected ? { skills: selected } : {}) })); }
    catch { setError('Chưa đọc hoặc lưu được kỹ năng. Anh có thể thử lại.'); }
    finally { lock.current = false; setLoading(false); if (selected) onBusy(false); }
  };
  return <details className="session-skills" name="composer-options" onToggle={event => { if (event.currentTarget.open && !choices) void load(); }}>
    <summary><WorkbenchIcon name="skills" />Kỹ năng{choices?.selected.length ? ` · ${choices.selected.length} đã chọn` : ''}</summary>
    <div className="composer-options__body"><p>Để mặc định, trợ lý tự chọn cách làm phù hợp. Hoặc chọn những kỹ năng anh muốn dùng trong phiên này.</p>
      <p>Kỹ năng có thể bổ sung hướng dẫn. Trong bản này, trợ lý chưa được dùng công cụ để thao tác trên máy hoặc dịch vụ bên ngoài.</p>
      {loading && <p role="status">Đang tải…</p>}{error && <p role="alert">{error}</p>}
      {!loading && <button type="button" disabled={disabled} onClick={() => void load()}>Tải lại kỹ năng</button>}
      {choices && <><button type="button" disabled={disabled || loading} onClick={() => void load([])}>Dùng mặc định</button>
        {choices.skills.length === 0 && <p>Chưa có kỹ năng bổ sung sẵn sàng. Anh vẫn có thể giao việc trực tiếp trong ô chat.</p>}
        <div className="session-skills__list">{choices.skills.map(skill => <label key={skill.name}><input type="checkbox" disabled={disabled || loading} checked={choices.selected.includes(skill.name)}
          onChange={event => void load(event.target.checked ? [...choices.selected, skill.name] : choices.selected.filter(name => name !== skill.name))} />
          <span><strong>{skill.name}</strong><small>{skill.description}</small></span></label>)}</div></>}
    </div></details>;
}
