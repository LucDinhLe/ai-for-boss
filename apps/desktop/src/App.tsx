import { useEffect, useMemo, useState } from "react";

type Locale = "vi" | "en";
type Theme = "light" | "dark";

const fallbackStatus: ShellStatus = {
  schemaVersion: "0.4.0",
  classification: "experimental-internal",
  product: {
    name: "AI for Boss",
    version: "0.0.0-dev",
    attribution: "Built on OpenClaw"
  },
  releaseTrain: {
    id: "loading",
    openclaw: "loading",
    electron: "loading",
    node: "loading",
    pnpm: "loading"
  },
  contractSummary: {
    capabilityFamilies: 0,
    advertisableCapabilities: 0,
    authModes: 0,
    sourcesOfTruth: 0,
    dataFlows: 0,
    threats: 0
  },
  featureState: {
    shell: "loading",
    gateway: "not-implemented",
    providerConnection: "not-implemented",
    agentGenesis: "not-implemented",
    advisor: "preview-only",
    tools: "blocked"
  }
};

const copy = {
  vi: {
    preview: "Bản nội bộ · Feature 0.4",
    newSession: "Phiên mới",
    team: "Đội Agent",
    approvals: "Hộp phê duyệt",
    files: "Tệp kết quả",
    recent: "PHIÊN GẦN ĐÂY",
    noSessions: "Chưa có phiên làm việc",
    workspace: "Không gian dự án",
    workspaceState: "Chưa cấp thư mục",
    headline: "Một nơi yên để giao việc lớn.",
    intro:
      "Khung ứng dụng đã sẵn sàng để nối lõi OpenClaw. Các kết nối và hành động thật vẫn được khóa cho tới đúng cổng kiểm thử.",
    taskPlaceholder: "Mô tả việc anh muốn hoàn thành…",
    unavailable: "Mở giao việc sau khi kết nối và khai sinh Agent",
    context: "NGỮ CẢNH HỆ THỐNG",
    contractReady: "Hợp đồng nền đã nạp",
    contractError: "Hợp đồng nền chưa sẵn sàng",
    capability: "nhóm năng lực đã ánh xạ",
    auth: "đường xác thực đã phân loại",
    data: "luồng dữ liệu đã khóa",
    threats: "nguy cơ đã truy vết",
    release: "Release train",
    honestState: "Chưa kết nối model, Gateway hoặc tool thật",
    step1: "Khung ứng dụng",
    step1Note: "Electron shell và biên an toàn",
    step2: "Kết nối & khai sinh",
    step2Note: "Sẽ mở ở trải nghiệm cốt lõi",
    step3: "Giao việc đầu tiên",
    step3Note: "Chờ runtime và quyền thật",
    ready: "ĐANG XÁC MINH",
    later: "CHƯA KHẢ DỤNG",
    theme: "Đổi giao diện",
    language: "Đổi ngôn ngữ",
    settings: "Trung tâm điều khiển chưa khả dụng",
    builtOn: "Built on OpenClaw"
  },
  en: {
    preview: "Internal build · Feature 0.4",
    newSession: "New session",
    team: "Agent team",
    approvals: "Approval inbox",
    files: "Result files",
    recent: "RECENT SESSIONS",
    noSessions: "No work sessions yet",
    workspace: "Project space",
    workspaceState: "No folder granted",
    headline: "A calm place for consequential work.",
    intro:
      "The application shell is ready for the OpenClaw core. Real connections and actions stay locked until their evidence gates pass.",
    taskPlaceholder: "Describe what you want to complete…",
    unavailable: "Task entry opens after connection and Agent Genesis",
    context: "SYSTEM CONTEXT",
    contractReady: "Foundation contracts loaded",
    contractError: "Foundation contracts unavailable",
    capability: "capability families mapped",
    auth: "authentication paths classified",
    data: "data flows locked",
    threats: "threats traced",
    release: "Release train",
    honestState: "No live model, Gateway, or tool is connected",
    step1: "Application shell",
    step1Note: "Electron shell and safety boundary",
    step2: "Connect & create",
    step2Note: "Opens with the core experience",
    step3: "First assignment",
    step3Note: "Waiting for runtime and real permissions",
    ready: "VERIFYING",
    later: "NOT AVAILABLE",
    theme: "Change theme",
    language: "Change language",
    settings: "Control center is not available yet",
    builtOn: "Built on OpenClaw"
  }
} as const;

function App() {
  const [locale, setLocale] = useState<Locale>("vi");
  const [theme, setTheme] = useState<Theme>("light");
  const [status, setStatus] = useState<ShellStatus>(fallbackStatus);
  const [bridgeReady, setBridgeReady] = useState(false);
  const text = copy[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
  }, [locale, theme]);

  useEffect(() => {
    let active = true;

    window.aiForBoss
      ?.getShellStatus()
      .then((nextStatus) => {
        if (active) {
          setStatus(nextStatus);
          setBridgeReady(nextStatus.releaseTrain.id !== "unavailable");
        }
      })
      .catch(() => {
        if (active) {
          setBridgeReady(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(
    () => [
      [status.contractSummary.capabilityFamilies, text.capability],
      [status.contractSummary.authModes, text.auth],
      [status.contractSummary.dataFlows, text.data],
      [status.contractSummary.threats, text.threats]
    ],
    [status, text]
  );

  return (
    <main className="app-shell">
      <aside className="left-panel" aria-label={locale === "vi" ? "Điều hướng" : "Navigation"}>
        <header className="brand-block">
          <div className="brand-glyph" aria-hidden="true">
            <span />
            <span />
          </div>
          <div>
            <strong>AI for Boss</strong>
            <small>{text.builtOn}</small>
          </div>
        </header>

        <nav className="primary-nav">
          <button className="nav-item active" type="button">
            <span className="nav-mark">＋</span>
            {text.newSession}
          </button>
          <button className="nav-item" type="button" disabled>
            <span className="nav-mark">◎</span>
            {text.team}
          </button>
          <button className="nav-item" type="button" disabled>
            <span className="nav-mark">◇</span>
            {text.approvals}
          </button>
          <button className="nav-item" type="button" disabled>
            <span className="nav-mark">□</span>
            {text.files}
          </button>
        </nav>

        <section className="session-list" aria-labelledby="recent-title">
          <p id="recent-title" className="eyebrow">
            {text.recent}
          </p>
          <p className="muted-copy">{text.noSessions}</p>
        </section>

        <footer className="workspace-block">
          <span className="workspace-symbol" aria-hidden="true">⌂</span>
          <span>
            <strong>{text.workspace}</strong>
            <small>{text.workspaceState}</small>
          </span>
        </footer>
      </aside>

      <section className="center-panel">
        <header className="topbar">
          <span className="preview-badge">{text.preview}</span>
          <div className="top-actions">
            <button
              type="button"
              className="quiet-button"
              aria-label={text.language}
              onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
            >
              {locale === "vi" ? "EN" : "VI"}
            </button>
            <button
              type="button"
              className="quiet-button"
              aria-label={text.theme}
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "◐" : "◑"}
            </button>
            <button type="button" className="quiet-button" aria-label={text.settings} disabled>
              ⚙
            </button>
          </div>
        </header>

        <div className="welcome-stage">
          <div className="editorial-rule" aria-hidden="true" />
          <p className="kicker">AI FOR BOSS</p>
          <h1>{text.headline}</h1>
          <p className="intro">{text.intro}</p>

          <ol className="journey" aria-label={locale === "vi" ? "Ba chặng" : "Three stages"}>
            <li className="current">
              <span className="step-number">01</span>
              <span className="step-copy">
                <strong>{text.step1}</strong>
                <small>{text.step1Note}</small>
              </span>
              <span className="step-state">{text.ready}</span>
            </li>
            <li>
              <span className="step-number">02</span>
              <span className="step-copy">
                <strong>{text.step2}</strong>
                <small>{text.step2Note}</small>
              </span>
              <span className="step-state">{text.later}</span>
            </li>
            <li>
              <span className="step-number">03</span>
              <span className="step-copy">
                <strong>{text.step3}</strong>
                <small>{text.step3Note}</small>
              </span>
              <span className="step-state">{text.later}</span>
            </li>
          </ol>
        </div>

        <div className="composer-shell" aria-disabled="true">
          <span className="composer-plus" aria-hidden="true">＋</span>
          <span>{text.taskPlaceholder}</span>
          <span className="composer-lock" aria-hidden="true">⌁</span>
          <small>{text.unavailable}</small>
        </div>
      </section>

      <aside className="right-panel" aria-label={locale === "vi" ? "Ngữ cảnh" : "Context"}>
        <header className="context-header">
          <p className="eyebrow">{text.context}</p>
          <span className={`health-dot ${bridgeReady ? "ready" : "degraded"}`} />
        </header>

        <section className="contract-card">
          <span className="contract-orbit" aria-hidden="true">
            <i />
          </span>
          <h2>{bridgeReady ? text.contractReady : text.contractError}</h2>
          <p>{text.honestState}</p>
        </section>

        <dl className="metrics-list">
          {metrics.map(([value, label]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section className="release-card">
          <p className="eyebrow">{text.release}</p>
          <strong>{status.releaseTrain.id}</strong>
          <span>OpenClaw {status.releaseTrain.openclaw}</span>
          <span>Electron {status.releaseTrain.electron}</span>
        </section>

        <footer className="classification">
          <span>INTERNAL</span>
          <p>{status.classification}</p>
        </footer>
      </aside>
    </main>
  );
}

export default App;
