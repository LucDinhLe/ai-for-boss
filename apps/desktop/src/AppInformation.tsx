import { useEffect, useRef } from "react";
import type { ContextUsage, RuntimeStatus } from "./gateway-client";

export default function AppInformation({ runtime, shell, usage, availableModelCount, sessionKey, onClose }: {
  runtime: RuntimeStatus;
  shell: ShellStatus | null;
  usage: ContextUsage;
  availableModelCount: number;
  sessionKey: string | null;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { closeButton.current?.focus(); }, []);
  return <section className="workspace__panel" id="app-information" role="tabpanel" aria-labelledby="information-tab"
    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
    <header className="information-header">
      <h2 id="app-information-title">Thông tin ứng dụng</h2>
      <button ref={closeButton} type="button" onClick={onClose} aria-label="Đóng thông tin ứng dụng">Đóng</button>
    </header>
    {shell ? <p className="panel-footnote">{shell.product.name} {shell.product.version} · Bản thử nghiệm</p> : null}
    <h3>Kết nối và chẩn đoán</h3>
    <dl>
      <dt>Gateway</dt><dd>{runtime.connected ? "Đã kết nối" : "Chưa kết nối"}</dd>
      <dt>Trạng thái bộ chạy</dt><dd>{runtime.supervisor}</dd>
      {runtime.detail ? <><dt>Chi tiết bộ chạy</dt><dd>{runtime.detail}</dd></> : null}
      <dt>Phiên bản OpenClaw</dt><dd>{runtime.serverVersion ?? "—"}</dd>
      <dt>Giao thức</dt><dd>{runtime.protocol ? `v${runtime.protocol}` : "—"}</dd>
      <dt>Node runtime</dt><dd className="mono">{runtime.nodeRuntime ?? "—"}</dd>
      <dt>Thư mục dữ liệu</dt><dd className="mono">{runtime.stateDirectory ?? "—"}</dd>
      <dt>Model khả dụng</dt><dd>{availableModelCount}</dd>
      <dt>Kênh cài đặt</dt><dd>{runtime.setupReady ? "Sẵn sàng" : "Chưa sẵn sàng"}</dd>
      <dt>Mã cuộc trò chuyện</dt><dd className="mono">{sessionKey ?? "—"}</dd>
      <dt>Ngữ cảnh đã dùng / tối đa</dt><dd>{usage.usedTokens ?? "—"} / {usage.contextTokens ?? "—"} token</dd>
    </dl>
    <h3>Phạm vi bản thử</h3>
    <p className="panel-footnote">Bật Advisor và chọn mô hình ở thanh trên. Trợ lý tự xin ý kiến khi lập kế hoạch, nhận góp ý để chỉnh và kiểm kết quả. Mỗi bước có tối đa một lần sửa tự động; nếu cần anh quyết định, công việc sẽ dừng và nói rõ. Góp ý không cấp thêm quyền thao tác.</p>
    <ul className="boundary-list">
      <li>Gateway chỉ nghe loopback, token sinh mới mỗi lần mở ứng dụng.</li>
      <li>Mọi lệnh từ giao diện đi qua danh sách cho phép ở tiến trình chính.</li>
      <li>Dự án và agents có thể quản lý trong ứng dụng. Lệnh trên máy cần duyệt từng lần, không có sandbox. Thao tác website tự động chưa bật.</li>
    </ul>
    {runtime.lastError ? <p className="panel-error">{runtime.lastError}</p> : null}
  </section>;
}
