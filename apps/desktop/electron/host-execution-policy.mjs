import path from 'node:path';

const error = () => new Error('Chưa xác nhận được quyền làm việc và cơ chế duyệt lệnh. Chưa gửi yêu cầu đến mô hình.');
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keyPattern = /^agent:([a-z0-9][a-z0-9_-]{0,63}):[^\s\0]{1,4000}$/u;
const normalizedPath = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const samePath = (a, b) => typeof a === 'string' && typeof b === 'string' && normalizedPath(a) === normalizedPath(b);
const strict = value => value?.security === 'allowlist' && value.ask === 'on-miss'
  && value.askFallback === 'deny' && value.autoAllowSkills === false;
const floor = { security: 'allowlist', ask: 'on-miss', askFallback: 'deny', autoAllowSkills: false };
const allow = ['read', 'write', 'edit', 'apply_patch', 'exec', 'process', 'web_search', 'web_fetch', 'image', 'pdf',
  'aifb_export_document', 'aifb_record_decision', 'agents_list', 'sessions_list', 'sessions_send', 'sessions_spawn', 'subagents'];

/** Host-owned policy. Native OpenClaw executes and binds commands; the shell never evals model output. */
export class HostExecutionPolicy {
  #tail = Promise.resolve();
  constructor({ request, configPath }) { Object.assign(this, { request, configPath }); }
  ensure(key) {
    if (key !== undefined && !keyPattern.test(key)) return Promise.reject(error());
    const work = this.#tail.then(() => this.#ensure(key)); this.#tail = work.catch(() => {}); return work;
  }
  async #approvals() {
    let snapshot = await this.request('exec.approvals.get', {});
    const valid = value => record(value?.file) && value.file.version === 1 && typeof value.hash === 'string' && value.hash.length > 0
      && (value.file.agents === undefined || record(value.file.agents) && Object.values(value.file.agents).every(record));
    if (!valid(snapshot)) throw error();
    if (!strict(snapshot.file.defaults) || Object.values(snapshot.file.agents ?? {}).some(value => !strict(value))) {
      const file = { ...snapshot.file, defaults: { ...snapshot.file.defaults, ...floor },
        agents: Object.fromEntries(Object.entries(snapshot.file.agents ?? {}).map(([id, value]) => [id, { ...value, ...floor }])) };
      await this.request('exec.approvals.set', { file, baseHash: snapshot.hash });
      snapshot = await this.request('exec.approvals.get', {});
    }
    if (!valid(snapshot) || !strict(snapshot.file.defaults) || Object.values(snapshot.file.agents ?? {}).some(value => !strict(value))) throw error();
  }
  async #ensure(key) {
    // Establish the fail-closed host floor BEFORE making any tool visible.
    await this.#approvals();
    let snapshot = await this.request('config.get', {});
    const valid = value => value?.valid === true && samePath(value.path, this.configPath)
      && record(value.config) && typeof value.hash === 'string';
    if (!valid(snapshot)) throw error();
    const matches = value => value?.tools?.exec?.host === 'gateway' && value.tools.exec.mode === 'auto' && value.tools.exec.strictInlineEval === true
      && value.tools.elevated?.enabled === false && JSON.stringify(value.tools.allow) === JSON.stringify(allow)
      && value.tools.agentToAgent?.enabled === true && JSON.stringify(value.tools.agentToAgent.allow) === '["*"]'
      && value.tools.sessions?.visibility === 'all'
      && JSON.stringify(value.agents?.defaults?.subagents?.allowAgents) === '["*"]'
      && Array.isArray(value.tools.deny) && !value.tools.deny.includes('*');
    if (!matches(snapshot.config)) {
      const deny = snapshot.config.tools?.deny ?? [];
      if (!Array.isArray(deny) || deny.some(item => typeof item !== 'string')) throw error();
      await this.request('config.patch', { baseHash: snapshot.hash, replacePaths: ['tools.deny', 'tools.allow'], raw: JSON.stringify({ tools: {
        profile: 'full', allow, deny: deny.filter(item => item !== '*'), elevated: { enabled: false },
        exec: { host: 'gateway', mode: 'auto', strictInlineEval: true }, agentToAgent: { enabled: true, allow: ['*'] }, sessions: { visibility: 'all' } },
        agents: { defaults: { subagents: { allowAgents: ['*'] } } } }), note: 'AI for Boss: workspace-scoped native automatic review with human fallback; strict inline evaluation, no sandbox or unrestricted execution.' });
      snapshot = await this.request('config.get', {});
    }
    if (!valid(snapshot) || !matches(snapshot.config) || !snapshot.configRevisionHash
      || snapshot.appliedConfigHash !== snapshot.configRevisionHash) throw error();
    if (key !== undefined) {
      let session = (await this.request('sessions.describe', { key }))?.session;
      if (session?.key !== key || typeof session.sessionId !== 'string') throw error();
      if (session.permissionMode !== 'workspace') {
        const id = session.sessionId;
        await this.request('sessions.patch', { key, expectedSessionId: id,
          expectedPermissionMode: session.permissionMode ?? null, permissionMode: 'workspace' });
        session = (await this.request('sessions.describe', { key }))?.session;
        if (session?.sessionId !== id || session?.key !== key) throw error();
      }
      if (session.permissionMode !== 'workspace') throw error();
    }
    return { verified: true, permissionMode: 'workspace', approval: 'native-auto-with-human-fallback', sandbox: false };
  }
}
