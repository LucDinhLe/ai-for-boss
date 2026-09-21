import { useCallback, useEffect, useRef, useState } from 'react';
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
export default function ProviderSettings({ ready, models, currentProvider, currentModel, onConnect, onChangeModel }: {
  ready: boolean; models: ModelSummary[]; currentProvider?: string | null; currentModel?: string | null;
  onConnect?(query?: string): void; onChangeModel?(): void;
}) {
  const [cards, setCards] = useState<ProviderCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** What every new conversation starts on. The core picks one on activation; this is how the user takes that back. */
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const epoch = useRef(0);

  const load = useCallback(async (refresh = false) => {
    if (!ready) return;
    const current = ++epoch.current;
    setError(null);
    try {
      const [status, order, current0] = await Promise.all([
        setupCall<{ providers?: AuthProvider[] }>('models.authStatus', { refresh }),
        manage<Record<string, string[]>>({ action: 'provider-order-read' }).catch(() => ({} as Record<string, string[]>)),
        manage<{ model: string | null }>({ action: 'default-model-read' }).catch(() => ({ model: null }))
      ]);
      if (current !== epoch.current) return;
      setDefaultModel(current0.model);
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

  const chooseDefaultModel = async (modelRef: string) => {
    if (busy) return;
    setBusy('default-model'); setError(null);
    try {
      await manage({ action: 'default-model-set', model: modelRef });
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

  // Only what the core says is available: the shell never invents a model.
  const selectable = models.filter(model => model.available)
    .map(model => ({ ref: model.id.startsWith(model.provider + '/') ? model.id : `${model.provider}/${model.id}` }))
    .filter((entry, index, all) => all.findIndex(other => other.ref === entry.ref) === index);
  // A provider with models but no stored account is connected too — through an
  // app on this machine — so it belongs in the list, not in the dim tail.
  const connected = cards?.filter(card => card.accounts.length > 0 || card.modelCount > 0) ?? [];
  const rest = cards?.filter(card => card.accounts.length === 0 && card.modelCount === 0) ?? [];

  return <>
    <p className="settings-lead">Mỗi nhà cung cấp là một thẻ, dưới thẻ là các tài khoản của anh chị. Tài khoản số 1 được dùng trước; những tài khoản sau là dự phòng khi tài khoản trước hết lượt hoặc hết hạn. Thứ tự này do lõi OpenClaw thực thi. Di chuột lên một biểu tượng để biết nó làm gì.</p>
    {/* The core picks a model for you when a connection is activated. This is the
        one place that choice can be taken back, and it only offers what the
        account actually provides. */}
    <div className="settings-card provider-default">
      <div>
        <p className="provider-default__caption">Mô hình mặc định — cuộc trò chuyện mới nào cũng bắt đầu bằng cái này</p>
        {selectable.length > 0
          ? <select aria-label="Mô hình mặc định" className="provider-default__select"
              value={defaultModel ?? ''} disabled={!ready || Boolean(busy)}
              onChange={event => void chooseDefaultModel(event.target.value)}>
              {!defaultModel && <option value="">Chưa chọn</option>}
              {selectable.map(entry => <option key={entry.ref} value={entry.ref}>{entry.ref}</option>)}
            </select>
          : <p className="provider-default__model">{defaultModel ?? 'Chưa có mô hình nào dùng được'}</p>}
        {currentModel && currentModel !== defaultModel &&
          <p className="settings-muted">Cuộc trò chuyện đang mở dùng {currentModel} — đổi riêng cho phiên đó ở mục Mô hình.</p>}
      </div>
      {onChangeModel && <button type="button" onClick={() => onChangeModel()}>Mở mục Mô hình</button>}
    </div>
    <div className="settings-card">
      <div className="provider-head">
        <h2><WorkbenchIcon name="model" />Tài khoản AI của anh chị</h2>
        {onConnect && <button className="settings-primary" disabled={!ready} onClick={() => onConnect()}>
          <WorkbenchIcon name="plug" />Thêm nhà cung cấp</button>}
      </div>
      {!ready ? <p>Bật Gateway để xem tài khoản đã kết nối.</p>
        : cards === null ? <p role="status">Đang đọc danh sách tài khoản…</p>
        : connected.length === 0 ? <p>Chưa có tài khoản nào. Bấm Thêm nhà cung cấp để đăng nhập hoặc dán API key.</p>
        : <ul className="provider-cards">{connected.map(card => <li key={card.provider} className="provider-cards__item">
          <div className="provider-cards__head">
            <BrandIcon id={card.provider} label={card.label} />
            <div>
              <strong>{card.label}</strong>
              <small className={`provider-cards__health provider-cards__health--${card.headline.tone}`}>{card.headline.label}</small>
            </div>
            <span className="provider-cards__count">{card.provider === currentProvider && currentModel
              ? `Đang dùng ${currentModel}` : `${card.modelCount} mô hình khả dụng`}</span>
            {/* Usage sits on the card, not on a row: the core reports it per
                provider and has no per-account figure to show. */}
            <button type="button" className="provider-cards__icon" disabled={!card.usage}
              title={card.usage ? `Mức dùng theo lõi ghi nhận: ${card.usage}` : 'Lõi chưa báo mức dùng cho nhà cung cấp này'}
              aria-label={`Mức dùng của ${card.label}`}><WorkbenchIcon name="usage" /></button>
          </div>
          {card.accounts.length === 0 && <p className="settings-muted provider-cards__note">
            Không có tài khoản lưu ở đây. Mô hình của nhà cung cấp này chạy qua ứng dụng đã đăng nhập sẵn trên máy.</p>}
          <ol className="provider-accounts">{card.accounts.map((account, index) => <li key={account.profileId}>
            <span className="provider-accounts__rank">{index + 1}</span>
            {/* No readable name from the core means the row leads with what it
                really is — OAuth or a key — instead of repeating the provider. */}
            <span className="provider-accounts__name">{account.name ?? account.kind}
              {account.primary && <em className="provider-accounts__primary">Dùng trước</em>}
              {account.name && <small>{account.kind}</small>}
            </span>
            <span className={`provider-accounts__health provider-accounts__health--${account.health.tone}`}>{account.health.label}</span>
            {/* Four icons, always all four. A button the core will not allow is dimmed
                and says why in its tooltip, so every row keeps the same shape. */}
            <span className="provider-accounts__actions">
              <button type="button" className="provider-accounts__icon" disabled={!onConnect || Boolean(busy)}
                title={onConnect ? 'Đăng nhập lại, làm mới token' : 'Bản này không mở kết nối nhà cung cấp'}
                aria-label={`Đăng nhập lại tài khoản ${index + 1} của ${card.label}`}
                onClick={() => onConnect?.(card.label)}><WorkbenchIcon name="plug" /></button>
              <button type="button" className="provider-accounts__icon" disabled={!card.canReorder || index === 0 || Boolean(busy)}
                title={!card.canReorder ? 'Lõi không cho đổi thứ tự ở nhà cung cấp này'
                  : index === 0 ? 'Đã ở trên cùng' : 'Đưa lên trên, cho dùng trước'}
                aria-label={`Đưa tài khoản ${index + 1} của ${card.label} lên trên`}
                onClick={() => void move(card, account.profileId, -1)}>↑</button>
              <button type="button" className="provider-accounts__icon" disabled={!card.canReorder || index === card.accounts.length - 1 || Boolean(busy)}
                title={!card.canReorder ? 'Lõi không cho đổi thứ tự ở nhà cung cấp này'
                  : index === card.accounts.length - 1 ? 'Đã ở dưới cùng' : 'Hạ xuống, nhường tài khoản dưới dùng trước'}
                aria-label={`Đưa tài khoản ${index + 1} của ${card.label} xuống dưới`}
                onClick={() => void move(card, account.profileId, 1)}>↓</button>
              <button type="button" className="provider-accounts__icon provider-accounts__remove" disabled={!account.canLogout || Boolean(busy)}
                title={account.canLogout ? 'Gỡ tài khoản khỏi máy' : 'Lõi không cho gỡ tài khoản này'}
                aria-label={`Gỡ tài khoản ${index + 1} của ${card.label}`}
                onClick={() => void logout(card, account.profileId)}><WorkbenchIcon name="trash" /></button>
            </span>
          </li>)}</ol>
        </li>)}</ul>}
      {error && <p className="provider-error" role="alert">{error}</p>}
      <div className="provider-foot">
        <button type="button" disabled={!ready} onClick={() => void load(true)}>Kiểm tra lại</button>
        <p className="settings-muted">Quyền dùng từng mô hình và cách tính phí thuộc tài khoản của anh chị tại nhà cung cấp. Có trong danh mục chưa đồng nghĩa đã dùng được.</p>
      </div>
    </div>
    {/* The second list and the 84-entry catalogue used to be two more cards here,
        each its own way into connecting (spec 0063). The tail is one dim line now,
        and the catalogue belongs to the Thêm nhà cung cấp flow, not to this page. */}
    {rest.length > 0 && <p className="provider-rest">Lõi còn hỗ trợ, chưa nối tài khoản nào:{' '}
      {[...rest].sort((a, b) => compareProviders(a.provider, b.provider)).map(card => card.label).join(' · ')}</p>}
  </>;
}
