import { useEffect, useRef, useState } from 'react';
import { manage } from './workbench-api';
import { onGatewayEvent } from './gateway-client';
type Approval = { id: string; sessionKey: string | null; command: string; warning: string | null;
  host: string | null; agentId: string | null; expiresAtMs: number; canAllow: boolean; revision: string };

export default function ApprovalInbox({ ready, onVisibility }: { ready: boolean; onVisibility(value: boolean): void }) {
  const [rows, setRows] = useState<Approval[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const epoch = useRef(0), lock = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true, reading = false;
    const load = async () => {
      if (!active || !ready || reading || lock.current) return;
      reading = true; const generation = ++epoch.current;
      try {
        const result = await manage<{ approvals: Approval[] }>({ action: 'approval-list' });
        if (active && generation === epoch.current) { setRows(result.approvals); setMessage(''); }
      } catch { if (active && generation === epoch.current) { setRows([]); } }
      finally { reading = false; }
    };
    refresh.current = load;
    const unsubscribe = onGatewayEvent(event => { if (event.event.startsWith('exec.approval.')) void load(); });
    void load(); const timer = window.setInterval(() => { void load(); }, 1500);
    return () => { active = false; clearInterval(timer); unsubscribe(); };
  }, [ready]);
  const visible = ready && rows.length > 0;
  useEffect(() => { onVisibility(visible && expanded);
    return () => { onVisibility(false); }; }, [visible, expanded, onVisibility]);
  const resolve = async (row: Approval, decision: 'allow-once' | 'deny') => {
    if (lock.current || !ready) return;
    lock.current = true; ++epoch.current; setBusy(true); setMessage('');
    try {
      const result = await manage<{ status: string }>({ action: 'approval-resolve', id: row.id, revision: row.revision, decision });
      setMessage(result.status === 'allowed' ? 'Đã cho phép lệnh này.' : 'Yêu cầu đã kết thúc: ' + result.status);
      setRows(old => old.filter(item => item.id !== row.id));
    } catch (error) { setMessage((error as Error).message); }
    finally { lock.current = false; setBusy(false); void refresh.current(); }
  };
  if (!visible) return null;
  const row = rows[0];
  if (!expanded) return <button className="approval-pending" onClick={() => setExpanded(true)}>{rows.length} lệnh chờ duyệt</button>;
  return <section className="approval-dialog" role="region" aria-labelledby="approval-title">
    <button onClick={() => setExpanded(false)}>Thu gọn · tiếp tục công việc khác</button>
    <h2 id="approval-title">Duyệt lệnh trên máy</h2>
    <p>Lệnh chạy trực tiếp với quyền tài khoản Windows của anh. Không có sandbox.</p>
    <p>Agent: {row.agentId || 'Chưa rõ'} · Máy thực thi: {row.host || 'Chưa rõ'} · {rows.length} yêu cầu chờ</p>
    {row.sessionKey && <p className="settings-muted">Phiên: {row.sessionKey}</p>}
    <pre>{row.command}</pre>{row.warning && <p>{row.warning}</p>}
    <p>Chỉ duyệt nếu anh hiểu và đồng ý với lệnh hiển thị. Quyền duyệt chỉ dùng cho lần này.</p>
    <div className="approval-actions"><button disabled={busy || !ready} onClick={() => void resolve(row, 'deny')}>Từ chối</button>
      <button disabled={busy || !ready || !row.canAllow} onClick={() => void resolve(row, 'allow-once')}>Cho phép lần này</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
