import { useRef } from "react";
import type { SessionSummary } from "./gateway-client";
import { conversationTitle } from "./workspace-ui";

export type SessionTabsProps = {
  sessions: SessionSummary[];
  openKeys: string[];
  activeKey: string | null;
  disabled: boolean;
  onSelect(key: string): void;
  onClose(key: string): void;
  onNew(): void;
};

export default function SessionTabs(props: SessionTabsProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const keys = [...new Set(props.openKeys)];
  const focusedKey = keys.includes(props.activeKey ?? "") ? props.activeKey : keys[0];
  return <div className="session-tabs">
    <div className="session-tabs__list" role="tablist" aria-label="Phiên đang mở" aria-orientation="horizontal">
      {keys.map((key, index) => {
        const title = conversationTitle(key, props.sessions);
        return <div className={`session-tab${key === props.activeKey ? " session-tab--active" : ""}`} key={key}>
          <button type="button" role="tab" id={`workspace-tab-${encodeURIComponent(key)}`} aria-controls="workspace-content"
            aria-selected={key === props.activeKey} tabIndex={key === focusedKey ? 0 : -1} title={title}
            disabled={props.disabled} ref={(node) => { if (node) buttons.current.set(key, node); else buttons.current.delete(key); }}
            onClick={() => { if (!props.disabled) props.onSelect(key); }} onKeyDown={(event) => {
              if (props.disabled || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
              if (event.key === "Delete") { event.preventDefault(); props.onClose(key); return; }
              const next = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1
                : event.key === "ArrowRight" ? (index + 1) % keys.length
                  : event.key === "ArrowLeft" ? (index - 1 + keys.length) % keys.length : -1;
              if (next < 0) return;
              event.preventDefault();
              props.onSelect(keys[next]);
              buttons.current.get(keys[next])?.focus();
              buttons.current.get(keys[next])?.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}><span className="session-tab__dot" aria-hidden="true">•</span><span>{title}</span></button>
          <button type="button" className="session-tab__close" aria-label={`Đóng tab ${title}`} title="Đóng tab"
            disabled={props.disabled} onClick={() => { if (!props.disabled) props.onClose(key); }}>×</button>
        </div>;
      })}
    </div>
    <button type="button" className="session-tabs__new tool-icon" aria-label="Phiên mới" title="Phiên mới"
      disabled={props.disabled} onClick={() => { if (!props.disabled) props.onNew(); }}>+</button>
  </div>;
}
