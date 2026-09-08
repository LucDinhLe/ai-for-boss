import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { providerFamily, providerLabel } from './provider-order';
import type { ModelSummary } from "./gateway-client";
import { WorkbenchIcon } from './WorkspaceSidebar';
import BrandIcon from './BrandIcon';
import { isSelectableModel } from './chat-state';
import { modelChoices } from './model-choices';

export default function ModelPicker({ models, currentProvider, currentId, label, disabled, onSelect, id = 'composer-model', onOpen, onRefresh, loading = false, error }: {
  models: ModelSummary[]; currentProvider: string | null; currentId: string | null;
  label: string; disabled: boolean; onSelect(model: ModelSummary): void; id?: string;
  onOpen?(): void; onRefresh?(): void; loading?: boolean; error?: string | null;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("");
  const [provider, setProvider] = useState('__connected'), [limit, setLimit] = useState(100);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null);
  const visible = open && !disabled;
  const choices = useMemo(() => visible ? modelChoices(models, query, provider, limit, currentProvider)
    : { models: [], total: 0, providers: [] }, [visible, models, query, provider, limit, currentProvider]);
  useEffect(() => {
    if (!visible) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [visible]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div ref={root} className="model-picker" onKeyDown={event => {
    if (!visible) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const options = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ?? []);
      const index = options.indexOf(document.activeElement as HTMLButtonElement);
      options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length]?.focus();
    }
  }}>
    <button ref={trigger} id={id} type="button" className="model-picker__trigger" disabled={disabled}
      value={JSON.stringify([currentProvider, currentId])}
      aria-label={id === 'advisor-model-picker' ? 'Mô hình Advisor' : 'Mô hình cuộc trò chuyện'} aria-haspopup="menu" aria-expanded={visible}
      onClick={() => { setQuery(""); setProvider('__connected'); setLimit(100); if (!open) onOpen?.(); setOpen(value => !value); }}>
      {currentProvider && <BrandIcon id={currentProvider} />}<span className={id === 'composer-model' ? 'composer__model-name' : 'model-picker__name'}>{label}</span><WorkbenchIcon name="chevronDown" />
    </button>
    {visible && <div className="model-picker__popover" onBlur={event => {
      if (event.relatedTarget && !root.current?.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
      <input ref={search} aria-label="Tìm mô hình" placeholder="Tìm mô hình…" value={query} onChange={event => { setQuery(event.target.value); setLimit(100); }} />
      <select aria-label="Lọc nhà cung cấp mô hình" value={provider} onChange={event => { setProvider(event.target.value); setLimit(100); }}>
        <option value="__connected">Nhà cung cấp đã kết nối</option><option value="__all">Tất cả nhà cung cấp</option>
        {choices.providers.map(item => <option key={item} value={item}>{providerLabel(item)} · {item}</option>)}
      </select>
      {onRefresh && <button type="button" className="model-picker__refresh" disabled={loading} onClick={onRefresh}><WorkbenchIcon name="reload" />Tải lại danh mục</button>}
      {loading && <p role="status">Đang tải danh mục từ OpenClaw…</p>}
      {error && <p role="alert">{error}</p>}
      <div role="menu" aria-label="Chọn mô hình" className="model-picker__options">
        {choices.models.map((model, index) => {
            const checked = model.provider === currentProvider && model.id === currentId;
            const selectable = isSelectableModel(model);
            const reason = model.available !== true ? model.unavailableReason === 'auth-failed' ? 'Chưa xác nhận quyền dùng mô hình; kiểm tra kết nối'
              : model.unavailableReason === 'cooldown' ? 'Tạm thời chưa sẵn sàng' : 'Chưa xác nhận kết nối cho mô hình này'
              : model.selectionReason === 'not-offered' ? 'Chưa có trong danh sách được chọn của agent' : 'Chưa được phép chọn';
            return <Fragment key={JSON.stringify([model.provider, model.id])}>
              {(index === 0 || providerFamily(choices.models[index - 1].provider) !== providerFamily(model.provider)) && <div className="model-picker__group" role="presentation">{providerLabel(model.provider)}</div>}
              <button type="button" role="menuitemradio" aria-checked={checked}
              disabled={!selectable} title={!selectable ? reason : `${model.provider}/${model.id}`}
              onClick={() => { close(); if (!checked && selectable) onSelect(model); }}>
              <BrandIcon id={model.provider} /><span><strong>{model.name?.trim() || model.id}</strong><small>{model.provider}/{model.id}</small>{!selectable && <small>{reason}</small>}</span>{checked && <WorkbenchIcon name="check" />}
            </button></Fragment>;
          })}
        {!loading && choices.total === 0 && <p>Không tìm thấy mô hình. Chọn Tất cả nhà cung cấp, tải lại danh mục hoặc kiểm tra kết nối.</p>}
      </div>
      {choices.total > 0 && <p className="model-picker__count">Hiển thị {choices.models.length} / {choices.total} mô hình</p>}
      {choices.models.length < choices.total && <button type="button" onClick={() => setLimit(value => value + 100)}>Hiển thị thêm 100 mô hình</button>}
    </div>}
  </div>;
}
