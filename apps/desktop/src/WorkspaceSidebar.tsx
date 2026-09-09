import { useEffect, useRef, useState } from "react";
import type { SessionSummary } from "./gateway-client";
import type { ProjectSummary, WorkspaceView } from "./workbench-api";
import { conversationTitle } from "./workspace-ui";
import BrandMark from "./BrandMark";

export type { WorkspaceView } from "./workbench-api";

const iconPaths = {
  thinking: 'M12 5a3 3 0 0 0-6 0v1a4 4 0 0 0-3 6 4 4 0 0 0 2 7 3.5 3.5 0 0 0 7 1V5Zm0 0a3 3 0 0 1 6 0v1a4 4 0 0 1 3 6 4 4 0 0 1-2 7 3.5 3.5 0 0 1-7 1M6 6c0 2 1 3 3 3m9-3c0 2-1 3-3 3M5 19v-3l3-2m11 5v-3l-3-2',
  edit: 'm16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  unpin: 'm3 3 18 18M9 3h7l-1 6 4 4v2h-2M7 7l2 2-4 4v2h6v7m2-7h1',
  model: 'm12 3 9 5v9l-9 5-9-5V8Zm-9 5 9 5 9-5M12 13v9',
  plugin: 'M9 3v4H3v6h4a3 3 0 1 1 0 6H3v3h6v-4h6v4h6v-7h-4a3 3 0 1 1 0-6h4V7h-6V3Z',
  plug: 'M8 3v5m8-5v5M5 8h14v4a7 7 0 0 1-14 0ZM12 19v3',
  play: 'm8 4 12 8-12 8Z', stop: 'M5 5h14v14H5Z',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8ZM3 12h4l2-4 4 8 2-4h6',
  back: 'm14 5-7 7 7 7M7 12h14', forward: 'm10 5 7 7-7 7M3 12h14', reload: 'M20 7V2m0 5h-5M20 7a9 9 0 1 0 1 8', close: 'm6 6 12 12M6 18 18 6', lock: 'M6 10h12v11H6ZM8 10V7a4 4 0 0 1 8 0v3', key: 'M14 14a6 6 0 1 0-4-4L3 17v4h4v-3h3l4-4Zm4-8h.01',
  layout: "M3 3h6v18H3ZM13 3h8v7h-8ZM13 14h8v7h-8Z", focus: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  chevronDown: "m6 9 6 6 6-6", check: "m5 12 4 4L19 6", agents: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3a7 7 0 0 1 14 0v3M17 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-3 9 2 2 4-4", context: "M21 12a9 9 0 1 1-9-9m0 0v9h9", gateway: "M12 3v4m0 10v4M3 12h4m10 0h4M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M6 6l2 2m8 8 2 2m0-12-2 2M8 16l-2 2",
  sidebarRight: "M3 4h18v16H3ZM15 4v16",
  new: "M12 5v14M5 12h14", projects: "M3 7V5h6l2 2h10v12H3Z",
  usage: "M4 13h3v7H4ZM10 8h3v12h-3ZM16 3h3v17h-3Z",
  skills: "m8 3-5 4 3 5 3-2v11h6V10l3 2 3-5-5-4c-1 3-7 3-8 0Z",
  messages: "M4 4h16v12H9l-5 5Z", artifacts: "M8 3h8l4 4v14H8ZM4 7v12M15 3v5h5",
  cron: "M12 8v5l3 2M5 3 2 6m17-3 3 3M7 20l-2 2m12-2 2 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  settings: "M21.95,11.02L21.95,12.98L19.66,14.32L19.06,15.77L19.73,18.34L18.34,19.73L15.77,19.06L14.32,19.66L12.98,21.95L11.02,21.95L9.68,19.66L8.23,19.06L5.66,19.73L4.27,18.34L4.94,15.77L4.34,14.32L2.05,12.98L2.05,11.02L4.34,9.68L4.94,8.23L4.27,5.66L5.66,4.27L8.23,4.94L9.68,4.34L11.02,2.05L12.98,2.05L14.32,4.34L15.77,4.94L18.34,4.27L19.73,5.66L19.06,8.23L19.66,9.68ZM15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0",
  voice: "M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8",
  bell: "M5 16h14l-2-3V8a5 5 0 0 0-10 0v5Zm5 4h4",
  keyboard: "M2 5h20v14H2Zm3 4h.1m3 0h.1m3 0h.1m3 0h.1m3 0h.1M5 12h.1m3 0h.1m3 0h.1m3 0h.1m3 0h.1M7 16h10",
  sidebar: "M3 4h18v16H3ZM9 4v16", search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z", pin: "m8 3 8 0-1 6 4 4v2h-6v7m-2-7H5v-2l4-4Z",
  files: "M6 3h8l4 4v14H6ZM14 3v5h5", web: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  terminal: "m4 6 5 6-5 6m9 0h7", info: "M12 10v7m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  advisor: "M4 4h16v12h-6l-5 5v-5H4Zm4 4h8m-8 4h5", chevron: "m9 5 7 7-7 7"
} as const;
export type IconName = keyof typeof iconPaths;

export function WorkbenchIcon({ name }: { name: keyof typeof iconPaths }) {
  return <svg className="workbench-icon" viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={iconPaths[name]} />
  </svg>;
}

export type WorkspaceSidebarProps = {
  sessions: SessionSummary[];
  projects: ProjectSummary[];
  activeKey: string | null;
  activeView: WorkspaceView;
  disabled: boolean;
  modelActive?: boolean;
  actionBusy?: boolean;
  onNewSession(): void;
  onNavigate(view: WorkspaceView): void;
  onOpenSession(key: string): void;
  onPinSession(key: string, pinned: boolean): void | Promise<void>;
  onRenameSession?(key: string, label: string): Promise<void>;
  onDeleteSession?(key: string): void;
  onOpenProject(project: ProjectSummary): void;
  onToggle(): void;
};

const navigation = [
  ["projects", "Dự án"], ["usage", "Thống kê sử dụng"], ["skills", "Kỹ năng"],
  ["messages", "Nhắn tin"], ["cron", "Tác vụ định kỳ"]
] as const;

export default function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const [search, setSearch] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null), [name, setName] = useState("");
  const [renameError, setRenameError] = useState(""), [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<{ key: string; left: number; top: number } | null>(null);
  const [pinningKey, setPinningKey] = useState<string | null>(null), [actionError, setActionError] = useState("");
  const renameLock = useRef(false), pinLock = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null), menuOpener = useRef<{ key: string; element: HTMLElement } | null>(null);
  const menuTriggers = useRef(new Map<string, HTMLButtonElement>());
  const actionsDisabled = props.disabled || props.actionBusy === true || saving || pinningKey !== null;
  const query = search.trim().toLocaleLowerCase("vi");
  const filtered = props.sessions.filter((session) => [conversationTitle(session.key, props.sessions), session.label]
    .some((value) => value?.toLocaleLowerCase("vi").includes(query)));
  const pinned = filtered.filter((session) => session.pinned === true);
  const unpinned = filtered.filter((session) => session.pinned !== true);
  const knownProjects = new Set(props.projects.map((project) => project.id));
  const home = unpinned.filter((session) => !session.projectId);
  const orphaned = unpinned.filter((session) => session.projectId && !knownProjects.has(session.projectId));
  const menuSession = menu && !actionsDisabled ? filtered.find(session => session.key === menu.key) : undefined;
  const menuKey = menuSession?.key;
  useEffect(() => {
    if (!menuKey) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !menuOpener.current?.element.contains(event.target as Node)) setMenu(null);
    };
    const scrolled = (event: Event) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    const close = () => setMenu(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      document.removeEventListener("pointerdown", outside); document.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("resize", close); window.removeEventListener("blur", close);
    };
  }, [menuKey, menu?.left, menu?.top]);
  const restoreFocus = (key: string) => {
    const opener = menuOpener.current;
    if (opener?.key === key && opener.element.isConnected) opener.element.focus();
    else menuTriggers.current.get(key)?.focus();
  };
  const closeMenu = (restore = true) => { if (restore && menu) restoreFocus(menu.key); setMenu(null); };
  const openMenu = (session: SessionSummary, opener: HTMLElement, point?: { x: number; y: number }) => {
    if (actionsDisabled || renameLock.current || pinLock.current) return;
    const bounds = opener.getBoundingClientRect();
    menuOpener.current = { key: session.key, element: opener };
    setActionError("");
    setMenu({ key: session.key, left: Math.max(8, Math.min(point?.x ?? bounds.right - 208, window.innerWidth - 216)),
      top: Math.max(8, Math.min(point?.y ?? bounds.bottom + 4, window.innerHeight - 164)) });
  };
  const togglePin = async (session: SessionSummary) => {
    if (actionsDisabled || pinLock.current || renameLock.current) return;
    closeMenu(); pinLock.current = true; setPinningKey(session.key); setActionError("");
    try { await props.onPinSession(session.key, session.pinned !== true); }
    catch { setActionError("Chưa cập nhật được ghim. Thử lại khi kết nối ổn định."); }
    finally {
      pinLock.current = false; setPinningKey(null);
      window.requestAnimationFrame(() => restoreFocus(session.key));
    }
  };
  const finishRename = () => {
    if (renaming) window.requestAnimationFrame(() => restoreFocus(renaming));
    setRenaming(null);
  };
  const row = (session: SessionSummary) => {
    const title = conversationTitle(session.key, props.sessions);
    return <div key={session.key} className="sidebar-session" data-session-key={session.key} aria-busy={pinningKey === session.key}
      onContextMenu={event => { event.preventDefault(); openMenu(session, menuTriggers.current.get(session.key) ?? event.currentTarget, { x: event.clientX, y: event.clientY }); }}>
      <button type="button" className={`session-item${props.activeView === "chat" && session.key === props.activeKey ? " session-item--active" : ""}`}
        title={title} aria-current={props.activeView === "chat" && session.key === props.activeKey ? "page" : undefined}
        disabled={actionsDisabled} onClick={(event) => {
          if (actionsDisabled) return;
          if (event.shiftKey) {
            if (event.currentTarget) menuOpener.current = { key: session.key, element: event.currentTarget };
            void togglePin(session);
          }
          else props.onOpenSession(session.key);
        }} onKeyDown={event => {
          if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault(); openMenu(session, event.currentTarget);
          }
        }}>
        <span className="sidebar-session__dot" aria-hidden="true">{session.pinned ? <WorkbenchIcon name="pin" /> : "•"}</span><span>{title}</span>
      </button>
      <button ref={element => { if (element) menuTriggers.current.set(session.key, element); else menuTriggers.current.delete(session.key); }}
        type="button" className="sidebar-session__more" aria-label={`Tùy chọn cuộc trò chuyện ${title}`}
        title="Tùy chọn cuộc trò chuyện" aria-haspopup="menu" aria-expanded={menuSession?.key === session.key}
        aria-controls={menuSession?.key === session.key ? "conversation-menu" : undefined} disabled={actionsDisabled}
        onClick={event => { if (actionsDisabled) return; if (menuSession?.key === session.key) closeMenu(); else openMenu(session, event.currentTarget); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); openMenu(session, event.currentTarget); }
        }}>
        <WorkbenchIcon name="more" />
      </button>
    </div>;
  };

  return <>
    {menuSession && menu && <div ref={menuRef} id="conversation-menu" role="menu" className="conversation-menu"
      aria-label={`Tùy chọn cuộc trò chuyện ${conversationTitle(menuSession.key, props.sessions)}`}
      style={{ left: menu.left, top: menu.top }} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && !menuOpener.current?.element.contains(event.relatedTarget as Node)) closeMenu(false);
      }} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); }
        else if (event.key === "Tab") closeMenu();
        else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? []);
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        }
      }}>
      {props.onRenameSession && <button type="button" role="menuitem" tabIndex={-1} disabled={actionsDisabled} onClick={() => {
        if (actionsDisabled) return;
        closeMenu(false); setRenaming(menuSession.key); setName(conversationTitle(menuSession.key, props.sessions)); setRenameError("");
      }}><WorkbenchIcon name="edit" /><span>Đổi tên</span></button>}
      <button type="button" role="menuitemcheckbox" aria-checked={menuSession.pinned === true} tabIndex={-1} disabled={actionsDisabled}
        onClick={() => void togglePin(menuSession)}><WorkbenchIcon name={menuSession.pinned ? "unpin" : "pin"} /><span>{menuSession.pinned ? "Bỏ ghim" : "Ghim"}</span></button>
      {props.onDeleteSession && <button type="button" role="menuitem" className="conversation-menu__delete" tabIndex={-1} disabled={actionsDisabled} onClick={() => {
        if (actionsDisabled) return;
        closeMenu(); props.onDeleteSession?.(menuSession.key);
      }}><WorkbenchIcon name="trash" /><span>Xóa cuộc trò chuyện</span></button>}
    </div>}
    {pinningKey && <p className="sidebar-action-notice" role="status">Đang cập nhật ghim…</p>}
    {actionError && <p className="sidebar-action-notice" role="alert">{actionError}</p>}
    {renaming && <form className="session-rename" aria-label="Đổi tên cuộc trò chuyện" onSubmit={async event => {
      event.preventDefault();
      if (renameLock.current || actionsDisabled || !name.trim()) return;
      renameLock.current = true; setSaving(true); setRenameError("");
      try { await props.onRenameSession?.(renaming, name.trim()); finishRename(); }
      catch { setRenameError("Chưa lưu được tên. Tên có thể trùng hoặc kết nối bị gián đoạn."); }
      finally { renameLock.current = false; setSaving(false); }
    }}>
      <label>Tên cuộc trò chuyện<input autoFocus required maxLength={200} value={name} disabled={actionsDisabled}
        onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Escape" && !saving) finishRename(); }} /></label>
      {renameError && <p role="alert">{renameError}</p>}
      <button type="submit" disabled={actionsDisabled || !name.trim()}>{saving ? "Đang lưu…" : "Lưu tên"}</button>
      <button type="button" disabled={saving} onClick={() => { if (!saving) finishRename(); }}>Hủy</button>
    </form>}
    <div className="sidebar-top">
      <button type="button" className="tool-icon" onClick={props.onToggle} aria-label="Thu gọn thanh bên" title="Thu gọn thanh bên">
        <WorkbenchIcon name="sidebar" />
      </button>
      <BrandMark active={props.modelActive} /><strong className="sidebar-brand">AI for Boss</strong>
    </div>
    <nav className="sidebar-navigation" aria-label="Bàn làm việc">
      <button type="button" className="sidebar-nav-item" disabled={props.disabled}
        onClick={() => { if (!props.disabled) props.onNewSession(); }}><WorkbenchIcon name="new" /><span>Phiên mới</span></button>
      {navigation.map(([view, label]) => <button type="button" key={view}
        className={`sidebar-nav-item${props.activeView === view ? " sidebar-nav-item--active" : ""}`}
        aria-current={props.activeView === view ? "page" : undefined} disabled={props.disabled}
        onClick={() => { if (!props.disabled) props.onNavigate(view); }}><WorkbenchIcon name={view} />
        <span>{label}</span></button>)}
    </nav>
    <label className="sidebar-search"><WorkbenchIcon name="search" /><span className="sr-only">Tìm phiên</span>
      <input type="search" placeholder="Tìm phiên…" value={search} onChange={(event) => setSearch(event.target.value)} />
    </label>
    <div className="sidebar-scroll session-list" aria-label="Danh sách cuộc trò chuyện">
      <section className="sidebar-section" aria-label="Đã ghim">
        <h2><WorkbenchIcon name="pin" />Đã ghim</h2>
        {pinned.map(row)}
        {!pinned.length ? <p className="sidebar-empty">{query ? "Không có phiên ghim phù hợp." : "Mở dấu ba chấm của cuộc trò chuyện để ghim."}</p> : null}
      </section>
      <section className="sidebar-section" aria-label="Dự án và phiên">
        <h2><WorkbenchIcon name="projects" />Dự án</h2>
        {!query || home.length ? <div className="sidebar-project">
          <button type="button" className="sidebar-project__title" disabled={props.disabled}
            onClick={() => { if (!props.disabled) props.onNavigate("chat"); }}><WorkbenchIcon name="home" /><span>Trang chủ</span></button>
          {home.map(row)}
        </div> : null}
        {props.projects.map((project) => {
          const rows = unpinned.filter((session) => session.projectId === project.id);
          if (query && !rows.length) return null;
          return <div key={project.id} className="sidebar-project" data-project-id={project.id}>
            <button type="button" className="sidebar-project__title" title={project.displayName} disabled={props.disabled}
              onClick={() => { if (!props.disabled) props.onOpenProject(project); }}>
              <WorkbenchIcon name="projects" /><span>{project.displayName}</span>
            </button>
            {rows.map(row)}
          </div>;
        })}
        {orphaned.length ? <div className="sidebar-project"><p className="sidebar-project__missing">Dự án chưa tải</p>{orphaned.map(row)}</div> : null}
        {!filtered.length ? <p className="sidebar-empty" role="status">{query ? "Không tìm thấy phiên phù hợp." : "Các phiên sẽ xuất hiện ở đây."}</p> : null}
      </section>
    </div>
    <footer className="sidebar-footer">
      <button type="button" className="tool-icon" title="Trang chủ" aria-label="Trang chủ" disabled={props.disabled}
        onClick={() => { if (!props.disabled) props.onNavigate("chat"); }}><WorkbenchIcon name="home" /></button>
      <span>Built on OpenClaw</span>
      <button type="button" className="tool-icon" title="Cài đặt" aria-label="Cài đặt"
        onClick={() => props.onNavigate("settings")}><WorkbenchIcon name="settings" /></button>
    </footer>
  </>;
}
