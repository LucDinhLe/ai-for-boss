import { useRef, useState } from 'react';
import { manage } from './workbench-api';
import type { RuntimeStatus } from './gateway-client';
import { WorkbenchIcon } from './WorkspaceSidebar';
export default function GatewayControl({ runtime, onRetry }: { runtime: RuntimeStatus; onRetry(): void }) {
  const [busy, setBusy] = useState(false), [report, setReport] = useState('');
  const [checking, setChecking] = useState(false);
  const lock = useRef(false);
  const act = async (action: string) => {
    if (lock.current) return; lock.current = true; setBusy(true); setChecking(action === 'gateway-health'); setReport('');
    try {
      const result = await manage<{ stopped?: boolean; ready?: boolean; paused?: boolean; healthy?: boolean }>({ action });
      setReport(result.stopped || result.paused ? 'Đã tạm dừng. Bật lại Gateway khi anh muốn giao việc tiếp.' : result.ready ? 'Đã sẵn sàng nhận việc.'
        : result.healthy ? 'Gateway phản hồi bình thường. Chưa kiểm đăng nhập hoặc gọi mô hình.' : 'Gateway có phản hồi nhưng còn mục cần kiểm tra.');
    } catch (e) { setReport(String((e as Error).message)); }
    finally { lock.current = false; setBusy(false); setChecking(false); }
  };
  return <details className="gateway-control"><summary><WorkbenchIcon name="gateway" /><span className={runtime.connected && runtime.setupReady ? 'control-dot ready' : 'control-dot'} /> Gateway<WorkbenchIcon name="chevronDown" /></summary>
    <div className="control-popover"><strong>Gateway OpenClaw</strong><p>{runtime.paused ? 'Đang tạm dừng' : runtime.connected && runtime.setupReady ? 'Sẵn sàng làm việc' : 'Đang kết nối'}</p>
      <button disabled={busy} onClick={() => void act(runtime.paused ? 'gateway-resume' : 'gateway-stop')}><WorkbenchIcon name={runtime.paused ? 'play' : 'stop'} />{busy ? 'Đang xử lý…' : runtime.paused ? 'Tiếp tục Gateway' : 'Dừng Gateway'}</button>
      <button disabled={busy || !runtime.connected || !runtime.setupReady} onClick={() => void act('gateway-health')}><span className={checking ? 'health-checking' : ''}><WorkbenchIcon name="heart" /></span>Kiểm tra sức khỏe</button>
      {!runtime.paused && !runtime.connected && runtime.supervisor === 'safe-mode' && <button disabled={busy} onClick={onRetry}><WorkbenchIcon name="reload" />Thử kết nối lại</button>}
      <small>Dừng sẽ ngắt việc đang chạy và tạm ngừng lịch. Nháp vẫn giữ; việc bị ngắt không tự gửi lại.</small>
      {report && <p role="status">{report}</p>}<details><summary>Thông tin thêm</summary><p>OpenClaw {runtime.serverVersion ?? '—'} · Kết nối {runtime.protocol ?? '—'}</p>{runtime.lastError && <p>{runtime.lastError}</p>}</details>
    </div></details>;
}
