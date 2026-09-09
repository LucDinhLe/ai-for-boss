import { loadModelCatalogue } from './model-catalogue.mjs';
import { modelSettings } from './model-settings.mjs';
const PREFIX = 'aifb-schedule:';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
function fields(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) throw new Error('Yêu cầu chưa hợp lệ.');
}
function text(value, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || [...value].some(c => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)))) throw new Error('Nội dung chưa hợp lệ.');
  return value.trim();
}
function bool(value) { if (typeof value !== 'boolean') throw new Error('Trạng thái chưa hợp lệ.'); return value; }
const display = (value, limit = 500) => typeof value === 'string' ? value.slice(0, limit) : '';
// Fixed read projections: never return config, command, arguments, endpoint, headers or environment.
export function mcpInventory(snapshot) {
  if (!snapshot?.config || typeof snapshot.config !== 'object' || Array.isArray(snapshot.config)) throw new Error('Chưa đọc được danh sách MCP.');
  const servers = snapshot?.config?.mcp?.servers;
  if (servers !== undefined && (!servers || typeof servers !== 'object' || Array.isArray(servers))) throw new Error('Chưa đọc được danh sách MCP.');
  return Object.entries(servers ?? {}).slice(0, 1000).map(([id, server]) => ({ id: display(id, 160),
    enabled: server?.enabled !== false, transport: ['stdio', 'http', 'sse', 'streamable-http'].includes(server?.transport) ? server.transport : server?.url ? 'http' : 'stdio' }));
}
export function pluginInventory(result) {
  if (!Array.isArray(result?.plugins)) throw new Error('Chưa đọc được danh sách plugin.');
  return result.plugins.slice(0, 2000).map(item => ({ id: display(item.id, 160), label: display(item.name, 160),
    description: display(item.description, 2000), installed: item.installed === true, enabled: item.enabled === true,
    state: ['enabled', 'disabled', 'not-installed', 'error'].includes(item.state) ? item.state : 'unknown', category: display(item.category, 80),
    version: display(item.version, 80), packageName: display(item.packageName, 200), origin: display(item.origin, 80),
    kinds: Array.isArray(item.kind) ? item.kind.filter(kind => typeof kind === 'string').slice(0, 20).map(kind => display(kind, 80)) : [] }));
}
export function pluginCatalogue(result) {
  return { plugins: pluginInventory(result), mutationAllowed: result.mutationAllowed === true,
    diagnosticCount: Array.isArray(result.diagnostics) ? result.diagnostics.length : 0 };
}
// tools.effective is a public read projection: it never starts or probes MCP transports.
export function toolInventory(result, scope = null) {
  if (!result || !Array.isArray(result.groups) || typeof result.agentId !== 'string'
    || (scope && (result.agentId !== scope.agentId || (result.sessionKey !== undefined && result.sessionKey !== scope.sessionKey)))) throw new Error('Chưa đọc được công cụ của phiên.');
  const sources = ['core', 'plugin', 'channel', 'mcp'];
  const tools = result.groups.slice(0, 100).flatMap(group => {
    if (!Array.isArray(group.tools)) throw new Error('Danh mục công cụ chưa đúng định dạng.');
    return group.tools.slice(0, 1000).map(item => {
      if (!item || typeof item.id !== 'string' || !sources.includes(item.source)) throw new Error('Công cụ chưa đúng định dạng.');
      return { id: display(item.id, 200), label: display(item.label, 200), description: display(item.description, 2000),
        source: item.source, group: display(group.label, 160), pluginId: display(item.pluginId, 160),
        channelId: display(item.channelId, 160), mcpServer: display(item.mcpServer, 160),
        deniedBySession: item.deniedBySession === true,
        risk: ['low', 'medium', 'high'].includes(item.risk) ? item.risk : 'unknown' };
    });
  }).slice(0, 2000);
  return { agentId: display(result.agentId, 160), sessionKey: scope?.sessionKey ?? null, effective: Boolean(scope),
    profile: display(result.profile, 160), tools,
    notices: Array.isArray(result.notices) ? result.notices.slice(0, 50).map(item => ({ id: display(item.id, 160),
      severity: item.severity === 'warning' ? 'warning' : 'info', message: display(item.message, 1000) })) : [] };
}
function agent(sessionKey) {
  const key = text(sessionKey, 4096), match = /^agent:([a-z0-9_-]+):.+$/u.exec(key);
  if (!match) throw new Error('Hãy mở một phiên trước.');
  return { agentId: match[1], sessionKey: key };
}
export function scheduleDraft(input) {
  fields(input, ['name', 'message', 'frequency', 'time', 'timeZone', 'enabled']);
  const time = /^(\d{2}):(\d{2})$/u.exec(input.time ?? '');
  if (!time || +time[1] > 23 || +time[2] > 59 || !['daily', 'weekdays', 'weekly'].includes(input.frequency)) throw new Error('Lịch chưa hợp lệ.');
  const tz = text(input.timeZone, 100);
  try { new Intl.DateTimeFormat('vi-VN', { timeZone: tz }).format(); } catch { throw new Error('Múi giờ chưa hợp lệ.'); }
  return { name: text(input.name), enabled: bool(input.enabled), schedule: {
    kind: 'cron', expr: `${+time[2]} ${+time[1]} * * ${input.frequency === 'weekdays' ? '1-5' : input.frequency === 'weekly' ? '1' : '*'}`, tz
  }, sessionTarget: 'isolated', wakeMode: 'next-heartbeat',
  payload: { kind: 'agentTurn', message: text(input.message, 12000), toolsAllow: [], timeoutSeconds: 120 },
  delivery: { mode: 'none' }, failureAlert: false };
}
export function isManagedJob(job) {
  return typeof job?.declarationKey === 'string' && uuid.test(job.declarationKey.slice(PREFIX.length))
    && job.declarationKey.startsWith(PREFIX) && job.sessionTarget === 'isolated'
    && job.payload?.kind === 'agentTurn' && Array.isArray(job.payload.toolsAllow) && job.payload.toolsAllow.length === 0
    && job.delivery?.mode === 'none' && !job.trigger && !job.delivery?.failureDestination
    && !job.delivery?.completionDestination && !job.failureAlert;
}

/** No arbitrary method, config, secret, path, tool or delivery destination crosses this boundary. */
export class NativeManagement {
  #busy = false;
  #wizard = null;
  constructor(request, catalogue) { this.request = request; this.catalogue = catalogue; }
  clear() { this.#wizard = null; }
  async run(input) {
    if (input?.action === 'model-catalogue') {
      fields(input, ['action', 'agentId', 'refresh'], ['action']);
      if (Object.hasOwn(input, 'agentId') && (typeof input.agentId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(input.agentId))) throw new Error('Agent chưa hợp lệ.');
      if (Object.hasOwn(input, 'refresh') && input.refresh !== true) throw new Error('Yêu cầu tải lại chưa hợp lệ.');
      return loadModelCatalogue(this.request, { ...(input.agentId ? { agentId: input.agentId } : {}), ...(input.refresh ? { refresh: true } : {}) });
    }
    if (input?.action === 'catalog') {
      fields(input, ['action']);
      return this.catalogue;
    }
    if (input?.action === 'plugin-inventory' || input?.action === 'mcp-inventory') {
      fields(input, ['action']);
      return input.action === 'plugin-inventory' ? pluginCatalogue(await this.request('plugins.list', {}))
        : { servers: mcpInventory(await this.request('config.get', {})) };
    }
    if (input?.action === 'tool-inventory') {
      fields(input, ['action', 'sessionKey'], ['action']);
      const scope = Object.hasOwn(input, 'sessionKey') ? agent(input.sessionKey) : null;
      return toolInventory(await this.request(scope ? 'tools.effective' : 'tools.catalog', scope ?? { includePlugins: true }), scope);
    }
    // Opening a skill chooser is a read, so it must not reserve the mutation lock.
    if (input?.action === 'session-skills' && !Object.hasOwn(input, 'skills')) return this.#run(input);
    if (this.#busy) throw new Error('Đang xử lý thao tác trước.');
    this.#busy = true;
    try { return await this.#run(input); } finally { this.#busy = false; }
  }
  async #run(input) {
    const request = this.request;
    switch (input?.action) {
      case 'model-settings':
      case 'model-settings-save': return modelSettings(request, input);
      case 'plugin-toggle': {
        fields(input, ['action', 'pluginId', 'enabled']);
        const pluginId = text(input.pluginId, 160), enabled = bool(input.enabled);
        const before = pluginCatalogue(await request('plugins.list', {}));
        const item = before.plugins.find(plugin => plugin.id === pluginId);
        if (!before.mutationAllowed) throw new Error('Bộ chạy hiện không cho phép thay đổi plugin.');
        if (!item?.installed) throw new Error('Chỉ có thể bật hoặc tắt plugin đã cài.');
        // Never accept a capability-review token or installation-policy override from the renderer.
        const result = await request('plugins.setEnabled', { pluginId, enabled });
        if (result?.ok !== true || result.plugin?.id !== pluginId || result.plugin.enabled !== enabled
          || typeof result.restartRequired !== 'boolean') throw new Error('Chưa xác nhận thay đổi plugin; hãy tải lại.');
        const after = pluginCatalogue(await request('plugins.list', {}));
        const actual = after.plugins.find(plugin => plugin.id === pluginId);
        if (!actual?.installed || actual.enabled !== enabled) throw new Error('Chưa xác nhận thay đổi plugin; hãy tải lại.');
        return { ok: true, plugin: actual, restartRequired: result.restartRequired,
          warnings: Array.isArray(result.warnings) ? result.warnings.filter(item => typeof item === 'string').slice(0, 20).map(item => display(item, 500)) : [] };
      }
      case 'session-skills': {
        fields(input, ['action', 'sessionKey', 'skills'], ['action', 'sessionKey']);
        const scope = agent(input.sessionKey);
        const [catalog, described, history] = await Promise.all([
          request('skills.status', { agentId: scope.agentId }), request('sessions.describe', { key: scope.sessionKey }),
          Object.hasOwn(input, 'skills') ? request('chat.history', { sessionKey: scope.sessionKey, limit: 1 }) : null]);
        const row = described.session;
        if (!row || row.key !== scope.sessionKey) throw new Error('Chưa tìm thấy cuộc trò chuyện.');
        const skills = (catalog.skills ?? []).filter(s => s.eligible && !s.disabled && !s.blockedByAllowlist && !s.blockedByAgentFilter)
          .map(s => ({ name: s.name, description: String(s.description ?? '').slice(0, 300) }));
        if (!Object.hasOwn(input, 'skills')) return { skills, selected: Object.entries(row.toolOverrides?.skills ?? {}).filter(([, yes]) => yes).map(([name]) => name) };
        if (history.inFlightRun) throw new Error('Chờ lượt hiện tại xong rồi đổi kỹ năng.');
        if (!Array.isArray(input.skills) || input.skills.length > 100 || input.skills.some(name => !skills.some(s => s.name === name))) throw new Error('Kỹ năng chưa sẵn sàng cho phiên này.');
        const before = row.toolOverrides ?? null, next = { ...(before ?? {}) };
        if (input.skills.length) next.skills = Object.fromEntries(skills.map(s => [s.name, input.skills.includes(s.name)]));
        else delete next.skills;
        const overlay = Object.keys(next).length ? next : null;
        await request('sessions.patch', { key: scope.sessionKey, expectedSessionId: row.sessionId,
          expectedToolOverrides: before, toolOverrides: overlay });
        const after = await request('sessions.describe', { key: scope.sessionKey });
        const actual = after.session?.toolOverrides?.skills ?? {};
        const selected = Object.entries(actual).filter(([, yes]) => yes).map(([name]) => name);
        if (JSON.stringify([...selected].sort()) !== JSON.stringify([...new Set(input.skills)].sort())
          || (!input.skills.length && Object.keys(actual).length)) throw new Error('Chưa xác nhận kỹ năng; hãy tải lại.');
        return { skills, selected };
      }
      case 'skill-toggle': {
        fields(input, ['action', 'sessionKey', 'skillKey', 'enabled']);
        const scope = agent(input.sessionKey), skillKey = text(input.skillKey), enabled = bool(input.enabled);
        const status = await request('skills.status', scope);
        const skill = status.skills?.find(item => (item.skillKey || item.name) === skillKey);
        if (!skill || skill.blockedByAllowlist || skill.blockedByAgentFilter) throw new Error('Kỹ năng không thuộc danh sách được phép.');
        if (enabled && Object.values(skill.missing ?? {}).some(value => Array.isArray(value) && value.length)) throw new Error('Hãy bổ sung điều kiện của kỹ năng trước.');
        await request('skills.update', { skillKey, enabled });
        const after = await request('skills.status', scope);
        const actual = after.skills?.find(item => (item.skillKey || item.name) === skillKey);
        if (!actual || actual.disabled === enabled) throw new Error('Chưa xác nhận thay đổi kỹ năng; hãy tải lại.');
        return { ok: true };
      }
      case 'channel-start':
      case 'channel-stop': {
        fields(input, ['action', 'channel', 'accountId']);
        const channel = text(input.channel), accountId = text(input.accountId);
        const status = await request('channels.status', { probe: false, channel });
        const row = status.channelAccounts?.[channel]?.find(account => account.accountId === accountId);
        if (!row || (input.action === 'channel-start' && row.configured !== true)) throw new Error('Tài khoản kênh chưa được thiết lập.');
        const starting = input.action === 'channel-start';
        const outcome = await request(starting ? 'channels.start' : 'channels.stop', { channel, accountId });
        const after = await request('channels.status', { probe: false, channel });
        const actual = after.channelAccounts?.[channel]?.find(account => account.accountId === accountId);
        const confirmed = Boolean(actual) && (starting ? actual.running === true : actual.running === false);
        const reason = display(outcome?.outcome?.reason, 300);
        return { ok: confirmed, running: actual?.running === true,
          status: confirmed ? starting ? 'started' : 'stopped' : ['retry', 'skipped'].includes(outcome?.outcome?.status) ? outcome.outcome.status : 'unconfirmed',
          reason, ...(!confirmed ? { error: starting ? 'Kênh chưa khởi động. Kiểm tra cấu hình và thử lại.' : 'Chưa xác nhận kênh đã dừng. Hãy tải lại trạng thái.' } : {}) };
      }
      case 'channel-setup': {
        fields(input, ['action', 'channel']);
        const channel = text(input.channel, 160), known = this.catalogue.channels.find(c => c.id === channel);
        if (!known) throw new Error('Kênh không nằm trong danh mục của bộ chạy.');
        if (!known.bundled) {
          const plugins = pluginInventory(await request('plugins.list', {}));
          if (!plugins.some(plugin => plugin.installed && (plugin.id === channel || (known.packageName && plugin.packageName === known.packageName)))) {
            throw new Error('Kênh này cần cài plugin trước khi kết nối.');
          }
        }
        if (this.#wizard) throw new Error('Hãy hoàn tất hoặc hủy hướng dẫn đang mở.');
        const result = await request('wizard.start', { flow: 'channels', channel });
        this.#wizard = result.done ? null : { id: result.sessionId, step: result.step };
        return result;
      }
      case 'channel-next':
      case 'channel-cancel': {
        fields(input, ['action', 'sessionId', 'answer'], ['action', 'sessionId']);
        if (!this.#wizard || input.sessionId !== this.#wizard.id) throw new Error('Hướng dẫn không thuộc cửa sổ này.');
        const params = { sessionId: this.#wizard.id };
        if (input.action === 'channel-next' && Object.hasOwn(input, 'answer')) {
          fields(input.answer, ['stepId', 'value']);
          const step = this.#wizard.step;
          if (!step || input.answer.stepId !== step.id) throw new Error('Bước hướng dẫn đã thay đổi.');
          const value = input.answer.value;
          if (JSON.stringify(value)?.length > 16384) throw new Error('Câu trả lời quá dài.');
          if (step.type === 'select' && !step.options?.some(o => JSON.stringify(o.value) === JSON.stringify(value))) throw new Error('Lựa chọn chưa hợp lệ.');
          if (step.type === 'text' && typeof value !== 'string') throw new Error('Cần nhập văn bản.');
          if (step.type === 'confirm' && typeof value !== 'boolean') throw new Error('Cần chọn đồng ý hoặc không.');
          params.answer = input.answer;
        }
        const result = await request(input.action === 'channel-cancel' ? 'wizard.cancel' : 'wizard.next', params);
        if (result.done || ['done', 'completed', 'cancelled', 'error'].includes(result.status)) this.#wizard = null;
        else this.#wizard.step = result.step ?? this.#wizard.step;
        return { ...result, sessionId: params.sessionId };
      }
      case 'cron-create': {
        fields(input, ['action', 'requestId', 'sessionKey', 'draft']);
        if (!uuid.test(input.requestId)) throw new Error('Mã yêu cầu chưa hợp lệ.');
        const scope = agent(input.sessionKey), draft = scheduleDraft(input.draft);
        const result = await request('cron.add', { ...draft, ...scope, declarationKey: PREFIX + input.requestId });
        const job = result.job ?? result;
        if (!job.id) throw new Error('Chưa xác nhận lịch; hãy tải lại trước khi thử tiếp.');
        return await request('cron.get', { id: job.id });
      }
      case 'cron-get':
      case 'cron-save':
      case 'cron-toggle':
      case 'cron-remove': {
        const allowed = ['action', 'id', 'sessionKey', ...(input.action === 'cron-save' ? ['draft'] : input.action === 'cron-toggle' ? ['enabled'] : [])];
        fields(input, allowed);
        const scope = agent(input.sessionKey), id = text(input.id);
        const raw = await request('cron.get', { id }), job = raw.job ?? raw;
        if (!isManagedJob(job) || job.agentId !== scope.agentId) throw new Error('Lịch này chỉ được xem; không phải lịch do trang này tạo cho tác nhân đang chọn.');
        if (input.action === 'cron-get') return job;
        const revision = job.configRevision ?? raw.configRevision;
        if (typeof revision !== 'string') throw new Error('Thiếu phiên bản lịch; hãy tải lại.');
        if (input.action === 'cron-remove') return await request('cron.remove', { id });
        const patch = input.action === 'cron-toggle' ? { enabled: bool(input.enabled) } : scheduleDraft(input.draft);
        await request('cron.update', { id, patch, expectedConfigRevision: revision });
        return await request('cron.get', { id });
      }
      default: throw new Error('Thao tác không được hỗ trợ.');
    }
  }
}
