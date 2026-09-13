import { useCallback, useEffect, useRef, useState } from 'react';
import CapabilityCatalog from './CapabilityCatalog';
import BrandIcon from './BrandIcon';
import { WorkbenchIcon } from './WorkspaceSidebar';
import { manage } from './workbench-api';
import { providerCards, reorder, type AuthProvider, type ProviderCard } from './provider-accounts';
import { compareProviders } from './provider-order';
import type { ModelSummary } from './gateway-client';

function setupCall<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = window.aiForBoss?.setup;
  if (!api) return Promise.reject(new Error('Cầu nối thiết lập chưa sẵn sàng.'));
  return api.request(method, params) as Promise<T>;
}

/**
 * Settings → Nhà cung cấp (spec 0060).
 *
 * One card per provider, the accounts stored under it in the order the core
 * will actually try them, and the health and usage the core reports. Everything
 * shown comes from `models.authStatus`; the page names no provider of its own.
 */
export default function ProviderSettings({ ready, models, currentProvider, currentModel, onConnect }: {
  ready: boolean; models: ModelSummary[]; currentProvider?: string | null; currentModel?: string | null; onConnect?(): void;
}) {
  const [cards, setCards] = useState<ProviderCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const epoch = useRef(0);

  const load = useCallback(async (refresh = false) => {
    if (!ready) return;
    const current = ++epoch.current;
    setError(null);
    try {
      const [status, order] = await Promise.all([
        setupCall<{ providers?: AuthProvider[] }>('models.authStatus', { refresh }),
        manage<Record<string, string[]>>({ action: 'provider-order-read' }).catch(() => ({} as Record<string, string[]>))
      ]);
      if (current !== epoch.current) return;
      const modelCounts: Record<string, number> = {};
      for (const model of models) if (model.available) modelCounts[model.provider] = (modelCounts[model.provider] ?? 0) + 1;
      setCards(providerCards(status.providers ?? [], { order, modelCounts }));
    } catch (cause) {
      if (current === epoch.current) { setCards([]); setError(String((cause as Error)?.message ?? cause)); }
    }
  }, [ready, models]);

  // The first read is deferred off the effect body: calling setState synchronously
  // inside an effect cascades renders, and the lint rule that guards that is on.
  useEffect(() => { void Promise.resolve().then(() => load(false)); }, [load]);

  const move = async (card: ProviderCard, profileId: string, direction: -1 | 1) => {
    const next = reorder(card.accounts.map(account => account.profileId), profileId, direction);
    if (!next || busy) return;
    setBusy(profileId); setError(null);
    try {
      await manage({ action: 'provider-order-set', provider: card.provider, profileIds: next });
      await load(false);
    } catch (cause) { setError(String((cause as Error)?.message ?? cause)); }
    finally { setBusy(null); }
  };

  const logout = async (card: ProviderCard, profileId: string) => {
    if (busy) return;
    setBusy(profileId); setError(null);
    try {
      await setupCall('models.authLogout', { provider: card.provider, profileId });
      await load(true);
    } catch (cause) { setError(String((cause as Error)?.message ?? cause)); }
    finally { setBusy(null); }
  };

  const connected = cards?.filter(card => card.accounts.length > 0) ?? [];
  const rest = cards?.filter(card => card.accounts.length === 0) ?? [];

  return <>
    <p className="settings-lead">Mỗi nhà cung cấp là một thẻ. Tài khoản đầu danh sách được dùng trước; những tài khoản sau là dự phòng khi tài khoản trước hết lượt hoặc hết hạn. Thứ tự này do lõi OpenClaw thực thi.</p>
    <div className="settings-card">
      <div className="provider-head">
        <h2><WorkbenchIcon name="model" />Tài khoản AI của anh chị</h2>
        {onConnect && <button className="settings-primary" disabled={!ready} onClick={() => onConnect()}>
          <WorkbenchIcon name="plug" />Thêm tài khoản</button>}
      </div>
      {!ready ? <p>Bật Gateway để xem tài khoản đã kết nối.</p>
        : cards === null ? <p role="status">Đang đọc danh sách tài khoản…</p>
        : connected.length === 0 ? <p>Chưa có tài khoản nào. Bấm Thêm tài khoản để đăng nhập hoặc dán khoá API.</p>
        : <ul className="provider-cards">{connected.map(card => <li key={card.provider} className="provider-cards__item">
          <div className="provider-cards__head">
            <BrandIcon id={card.provider} label={card.label} />
            <div>
              <strong>{card.label}</strong>
              <small className={`provider-cards__health provider-cards__health--${card.headline.tone}`}>{card.headline.label}</small>
            </div>
            <span className="provider-cards__count">{card.provider === currentProvider && currentModel
              ? `Đang dùng ${currentModel}` : `${card.modelCount} mô hình khả dụng`}</span>
          </div>
          <ol className="provider-accounts">{card.accounts.map((account, index) => <li key={account.profileId}>
            <span className="provider-accounts__rank">{index + 1}</span>
            <span className="provider-accounts__name">{account.name}
              {account.primary && <em className="provider-accounts__primary">Dùng trước</em>}
              <small>{account.kind}</small>
            </span>
            <span className={`provider-accounts__health provider-accounts__health--${account.health.tone}`}>{account.health.label}</span>
            <span className="provider-accounts__actions">
              {card.canReorder && <>
                <button type="button" aria-label={`Đưa ${account.name} lên trên`} disabled={index === 0 || Boolean(busy)}
                  onClick={() => void move(card, account.profileId, -1)}>↑</button>
                <button type="button" aria-label={`Đưa ${account.name} xuống dưới`} disabled={index === card.accounts.length - 1 || Boolean(busy)}
                  onClick={() => void move(card, account.profileId, 1)}>↓</button>
              </>}
              {account.canLogout && <button type="button" className="provider-accounts__remove" disabled={Boolean(busy)}
                aria-label={`Đăng xuất ${account.name}`} onClick={() => void logout(card, account.profileId)}>Đăng xuất</button>}
            </span>
          </li>)}</ol>
          {card.usage && <p className="provider-cards__usage">Mức dùng theo lõi ghi nhận: {card.usage}</p>}
        </li>)}</ul>}
      {error && <p className="provider-error" role="alert">{error}</p>}
      <div className="provider-foot">
        <button type="button" disabled={!ready} onClick={() => void load(true)}>Kiểm tra lại</button>
        <p className="settings-muted">Quyền dùng từng mô hình và cách tính phí thuộc tài khoản của anh chị tại nhà cung cấp. Có trong danh mục chưa đồng nghĩa đã dùng được.</p>
      </div>
    </div>
    {rest.length > 0 && <div className="settings-card">
      <h2><WorkbenchIcon name="model" />Nhà cung cấp lõi có hỗ trợ</h2>
      <p>Những nhà cung cấp lõi báo lên nhưng anh chị chưa kết nối tài khoản nào. Cách kết nối tuỳ nhà cung cấp: đăng nhập tài khoản, dùng ứng dụng đã đăng nhập trên máy, hoặc dán khoá API.</p>
      <ul className="provider-rest">{[...rest].sort((a, b) => compareProviders(a.provider, b.provider)).map(card =>
        <li key={card.provider}><BrandIcon id={card.provider} label={card.label} /><span>{card.label}</span></li>)}</ul>
    </div>}
    <div className="settings-card">
      <h2><WorkbenchIcon name="model" />Danh mục nhà cung cấp của OpenClaw</h2>
      <p>Toàn bộ tên mà bộ chạy biết, kể cả những nhà cung cấp cần plugin hoặc máy chủ riêng. Mở khi cần tra cứu; việc đọc danh mục sẽ dò lại tài khoản trên máy nên mất tới nửa phút.</p>
      {showCatalogue
        ? <CapabilityCatalog kind="providers" ready={ready} connectedProviders={connected.map(card => card.provider)} onConnect={onConnect ? () => onConnect() : undefined} />
        : <button onClick={() => setShowCatalogue(true)}>Xem toàn bộ danh mục</button>}
    </div>
  </>;
}
