import { useEffect, useRef, useState } from 'react';
import { call } from './gateway-client';
import { manage, type CronJobSummary, type ScheduleDraft } from './workbench-api';
import { WorkbenchIcon } from './WorkspaceSidebar';

const suggestions = [
  { name: 'Lập ba ưu tiên trong ngày', description: 'Chọn ba việc đáng làm nhất từ mục tiêu của anh.', frequency: 'weekdays', time: '08:00', message: 'Từ mục tiêu sau, đề xuất ba ưu tiên hôm nay và thứ tự thực hiện: ' },
  { name: 'Rà soát kế hoạch tuần', description: 'Tìm việc cần ưu tiên và điểm còn thiếu trong kế hoạch.', frequency: 'weekly', time: '08:30', message: 'Rà soát kế hoạch tuần này, chỉ ra ba ưu tiên và điều cần bổ sung: ' },
  { name: 'Gợi ý nội dung truyền thông', description: 'Chuẩn bị năm ý tưởng bài viết để anh lựa chọn.', frequency: 'weekly', time: '09:00', message: 'Gợi ý năm ý tưởng bài viết cho sản phẩm và khách hàng sau: ' },
  { name: 'Nhắc việc', description: 'Một lời nhắc ngắn cho việc anh muốn duy trì.', frequency: 'daily', time: '09:00', message: 'Nhắc tôi dành thời gian cho việc sau, bằng một câu ngắn: ' },
  { name: 'Khép lại ngày làm việc', description: 'Ba câu hỏi để nhìn lại ngày và chuẩn bị ngày mai.', frequency: 'weekdays', time: '17:00', message: 'Đặt ba câu hỏi ngắn giúp tôi tổng kết hôm nay: việc đã xong, việc còn vướng và ưu tiên ngày mai.' },
  { name: 'Nhắc vận động', description: 'Dừng một chút, uống nước và cử động nhẹ.', frequency: 'weekdays', time: '15:00', message: 'Viết một lời nhắc thân thiện để tôi nghỉ vài phút, uống nước và vận động nhẹ.' },
  { name: 'Bài học nhỏ mỗi ngày', description: 'Một ý tưởng dễ hiểu, kèm ví dụ và cách thử.', frequency: 'daily', time: '08:00', message: 'Dạy tôi một ý nhỏ về chủ đề dưới đây, kèm ví dụ và một cách thử trong năm phút: ' },
  { name: 'Gợi ý suy ngẫm', description: 'Một câu hỏi nhẹ nhàng để kết thúc ngày.', frequency: 'daily', time: '20:30', message: 'Gợi ý một câu hỏi ngắn giúp tôi nhìn lại điều đáng trân trọng hôm nay.' }
];
const fresh = (): ScheduleDraft => ({ name: suggestions[0].name, message: suggestions[0].message, frequency: suggestions[0].frequency, time: suggestions[0].time, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, enabled: false });
type NativeJob = { id: string; name: string; enabled: boolean; payload: { message: string }; schedule: { expr: string; tz?: string } };
const date = (value: number | null) => value === null ? 'Chưa có' : new Date(value).toLocaleString('vi-VN');
const runStatus = (value: string) => ({ ok: 'Hoàn tất', error: 'Có lỗi', skipped: 'Bỏ qua' }[value] ?? 'Chưa có kết quả');
export default function SchedulePanel({ jobs, sessionKey, onRefresh, onShowRuns }: { jobs: CronJobSummary[]; sessionKey: string | null; onRefresh: () => void; onShowRuns?: (id: string, name: string) => void }) {
  const [draft, setDraft] = useState<ScheduleDraft>(fresh);
  const [form, setForm] = useState(false), [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<CronJobSummary | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const lock = useRef(false), mounted = useRef(true), requestId = useRef(crypto.randomUUID());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const action = async (payload: Record<string, unknown>, after?: (result: NativeJob) => void) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const roster = sessionKey ? null : await call<{ defaultId: string }>('agents.list');
      const scopedKey = sessionKey || (roster?.defaultId ? 'agent:' + roster.defaultId + ':main' : null);
      if (!scopedKey) throw new Error('Chưa có trợ lý sẵn sàng.');
      const result = await manage<NativeJob>({ ...payload, sessionKey: scopedKey });
      if (!mounted.current) return;
      if (after) after(result); else { setForm(false); setDeleting(null); onRefresh(); }
    } catch { if (mounted.current) setError('Chưa xác nhận thao tác. Tải lại danh sách trước khi thử tiếp; các lịch hệ thống chỉ được xem.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  const edit = (job: CronJobSummary) => void action({ action: 'cron-get', id: job.id }, result => {
    const parts = result.schedule.expr.split(' '), frequency = parts[4] === '1-5' ? 'weekdays' : parts[4] === '1' ? 'weekly' : 'daily';
    setDraft({ name: result.name, message: result.payload.message, enabled: result.enabled, timeZone: result.schedule.tz ?? 'Asia/Ho_Chi_Minh',
      time: `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`, frequency });
    setEditing(job.id); setForm(true);
  });
  return <section className="capability-panel" aria-label="Tạo và quản lý lịch">
    <h2><WorkbenchIcon name="cron" />Gợi ý cho công việc của anh</h2>
    <p>Chọn mẫu, viết điều anh cần và đặt giờ. Kết quả xem tại đây; cần mở ứng dụng và để Gateway chạy.</p>
    <div className="schedule-suggestions">{suggestions.map(item => <button type="button" key={item.name} disabled={busy} onClick={() => {
      requestId.current = crypto.randomUUID(); setDraft({ ...fresh(), name: item.name, message: item.message, frequency: item.frequency, time: item.time }); setEditing(null); setForm(true); setError('');
    }}><strong><WorkbenchIcon name="cron" />{item.name}</strong><small>{item.description}</small></button>)}</div>

    {error && <p role="alert" className="notice">{error}</p>}
    {form && <form className="capability-form" aria-label="Nội dung và thời gian tác vụ" onSubmit={event => {
      event.preventDefault(); void action(editing ? { action: 'cron-save', id: editing, draft } : { action: 'cron-create', requestId: requestId.current, draft });
    }}>
      <h3><WorkbenchIcon name={editing ? 'settings' : 'new'} />{editing ? 'Sửa tác vụ' : 'Tạo tác vụ'}</h3>
      <label>Tên tác vụ<input required maxLength={200} value={draft.name} disabled={busy} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
      <label>Anh muốn trợ lý làm gì?<textarea required rows={3} maxLength={12000} value={draft.message} disabled={busy} onChange={event => setDraft({ ...draft, message: event.target.value })} /></label>
      <div className="schedule-fields"><label>Lặp lại<select value={draft.frequency} disabled={busy} onChange={event => setDraft({ ...draft, frequency: event.target.value })}>
        <option value="daily">Hằng ngày</option><option value="weekdays">Thứ hai đến thứ sáu</option><option value="weekly">Mỗi thứ hai</option>
      </select></label><label>Giờ chạy<input required type="time" value={draft.time} disabled={busy} onChange={event => setDraft({ ...draft, time: event.target.value })} /></label>
      <details><summary>Tùy chọn thêm</summary><label>Múi giờ<input required value={draft.timeZone} disabled={busy} onChange={event => setDraft({ ...draft, timeZone: event.target.value })} /></label></details></div>
      <p>Mẫu dùng nội dung anh nhập; kết quả lưu trong ứng dụng. Chưa tự lấy email hoặc tin trên web. Mỗi lần chạy có dùng hạn mức AI.</p>
      <label><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /> Bật chạy theo lịch sau khi lưu</label>
      <div className="capability-options"><button type="submit" disabled={busy}>{busy ? 'Đang lưu…' : draft.enabled ? 'Lưu và bật lịch' : 'Lưu lịch đang tắt'}</button>
        <button type="button" disabled={busy} onClick={() => setForm(false)}>Đóng biểu mẫu</button></div>
    </form>}
    {jobs.some(job => job.managed) && <><h2><WorkbenchIcon name="cron" />Lịch của anh</h2><ul className="native-list">{jobs.filter(job => job.managed).map(job => <li key={job.id}>
      <div><strong><WorkbenchIcon name="cron" />{job.name}</strong><p>{job.enabled ? 'Đang bật' : 'Đang tắt'} · Lần tới: {date(job.nextRunAtMs)}</p>
        <small>Lần trước: {date(job.lastRunAtMs)} · {runStatus(job.lastRunStatus)}</small>{job.error && <p className="notice">{job.error}</p>}</div><div className="capability-options">
        <button type="button" disabled={busy} onClick={() => edit(job)}><WorkbenchIcon name="settings" />Sửa</button>
        <button type="button" disabled={busy} onClick={() => void action({ action: 'cron-toggle', id: job.id, enabled: !job.enabled })}><WorkbenchIcon name={job.enabled ? 'stop' : 'play'} />{job.enabled ? 'Tạm dừng' : 'Bật lịch'}</button>
        {onShowRuns && <button type="button" disabled={busy} onClick={() => onShowRuns(job.id, job.name)}><WorkbenchIcon name="files" />Xem lịch sử</button>}
        <button type="button" disabled={busy} onClick={() => setDeleting(job)}><WorkbenchIcon name="close" />Xóa</button>
      </div>
    </li>)}</ul></>}
    {deleting && <div className="capability-form" role="group" aria-label="Xác nhận xóa lịch"><p>Xóa lịch “{deleting.name}”?</p>
      <button type="button" disabled={busy} onClick={() => void action({ action: 'cron-remove', id: deleting.id })}>Xóa lịch này</button>
      <button type="button" disabled={busy} onClick={() => setDeleting(null)}>Giữ lại</button></div>}
  </section>;
}
