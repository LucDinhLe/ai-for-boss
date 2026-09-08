/** Read-only projections over public Gateway methods; no filesystem or provider API. */
export type WorkspaceView = "chat" | "projects" | "agents" | "usage" | "skills" | "messages" | "artifacts" | "cron" | "settings";
export type ProjectSummary = { id: string; displayName: string; source?: string; agentId?: string; directory?: string };
type Row = Record<string, unknown>;
const object = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, max = 500): string => typeof value === "string" ? value.slice(0, max) : "";
const hasControl = (value: string) => [...value].some(character => character.charCodeAt(0) < 32);
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const rows = (value: unknown, max = 1000): Row[] => {
  if (!Array.isArray(value)) throw new Error("Dữ liệu trả về chưa đúng định dạng.");
  return value.slice(0, max).map(object);
};
async function read(method: string, params: Row = {}): Promise<Row> {
  const api = typeof window === "undefined" ? undefined : window.aiForBoss?.gateway;
  if (!api) throw new Error("Chưa kết nối bộ chạy.");
  return object(await api.request(method, params));
}
function key(value: string): string {
  if (!value || value.length > 4096 || hasControl(value)) throw new Error("Phiên chưa hợp lệ.");
  return value;
}
function agentParams(sessionKey: string | null): Row {
  const match = sessionKey?.match(/^agent:([^:]+):/);
  return match ? { agentId: match[1] } : {};
}
export async function listProjects(): Promise<ProjectSummary[]> {
  const result = await read("projects.list");
  return rows(result.projects).filter(row => text(row.id) && text(row.displayName)).map(row => ({
    id: text(row.id, 4096), displayName: text(row.displayName),
    ...(typeof row.source === "string" ? { source: text(row.source) } : {}),
    ...(typeof row.agentId === "string" ? { agentId: text(row.agentId) } : {})
  }));
}
export type UsageSummary = { startDate: string; endDate: string; sessions: number; totalTokens: number | null;
  input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null; totalCost: number | null; missingCostEntries: number | null; cacheStatus: string };
export async function readUsage(sessionKey: string | null): Promise<UsageSummary> {
  const result = await read("sessions.usage", { ...agentParams(sessionKey), range: "7d", mode: "specific",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, limit: 100, includeContextWeight: false });
  const totals = object(result.totals);
  return { startDate: text(result.startDate), endDate: text(result.endDate), sessions: rows(result.sessions).length,
    totalTokens: number(totals.totalTokens), input: number(totals.input), output: number(totals.output),
    cacheRead: number(totals.cacheRead), cacheWrite: number(totals.cacheWrite),
    totalCost: number(totals.totalCost), missingCostEntries: number(totals.missingCostEntries),
    cacheStatus: text(object(result.cacheStatus).status) };
}
export type SkillSummary = { id: string; name: string; description: string; eligible: boolean; disabled: boolean; blocked: boolean; source: string; missing: string[] };
export async function readSkills(sessionKey: string | null): Promise<SkillSummary[]> {
  const result = await read("skills.status", { ...agentParams(sessionKey), ...(sessionKey ? { sessionKey: key(sessionKey) } : {}) });
  return rows(result.skills).map((row, index) => ({ id: text(row.skillKey) || text(row.name) || String(index),
    name: text(row.name) || "Kỹ năng", description: text(row.description, 1500),
    disabled: row.disabled === true, blocked: row.blockedByAllowlist === true || row.blockedByAgentFilter === true, source: text(row.source),
    eligible: row.eligible === true && row.disabled !== true && row.blockedByAllowlist !== true && row.blockedByAgentFilter !== true,
    missing: Object.values(object(row.missing)).flatMap(value => Array.isArray(value)
      ? value.filter(item => typeof item === "string").slice(0, 20).map(item => text(item)) : []).slice(0, 30)
  }));
}
export type ChannelSummary = { id: string; channel: string; accountId: string; configured: boolean; running: boolean; label: string; account: string; status: string; error: string };
export async function readChannels(): Promise<{ channels: ChannelSummary[]; partial: boolean }> {
  const result = await read("channels.status", { probe: false });
  if (!Array.isArray(result.channelOrder)) throw new Error("Chưa đọc được trạng thái kênh.");
  const labels = object(result.channelLabels), snapshots = object(result.channels), accounts = object(result.channelAccounts);
  const ids = [...new Set([...result.channelOrder.filter(id => typeof id === "string"), ...Object.keys(snapshots), ...Object.keys(accounts)])];
  const channels = ids.slice(0, 100).flatMap(id => {
    const items = Array.isArray(accounts[id]) && accounts[id].length ? accounts[id] : [snapshots[id]];
    return items.slice(0, 50).map((value: unknown, index: number) => {
      const row = object(value);
      return { id: `${id}:${text(row.accountId) || index}`, channel: id, accountId: text(row.accountId), configured: row.configured === true, running: row.running === true, label: text(labels[id]) || id,
        account: text(row.name) || text(row.accountId), error: text(row.lastError, 500),
        status: row.connected === true ? "Đã kết nối" : row.running === true ? "Đang chạy"
          : row.configured === false ? "Chưa thiết lập" : row.configured === true ? "Đã thiết lập" : "Chưa có trạng thái" };
    });
  });
  return { channels, partial: result.partial === true };
}
export type CronJobSummary = { id: string; name: string; enabled: boolean; managed: boolean; scheduleKind: string;
  nextRunAtMs: number | null; lastRunAtMs: number | null; lastRunStatus: string; error: string };
export type CronPage = { jobs: CronJobSummary[]; total: number | null; nextOffset: number | null; hasMore: boolean };
export async function readCronPage(sessionKey: string | null, offset = 0): Promise<CronPage> {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Trang lịch chưa hợp lệ.");
  const result = await read("cron.list", { ...agentParams(sessionKey), includeDisabled: true, limit: 50, offset,
    compact: true, includeDeliveryPreviews: false });
  const next = number(result.nextOffset);
  return { jobs: rows(result.jobs, 50).map(row => ({ id: text(row.id), name: text(row.displayName) || text(row.name),
    enabled: row.enabled === true, managed: text(row.declarationKey).startsWith("aifb-schedule:"), scheduleKind: text(row.scheduleKind), nextRunAtMs: number(row.nextRunAtMs),
    lastRunAtMs: number(row.lastRunAtMs), lastRunStatus: text(row.lastRunStatus), error: text(row.lastRunError) })),
    total: number(result.total), hasMore: result.hasMore === true,
    nextOffset: result.hasMore === true && next !== null && Number.isSafeInteger(next) && next > offset ? next : null };
}
export async function readCronStatus(): Promise<{ enabled: boolean | null; jobs: number | null }> {
  const result = await read("cron.status");
  return { enabled: typeof result.enabled === "boolean" ? result.enabled : null, jobs: number(result.jobs) };
}
export type CronRunSummary = { id: string; status: string; timestamp: number | null; durationMs: number | null; summary: string; error: string };
export async function readCronRuns(jobId: string, sessionKey: string | null): Promise<{ runs: CronRunSummary[]; hasMore: boolean }> {
  const result = await read("cron.runs", { ...agentParams(sessionKey), scope: "job", id: key(jobId), limit: 20, offset: 0 });
  return { runs: rows(result.entries, 20).map((row, index) => ({ id: text(row.runId) || String(index), status: text(row.status),
    timestamp: number(row.ts), durationMs: number(row.durationMs), summary: text(row.summary, 1500), error: text(row.error) })), hasMore: result.hasMore === true };
}
export type SessionFile = { path: string; name: string; kind: "file" | "directory" | "symlink";
  modified: boolean; missing: boolean; size: number | null };
export type SessionFileList = { sessionKey: string; path: string; parentPath: string | null; entries: SessionFile[];
  files: SessionFile[]; truncated: boolean };
function files(value: unknown): SessionFile[] {
  return rows(value, 1000).filter(row => text(row.path, 4096) && text(row.name)).map(row => ({ path: text(row.path, 4096),
    name: text(row.name), kind: row.kind === "directory" ? "directory" : row.kind === "symlink" ? "symlink" : "file",
    modified: row.kind === "modified" || row.sessionKind === "modified", missing: row.missing === true, size: number(row.size) }));
}
export async function listSessionFiles(sessionKey: string, path = "", search = ""): Promise<SessionFileList> {
  if (path.length > 4096 || hasControl(path) || /(^[\\/]|:|(^|[\\/])\.\.([\\/]|$))/.test(path)) throw new Error("Thư mục chưa hợp lệ.");
  const result = await read("sessions.files.list", { sessionKey: key(sessionKey), path, ...(search.trim() ? { search: search.trim().slice(0, 200) } : {}) });
  if (result.sessionKey !== sessionKey) throw new Error("Tệp trả về không thuộc phiên đang xem.");
  const browser = object(result.browser);
  return { sessionKey, path: text(browser.path, 4096), parentPath: typeof browser.parentPath === "string" ? browser.parentPath : null,
    entries: browser.entries === undefined ? [] : files(browser.entries), files: files(result.files), truncated: browser.truncated === true };
}
export type FilePreview = { name: string; kind: "text" | "image" | "unsupported"; content: string; imageUrl: string | null };
export function projectFilePreview(raw: unknown): FilePreview {
  const row = object(raw), name = text(row.name) || "Tệp", content = typeof row.content === "string" ? row.content : "";
  if (row.missing === true) throw new Error("Tệp không còn tồn tại.");
  if (row.previewKind === "text" && row.contentEncoding === "utf8") {
    if (new TextEncoder().encode(content).length > 262144) throw new Error("Tệp vượt giới hạn xem trước.");
    return { name, kind: "text", content, imageUrl: null };
  }
  const mime = text(row.mimeType);
  if (row.previewKind === "image" && row.contentEncoding === "base64" && ["image/png", "image/jpeg", "image/gif", "image/webp"].includes(mime)) {
    if (!content || content.length > 349528 || content.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw new Error("Ảnh xem trước chưa hợp lệ.");
    const bytes = content.length / 4 * 3 - (content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0);
    if (bytes > 262144) throw new Error("Ảnh vượt giới hạn xem trước.");
    return { name, kind: "image", content: "", imageUrl: `data:${mime};base64,${content}` };
  }
  return { name, kind: "unsupported", content: "", imageUrl: null };
}
export async function getSessionFile(listing: SessionFileList, file: SessionFile): Promise<FilePreview> {
  if (file.kind !== "file" || file.missing || ![...listing.entries, ...listing.files].some(item => item.path === file.path && item.kind === "file")) throw new Error("Hãy chọn tệp từ danh sách của phiên.");
  const result = await read("sessions.files.get", { sessionKey: key(listing.sessionKey), path: file.path });
  if (result.sessionKey !== listing.sessionKey) throw new Error("Tệp trả về không thuộc phiên đang xem.");
  const returnedFile = object(result.file);
  if (returnedFile.path !== file.path && returnedFile.workspacePath !== file.path) throw new Error("Tệp trả về không khớp mục đã chọn.");
  return projectFilePreview(result.file);
}

export async function manage<T = Record<string, unknown>>(payload: unknown): Promise<T> {
  if (!window.aiForBoss?.management) throw new Error("Cầu nối quản lý chưa sẵn sàng.");
  return window.aiForBoss.management.request<T>(payload);
}
type CatalogueEntry = { id: string; label: string; description: string; bundled: boolean; packageName?: string };
export type NativeAuthMethod = { id: string; provider: string; method: string; label: string; hint: string; pluginId: string; docsPath: string;
  guidedSecret: boolean; guidedAuth: 'oauth' | 'device-code' | null; discovery: boolean; manualOnly: boolean; scopes: string[] };
export type NativeCatalogue = { version: string; channels: CatalogueEntry[]; providers: CatalogueEntry[]; plugins: CatalogueEntry[]; authMethods?: NativeAuthMethod[] };
export type PluginSummary = { id: string; label: string; description: string; installed: boolean; enabled: boolean;
  state: string; category: string; version: string; packageName: string; origin: string; kinds: string[] };
export type PluginCatalogue = { plugins: PluginSummary[]; mutationAllowed: boolean; diagnosticCount: number };
export type PluginToggleResult = { ok: true; plugin: PluginSummary; restartRequired: boolean; warnings: string[] };
export type ToolSummary = { id: string; label: string; description: string; source: 'core' | 'plugin' | 'channel' | 'mcp';
  group: string; pluginId: string; channelId: string; mcpServer: string; deniedBySession: boolean; risk: 'low' | 'medium' | 'high' | 'unknown' };
export type ToolInventory = { agentId: string; sessionKey: string | null; effective: boolean; profile: string; tools: ToolSummary[];
  notices: { id: string; severity: 'info' | 'warning'; message: string }[] };
export type ChannelActionResult = { ok: boolean; running: boolean; status: 'started' | 'stopped' | 'retry' | 'skipped' | 'unconfirmed'; reason: string; error?: string };
export type ScheduleDraft = { name: string; message: string; frequency: string; time: string; timeZone: string; enabled: boolean };
