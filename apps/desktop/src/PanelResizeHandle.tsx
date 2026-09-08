import { useRef } from 'react';
export default function PanelResizeHandle({ side, value, onChange, onDragging }: {
  side: 'left' | 'right'; value: number; onChange(value: number): void; onDragging(value: boolean): void;
}) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const width = () => document.querySelector(side === 'left' ? '.workspace__rail' : '.workspace__dock')?.getBoundingClientRect().width ?? value;
  const change = (next: number) => onChange(Math.round(Math.max(side === 'left' ? 180 : 240, Math.min(side === 'left' ? 320 : 960, next))));
  return <div role="separator" tabIndex={0} aria-orientation="vertical" aria-label={side === 'left' ? 'Độ rộng thanh bên trái' : 'Độ rộng bảng bên phải'}
    aria-valuenow={value} aria-valuemin={side === 'left' ? 180 : 240} aria-valuemax={side === 'left' ? 320 : 960}
    title="Kéo để đổi độ rộng · phím mũi tên để tinh chỉnh" className={`panel-resizer panel-resizer--${side}`}
    onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, width: width() }; onDragging(true); }}
    onPointerMove={event => { if (drag.current) change(drag.current.width + (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1)); }}
    onPointerUp={event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); onDragging(false); }}
    onLostPointerCapture={() => { drag.current = null; onDragging(false); }}
    onPointerCancel={() => { drag.current = null; onDragging(false); }}
    onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault();
      change(event.key === 'Home' ? 0 : event.key === 'End' ? 960 : width() + (event.key === 'ArrowRight' ? 10 : -10) * (side === 'left' ? 1 : -1)); }} />;
}
