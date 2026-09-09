export type LayoutPreferences = { leftHidden: boolean; rightHidden: boolean; railWidth: number; dockWidth: number; textSize: number; theme: 'light' | 'dark' };
export const DEFAULT_LAYOUT: LayoutPreferences = { leftHidden: false, rightHidden: false, railWidth: 230, dockWidth: 320, textSize: 14, theme: 'light' };
const KEY = 'aifb.layout.v1';
export function parseLayout(value: string | null): LayoutPreferences {
  try {
    const data = JSON.parse(value ?? '{}');
    const bounded = (key: 'railWidth' | 'dockWidth' | 'textSize', min: number, max: number) => Number.isInteger(data?.[key]) && data[key] >= min && data[key] <= max ? data[key] : DEFAULT_LAYOUT[key];
    return { leftHidden: data?.leftHidden === true, rightHidden: data?.rightHidden === true,
      railWidth: bounded('railWidth', 180, 320), dockWidth: bounded('dockWidth', 240, 960), textSize: bounded('textSize', 12, 18), theme: data?.theme === 'dark' ? 'dark' : 'light' };
  } catch { return { ...DEFAULT_LAYOUT }; }
}
export function loadLayout(): LayoutPreferences {
  try { return parseLayout(localStorage.getItem(KEY)); } catch { return { ...DEFAULT_LAYOUT }; }
}
export function saveLayout(layout: LayoutPreferences) {
  try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch { /* Private/restricted storage: controls remain usable for this window. */ }
}
