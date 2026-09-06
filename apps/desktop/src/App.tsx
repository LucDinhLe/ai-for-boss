import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  call,
  getRuntimeStatus,
  IDLE_STATUS,
  onGatewayEvent,
  onRuntimeStatus,
  readContextUsage,
  shortSessionKey,
  toTranscriptMessage,
  type ContextUsage,
  type ModelSummary,
  type RuntimeStatus,
  type SessionSummary,
  type TranscriptMessage
} from "./gateway-client";
import ConnectScreen from "./connect/ConnectScreen";

const SUPERVISOR_LABELS: Record<RuntimeStatus["supervisor"], string> = {
  idle: "Chưa khởi động",
  starting: "Đang khởi động",
  ready: "Đang chạy",
  restarting: "Đang khởi động lại",
  "safe-mode": "Chế độ an toàn"
};

const SUPERVISOR_DETAILS: Record<string, string> = {
  "node-runtime-missing": "Không tìm thấy Node runtime đi kèm.",
  "openclaw-package-missing": "Không tìm thấy gói OpenClaw đã cài.",
  "invalid-config": "Cấu hình OpenClaw không hợp lệ và không tự sửa được.",
  "restart-limit-reached": "Gateway dừng nhiều lần liên tiếp nên đã ngừng tự khởi động lại.",
  "spawn-failed": "Không khởi chạy được tiến trình OpenClaw."
};

function formatTokens(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}

function useRuntime() {
  const [status, setStatus] = useState<RuntimeStatus>(IDLE_STATUS);
  useEffect(() => {
    let active = true;
    getRuntimeStatus().then((initial) => {
      if (active) setStatus(initial);
    });
    const unsubscribe = onRuntimeStatus((next) => setStatus(next));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return status;
}

function ContextMeter({ usage }: { usage: ContextUsage }) {
  const ceiling = usage.contextTokens;
  const used = usage.usedTokens;
  const ratio = ceiling && used ? Math.min(used / ceiling, 1) : 0;
  const known = Boolean(ceiling && used !== null);
  const level = ratio >= 0.85 ? "high" : ratio >= 0.7 ? "warn" : "calm";

  return (
    <div className="context-meter" title="Dung lượng cửa sổ ngữ cảnh của phiên">
      <span className="context-meter__label">Ngữ cảnh</span>
      <span className="context-meter__track" aria-hidden="true">
        <span className={`context-meter__fill context-meter__fill--${level}`} style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="context-meter__value">
        {known
          ? `${formatTokens(used as number)} / ${formatTokens(ceiling as number)} · ${Math.round(ratio * 100)}%`
          : ceiling
            ? `chưa có số liệu / ${formatTokens(ceiling)}`
            : "chưa có số liệu"}
      </span>
    </div>
  );
}

function AdvisorSlot() {
  return (
    <div className="advisor-slot" aria-live="polite">
      <span className="advisor-slot__dot" aria-hidden="true" />
      <div>
        <strong>Advisor</strong>
        <p>
          Cổng kế hoạch và cổng nghiệm thu sẽ chạy trong một phiên rà soát riêng, chỉ đọc. Bản thử nghiệm 0 chưa bật
          Advisor; ô này giữ đúng chỗ của nó trong bố cục.
        </p>
      </div>
      <span className="advisor-slot__state">chưa bật</span>
    </div>
  );
}

function App() {
  const runtime = useRuntime();
  const [shell, setShell] = useState<ShellStatus | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [usage, setUsage] = useState<ContextUsage>({ usedTokens: null, contextTokens: null, model: null });
  const [draft, setDraft] = useState("");
  const [runState, setRunState] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectOffered, setConnectOffered] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  // Event handlers registered once still need the session the user is looking
  // at now, so the key is mirrored into a ref from an effect rather than during
  // render.
  const activeKeyRef = useRef<string | null>(null);

  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  useEffect(() => {
    window.aiForBoss?.getShellStatus().then(setShell).catch(() => setShell(null));
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const result = await call<{ sessions?: SessionSummary[]; items?: SessionSummary[] }>("sessions.list", {
        limit: 30,
        sortBy: "updatedAt"
      });
      setSessions(result.sessions ?? result.items ?? []);
    } catch (error) {
      setNotice(String((error as Error)?.message ?? error));
    }
  }, []);

  const loadHistory = useCallback(async (key: string) => {
    try {
      const history = await call<Record<string, unknown>>("chat.history", { sessionKey: key, limit: 200 });
      const raw = (history.messages ?? []) as Record<string, unknown>[];
      const mapped = raw
        .map((entry, index) => toTranscriptMessage(entry, `${key}-${index}`))
        .filter((entry): entry is TranscriptMessage => entry !== null);
      setMessages(mapped);
      setUsage(readContextUsage(history));
    } catch (error) {
      setNotice(String((error as Error)?.message ?? error));
    }
  }, []);

  const openSession = useCallback(
    async (key: string) => {
      setActiveKey(key);
      setMessages([]);
      setRunState(null);
      await call("sessions.messages.subscribe", { key }).catch(() => {});
      await loadHistory(key);
    },
    [loadHistory]
  );

  useEffect(() => {
    if (!runtime.connected) return;
    let cancelled = false;
    (async () => {
      await refreshSessions();
      try {
        const catalogue = await call<{ models?: ModelSummary[] }>("models.list");
        if (cancelled) return;
        const available = catalogue.models ?? [];
        setModels(available);
        // A first run on a clean machine has no provider, so every turn would
        // fail before reaching a model. Open the Connect screen once instead of
        // letting the person discover that by sending a message.
        if (available.length === 0 && !connectOffered) {
          setConnectOffered(true);
          setShowConnect(true);
        }
      } catch {
        if (!cancelled) setModels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runtime.connected, refreshSessions, connectOffered]);

  useEffect(() => {
    const unsubscribe = onGatewayEvent(({ event, payload }) => {
      if (!payload) return;
      const key = typeof payload.sessionKey === "string" ? payload.sessionKey : null;

      if (event === "session.message" && key && key === activeKeyRef.current) {
        const message = toTranscriptMessage(
          (payload.message ?? {}) as Record<string, unknown>,
          String(payload.messageId ?? Date.now())
        );
        if (!message) return;
        setMessages((current) =>
          current.some((entry) => entry.id === message.id) ? current : [...current, message]
        );
        return;
      }

      if (event === "chat" && key && key === activeKeyRef.current) {
        const state = typeof payload.state === "string" ? payload.state : null;
        setRunState(state);
        if (state === "error" && typeof payload.errorMessage === "string") {
          setNotice(payload.errorMessage);
        }
        if (state === "error" || state === "done" || state === "final") {
          setBusy(false);
          void loadHistory(key);
        }
        return;
      }

      if (event === "sessions.changed") {
        void refreshSessions();
      }
    });
    return unsubscribe;
  }, [loadHistory, refreshSessions]);

  useEffect(() => {
    const node = transcriptRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, runState]);

  const createSession = useCallback(async () => {
    setNotice(null);
    const key = `aifb-${Date.now().toString(36)}`;
    try {
      const created = await call<{ key: string }>("sessions.create", {
        key,
        displayName: "Phiên mới",
        label: key
      });
      await refreshSessions();
      await openSession(created.key ?? key);
    } catch (error) {
      setNotice(String((error as Error)?.message ?? error));
    }
  }, [openSession, refreshSessions]);

  const send = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const text = draft.trim();
      if (!text || !activeKey || busy) return;
      setDraft("");
      setBusy(true);
      setRunState("started");
      setMessages((current) => [
        ...current,
        { id: `local-${Date.now()}`, role: "user", content: text, timestamp: Date.now(), pending: true }
      ]);
      try {
        await call("sessions.send", { key: activeKey, message: text });
      } catch (error) {
        setBusy(false);
        setNotice(String((error as Error)?.message ?? error));
      }
    },
    [activeKey, busy, draft]
  );

  const abort = useCallback(async () => {
    if (!activeKey) return;
    await call("chat.abort", { sessionKey: activeKey }).catch(() => {});
    setBusy(false);
  }, [activeKey]);

  const availableModels = useMemo(() => models.filter((model) => model.available !== false), [models]);
  const supervisorLabel = SUPERVISOR_LABELS[runtime.supervisor] ?? runtime.supervisor;
  const supervisorDetail = runtime.detail ? (SUPERVISOR_DETAILS[runtime.detail] ?? runtime.detail) : null;

  if (showConnect) {
    return <ConnectScreen onDone={() => setShowConnect(false)} />;
  }

  return (
    <div className="workspace">
      <aside className="workspace__rail">
        <div className="brand-block">
          <span className="brand-glyph" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>
            <strong>AI for Boss</strong>
            <small>BUILT ON OPENCLAW</small>
          </span>
        </div>

        <div className="rail-actions">
          <button type="button" onClick={createSession} disabled={!runtime.connected}>
            Phiên mới
          </button>
          <button type="button" onClick={() => setShowConnect(true)} disabled={!runtime.setupReady}>
            {models.length === 0 ? "Kết nối model" : "Đổi kết nối"}
          </button>
        </div>

        <nav className="session-list" aria-label="Danh sách phiên">
          {sessions.length === 0 ? (
            <p className="empty-hint">
              {runtime.connected ? "Chưa có phiên nào. Bấm “Phiên mới” để bắt đầu." : "Đang chờ OpenClaw khởi động…"}
            </p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.key}
                type="button"
                className={session.key === activeKey ? "session-item session-item--active" : "session-item"}
                onClick={() => openSession(session.key)}
              >
                <strong>{session.displayName ?? session.label ?? shortSessionKey(session.key)}</strong>
                <small>{shortSessionKey(session.key)}</small>
              </button>
            ))
          )}
        </nav>
      </aside>

      <main className="workspace__main">
        <header className="workspace__header">
          <div>
            <h1>{activeKey ? shortSessionKey(activeKey) : "Chưa mở phiên"}</h1>
            <p>
              {runtime.connected
                ? `OpenClaw ${runtime.serverVersion ?? "?"} · giao thức v${runtime.protocol ?? "?"}`
                : supervisorLabel}
            </p>
          </div>
          <span className={`run-pill run-pill--${runState ?? "idle"}`}>
            {busy ? "Đang chạy" : runState === "error" ? "Lỗi" : "Sẵn sàng"}
          </span>
        </header>

        <AdvisorSlot />

        <div className="transcript" ref={transcriptRef}>
          {messages.length === 0 ? (
            <p className="empty-hint">
              Bản thử nghiệm 0 mở đúng một cửa sổ trò chuyện trên lõi OpenClaw thật. Chưa kết nối nhà cung cấp model nên
              lượt chạy sẽ báo lỗi thiếu khoá; đó là hành vi đúng ở bước này.
            </p>
          ) : (
            messages.map((message) => (
              <article key={message.id} className={`bubble bubble--${message.role}`}>
                <span className="bubble__role">{message.role === "user" ? "Bạn" : "Agent"}</span>
                <p>{message.content}</p>
              </article>
            ))
          )}
        </div>

        {notice ? (
          <div className="notice" role="status">
            <strong>Thông báo từ Gateway</strong>
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice(null)}>
              Đóng
            </button>
          </div>
        ) : null}

        <form className="composer" onSubmit={send}>
          <label className="sr-only" htmlFor="composer-input">
            Nội dung gửi cho agent
          </label>
          <textarea
            id="composer-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={activeKey ? "Giao việc cho agent…" : "Mở hoặc tạo một phiên trước khi giao việc"}
            disabled={!activeKey || !runtime.connected}
            rows={3}
          />
          <div className="composer__footer">
            <span className="model-pill">
              {usage.model ?? availableModels[0]?.id ?? "chưa có model khả dụng"}
            </span>
            <div className="composer__actions">
              {busy ? (
                <button type="button" onClick={abort}>
                  Dừng
                </button>
              ) : null}
              <button type="submit" disabled={!activeKey || !runtime.connected || draft.trim().length === 0}>
                Gửi
              </button>
            </div>
          </div>
        </form>

        <footer className="statusbar">
          <span className={`statusbar__dot statusbar__dot--${runtime.connected ? "ready" : runtime.supervisor}`} />
          <span>{supervisorLabel}</span>
          {supervisorDetail ? <span className="statusbar__detail">{supervisorDetail}</span> : null}
          <ContextMeter usage={usage} />
        </footer>
      </main>

      <aside className="workspace__panel">
        <h2>Trạng thái nền</h2>
        <dl>
          <dt>Gateway</dt>
          <dd>{runtime.connected ? "đã kết nối" : supervisorLabel}</dd>
          <dt>Phiên bản OpenClaw</dt>
          <dd>{runtime.serverVersion ?? "—"}</dd>
          <dt>Giao thức</dt>
          <dd>{runtime.protocol ? `v${runtime.protocol}` : "—"}</dd>
          <dt>Node runtime</dt>
          <dd className="mono">{runtime.nodeRuntime ?? "—"}</dd>
          <dt>Thư mục dữ liệu</dt>
          <dd className="mono">{runtime.stateDirectory ?? "—"}</dd>
          <dt>Model khả dụng</dt>
          <dd>{availableModels.length}</dd>
          <dt>Kênh cài đặt</dt>
          <dd>{runtime.setupReady ? "sẵn sàng" : "—"}</dd>
        </dl>

        <h2>Ranh giới của bản này</h2>
        <ul className="boundary-list">
          <li>Gateway chỉ nghe loopback, token sinh mới mỗi lần mở app.</li>
          <li>Giao diện không tự mở kết nối mạng; mọi lệnh đi qua danh sách cho phép ở tiến trình chính.</li>
          <li>Chưa bật tool, duyệt hành động, Advisor, dự án và bộ cài.</li>
        </ul>

        {shell ? (
          <p className="panel-footnote">
            {shell.product.name} {shell.product.version} · {shell.classification}
          </p>
        ) : null}

        {runtime.lastError ? <p className="panel-error">{runtime.lastError}</p> : null}
      </aside>
    </div>
  );
}

export default App;
