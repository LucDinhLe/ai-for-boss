import { useCallback, useEffect, useRef, useState } from 'react';
import { manage } from './workbench-api';
type Values = { revision: string; cacheRetention: 'none' | 'short' | 'long' | null; catalogRefresh: boolean; applied?: boolean };
export default function ModelSettings({ ready, disabled }: { ready: boolean; disabled: boolean }) {
  const [value, setValue] = useState<Values | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const alive = useRef(false), lock = useRef(false), generation = useRef(0);
  const load = useCallback(async () => {
    const epoch = ++generation.current;
    await Promise.resolve();
    if (!alive.current || generation.current !== epoch) return;
    setValue(null); setMessage('');
    if (!ready) return;
    try { const result = await manage<Values>({ action: 'model-settings' }); if (alive.current && generation.current === epoch) setValue(result); }
    catch (error) { if (alive.current && generation.current === epoch) setMessage((error as Error).message); }
  }, [ready]);
  const run = async (save = false) => {
    if (!ready || lock.current || save && (disabled || !value)) return;
    const epoch = ++generation.current;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const result = await manage<Values>(save ? { action: 'model-settings-save', revision: value!.revision,
        cacheRetention: value!.cacheRetention, catalogRefresh: value!.catalogRefresh } : { action: 'model-settings' });
      if (alive.current && generation.current === epoch) { setValue(result); if (save) setMessage(result.applied ? 'Đã lưu và áp dụng cài đặt.' : 'Đã lưu. Bộ chạy chưa xác nhận áp dụng; tải lại để kiểm tra.'); }
    } catch (error) { if (alive.current && generation.current === epoch) setMessage((error as Error).message); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  useEffect(() => { let current = true; alive.current = true;
    void Promise.resolve().then(() => { if (current) return load(); });
    return () => { current = false; alive.current = false; }; }, [load]);
  return <div className="settings-card"><h2>Prompt caching & cập nhật mô hình</h2>
    <p>Giữ mô hình, mức thinking và nội dung chỉ dẫn ổn định giúp tái sử dụng cache. Số liệu đọc/ghi cache nằm trong Thanh toán & sử dụng.</p>
    {value && <fieldset className="model-settings-fields" disabled={busy || disabled || !ready}>
      <label>Thời gian lưu prompt cache mặc định <select aria-label="Thời gian lưu prompt cache" value={value.cacheRetention ?? ''}
        onChange={event => setValue({ ...value, cacheRetention: event.target.value as Values['cacheRetention'] })}>
        <option value="" disabled>Theo mặc định của nhà cung cấp</option><option value="short">Ngắn — tiết kiệm chi phí lưu</option>
        <option value="long">Dài — cho các lượt làm việc cách xa nhau</option><option value="none">Không yêu cầu cache riêng</option></select></label>
      <p>Áp dụng khi provider hỗ trợ; cấu hình riêng của model hoặc agent được ưu tiên. CLI quản lý cache riêng. Cache dài có thể tăng phí lưu; lựa chọn cuối không tắt được cache tự động của provider.</p>
      <label><input type="checkbox" checked={value.catalogRefresh} onChange={event => setValue({ ...value, catalogRefresh: event.target.checked })} /> Tự động cập nhật danh mục mô hình từ OpenClaw</label>
      <p>Kiểm tra khi mở Gateway và tối đa mỗi 6 giờ. Danh mục mới có hiệu lực sau khi khởi động lại Gateway lúc công việc đã xong. Quyền tài khoản quyết định mô hình nào dùng được.</p>
      <button onClick={() => void run(true)}>Lưu cài đặt mô hình</button>
    </fieldset>}
    <button disabled={busy || !ready} onClick={() => void run()}>{busy ? 'Đang xử lý…' : 'Tải lại cài đặt mô hình'}</button>
    {!ready && <p>Kết nối Gateway để đọc cài đặt.</p>}{message && <p role="status">{message}</p>}
  </div>;
}
