import { useState } from 'react';
import CapabilityCatalog from './CapabilityCatalog';
import BrandIcon from './BrandIcon';
import { WorkbenchIcon } from './WorkspaceSidebar';
import { compareProviders, providerLabel } from './provider-order';
import type { ModelSummary } from './gateway-client';

/**
 * Settings → Nhà cung cấp used to open straight into the 66-entry OpenClaw
 * catalogue and start a native account scan on every visit. The page now leads
 * with what is actually connected and one way in to the Connect screen; the
 * full catalogue stays one click away and is only mounted (and only scans)
 * when someone opens it.
 */
export default function ProviderSettings({ ready, models, currentProvider, currentModel, onConnect }: {
  ready: boolean; models: ModelSummary[]; currentProvider?: string | null; currentModel?: string | null; onConnect?(): void;
}) {
  const [showCatalogue, setShowCatalogue] = useState(false);
  const connected = [...new Set(models.filter(model => model.available).map(model => model.provider))].sort(compareProviders);
  const countFor = (provider: string) => models.filter(model => model.available && model.provider === provider).length;
  return <>
    <p className="settings-lead">Tài khoản AI kết nối ở một chỗ. Đăng nhập tài khoản có sẵn được ưu tiên, rồi tới ứng dụng đã đăng nhập trên máy, sau cùng mới là API key.</p>
    <div className="settings-card">
      <h2><WorkbenchIcon name="model" />Tài khoản đang dùng</h2>
      {!ready ? <p>Bật Gateway để xem tài khoản đã kết nối.</p>
        : connected.length === 0 ? <p>Chưa có tài khoản nào dùng được. Bấm Kết nối AI để bắt đầu.</p>
        : <ul className="provider-settings__list">{connected.map(provider => <li key={provider}>
          <BrandIcon id={provider} label={providerLabel(provider)} /><strong>{providerLabel(provider)}</strong>
          <small>{provider === currentProvider && currentModel ? `Đang dùng ${currentModel}` : `${countFor(provider)} mô hình khả dụng`}</small>
        </li>)}</ul>}
      {onConnect && <button className="settings-primary" disabled={!ready} onClick={() => onConnect()}><WorkbenchIcon name="plug" />{connected.length ? 'Kết nối thêm hoặc đổi tài khoản' : 'Kết nối AI'}</button>}
      <p className="settings-muted">Quyền dùng từng mô hình và cách tính phí thuộc tài khoản của anh tại nhà cung cấp. Có trong danh mục chưa đồng nghĩa đã dùng được.</p>
    </div>
    <div className="settings-card">
      <h2><WorkbenchIcon name="model" />Danh mục nhà cung cấp của OpenClaw</h2>
      <p>Toàn bộ tên mà bộ chạy biết, kể cả những nhà cung cấp cần plugin hoặc máy chủ riêng. Mở khi cần tra cứu; việc đọc danh mục sẽ dò lại tài khoản trên máy nên mất tới nửa phút.</p>
      {showCatalogue
        ? <CapabilityCatalog kind="providers" ready={ready} connectedProviders={connected} onConnect={onConnect ? () => onConnect() : undefined} />
        : <button onClick={() => setShowCatalogue(true)}>Xem toàn bộ danh mục</button>}
    </div>
  </>;
}
