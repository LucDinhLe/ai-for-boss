import { WorkbenchIcon } from './WorkspaceSidebar';
import { DEFAULT_LAYOUT, type LayoutPreferences } from './layout-preferences';
export function LayoutOptions({ value, onChange }: { value: LayoutPreferences; onChange(value: LayoutPreferences): void }) {
  return <div className="layout-options">
    <label><input type="checkbox" checked={!value.leftHidden} onChange={event => onChange({ ...value, leftHidden: !event.target.checked })} />Thanh bên trái</label>
    <label><input type="checkbox" checked={!value.rightHidden} onChange={event => onChange({ ...value, rightHidden: !event.target.checked })} />Bảng Tệp / Web bên phải</label>
    <label>Độ rộng thanh bên <output>{value.railWidth} px</output><input aria-label="Độ rộng thanh bên" type="range" min="180" max="320" step="10" value={value.railWidth} onChange={event => onChange({ ...value, railWidth: Number(event.target.value) })} /></label>
    <label>Độ rộng bảng phải <output>{value.dockWidth} px</output><input aria-label="Độ rộng bảng phải" type="range" min="240" max="960" step="10" value={value.dockWidth} onChange={event => onChange({ ...value, dockWidth: Number(event.target.value) })} /></label>
    <label>Cỡ chữ cuộc trò chuyện <output>{value.textSize} px</output><input aria-label="Cỡ chữ cuộc trò chuyện" type="range" min="12" max="18" value={value.textSize} onChange={event => onChange({ ...value, textSize: Number(event.target.value) })} /></label>
    <label>Giao diện<select aria-label="Màu giao diện" value={value.theme} onChange={event => onChange({ ...value, theme: event.target.value as LayoutPreferences['theme'] })}><option value="light">Sáng</option><option value="dark">Tối</option></select></label>
    <button type="button" onClick={() => onChange({ ...DEFAULT_LAYOUT })}>Khôi phục bố cục mặc định</button>
  </div>;
}
export default function LayoutControls({ value, onChange, onSettings }: { value: LayoutPreferences; onChange(value: LayoutPreferences): void; onSettings(): void }) {
  return <div className="layout-controls">
    <details className="layout-menu" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
      <summary className="tool-icon" aria-label="Điều chỉnh bố cục" title="Điều chỉnh bố cục"><WorkbenchIcon name="layout" /></summary>
      <div className="control-popover"><strong>Bố cục</strong><LayoutOptions value={value} onChange={onChange} /></div>
    </details>
    <button type="button" className="tool-icon" aria-label="Tập trung vào chat" title="Tập trung vào chat / Hiện đủ ba bảng" aria-pressed={value.leftHidden && value.rightHidden}
      onClick={() => onChange({ ...value, leftHidden: !(value.leftHidden && value.rightHidden), rightHidden: !(value.leftHidden && value.rightHidden) })}><WorkbenchIcon name="focus" /></button>
    <button type="button" className="tool-icon" aria-label="Cài đặt" title="Cài đặt" onClick={onSettings}><WorkbenchIcon name="settings" /></button>
  </div>;
}
