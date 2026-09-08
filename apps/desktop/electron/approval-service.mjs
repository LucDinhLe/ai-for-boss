import { createHash } from 'node:crypto';
import { validateApprovalGetResult } from '@openclaw/gateway-protocol';
const invalid = () => new Error('Yêu cầu duyệt đã thay đổi hoặc hết hạn. Hãy tải lại.');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class ApprovalService {
  constructor(request) { this.request = request; }
  async pending(id) {
    const result = await this.request('approval.get', { id });
    if (!validateApprovalGetResult(result)) throw invalid();
    const row = result.approval;
    if (row.id !== id || row.status !== 'pending' || row.expiresAtMs <= Date.now() || row.presentation.kind !== 'exec') return null;
    const p = row.presentation;
    // Only the upstream reviewer-safe presentation crosses IPC. No env, cwd,
    // execution plan, raw argv or approval policy/socket credentials.
    if (p.commandText.length > 64000) throw invalid();
    const view = { id: row.id, sessionKey: row.sourceSessionKey ?? null, command: p.commandText,
      warning: p.warningText ?? null, host: p.host ?? null, agentId: p.agentId ?? null,
      expiresAtMs: row.expiresAtMs, canAllow: p.allowedDecisions.includes('allow-once') };
    return { ...view, revision: digest(view) };
  }
  async run(input) {
    if (input?.action === 'approval-list' && Object.keys(input).length === 1) {
      const rows = await this.request('exec.approval.list', {});
      if (!Array.isArray(rows) || rows.length > 500) throw invalid();
      const approvals = [];
      for (const row of rows) {
        if (typeof row?.id !== 'string' || row.id.length > 512) throw invalid();
        const view = await this.pending(row.id); if (view) approvals.push(view);
      }
      return { approvals };
    }
    if (input?.action !== 'approval-resolve' || Object.keys(input).sort().join(',') !== 'action,decision,id,revision'
      || typeof input.id !== 'string' || input.id.length > 512 || typeof input.revision !== 'string'
      || !['allow-once', 'deny'].includes(input.decision)) throw invalid();
    const current = await this.pending(input.id);
    if (!current || current.revision !== input.revision || input.decision === 'allow-once' && !current.canAllow) throw invalid();
    const result = await this.request('approval.resolve', { id: input.id, kind: 'exec', decision: input.decision });
    // The canonical native state, not the button click, decides the result.
    const after = await this.request('approval.get', { id: input.id });
    if (!validateApprovalGetResult(after) || after.approval.id !== input.id || after.approval.status === 'pending') throw invalid();
    void result;
    return { id: input.id, status: after.approval.status };
  }
}
