import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  approveGenesis,
  CONNECTION_FIXTURES,
  connectFixture,
  createInitialFirstRunState,
  createTaskDraft,
  PASSING_PROMOTION_CHECKS,
  verifyInternalInstall
} from "./first-run-machine.mjs";

type Locale = "vi" | "en";
type Theme = "light" | "dark";

const fallbackStatus: ShellStatus = {
  schemaVersion: "0.4.0",
  classification: "experimental-internal",
  product: { name: "AI for Boss", version: "0.0.0-dev", attribution: "Built on OpenClaw" },
  releaseTrain: { id: "loading", openclaw: "loading", electron: "loading", node: "loading", pnpm: "loading" },
  contractSummary: { capabilityFamilies: 0, advertisableCapabilities: 0, authModes: 0, sourcesOfTruth: 0, dataFlows: 0, threats: 0 },
  featureState: { shell: "loading", gateway: "not-implemented", providerConnection: "not-implemented", agentGenesis: "not-implemented", advisor: "preview-only", tools: "blocked" }
};

const copy = {
  vi: {
    badge: "TYPE C · NỘI BỘ · DỮ LIỆU GIẢ",
    preview: "Feature 0.5 · dữ liệu giả · experimental-internal",
    railTitle: "Ba bước để bắt đầu.",
    railBody: "Đi đủ hành trình bằng dữ liệu mô phỏng. Kết nối và hành động thật vẫn khóa.",
    steps: ["Cài đặt", "Kết nối & khai sinh", "Giao việc đầu tiên"],
    installKicker: "BƯỚC 1 · CÀI ĐẶT",
    installTitle: "Xác minh nền tảng trước khi đi tiếp.",
    installLead: "Bước này chỉ kiểm tra app shell và release train đã khóa. Bản hiện tại chưa phải installer, chưa ký số và chưa dành cho người dùng thật.",
    checks: ["Electron shell và biên renderer đã nạp", "Không có kết nối mạng từ renderer", "Gateway, OAuth và tool thật tiếp tục bị khóa"],
    verify: "Xác minh bản nội bộ",
    connectKicker: "BƯỚC 2 · KẾT NỐI VÀ KHAI SINH",
    connectTitle: "Chọn model giả, rồi đặt bản sắc cho Agent.",
    connectLead: "Mọi lựa chọn ở đây chỉ là fixture kiểm thử. Không nhập khóa, không gọi provider và không có dữ liệu rời máy.",
    mock: "MÔ PHỎNG · KHÔNG KẾT NỐI",
    fixture: "Model thử nghiệm",
    connect: "Dùng kết nối giả này",
    connected: "Đã chọn fixture",
    name: "Tên Agent",
    role: "Vai trò",
    tone: "Giọng điệu",
    address: "Cách xưng hô",
    boundary: "Ranh giới",
    birth: "Xác nhận bản sắc và tiếp tục",
    assignKicker: "BƯỚC 3 · GIAO VIỆC ĐẦU TIÊN",
    assignTitle: "Nói kết quả anh/chị muốn có.",
    assignLead: "Hệ thống chỉ tạo một bản giao việc nội bộ. Task không chạy, không gọi model và không trừ token.",
    task: "Mục tiêu công việc",
    taskPlaceholder: "Ví dụ: Lập kế hoạch ưu tiên cho tuần tới, gồm ba việc quan trọng nhất…",
    permissionTitle: "Trước khi giao việc",
    data: "Dữ liệu rời máy",
    none: "Không có",
    permissions: "Tool và quyền thật",
    budget: "Chi phí thật",
    zero: "0 token",
    create: "Tạo bản giao việc thử nghiệm",
    completeKicker: "HOÀN THÀNH BA BƯỚC",
    completeTitle: "Bản giao việc đầu tiên đã sẵn sàng để kiểm thử.",
    completeLead: "Đây là draft nội bộ. Gateway, OpenClaw runtime và Advisor chưa chạy.",
    advisor: "Advisor giữ hai checkpoint nền",
    advisorNote: "Chưa có runtime · không tự pass",
    plan1: "Phản biện kế hoạch trước hành động nhạy cảm.",
    plan2: "Kiểm tra đầu cuối trước khi bàn giao.",
    again: "Làm lại demo",
    context: "HỢP ĐỒNG AN TOÀN",
    genesis: "Agent Genesis",
    bootstrap: "BOOTSTRAP.md",
    reportReady: "Báo Agent sẵn sàng",
    gateway: "Gateway / OAuth",
    stateSource: "Nguồn trạng thái",
    retained: "Được giữ",
    removed: "Xóa cuối · chỉ mô phỏng",
    yesPreview: "Có · preview",
    no: "Không",
    unavailable: "Chưa kết nối",
    memoryOnly: "Demo trong bộ nhớ",
    contractError: "Shell contract chưa sẵn sàng. Hành trình giữ ở Bước 1.",
    formError: "Trạng thái chưa đủ an toàn để tiếp tục. Dữ liệu trước đó được giữ nguyên.",
    theme: "Đổi giao diện",
    language: "Đổi ngôn ngữ",
    builtOn: "Built on OpenClaw"
  },
  en: {
    badge: "TYPE C · INTERNAL · MOCK DATA",
    preview: "Feature 0.5 · mock data · experimental-internal",
    railTitle: "Three steps to begin.",
    railBody: "Complete the journey with simulated data. Live connections and actions stay locked.",
    steps: ["Install", "Connect & create", "First assignment"],
    installKicker: "STEP 1 · INSTALL",
    installTitle: "Verify the foundation before moving on.",
    installLead: "This step checks only the application shell and locked release train. The build is unsigned, is not an installer, and is not user-ready.",
    checks: ["Electron shell and renderer boundary loaded", "Renderer outbound network remains denied", "Gateway, OAuth, and real tools remain locked"],
    verify: "Verify internal build",
    connectKicker: "STEP 2 · CONNECT AND CREATE",
    connectTitle: "Choose a mock model, then shape your Agent.",
    connectLead: "Every choice here is a test fixture. Enter no key, call no provider, and send no data off-device.",
    mock: "SIMULATION · NOT CONNECTED",
    fixture: "Test model",
    connect: "Use this mock connection",
    connected: "Fixture selected",
    name: "Agent name",
    role: "Role",
    tone: "Tone",
    address: "How to address you",
    boundary: "Boundary",
    birth: "Confirm identity and continue",
    assignKicker: "STEP 3 · FIRST ASSIGNMENT",
    assignTitle: "Describe the outcome you want.",
    assignLead: "The system creates one internal assignment only. It runs no task, calls no model, and spends no tokens.",
    task: "Work objective",
    taskPlaceholder: "Example: Plan next week's priorities and identify the top three actions…",
    permissionTitle: "Before assignment",
    data: "Data leaving device",
    none: "None",
    permissions: "Real tools and permissions",
    budget: "Real cost",
    zero: "0 tokens",
    create: "Create test assignment",
    completeKicker: "THREE STEPS COMPLETE",
    completeTitle: "Your first assignment is ready for testing.",
    completeLead: "This is an internal draft. Gateway, OpenClaw runtime, and Advisor are not running.",
    advisor: "Advisor keeps two background checkpoints",
    advisorNote: "No runtime · never auto-passed",
    plan1: "Review the plan before sensitive action.",
    plan2: "Review the final result before handoff.",
    again: "Reset demo",
    context: "SAFETY CONTRACT",
    genesis: "Agent Genesis",
    bootstrap: "BOOTSTRAP.md",
    reportReady: "Report Agent ready",
    gateway: "Gateway / OAuth",
    stateSource: "State source",
    retained: "Retained",
    removed: "Removed last · simulation only",
    yesPreview: "Yes · preview",
    no: "No",
    unavailable: "Not connected",
    memoryOnly: "In-memory demo",
    contractError: "The shell contract is unavailable. The journey stays at Step 1.",
    formError: "The state is not safe to advance. Previous data was preserved.",
    theme: "Change theme",
    language: "Change language",
    builtOn: "Built on OpenClaw"
  }
} as const;

const defaultIdentity = {
  name: "Tôm",
  role: "Trợ lý điều hành",
  tone: "Rõ ràng, điềm tĩnh",
  userAddress: "Anh/chị",
  boundary: "Xin duyệt trước hành động nhạy cảm"
};

function App() {
  const [locale, setLocale] = useState<Locale>("vi");
  const [theme, setTheme] = useState<Theme>("light");
  const [status, setStatus] = useState<ShellStatus>(fallbackStatus);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [journey, setJourney] = useState(createInitialFirstRunState);
  const [fixtureId, setFixtureId] = useState(CONNECTION_FIXTURES[0].id);
  const [identity, setIdentity] = useState(defaultIdentity);
  const [goal, setGoal] = useState("");
  const text = copy[locale];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
  }, [locale, theme]);

  useEffect(() => {
    let active = true;
    window.aiForBoss?.getShellStatus().then((nextStatus) => {
      if (active) {
        setStatus(nextStatus);
        setBridgeReady(nextStatus.releaseTrain.id !== "unavailable");
      }
    }).catch(() => active && setBridgeReady(false));
    return () => { active = false; };
  }, []);

  const step = journey.stage === "INSTALL" ? 1 : journey.stage === "CONNECT" ? 2 : 3;
  const error = useMemo(() => {
    if (!journey.lastError) return null;
    return journey.lastError === "shell-contract-unavailable" ? text.contractError : text.formError;
  }, [journey.lastError, text]);

  function handleGenesis(event: FormEvent) {
    event.preventDefault();
    setJourney((current) => approveGenesis(current, identity, PASSING_PROMOTION_CHECKS));
  }

  function handleTask(event: FormEvent) {
    event.preventDefault();
    setJourney((current) => createTaskDraft(current, { requestId: "first-assignment-preview", goal }));
  }

  function resetDemo() {
    setJourney(createInitialFirstRunState());
    setIdentity(defaultIdentity);
    setGoal("");
  }

  return (
    <main className="first-run-shell">
      <aside className="journey-rail" aria-label={locale === "vi" ? "Hành trình khởi tạo" : "First-run journey"}>
        <header className="brand-block"><div className="brand-glyph" aria-hidden="true"><span /><span /></div><div><strong>AI for Boss</strong><small>{text.builtOn}</small></div></header>
        <section className="journey-intro"><span className="internal-badge">{text.badge}</span><h1>{text.railTitle}</h1><p>{text.railBody}</p></section>
        <ol className="stepper">
          {text.steps.map((title, index) => <li key={title} className={step === index + 1 ? "current" : step > index + 1 || journey.stage === "COMPLETE" ? "done" : ""}><span>0{index + 1}</span><strong>{title}</strong></li>)}
        </ol>
        <footer className="rail-footer"><span className={`health-dot ${bridgeReady ? "ready" : ""}`} /><div><strong>{status.releaseTrain.id}</strong><small>OpenClaw {status.releaseTrain.openclaw} · Electron {status.releaseTrain.electron}</small></div></footer>
      </aside>

      <section className="journey-main">
        <header className="topbar"><span className="preview-badge">{text.preview}</span><div className="top-actions"><button type="button" className="quiet-button" aria-label={text.language} onClick={() => setLocale(locale === "vi" ? "en" : "vi")}>{locale === "vi" ? "EN" : "VI"}</button><button type="button" className="quiet-button" aria-label={text.theme} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "◐" : "◑"}</button></div></header>
        <div className="stage-wrap">
          {journey.stage === "INSTALL" && <section className="stage-card" data-stage="install-check"><p className="kicker">{text.installKicker}</p><h2>{text.installTitle}</h2><p className="stage-lead">{text.installLead}</p><ul className="check-list">{text.checks.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul><button className="primary-button" type="button" onClick={() => setJourney((current) => verifyInternalInstall(current, bridgeReady))}>{text.verify}</button></section>}

          {journey.stage === "CONNECT" && <section className="stage-card wide" data-stage="connect-genesis"><span className="mock-banner">{text.mock}</span><p className="kicker">{text.connectKicker}</p><h2>{text.connectTitle}</h2><p className="stage-lead">{text.connectLead}</p>
            <div className="form-grid"><label className="span-2">{text.fixture}<select value={fixtureId} onChange={(event) => setFixtureId(event.target.value)}>{CONNECTION_FIXTURES.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixture.provider} · {fixture.model}</option>)}</select></label></div>
            {journey.connection.status !== "connected-fixture" ? <div className="form-actions"><span /><button className="primary-button" type="button" onClick={() => setJourney((current) => connectFixture(current, fixtureId))}>{text.connect}</button></div> : <form onSubmit={handleGenesis}><div className="agent-chip"><span aria-hidden="true">◌</span><div><strong>{text.connected}</strong><small>{text.mock}</small></div></div><div className="form-grid"><label>{text.name}<input required maxLength={200} value={identity.name} onChange={(event) => setIdentity({ ...identity, name: event.target.value })} /></label><label>{text.role}<input required maxLength={200} value={identity.role} onChange={(event) => setIdentity({ ...identity, role: event.target.value })} /></label><label>{text.tone}<input maxLength={200} value={identity.tone} onChange={(event) => setIdentity({ ...identity, tone: event.target.value })} /></label><label>{text.address}<input maxLength={200} value={identity.userAddress} onChange={(event) => setIdentity({ ...identity, userAddress: event.target.value })} /></label><label className="span-2">{text.boundary}<textarea maxLength={200} value={identity.boundary} onChange={(event) => setIdentity({ ...identity, boundary: event.target.value })} /></label></div><div className="form-actions"><span /><button className="primary-button" type="submit">{text.birth}</button></div></form>}
          </section>}

          {journey.stage === "ASSIGN" && <section className="stage-card" data-stage="first-assignment"><p className="kicker">{text.assignKicker}</p><h2>{text.assignTitle}</h2><p className="stage-lead">{text.assignLead}</p><form onSubmit={handleTask}><label className="task-field">{text.task}<textarea required maxLength={1200} autoFocus placeholder={text.taskPlaceholder} value={goal} onChange={(event) => setGoal(event.target.value)} /></label><section className="permission-preview"><h3>{text.permissionTitle}</h3><dl><div><dt>{text.data}</dt><dd>{text.none}</dd></div><div><dt>{text.permissions}</dt><dd>{text.none}</dd></div><div><dt>{text.budget}</dt><dd>{text.zero}</dd></div></dl></section><div className="form-actions"><span /><button className="primary-button" type="submit">{text.create}</button></div></form></section>}

          {journey.stage === "COMPLETE" && <section className="stage-card" data-stage="complete"><p className="kicker">{text.completeKicker}</p><h2>{text.completeTitle}</h2><p className="stage-lead">{text.completeLead}</p><article className="mock-plan"><header><span aria-hidden="true">◇</span><div><strong>{text.advisor}</strong><small>{text.advisorNote}</small></div></header><ol><li>{text.plan1}</li><li>{text.plan2}</li></ol></article><blockquote className="stage-lead">“{journey.task.draft?.goal}”</blockquote><button className="secondary-button" type="button" onClick={resetDemo}>{text.again}</button></section>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      </section>

      <aside className="safety-panel" aria-label={locale === "vi" ? "Hợp đồng an toàn" : "Safety contract"}><p className="eyebrow">{text.context}</p><div className="lock-orbit" aria-hidden="true"><span>⌁</span></div><dl className="safety-list"><div><dt>{text.genesis}</dt><dd>{journey.genesis.state}</dd></div><div><dt>{text.bootstrap}</dt><dd>{journey.genesis.bootstrapRetained ? text.retained : text.removed}</dd></div><div><dt>{text.reportReady}</dt><dd>{journey.genesis.reportReady ? text.yesPreview : text.no}</dd></div><div><dt>{text.gateway}</dt><dd>{text.unavailable}</dd></div><div><dt>{text.stateSource}</dt><dd>{text.memoryOnly}</dd></div><div><dt>Advisor plan / final</dt><dd>pending-runtime</dd></div></dl><footer><span>INTERNAL</span><p>{status.classification}<br />{text.mock}</p></footer></aside>
    </main>
  );
}

export default App;
