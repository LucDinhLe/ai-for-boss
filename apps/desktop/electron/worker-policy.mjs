import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const unavailable = () => new Error('Chưa xác nhận được quyền an toàn của phiên. Yêu cầu chưa được gửi; hãy thử lại khi Gateway sẵn sàng.');
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keyPattern = /^agent:([a-z0-9][a-z0-9_-]{0,63}):[^\s\0]{1,4000}$/u;
const samePath = (left, right) => typeof left === 'string' && (process.platform === 'win32'
  ? path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase() : path.resolve(left) === path.resolve(right));

/** Only the host adapter constructs this before calling the worker send RPC. */
export class WorkerNotSubmittedError extends Error {
  constructor(error) { super(error?.message || 'Yêu cầu chưa được gửi đến mô hình.'); this.code = 'AIFB_WORKER_NOT_SUBMITTED'; }
}

/** Fixed host policy for this app's owned Gateway. Never a generic config bridge. */
export class WorkerPolicy {
  #tail = Promise.resolve();
  constructor({ request, configPath, backupPath }) { Object.assign(this, { request, configPath, backupPath }); }
  ensure(sessionKey) {
    if (sessionKey !== undefined && !keyPattern.test(sessionKey)) return Promise.reject(unavailable());
    const work = this.#tail.then(() => this.#ensure(sessionKey));
    this.#tail = work.catch(() => {}); return work;
  }
  #snapshot(value) {
    if (!record(value) || value.valid !== true || !samePath(value.path, this.configPath)
      || !record(value.config) || typeof value.hash !== 'string' || !value.hash) throw unavailable();
    const deny = value.config.tools?.deny;
    if (deny !== undefined && (!Array.isArray(deny) || deny.length > 2048 || deny.some(item => typeof item !== 'string' || item.length > 512))) throw unavailable();
    return { deny: deny ?? [], existed: deny !== undefined, hash: value.hash,
      applied: typeof value.configRevisionHash === 'string' && value.configRevisionHash.length > 0 && value.appliedConfigHash === value.configRevisionHash };
  }
  async #ensure(sessionKey) {
    let current = this.#snapshot(await this.request('config.get', {}));
    if (!current.deny.includes('*')) {
      // Save the prior policy only: never copy provider keys, paths or full config.
      if (!this.backupPath) throw unavailable();
      try {
        await writeFile(this.backupPath, JSON.stringify({ version: 1, recordedAt: new Date().toISOString(),
          source: 'OpenClaw config.get', hash: current.hash, toolsDeny: current.existed ? current.deny : null }, null, 2), { flag: 'wx', mode: 0o600 });
      } catch (error) { if (error.code !== 'EEXIST') throw unavailable(); }
      await this.request('config.patch', { raw: JSON.stringify({ tools: { deny: [...current.deny, '*'] } }), baseHash: current.hash,
        note: 'AI for Boss: enforce the current worker tool gate.' });
      current = this.#snapshot(await this.request('config.get', {}));
    }
    if (!current.applied || !current.deny.includes('*')) throw unavailable();
    if (sessionKey !== undefined) {
      const before = (await this.request('sessions.describe', { key: sessionKey }))?.session;
      if (before?.key !== sessionKey || typeof before.sessionId !== 'string') throw unavailable();
      if (before.permissionMode !== 'read-only') {
        await this.request('sessions.patch', { key: sessionKey, expectedSessionId: before.sessionId,
          expectedPermissionMode: before.permissionMode ?? null, permissionMode: 'read-only' });
        const after = (await this.request('sessions.describe', { key: sessionKey }))?.session;
        if (after?.key !== sessionKey || after.sessionId !== before.sessionId || after.permissionMode !== 'read-only') throw unavailable();
      }
      const inventory = await this.request('tools.effective', { sessionKey, agentId: keyPattern.exec(sessionKey)[1] });
      if (!record(inventory) || inventory.agentId !== keyPattern.exec(sessionKey)[1] || !Array.isArray(inventory.groups)
        || (inventory.sessionKey !== undefined && inventory.sessionKey !== sessionKey)
        || inventory.groups.some(group => !Array.isArray(group.tools) || group.tools.some(tool => tool.deniedBySession !== true))) throw unavailable();
    }
    return { verified: true, toolsAllowed: 0, permissionMode: 'read-only', sandbox: false };
  }
}

export function restrictSessionCreate(params, allowCwd = false) {
  if (!record(params) || Object.keys(params).some(key => !['key', 'agentId', 'model', 'projectId', 'displayName', 'permissionMode', ...(allowCwd ? ['cwd'] : [])].includes(key))
    || (params.permissionMode !== undefined && params.permissionMode !== 'read-only')) throw unavailable();
  return { ...params, permissionMode: 'read-only' };
}

/** Renderer writes may change presentation/model, never execution or routing. */
export function restrictSessionPatch(params) {
  if (!record(params) || Object.keys(params).some(key => !['key', 'agentId', 'expectedSessionId', 'expectedLifecycleRevision', 'model', 'contextWindow', 'label', 'pinned', 'icon', 'color'].includes(key))
    || (params.agentId !== undefined && keyPattern.exec(params.key)?.[1] !== params.agentId)) throw unavailable();
  return params;
}
