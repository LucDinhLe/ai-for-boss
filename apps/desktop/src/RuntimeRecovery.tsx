import { useRef, useState } from "react";
import { retryRuntimeStartup, type RuntimeStatus } from "./gateway-client";

export default function RuntimeRecovery({ runtime }: { runtime: RuntimeStatus }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  if (runtime.supervisor !== "safe-mode") return null;
  const missingRuntime = ["node-runtime-missing", "openclaw-package-missing"].includes(runtime.detail ?? "");
  const retry = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!await retryRuntimeStartup()) setError("Chưa khởi động lại được. Bạn có thể thử lại.");
    } catch {
      setError("Hiện chưa thể thử lại. Hãy chờ ứng dụng dừng xong hoặc đóng và mở lại.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="notice runtime-recovery" role="status">
      <strong>Ứng dụng chưa sẵn sàng</strong>
      <p>{missingRuntime
        ? "Gói ứng dụng thiếu thành phần cần thiết. Hãy mở đúng bản được bàn giao."
        : "Bạn có thể thử khởi động lại ngay tại đây. Chỉ bộ chạy của cửa sổ này được khởi động lại."}</p>
      {!missingRuntime && <button type="button" onClick={() => void retry()} disabled={busy || runtime.connected || runtime.setupReady}>
        {busy ? "Đang thử lại…" : "Thử khởi động lại"}
      </button>}
      {error && <p>{error}</p>}
    </div>
  );
}
