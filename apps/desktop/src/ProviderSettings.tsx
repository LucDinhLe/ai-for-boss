import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import BrandIcon from './BrandIcon';
import { manage } from './workbench-api';
import { providerCards, reorder, type AccountRow, type AuthProvider, type ProviderCard } from './provider-accounts';
import { providerFamily } from './provider-order';
import type { ModelSummary } from './gateway-client';

function setupCall<T = Record<string, unknown>>(method: string, params?: unknown): Promise<T> {
  const api = window.aiForBoss?.setup;
  if (!api) return Promise.reject(new Error('Cầu nối thiết lập chưa sẵn sàng.'));
  return api.request(method, params) as Promise<T>;
}

/**
 * The icons of the reference screen the Product Owner signed off on (25/09):
 * outline strokes, no words, always in the same place. Kept here rather than in
 * the shared sidebar set because nothing else in the app uses them.
 */
const PATHS = {
  shield: 'M12 3l7 3v5c0 4.5-3 8.4-7 10-4-1.6-7-5.5-7-10V6l7-3z',
  star: 'M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9L12 3.6z',
  edit: 'M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.4 3.6a2 2 0 0 1 2.8 2.8L12 15.6l-4 1 1-4 9.4-9z',
  usage: 'M4 4v16h16M8.5 16v-5M12.5 16V8M16.5 16v-3',
  tag: 'M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8zM8 8h.01',
  refresh: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5',
  plus: 'M12 5v14M5 12h14'
} as const;

function Icon({ name, filled = false }: { name: keyof typeof PATHS; filled?: boolean }) {
  return <svg className="pset-icon" viewBox="0 0 24 24" width="18" height="18" fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>;
}

/**
 * The core has no rename for an auth profile (spec 0063, 3b), so a label is the
 * shell's own note, kept on this machine only. It never reaches the core and it
 * changes nothing about which account is used.
 */
const LABELS_KEY = 'aifb.provider-labels.v1';
function readLabels(): Record<string, string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LABELS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function writeLabels(labels: Record<string, string>) {
  try { window.localStorage.setItem(LABELS_KEY, JSON.stringify(labels)); } catch { /* a label is a convenience, never a failure */ }
}

/** "openai-codex" reads "Openai-Codex", the way the reference screen names the core id under the brand. */
function coreName(provider: string) {
  return provider.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : part).join('-');
}

function modelRef(model: ModelSummary) {
  return model.id.startsWith(model.provider + '/') ? model.id : `${model.provider}/${model.id}`;
}

/**
 * Settings → Nhà cung cấp (spec 0060, 0063, 0067).
 *
 * One card per connected provider, the accounts under it in the order the core
 * will try them. Everything shown comes from `models.authStatus` and the model
 * list; the page names no provider of its own.
 */
export default function ProviderSettings({ ready, models, onConnect }: {
  ready: boolean; models: ModelSummary[]; currentProvider?: string | null; currentModel?: string | null;
  onConnect?(query?: string): void; onChangeModel?(): void;
}) {
  const [cards, setCards] = useState<ProviderCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** What every new conversation starts on. The star is how the user picks the provider behind it. */
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>(readLabels);
  const [labelling, setLabelling] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [usageOpen, setUsageOpen] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  // A result says itself and goes; an error stays until the person closes it.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const act = async (key: string, work: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(key); setError(null);
    try { await work(); setToast(done); } catch (cause) { setError(String((cause as Error)?.message ?? cause)); }
    finally { setBusy(null); }
  };

  const move = (card: ProviderCard, account: AccountRow, direction: -1 | 1) => {
    const next = reorder(card.accounts.map(item => item.profileId), account.profileId, direction);
    if (!next) return;
    void act(account.profileId, async () => {
      await manage({ action: 'provider-order-set', provider: card.provider, profileIds: next });
      await load(false);
    }, direction < 0 ? 'Đã đưa tài khoản lên, tài khoản này được dùng trước.' : 'Đã hạ tài khoản xuống một bậc.');
  };

  const logout = (card: ProviderCard, account: AccountRow) => void act(account.profileId, async () => {
    await setupCall('models.authLogout', { provider: card.provider, profileId: account.profileId });
    const next = { ...(labels ?? {}) }; delete next[account.profileId]; setLabels(next); writeLabels(next);
    await load(true);
  }, `Đã gỡ tài khoản khỏi ${card.label}.`);

  // Only what the core says is available: the shell never invents a model.
  const available = (card: ProviderCard) => models.filter(model => model.available
    && providerFamily(model.provider) === providerFamily(card.provider));
  const defaultFamily = defaultModel ? providerFamily(defaultModel.split('/')[0]) : null;
  const makeDefault = (card: ProviderCard) => {
    const first = available(card)[0];
    if (!first || providerFamily(card.provider) === defaultFamily) return;
    const ref = modelRef(first);
    void act('default-model', async () => {
      await manage({ action: 'default-model-set', model: ref });
      await load(false);
    }, `${card.label} là nhà cung cấp mặc định, cuộc trò chuyện mới chạy bằng ${ref}. Đổi mô hình cụ thể ở mục Mô hình.`);
  };

  const saveLabel = (event: FormEvent, profileId: string) => {
    event.preventDefault();
    const next = { ...(labels ?? {}) };
    const value = draft.trim().slice(0, 40);
    if (value) next[profileId] = value; else delete next[profileId];
    setLabels(next); writeLabels(next); setLabelling(null);
    setToast(value ? `Đã đặt nhãn “${value}”.` : 'Đã xoá nhãn.');
  };

  // A provider with models but no stored account is connected too, through an
  // app already signed in on this machine, so it belongs in the list.
  const connected = cards?.filter(card => card.accounts.length > 0 || card.modelCount > 0) ?? [];
  const locked = !ready || Boolean(busy);

  return <div className="pset">
    <p className="pset__subtitle">Cấu hình nhà cung cấp mô hình AI và API key</p>
    <div className="pset__intro">
      <p>Mỗi nhà cung cấp có thể có nhiều tài khoản. Tài khoản primary được dùng trước, các tài khoản còn lại là dự phòng
        theo thứ tự ưu tiên khi tài khoản trước gặp lỗi (hết lượt hoặc hết hạn đăng nhập). Để thêm tài khoản khác, bấm
        “Thêm nhà cung cấp”, chọn cùng nhà cung cấp rồi đặt một nhãn. Ngôi sao chọn nhà cung cấp cho cuộc trò chuyện mới.</p>
      {onConnect && <button type="button" className="pset__add settings-primary" disabled={!ready} onClick={() => onConnect()}>
        <Icon name="plus" />Thêm nhà cung cấp</button>}
    </div>

    {!ready ? <p className="pset__empty" role="status">Bộ chạy đang khởi động. Danh sách hiện ra ngay khi sẵn sàng.</p>
      : cards === null ? <p className="pset__empty" role="status">Đang đọc danh sách tài khoản…</p>
      : connected.length === 0 ? <p className="pset__empty">Chưa có tài khoản nào. Bấm Thêm nhà cung cấp để đăng nhập hoặc dán API key.</p>
      : <ul className="pset__list">{connected.map(card => {
        const isDefault = providerFamily(card.provider) === defaultFamily;
        const canDefault = available(card).length > 0;
        return <li key={card.provider} className="pset__group">
          <div className={isDefault ? 'pcard pcard--default' : 'pcard'}>
            <div className="pcard__head">
              <span className="pcard__logo"><BrandIcon id={card.provider} label={card.label} /></span>
              <div><strong>{card.label}</strong><small>{coreName(card.provider)}</small></div>
            </div>
            <div className="pcard__bar">
              <span className={`pcard__status pcard__status--${card.pill.tone}`}><Icon name="shield" />
                <span className="pcard__pill">{card.pill.label}</span></span>
              <span className="pcard__tools">
                <button type="button" className={isDefault ? 'pset__icon pset__icon--star is-on' : 'pset__icon pset__icon--star'}
                  disabled={locked || !canDefault || isDefault} aria-pressed={isDefault}
                  title={isDefault ? 'Nhà cung cấp mặc định cho cuộc trò chuyện mới'
                    : canDefault ? 'Chọn làm nhà cung cấp mặc định cho cuộc trò chuyện mới'
                    : 'Nhà cung cấp này chưa có mô hình dùng được'}
                  aria-label={`Đặt ${card.label} làm nhà cung cấp mặc định`}
                  onClick={() => makeDefault(card)}><Icon name="star" filled={isDefault} /></button>
                <button type="button" className="pset__icon" disabled={!onConnect || locked}
                  title={onConnect ? 'Sửa kết nối: đăng nhập lại, đổi API key hoặc thêm tài khoản' : 'Bản này không mở kết nối nhà cung cấp'}
                  aria-label={`Sửa kết nối ${card.label}`}
                  onClick={() => onConnect?.(card.provider)}><Icon name="edit" /></button>
              </span>
            </div>
          </div>
          {card.accounts.length === 0
            ? <p className="pset__note">Chạy qua ứng dụng đã đăng nhập sẵn trên máy, nên không có tài khoản lưu ở đây.</p>
            : <ol className="paccounts">{card.accounts.map((account, index) => {
              const label = labels?.[account.profileId];
              const name = label ?? account.name ?? card.provider;
              const detail = [account.kind, account.email && account.email !== name ? account.email : null,
                account.health.tone === 'ok' ? null : account.health.label].filter(Boolean).join(' · ');
              const position = `tài khoản ${index + 1} của ${card.label}`;
              return <li key={account.profileId} className="paccount">
                <span className="paccount__rank">{index + 1}</span>
                {labelling === account.profileId
                  ? <form className="paccount__label" onSubmit={event => saveLabel(event, account.profileId)}>
                    <input aria-label={`Nhãn cho ${position}`} value={draft} maxLength={40} autoFocus
                      placeholder="Ví dụ: Công ty, Cá nhân" onChange={event => setDraft(event.target.value)}
                      onKeyDown={event => { if (event.key === 'Escape') setLabelling(null); }} />
                    <button type="submit">Lưu</button>
                    <button type="button" onClick={() => setLabelling(null)}>Huỷ</button>
                  </form>
                  : <span className="paccount__name">
                    <span className="paccount__title"><strong>{name}</strong>
                      {account.primary && <em className="paccount__primary">primary</em>}</span>
                    <small className={`paccount__detail paccount__detail--${account.health.tone}`}>{detail}</small>
                  </span>}
                <span className="paccount__actions">
                  {/* Six icons, always all six. A button the core will not allow is
                      dimmed and says why, so every row keeps the same shape. */}
                  <button type="button" className="pset__icon" disabled={!card.usage} aria-expanded={usageOpen === account.profileId}
                    title={card.usage ? `Mức dùng của ${card.label}: ${card.usage}` : 'Lõi chưa báo mức dùng cho nhà cung cấp này'}
                    aria-label={`Mức dùng của ${position}`}
                    onClick={() => setUsageOpen(open => open === account.profileId ? null : account.profileId)}><Icon name="usage" /></button>
                  <button type="button" className="pset__icon" disabled={locked}
                    title="Đặt nhãn để phân biệt tài khoản (chỉ lưu trên máy này)" aria-label={`Đặt nhãn cho ${position}`}
                    onClick={() => { setDraft(label ?? ''); setLabelling(account.profileId); }}><Icon name="tag" /></button>
                  <button type="button" className="pset__icon" disabled={!onConnect || locked}
                    title={onConnect ? 'Đăng nhập lại, làm mới token' : 'Bản này không mở kết nối nhà cung cấp'}
                    aria-label={`Đăng nhập lại ${position}`}
                    onClick={() => onConnect?.(card.provider)}><Icon name="refresh" /></button>
                  <button type="button" className="pset__icon" disabled={locked || !card.canReorder || index === 0}
                    title={!card.canReorder ? 'Chỉ có một tài khoản, chưa có gì để đổi thứ tự'
                      : index === 0 ? 'Đã ở trên cùng' : 'Đưa lên trên, cho dùng trước'}
                    aria-label={`Đưa ${position} lên trên`}
                    onClick={() => move(card, account, -1)}><Icon name="up" /></button>
                  <button type="button" className="pset__icon" disabled={locked || !card.canReorder || index === card.accounts.length - 1}
                    title={!card.canReorder ? 'Chỉ có một tài khoản, chưa có gì để đổi thứ tự'
                      : index === card.accounts.length - 1 ? 'Đã ở dưới cùng' : 'Hạ xuống, nhường tài khoản dưới dùng trước'}
                    aria-label={`Đưa ${position} xuống dưới`}
                    onClick={() => move(card, account, 1)}><Icon name="down" /></button>
                  <button type="button" className="pset__icon pset__icon--danger" disabled={locked || !account.canLogout}
                    title={account.canLogout ? 'Gỡ tài khoản khỏi máy' : 'Lõi không cho gỡ tài khoản này'}
                    aria-label={`Gỡ ${position}`}
                    onClick={() => logout(card, account)}><Icon name="trash" /></button>
                </span>
                {usageOpen === account.profileId && card.usage &&
                  <p className="paccount__usage">Mức dùng lõi ghi nhận cho cả {card.label}: {card.usage}</p>}
              </li>;
            })}</ol>}
        </li>;
      })}</ul>}

    {error && <div className="pset__error" role="alert"><span>{error}</span>
      <button type="button" onClick={() => setError(null)}>Đóng</button>
      <button type="button" disabled={!ready} onClick={() => void load(true)}>Thử lại</button></div>}
    {toast && <div className="pset__toast" role="status">{toast}</div>}
  </div>;
}
