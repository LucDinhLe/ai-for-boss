import { useEffect, useRef, useState } from 'react';
import { manage } from './workbench-api';
export default function BrowserSettings({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [tabs, setTabs] = useState<number | null>(null);
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (action: string) => {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await manage<{ tabs?: unknown[]; copied?: boolean; opened?: boolean }>({ action });
      if (!alive.current) return;
      if (action === 'chrome-tabs') { if (!Array.isArray(result.tabs)) throw new Error('Chưa xác nhận kết nối tiện ích.'); setTabs(result.tabs.length); }
      else setMessage(result.copied ? 'Đã sao chép mã ghép nối. Dán trong tiện ích trong 60 giây.' : 'Đã mở trang tiện ích chính thức.');
    } catch (error) { if (alive.current) { setTabs(null); setMessage((error as Error).message); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <div className="settings-card"><h2>Browser Extension</h2><p>Kết nối Chrome qua tiện ích OpenClaw chính thức để đưa nội dung những tab anh chọn vào cuộc trò chuyện.</p>
    <ol><li><button disabled={busy} onClick={() => void run('chrome-store')}>Mở tiện ích chính thức</button> rồi thêm vào Chrome.</li>
      <li><button disabled={busy || !ready} onClick={() => void run('chrome-pair')}>Sao chép mã ghép nối</button>. Trong tiện ích mở Settings → Advanced manual pairing và dán mã.</li>
      <li>Chọn Selected tabs và đưa tab cần chia sẻ vào nhóm OpenClaw.</li></ol>
    <button disabled={busy || !ready} onClick={() => void run('chrome-tabs')}>Kiểm tra tab đã chia sẻ</button>
    {tabs !== null && <p role="status">{tabs ? `Đã nhận ${tabs} tab từ tiện ích.` : 'Chưa có tab được chia sẻ. Kiểm tra ghép nối và nhóm OpenClaw trong Chrome.'}</p>}
    {message && <p role="status">{message}</p>}<p>Mở Web → Kết nối Chrome để chọn trang đưa vào nháp. AI chưa tự bấm hoặc gửi trên trang. Trình duyệt tích hợp dùng màu theo cài đặt giao diện của ứng dụng.</p>
  </div>;
}
