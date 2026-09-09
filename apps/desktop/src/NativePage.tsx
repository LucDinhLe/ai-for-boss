import { WorkbenchIcon } from './WorkspaceSidebar';
import { capabilityRole } from './capability-role';
import ChannelPanel from "./ChannelPanel";
import SchedulePanel from "./SchedulePanel";
import { useCallback, useEffect, useRef, useState } from "react";
import SessionFiles from "./SessionFiles";
import { readChannels, readCronPage, readCronRuns, readCronStatus, readSkills, readUsage, manage,
  type ProjectSummary, type WorkspaceView, type UsageSummary, type SkillSummary, type ChannelSummary,
  type CronPage, type CronRunSummary } from "./workbench-api";

type Props = { view: WorkspaceView; projects: ProjectSummary[]; ready: boolean; activeKey: string | null; mutationsDisabled?: boolean;
  onOpenProject: (project: ProjectSummary) => void; onRefreshProjects: () => void; onConnect: () => void; onUseSkill: (name: string) => void };
const titles: Partial<Record<WorkspaceView, string>> = { projects: "Dự án", usage: "Thống kê sử dụng", skills: "Kỹ năng",
  messages: "Nhắn tin", artifacts: "Tệp kết quả", cron: "Tác vụ định kỳ" };
const numeric = (value: number | null) => value === null ? "Chưa có dữ liệu" : value.toLocaleString("vi-VN");
const date = (value: number | null) => value === null ? "Chưa có" : new Date(value).toLocaleString("vi-VN");
const runStatus = (value: string) => ({ ok: "Hoàn tất", error: "Có lỗi", skipped: "Bỏ qua" }[value] ?? "Chưa có kết quả");

export default function NativePage(props: Props) {
  const { view, ready, activeKey, projects, onOpenProject, onRefreshProjects, onConnect } = props;
  if (view === "chat" || view === "settings") return null;
  return <section className="native-page" aria-label={titles[view]}>
    <header className="native-page-header"><h1><WorkbenchIcon name={view === "usage" ? "usage" : view === "skills" ? "skills" : view === "cron" ? "cron" : view === "messages" ? "messages" : "projects"} />{titles[view]}</h1></header>
    {!ready && view !== 'messages' ? <div className="empty-state"><p>Kết nối bộ chạy để xem dữ liệu.</p><button type="button" onClick={onConnect}>Thông tin kết nối</button></div>
      : view === "projects" ? <>
        <p className="page-description">Các dự án đã có trong runtime. Chọn một dự án để tạo phiên làm việc.</p>
        <button type="button" onClick={onRefreshProjects}>Tải lại dự án</button>
        <ul className="native-list">{projects.map(project => <li key={project.id}>
          <div><strong>{project.displayName}</strong><p>{project.source === "workspace" ? "Không gian làm việc" : "Dự án đã đăng ký"}</p></div>
          <button type="button" onClick={() => onOpenProject(project)}>Mở phiên mới</button>
        </li>)}</ul>{projects.length === 0 && <p className="empty-state">Chưa có dự án được đăng ký trong runtime.</p>}
      </> : view === "artifacts" ? <SessionFiles sessionKey={activeKey} ready={ready} mode="artifacts" />
        : <ReadPage key={`${view}:${activeKey ?? "default"}`} view={view} ready={ready} activeKey={activeKey} mutationsDisabled={props.mutationsDisabled} onUseSkill={props.onUseSkill} />}
  </section>;
}

type PageData = { usage?: UsageSummary; skills?: SkillSummary[]; channels?: ChannelSummary[]; partial?: boolean;
  cron?: CronPage; cronEnabled?: boolean | null };
function ReadPage({ view, ready, activeKey, mutationsDisabled, onUseSkill }: { view: WorkspaceView; ready: boolean; activeKey: string | null; mutationsDisabled?: boolean; onUseSkill: (name: string) => void }) {
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const [runs, setRuns] = useState<CronRunSummary[] | null>(null);
  const [runsTitle, setRunsTitle] = useState("");
  const [runsMore, setRunsMore] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [skillBusy, setSkillBusy] = useState(false);
  const skillLock = useRef(false);
  const runEpoch = useRef(0);
  const invalidate = useCallback(() => { runEpoch.current++; }, []);
  useEffect(() => {
    if (!ready) return;
    let current = true;
    const token = ++runEpoch.current;
    const load = async (): Promise<PageData> => {
      if (view === "usage") return { usage: await readUsage(activeKey) };
      if (view === "skills") return { skills: await readSkills(activeKey) };
      if (view === "messages") return await readChannels();
      if (view === "cron") {
        const [cron, status] = await Promise.all([readCronPage(activeKey, offset), readCronStatus()]);
        return { cron, cronEnabled: status.enabled };
      }
      return {};
    };
    void load().then(result => { if (current && token === runEpoch.current) { setData(result); setLoading(false); } }).catch(() => {
      if (current && token === runEpoch.current) { setError("Chưa đọc được dữ liệu. Bạn có thể tải lại khi kết nối ổn định."); setLoading(false); }
    });
    return () => { current = false; invalidate(); };
  }, [view, ready, activeKey, offset, revision, invalidate]);
  const reload = (nextOffset = 0) => {
    runEpoch.current++;
    // A channel wizard can restart the Gateway or open WhatsApp QR after saving.
    // Keep its component alive while refreshing account readback, not across navigation.
    if (view !== 'messages') setData(null);
    setError(""); setLoading(true); setRuns(null); setRunsTitle("");
    setRunsLoading(false); setSkillBusy(false); setOffset(nextOffset); setRevision(value => value + 1);
  };
  const showRuns = async (id: string, name: string) => {
    const token = ++runEpoch.current;
    setRuns(null); setRunsTitle(name); setRunsLoading(true); setError("");
    try {
      const result = await readCronRuns(id, activeKey);
      if (token === runEpoch.current) { setRuns(result.runs); setRunsMore(result.hasMore); }
    } catch {
      if (token === runEpoch.current) setError("Chưa đọc được lịch sử của tác vụ này.");
    } finally { if (token === runEpoch.current) setRunsLoading(false); }
  };
  const toggleSkill = async (skill: SkillSummary) => {
    if (skillLock.current || !activeKey) return;
    skillLock.current = true; setSkillBusy(true); setError("");
    const token = runEpoch.current;
    try { await manage({ action: "skill-toggle", sessionKey: activeKey, skillKey: skill.id, enabled: skill.disabled }); if (token === runEpoch.current) reload(); }
    catch { if (token === runEpoch.current) setError("Chưa xác nhận thay đổi kỹ năng. Tải lại để xem trạng thái thực tế."); }
    finally { skillLock.current = false; if (token === runEpoch.current) setSkillBusy(false); }
  };
  const usage = data?.usage;
  return <div className="native-page-content">
    <button type="button" onClick={() => { if (ready) reload(); }} disabled={!ready || loading || skillBusy}>Tải lại</button>
    {!ready && <p role="status">Đang chờ kết nối lại. Thiết lập đang mở vẫn được giữ.</p>}
    {ready && loading && <p role="status">Đang đọc dữ liệu…</p>}
    {error && <p className="notice" role="alert">{error}</p>}
    {usage && <>
      <p className="page-description">Bảy ngày gần nhất · {usage.startDate} — {usage.endDate}. Số liệu lưu trong runtime, theo tác nhân của phiên đang chọn.</p>
      <dl className="native-stats"><div><dt>Tổng token</dt><dd>{numeric(usage.totalTokens)}</dd></div>
        <div><dt>Token đầu vào</dt><dd>{numeric(usage.input)}</dd></div><div><dt>Token đầu ra</dt><dd>{numeric(usage.output)}</dd></div>
        <div><dt>Token đọc từ prompt cache</dt><dd>{numeric(usage.cacheRead)}</dd></div><div><dt>Token ghi vào prompt cache</dt><dd>{numeric(usage.cacheWrite)}</dd></div>
        <div><dt>Phiên trong danh sách</dt><dd>{usage.sessions}{usage.sessions === 100 ? "+" : ""}</dd></div>
        <div><dt>Chi phí ghi nhận, USD</dt><dd>{usage.totalCost === null ? "Chưa có dữ liệu" : usage.totalCost.toLocaleString("vi-VN", { maximumFractionDigits: 4 })}</dd></div></dl>
      <p>Chi phí là số liệu ước tính/ghi nhận của runtime, không phải hóa đơn hay hạn mức tài khoản.</p>
      {usage.missingCostEntries !== 0 && <p className="notice">Dữ liệu giá chưa đầy đủ; tổng chi phí có thể thiếu.</p>}
      {usage.cacheStatus && usage.cacheStatus !== "fresh" && <p role="status">Số liệu đang được cập nhật hoặc chưa đầy đủ. Có thể tải lại sau.</p>}
    </>}
    {data?.skills && <>
      <p className="page-description">Kỹ năng hiện có của tác nhân đang chọn. Bật/tắt áp dụng cho toàn bộ bộ chạy; điều kiện công cụ và quyền sử dụng vẫn được giữ nguyên.</p>
      <p className="page-description">Có kỹ năng chưa đồng nghĩa thực hiện được mọi thao tác. Kỹ năng chỉ dùng công cụ phiên được cấp; thực thi trên máy và tự thao tác website chưa được mở trong bản nội bộ này.</p>
      <input aria-label="Lọc kỹ năng" placeholder="Tìm kỹ năng…" value={filter} onChange={event => setFilter(event.target.value)} />
      <ul className="native-list">{data.skills.filter(skill => `${skill.name} ${skill.description}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(skill => <li key={skill.id}>
        <div><strong><WorkbenchIcon name="skills" />{skill.name}</strong><p>{capabilityRole(`${skill.name} ${skill.description}`)}</p><details><summary>Mô tả từ OpenClaw</summary><p>{skill.description}</p></details><small>Nguồn: {skill.source || "OpenClaw"}</small><br /><small>{skill.missing.length ? `Cần bổ sung: ${skill.missing.join(", ")}` : ""}</small></div>
        <div className="capability-options"><span className="status-label">{skill.blocked ? "Bị giới hạn" : skill.disabled ? "Đang tắt" : skill.eligible ? "Đủ điều kiện" : "Cần thiết lập"}</span>
          <button type="button" disabled={skillBusy || !activeKey || skill.blocked || (skill.disabled && skill.missing.length > 0)} onClick={() => void toggleSkill(skill)}>{skill.disabled ? "Bật kỹ năng" : "Tắt kỹ năng"}</button>
          <button type="button" disabled={skillBusy || !activeKey || !skill.eligible} onClick={() => onUseSkill(skill.name)}>Dùng trong chat</button></div>
      </li>)}</ul>{data.skills.length === 0 && <p className="empty-state">Chưa có kỹ năng được báo về.</p>}
      <p>Kỹ năng thiếu phần mềm, tài khoản hoặc không hỗ trợ Windows sẽ ghi điều kiện ở trên. Bản này chưa tự cài phần mềm phụ thuộc.</p>
    </>}
    {data?.channels && <>
      <ChannelPanel channels={data.channels} ready={ready} mutationsDisabled={mutationsDisabled} onRefresh={() => reload()} />
      {data.partial && <p role="status">Một phần trạng thái chưa đọc được.</p>}
    </>}
    {data?.cron && <>
      <SchedulePanel jobs={data.cron.jobs} sessionKey={activeKey} onRefresh={() => reload()} onShowRuns={(id, name) => void showRuns(id, name)} />
      <p className="page-description">{data.cronEnabled === false ? "Bộ chạy lịch đang tắt." : data.cronEnabled === true ? "Bộ chạy lịch đang bật." : "Chưa rõ trạng thái bộ chạy lịch."} Lịch và kết quả do OpenClaw quản lý.</p>
      {data.cron.jobs.some(job => !job.managed) && <h2><WorkbenchIcon name="cron" />Lịch từ OpenClaw</h2>}
      <ul className="native-list">{data.cron.jobs.filter(job => !job.managed).map(job => <li key={job.id}><div><strong><WorkbenchIcon name="cron" />{job.name}</strong>
        <p>{job.enabled ? "Đang bật" : "Đang tắt"} · Lần tới: {date(job.nextRunAtMs)}</p>
        <small>Lần trước: {date(job.lastRunAtMs)} · {runStatus(job.lastRunStatus)}</small>{job.error && <p className="notice">{job.error}</p>}</div>
        <button type="button" onClick={() => void showRuns(job.id, job.name)}><WorkbenchIcon name="files" />Xem lịch sử</button></li>)}</ul>
      {data.cron.jobs.length === 0 && <p className="empty-state">Chưa có tác vụ trong trang này.</p>}
      <div className="native-pagination">{offset > 0 && <button type="button" onClick={() => reload(Math.max(0, offset - 50))}>Trang trước</button>}
        <span>{data.cron.total === null ? "" : `${data.cron.total} tác vụ`}</span>
        {data.cron.nextOffset !== null && <button type="button" onClick={() => reload(data.cron!.nextOffset!)}>Trang tiếp</button>}
        {data.cron.hasMore && data.cron.nextOffset === null && <span>Còn dữ liệu; hãy tải lại để lấy trang kế tiếp.</span>}</div>
      {runsTitle && <section className="cron-history"><h2>Lịch sử: {runsTitle}</h2>{runsLoading && <p role="status">Đang đọc lịch sử…</p>}
        <ul className="native-list">{runs?.map(run => <li key={run.id}><div><strong>{runStatus(run.status)}</strong><p>{date(run.timestamp)}</p>
          {run.summary && <p>{run.summary}</p>}{run.error && <p className="notice">{run.error}</p>}</div></li>)}</ul>
        {runs?.length === 0 && <p>Chưa có lượt chạy được ghi nhận.</p>}{runsMore && runs && <p>Đang hiển thị 20 lượt gần nhất; còn lịch sử cũ hơn.</p>}
      </section>}
    </>}
  </div>;
}
