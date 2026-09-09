import { useEffect, useState } from 'react';
import { manage } from './workbench-api';
type Status = { currentVersion: string; availableVersion: string | null; readyVersion: string | null;
  autoCheck: boolean; autoDownload: boolean; busy: boolean; message: string };
export default function UpdateSettings() {
  const [status, setStatus] = useState<Status | null>(null), [error, setError] = useState(''), [working, setWorking] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => { void manage<Status>({ action: 'update-status' }).then(value => { if (active) setStatus(value); }).catch(reason => { if (active) setError(reason.message); }); };
    load(); const timer = window.setInterval(load, 3000); return () => { active = false; clearInterval(timer); };
  }, []);
  const run = async (input: Record<string, unknown>) => {
    if (working) return; setWorking(true); setError('');
    try { setStatus(await manage<Status>(input)); } catch (reason) { setError((reason as Error).message); } finally { setWorking(false); }
  };
  const disabled = working || status?.busy || !status;
  return <div className="settings-card"><h2>Cập nhật bản thử</h2>
    <p>Bản tải về được kiểm tra trước khi dùng. Ứng dụng chọn bản mới khi mở lại và giữ bản cũ để khôi phục nếu khởi động lỗi.</p>
    {status && <><label className="settings-checkbox"><input type="checkbox" checked={status.autoCheck} disabled={disabled}
      onChange={event => void run({ action: 'update-settings', autoCheck: event.target.checked, autoDownload: status.autoDownload })} />Tự động kiểm tra khi mở ứng dụng</label>
      <label className="settings-checkbox"><input type="checkbox" checked={status.autoDownload} disabled={disabled}
        onChange={event => void run({ action: 'update-settings', autoCheck: status.autoCheck, autoDownload: event.target.checked })} />Tự động tải bản mới</label>
      <p role="status">{status.readyVersion ? `Đã chuẩn bị ${status.readyVersion}. Lưu công việc rồi đóng và mở lại ứng dụng để cập nhật.` : status.message}</p></>}
    <button disabled={disabled} onClick={() => void run({ action: 'update-check' })}>Kiểm tra cập nhật</button>
    <button disabled={disabled || !status?.availableVersion || Boolean(status.readyVersion)} onClick={() => void run({ action: 'update-download' })}>{working || status?.busy ? 'Đang xử lý…' : 'Tải bản mới'}</button>
    {error && <p role="status">{error}</p>}
  </div>;
}
