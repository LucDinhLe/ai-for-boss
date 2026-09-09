import { useEffect, useRef, useState } from 'react';
import { manage } from './workbench-api';
import type { LayoutPreferences } from './layout-preferences';
type Settings = { enabled: boolean; everyDays: number; retain: number; includeWorkspace: boolean };
type Status = { settings: Settings; records: { id: string; createdAt: number; bytes: number; version: string; includeWorkspace: boolean }[]; busy: boolean; message: string; startedAt: number | null; directory: string; layout?: LayoutPreferences | null };
export default function DataSettings({ disabled, onLayout }: { disabled: boolean; onLayout(value: LayoutPreferences): void }) {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(''), [repeat, setRepeat] = useState(''), [workspace, setWorkspace] = useState(false);
  const [now, setNow] = useState(0);
  const alive = useRef(false), lock = useRef(false);
  useEffect(() => {
    alive.current = true;
    const load = () => void manage<Status>({ action: 'data-status' }).then(value => { if (alive.current) { setStatus(value); setNow(Date.now()); } }).catch(error => { if (alive.current) setError(error.message); });
    load(); const timer = setInterval(load, 2000);
    return () => { alive.current = false; clearInterval(timer); };
  }, []);
  const run = async (action: string, extra = {}) => {
    if (lock.current || disabled || status?.busy) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const value = await manage<Status>({ action, ...extra });
      if (alive.current) { setStatus(value); if (value.layout) onLayout(value.layout); setPassword(''); setRepeat(''); }
    } catch (error) { if (alive.current) setError((error as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const locked = disabled || busy || status?.busy === true;
  const settings = status?.settings;
  return <><p className="settings-lead">Cấu hình và lịch sử nằm ngoài thư mục phiên bản; cài bản mới hoặc gỡ bản cũ giữ nguyên dữ liệu này.</p>
    <section className="settings-card"><h2>Sao lưu và khôi phục</h2>
      <p>Bản phục hồi gồm cấu hình OpenClaw, thông tin kết nối, dữ liệu do lõi hỗ trợ và giao diện AI for Boss. Khóa API và token được mã hóa trong tệp .aifb, không xuất thành ZIP đọc trực tiếp.</p>
      <p>Media trong dữ liệu lõi được giữ theo cơ chế sao lưu OpenClaw. Cookie trình duyệt của ứng dụng và các tệp nhật ký bị lõi loại trừ không nằm trong bản phục hồi.</p>
      <button disabled={locked || !status} onClick={() => void run('data-backup')}>Sao lưu ngay trên máy</button>
      <p>Bản trên máy được khóa theo tài khoản hệ điều hành hiện tại. Để lưu ở nơi khác, dùng bản xuất có mật khẩu. Bản thử khôi phục vào đúng thư mục dữ liệu ban đầu; chưa tự chuyển cấu hình sang máy khác.</p>
      <fieldset disabled={locked}>
        <legend>Xuất / nhập bản phục hồi có mật khẩu</legend>
        <label>Mật khẩu <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Nhập lại khi xuất <input type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} /></label>
        <label className="settings-checkbox"><input type="checkbox" checked={workspace} onChange={e => setWorkspace(e.target.checked)} /> Kèm không gian làm việc đã cấu hình trong OpenClaw</label>
        <p>Bản thử hiện chỉ tự khôi phục dữ liệu nằm trong thư mục ứng dụng. Bản có agent hoặc workspace bên ngoài vẫn xuất được nhưng chưa tự ghi đè các thư mục đó.</p>
        <button disabled={password.length < 12 || password !== repeat} onClick={() => void run('data-export', { password, includeWorkspace: workspace })}>Xuất bản phục hồi</button>
        <button disabled={password.length < 12} onClick={() => void run('data-import', { password })}>Nhập bản phục hồi</button>
      </fieldset>
    </section>
    {settings && <section className="settings-card"><h2>Sao lưu tự động</h2>
      <p>Thực hiện khi ứng dụng đang mở và công việc đã rảnh. Không cần cài lại sau mỗi lần nâng cấp.</p>
      <fieldset disabled={locked}>
        <label className="settings-checkbox"><input type="checkbox" checked={settings.enabled} onChange={e => void run('data-settings', { settings: { ...settings, enabled: e.target.checked } })} /> Bật sao lưu tự động</label>
        <label>Tần suất <select value={settings.everyDays} onChange={e => void run('data-settings', { settings: { ...settings, everyDays: Number(e.target.value) } })}><option value={1}>Hàng ngày</option><option value={7}>Hàng tuần</option></select></label>
        <label>Số bản giữ lại <select value={settings.retain} onChange={e => void run('data-settings', { settings: { ...settings, retain: Number(e.target.value) } })}>{[3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="settings-checkbox"><input type="checkbox" checked={settings.includeWorkspace} onChange={e => void run('data-settings', { settings: { ...settings, includeWorkspace: e.target.checked } })} /> Kèm không gian làm việc</label>
      </fieldset>
      <p className="settings-path">{status.directory}</p>
      {status.records.length === 0 && <p>Chưa có bản sao lưu hoàn tất.</p>}
      <ul className="native-list">{status.records.map(record => <li key={record.id}><span>{new Date(record.createdAt).toLocaleString('vi-VN')} · {(record.bytes / 1048576).toFixed(1)} MB · {record.version}</span>
        <button disabled={locked} onClick={() => void run('data-restore', { id: record.id })}>Khôi phục</button><button disabled={locked} onClick={() => void run('data-delete', { id: record.id })}>Xóa</button></li>)}</ul>
    </section>}
    {(busy || status?.busy) && <p role="status">{status?.message || 'Đang xử lý…'}{status?.startedAt ? ` (${Math.max(0, Math.floor((now - status.startedAt) / 1000))} giây)` : ''}</p>}
    {!status?.busy && status?.message && <p role="status">{status.message}</p>}{error && <p role="alert">{error}</p>}
  </>;
}
