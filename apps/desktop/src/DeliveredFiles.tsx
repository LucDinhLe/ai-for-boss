import { useRef, useState } from 'react';
import { manage } from './workbench-api';
import type { TranscriptMessage } from './gateway-client';

export default function DeliveredFiles({ sessionKey, files }: { sessionKey: string; files: NonNullable<TranscriptMessage['artifacts']> }) {
  const [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const lock = useRef(false);
  const save = async (artifactId: string) => {
    if (lock.current) return; lock.current = true; setBusy(true); setStatus('');
    try { const result = await manage<{ saved: boolean }>({ action: 'artifact-save', key: sessionKey, artifactId });
      setStatus(result.saved ? 'Đã lưu tệp vào vị trí anh chọn.' : 'Đã hủy lưu tệp.');
    } catch { setStatus('Chưa lưu được tệp. Hãy kiểm tra kết nối rồi thử lại.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div className="delivered-files">{files.map(file => <button key={file.artifactId} disabled={busy} onClick={() => void save(file.artifactId)}>
    ↓ Lưu {file.label}{file.sizeBytes !== undefined ? ` · ${Math.ceil(file.sizeBytes / 1024)} KB` : ''}
  </button>)}{status && <p role="status">{status}</p>}</div>;
}
