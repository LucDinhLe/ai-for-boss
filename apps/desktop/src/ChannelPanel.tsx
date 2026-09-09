import { WorkbenchIcon } from './WorkspaceSidebar';
import BrandIcon from './BrandIcon';
import { capabilityRole } from './capability-role';
import { useCallback, useEffect, useRef, useState } from 'react';
import { manage, type ChannelSummary, type NativeCatalogue, type PluginCatalogue, type ChannelActionResult } from './workbench-api';
import { localiseStep, type WizardStep } from './connect/wizard-vi';
import './channel-panel.css';

type Reply = { sessionId?: string; step?: WizardStep; done?: boolean; status?: string; error?: string; setupRoute?: 'native-config'; accounts?: { channel: string; accountId: string }[] };
type Qr = { ticket: string; connected: boolean; qrDataUrl: string | null; message: string };
type AccessRequest = { requestId: string; senderId: string; senderLabel: string; expiresAt: string };
const priority = ['telegram', 'zalo', 'whatsapp', 'discord', 'googlechat'];
const prerequisites: Record<string, string> = {
  telegram: 'Tạo bot qua @BotFather rồi nhập token. Không cần mở cổng mạng.',
  zalo: 'Dùng bot Zalo Bot Creator / Marketplace và token của bot. Không dùng tài khoản Zalo cá nhân hay Zalo OA.',
  whatsapp: 'Liên kết bằng mã QR trong WhatsApp → Thiết bị liên kết. Cần điện thoại đang đăng nhập WhatsApp.',
  discord: 'Cần bot token từ Discord Developer Portal, bật Message Content Intent và mời bot vào máy chủ.',
  googlechat: 'Cần ứng dụng Google Chat, khóa JSON của service account và địa chỉ webhook HTTPS công khai. Đây không phải đăng nhập Gmail.'
};
const wizardTime = () => Date.now();
export default function ChannelPanel({ channels, onRefresh, ready = true, mutationsDisabled = false }: { channels: ChannelSummary[]; onRefresh: () => void; ready?: boolean; mutationsDisabled?: boolean }) {
  const [catalogue, setCatalogue] = useState<NativeCatalogue | null>(null);
  const [installed, setInstalled] = useState<string[]>([]), [wizardLabel, setWizardLabel] = useState('Telegram');
  const [wizard, setWizard] = useState<Reply | null>(null);
  const [answer, setAnswer] = useState('');
  const [revealSecret, setRevealSecret] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [shipped, setShipped] = useState<string[]>([]), [notice, setNotice] = useState('');
  const [qr, setQr] = useState<Qr | null>(null), qrTicket = useRef<string | null>(null);
  const [access, setAccess] = useState<{ channel: string; accountId: string; requests: AccessRequest[] } | null>(null);
  const locked = useRef(false), mounted = useRef(true), session = useRef<string | null>(null);
  const committingConfig = useRef(false);
  const epoch = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), wake = useRef<(() => void) | null>(null);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  const cancelWait = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; wake.current?.(); wake.current = null; };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; invalidate(); cancelWait();
      if (session.current) void manage({ action: 'channel-cancel', sessionId: session.current }).catch(() => {});
      if (qrTicket.current) void manage({ action: 'channel-qr-clear', ticket: qrTicket.current }).catch(() => {});
    };
  }, [invalidate]);
  useEffect(() => {
    if (!ready) return;
    let fresh = true;
    void manage<NativeCatalogue>({ action: 'catalog' }).then(value => { if (fresh && mounted.current) setCatalogue(value); })
      .catch(() => { if (fresh && mounted.current) setError('Chưa đọc được danh mục kênh.'); });
    void manage<PluginCatalogue>({ action: 'plugin-inventory' }).then(value => { if (fresh && mounted.current) setInstalled(value.plugins.filter(p => p.installed).map(p => p.id)); }).catch(() => {});
    void manage<{ channels: { id: string; available: boolean }[] }>({ action: 'channel-bundle-status' })
      .then(value => { if (fresh && mounted.current) setShipped(value.channels.filter(row => row.available).map(row => row.id)); }).catch(() => {});
    return () => { fresh = false; };
  }, [ready]);
  const act = async (payload: Record<string, unknown>) => {
    if (!ready || mutationsDisabled || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const configCommit = payload.action === 'channel-next' && wizard?.setupRoute === 'native-config'
      && wizard.step?.type === 'confirm' && (payload.answer as { value?: unknown } | undefined)?.value === true;
    committingConfig.current = configCommit; setSavingConfig(configCommit);
    if (payload.answer && wizard?.step?.sensitive) { setAnswer(''); setRevealSecret(false); }
    setNotice(payload.action === 'channel-setup' ? 'Đang chuẩn bị kênh. Hướng dẫn kết nối sẽ mở khi sẵn sàng.' : '');
    const token = ++epoch.current, current = () => mounted.current && token === epoch.current;
    try {
      let result = await manage<Reply & Partial<Omit<ChannelActionResult, 'status'>>>(payload);
      if (!current()) {
        if (result.sessionId && !result.done) void manage({ action: 'channel-cancel', sessionId: result.sessionId }).catch(() => {});
        return;
      }
      setNotice('');
      if (payload.action === 'channel-start' || payload.action === 'channel-stop') {
        if (!result.ok) { setError(result.error || result.reason || 'Kênh chưa đổi trạng thái. Tải lại để kiểm tra.'); return; }
        onRefresh(); return;
      }
      const id = result.sessionId ?? session.current;
      if (id) session.current = id;
      const deadline = wizardTime() + 90_000;
      while (current() && id && (!result.step || result.step.type === 'progress' || result.status === 'done') && !result.done && !['cancelled', 'error'].includes(result.status ?? '')) {
        if (wizardTime() > deadline) throw new Error('Trình kết nối chưa phản hồi. Hủy rồi thử lại.');
        setWizard({ ...result, sessionId: id });
        await new Promise<void>(resolve => { wake.current = resolve; timer.current = setTimeout(resolve, 700); });
        if (!current()) return;
        result = await manage({ action: 'channel-next', sessionId: id });
      }
      if (!current()) return;
      if (result.error) setError(result.error);
      if (result.done || ['cancelled', 'error'].includes(result.status ?? '')) {
        session.current = null; setWizard(null); setAnswer('');
        if (!result.error && result.status !== 'error') {
          onRefresh(); setNotice(result.status === 'cancelled' ? '' : 'Đã lưu thiết lập. Kiểm tra trạng thái tài khoản bên dưới.');
          const whatsapp = result.accounts?.find(row => row.channel === 'whatsapp');
          if (whatsapp) {
            committingConfig.current = false; setSavingConfig(false);
            locked.current = false; setBusy(false);
            await startQr(whatsapp.accountId); return;
          }
        }
      } else if (id) {
        session.current = id; setWizard({ ...result, sessionId: id });
        setRevealSecret(false);
        setAnswer(!result.step?.sensitive && typeof result.step?.initialValue === 'string' ? result.step.initialValue : '');
        const initial = Array.isArray(result.step?.initialValue) ? result.step.initialValue : [];
        setSelected((result.step?.options ?? []).flatMap((o, i) => initial.some(v => JSON.stringify(v) === JSON.stringify(o.value)) ? [i] : []));
      } else onRefresh();
    } catch (failure) { if (current()) { setNotice(''); setError(failure instanceof Error ? failure.message : 'Chưa hoàn tất thao tác. Kiểm tra kết nối và thử lại.'); } }
    finally { if (current()) { committingConfig.current = false; setSavingConfig(false); locked.current = false; setBusy(false); } }
  };
  const closeQr = () => {
    epoch.current++; cancelWait(); const ticket = qrTicket.current; qrTicket.current = null; setQr(null);
    locked.current = false; setBusy(false);
    if (ticket) void manage({ action: 'channel-qr-clear', ticket }).catch(() => {});
  };
  const startQr = async (accountId: string) => {
    if (!ready || mutationsDisabled || locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('Đang lấy mã QR WhatsApp…');
    const token = ++epoch.current, current = () => mounted.current && token === epoch.current;
    try {
      let result = await manage<Qr>({ action: 'channel-qr-start', channel: 'whatsapp', accountId });
      if (!current()) { void manage({ action: 'channel-qr-clear', ticket: result.ticket }).catch(() => {}); return; }
      qrTicket.current = result.ticket; setQr({ ...result }); setNotice('');
      const deadline = wizardTime() + 120000;
      while (current() && !result.connected && wizardTime() < deadline) {
        await new Promise<void>(resolve => { wake.current = resolve; timer.current = setTimeout(resolve, 700); });
        if (!current()) return;
        const updated = await manage<Qr>({ action: 'channel-qr-wait', ticket: result.ticket });
        result = updated;
        if (current()) setQr(previous => ({ ...updated, qrDataUrl: updated.qrDataUrl ?? previous?.qrDataUrl ?? null }));
      }
      if (current()) {
        if (result.connected) { setNotice('WhatsApp đã liên kết.'); setQr(null); onRefresh(); }
        else setError('Mã QR đã hết thời gian chờ. Đóng mã này và chọn liên kết lại.');
        void manage({ action: 'channel-qr-clear', ticket: result.ticket }).catch(() => {}); qrTicket.current = null;
      }
    } catch (failure) { if (current()) { setNotice(''); setError(failure instanceof Error ? failure.message : 'Chưa lấy được mã QR WhatsApp.'); } }
    finally { if (current()) { locked.current = false; setBusy(false); } }
  };
  const loadAccess = async (channel: string, accountId: string) => {
    if (!ready || locked.current) return; locked.current = true; setBusy(true); setError('');
    try {
      const result = await manage<{ requests: AccessRequest[] }>({ action: 'channel-pairing-list', channel, accountId });
      if (mounted.current) setAccess({ channel, accountId, requests: result.requests });
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Chưa đọc được yêu cầu ghép đôi.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const decideAccess = async (requestId: string, approve: boolean) => {
    if (!ready || mutationsDisabled || !access || locked.current) return; locked.current = true; setBusy(true); setError('');
    try {
      const result = await manage<{ ok: boolean }>({ action: approve ? 'channel-pairing-approve' : 'channel-pairing-dismiss', channel: access.channel, accountId: access.accountId, requestId });
      if (result.ok !== true) throw new Error('Chưa xác nhận thay đổi. Yêu cầu vẫn được giữ trong danh sách.');
      if (mounted.current) setAccess(previous => previous && ({ ...previous, requests: previous.requests.filter(row => row.requestId !== requestId) }));
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Chưa xác nhận thay đổi quyền nhắn.'); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const cancel = async () => {
    // A confirmed config write may already be persisted. Keep its native ACK
    // and readback alive rather than cancelling only the renderer's listener.
    if (committingConfig.current) return;
    const id = session.current; epoch.current++; cancelWait(); locked.current = false; setBusy(false); setAnswer(''); setRevealSecret(false);
    if (!id) { setWizard(null); return; }
    try {
      const result = await manage<Reply>({ action: 'channel-cancel', sessionId: id });
      if (result.status === 'cancelled' || result.done) { session.current = null; setWizard(null); }
      else setError('Trình kết nối đang hoàn tất bước lưu. Chờ phản hồi rồi thử đóng lại.');
    }
    catch { setError('Chưa xác nhận hủy. Hãy thử hủy lại trước khi mở thiết lập khác.'); }
  };
  const step = wizard?.step;
  const local = step ? localiseStep(step) : null;
  const next = (value?: unknown) => void act({ action: 'channel-next', sessionId: session.current,
    ...(step && value !== undefined ? { answer: { stepId: step.id, value } } : {}) });
  const configuredIds = new Set(channels.map(channel => channel.channel));
  const catalogueRows = [...(catalogue?.channels ?? []), ...channels.filter((channel, index) =>
    !catalogue?.channels.some(item => item.id === channel.channel) && channels.findIndex(c => c.channel === channel.channel) === index)
    .map(channel => ({ id: channel.channel, label: channel.label, description: '', bundled: false, packageName: '' }))].sort((a, b) => (priority.includes(a.id) ? priority.indexOf(a.id) : 10) - (priority.includes(b.id) ? priority.indexOf(b.id) : 10));
  return <section className="capability-panel" aria-label="Kết nối kênh chat">
    <p className="page-description">Nhận việc và trao đổi với trợ lý ngay trên kênh bạn dùng. Chọn một kênh để thiết lập tài khoản và quyền nhận tin.</p>
    {mutationsDisabled && <p role="status">Chờ tác vụ hiện tại kết thúc hoặc bấm Dừng trước khi thiết lập kênh.</p>}
    {error && <p role="alert" className="notice">{error}</p>}
    {notice && <p role="status" className="notice">{notice}</p>}
    {!ready && <p role="status">Đang kết nối lại Gateway. Thiết lập đang mở được giữ nguyên.</p>}
    {qr && <section className="capability-form channel-qr" aria-label="Liên kết WhatsApp bằng mã QR">
      <h2><BrandIcon kind="channel" id="whatsapp" label="WhatsApp" />Liên kết WhatsApp</h2>
      <p>Mở WhatsApp trên điện thoại → Thiết bị liên kết → Liên kết thiết bị, rồi quét mã này.</p>
      {qr.qrDataUrl ? <img src={qr.qrDataUrl} alt="Mã QR liên kết WhatsApp do OpenClaw cung cấp" /> : <p role="status">Đang chờ mã QR…</p>}
      {qr.message && <p>{qr.message}</p>}<button type="button" onClick={closeQr}><WorkbenchIcon name="close" />Đóng mã QR</button>
    </section>}
    {access && <section className="capability-form" aria-label="Duyệt người được phép nhắn">
      <h2><WorkbenchIcon name="shield" />Người được phép nhắn</h2><p>Chỉ duyệt người anh nhận ra. Việc duyệt cho phép người đó giao việc cho trợ lý qua kênh này.</p>
      {!access.requests.length && <p>Chưa có yêu cầu đang chờ. Người dùng cần nhắn cho bot trước để gửi yêu cầu ghép đôi.</p>}
      {access.requests.map(row => <div key={row.requestId} className="channel-access-row"><span>{row.senderLabel || row.senderId} · {row.senderId}</span>
        <button disabled={!ready || busy || mutationsDisabled} type="button" onClick={() => void decideAccess(row.requestId, true)}>Cho phép</button><button disabled={!ready || busy || mutationsDisabled} type="button" onClick={() => void decideAccess(row.requestId, false)}>Bỏ qua</button></div>)}
      <button type="button" onClick={() => setAccess(null)}>Đóng</button>
    </section>}
    {wizard ? <section className="capability-form" aria-label={`Thiết lập ${wizardLabel}`}>
      <h2><WorkbenchIcon name="plug" />Thiết lập {wizardLabel}</h2><p>Chỉ nhập thông tin kết nối trong trình hướng dẫn này; không dán khóa truy cập vào ô chat.</p>
      {local && <>{local.title !== `Thiết lập ${wizardLabel}` && <h3>{local.title}</h3>}{local.recognised ? <p>{local.message}</p> : step?.message && <pre className="native-instructions">{step.message}</pre>}</>}
      {step?.type === 'text' && <form onSubmit={event => { event.preventDefault(); next(answer); }}>
        {step.multiline ? <>
          <textarea aria-label="Câu trả lời thiết lập" autoComplete="off" autoCapitalize="off" spellCheck={false} rows={6} maxLength={65536}
            className={`channel-secret-input${step.sensitive && !revealSecret ? ' channel-secret-input--masked' : ''}`} value={answer}
            placeholder={step.placeholder} onChange={event => setAnswer(event.target.value)} disabled={!ready || busy || mutationsDisabled} />
          {step.sensitive && <button type="button" aria-pressed={revealSecret} disabled={!ready || busy || mutationsDisabled}
            onClick={() => setRevealSecret(value => !value)}>{revealSecret ? 'Ẩn nội dung' : 'Hiện nội dung'}</button>}
        </> : <input aria-label="Câu trả lời thiết lập" autoComplete="off" autoCapitalize="off" spellCheck={false} type={step.sensitive ? 'password' : 'text'} value={answer}
          placeholder={step.placeholder} onChange={event => setAnswer(event.target.value)} disabled={!ready || busy || mutationsDisabled} />}
        <button disabled={!ready || busy || mutationsDisabled} type="submit">Tiếp tục</button>
      </form>}
      {step?.type === 'select' && <div className="capability-options">{step.options?.map((option, index) => <button type="button" key={index} disabled={!ready || busy || mutationsDisabled} onClick={() => next(option.value)}>{option.label}{option.hint && <small>{option.hint}</small>}</button>)}</div>}
      {step?.type === 'multiselect' && <><div className="capability-options">{step.options?.map((option, index) => <label key={index}>
        <input type="checkbox" checked={selected.includes(index)} disabled={!ready || busy || mutationsDisabled} onChange={() => setSelected(items => items.includes(index) ? items.filter(i => i !== index) : [...items, index])} />{option.label}
      </label>)}</div><button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => next(step.options?.filter((_, index) => selected.includes(index)).map(o => o.value))}>Tiếp tục</button></>}
      {step?.type === 'confirm' && <div className="capability-options"><button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => next(true)}>{step.confirmLabel || 'Đồng ý'}</button><button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => next(false)}>{step.declineLabel || 'Không'}</button></div>}
      {step && ['note', 'action'].includes(step.type) && <button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => next(true)}>{busy ? 'Đang xử lý…' : 'Tiếp tục'}</button>}
      {(!step || busy) && <p role="status">{savingConfig ? 'Đang lưu tài khoản và kiểm tra kết quả…' : 'Đang chờ trình kết nối…'}</p>}
      {!savingConfig && (busy || !ready || mutationsDisabled || step?.type !== 'confirm' || step.declineLabel !== 'Hủy thiết lập') && <button type="button" onClick={() => void cancel()}><WorkbenchIcon name="close" />Hủy thiết lập</button>}
    </section> : <>
      <input aria-label="Tìm kênh chat" placeholder="Tìm Telegram, Zalo, Slack…" value={filter} onChange={event => setFilter(event.target.value)} />
      <ul className="native-list">{catalogueRows.filter(channel => `${channel.label} ${channel.id}`.toLowerCase().includes(filter.toLowerCase())).map(channel => <li key={channel.id}>
        <div><strong><BrandIcon kind="channel" id={channel.id} label={channel.label} />{channel.label}</strong><p>{prerequisites[channel.id] || capabilityRole(`channel ${channel.id}`)}</p><details><summary>Chi tiết kết nối</summary><p>{channel.description}</p></details>
          <small>{channel.bundled ? 'Có trong bộ chạy' : shipped.includes(channel.id) ? 'Plugin chính thức đã có trong bản cài' : installed.includes(channel.id) ? 'Plugin đã được cài' : configuredIds.has(channel.id) ? 'Được bộ chạy báo về' : `Cần bổ sung plugin ${channel.packageName}`}</small>
          {channels.filter(account => account.channel === channel.id).map(account => <div key={account.id} className="channel-account">
            <span>{account.account || 'Tài khoản mặc định'} · {account.status}</span>{account.error && <p>{account.error}</p>}
            {account.accountId && account.configured && <button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => void act({ action: account.running ? 'channel-stop' : 'channel-start', channel: account.channel, accountId: account.accountId })}><WorkbenchIcon name={account.running ? 'stop' : 'play'} />{account.running ? 'Dừng kênh' : 'Khởi động kênh'}</button>}
            {account.accountId && account.channel === 'whatsapp' && <><button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => void startQr(account.accountId)}><WorkbenchIcon name="plug" />Liên kết bằng QR</button>{!account.configured && <small>Quét mã QR để liên kết điện thoại với tài khoản này.</small>}</>}
            {account.accountId && account.configured && priority.includes(account.channel) && <button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => void loadAccess(account.channel, account.accountId)}><WorkbenchIcon name="shield" />Duyệt người nhắn</button>}
          </div>)}
        </div>
        {channel.bundled || shipped.includes(channel.id) || installed.includes(channel.id) || installed.includes(channel.packageName ?? '') ? <button type="button" disabled={!ready || busy || mutationsDisabled} onClick={() => { setWizardLabel(channel.label); void act({ action: 'channel-setup', channel: channel.id }); }}><WorkbenchIcon name="plug" />Thiết lập {channel.label}</button> : <span className="status-label">{configuredIds.has(channel.id) ? 'Đã có cấu hình' : 'Cần plugin tương ứng'}</span>}
      </li>)}</ul>
    </>}
  </section>;
}
