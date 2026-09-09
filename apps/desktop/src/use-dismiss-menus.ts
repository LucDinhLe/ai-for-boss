import { useEffect } from 'react';

/** Only transient menus; never collapse content panels or forms. */
export function useDismissMenus() {
  useEffect(() => {
    const selector = 'details.agents-control, details.gateway-control, details.context-meter, details.layout-menu, details.work-templates, details.session-skills';
    const opened = () => [...document.querySelectorAll<HTMLDetailsElement>(selector)].filter(menu => menu.open);
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const menu of opened()) if (!menu.contains(event.target)) menu.open = false;
    };
    const toggle = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLDetailsElement) || !target.matches(selector) || !target.open) return;
      for (const menu of opened()) if (menu !== target) menu.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const menus = opened();
      for (const menu of menus) menu.open = false;
      if (menus.length) menus[0].querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('toggle', toggle, true);
      document.removeEventListener('keydown', escape);
    };
  }, []);
}
