import { randomUUID } from 'node:crypto';

const validKey = key => typeof key === 'string' && key.length > 0 && key.length <= 4096
  && [...key].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
const fields = (input, keys) => input && typeof input === 'object' && !Array.isArray(input)
  && Object.keys(input).every(key => keys.includes(key));

/** Host-owned confirmation receipts; never accepts native delete options from UI. */
export class ConversationService {
  #tickets = new Map();
  #busy = new Set();
  constructor(request, { now = Date.now } = {}) { this.request = request; this.now = now; }
  async #snapshot(key) {
    const result = await this.request('sessions.describe', { key });
    const row = result?.session;
    if (!row || row.key !== key || !validKey(row.sessionId) || !Number.isFinite(row.updatedAt)) throw new Error('Cuộc trò chuyện đã thay đổi hoặc không còn tồn tại. Hãy tải lại.');
    if (row.isMain || ['running', 'queued'].includes(row.status)) throw new Error('Không thể xóa phiên chính hoặc phiên đang làm việc.');
    const history = await this.request('chat.history', { sessionKey: key, limit: 1 });
    if (history?.inFlightRun || history?.sessionInfo?.hasActiveRun === true) throw new Error('Hãy dừng công việc trong cuộc trò chuyện trước khi xóa.');
    return row;
  }
  async run(input) {
    for (const [ticket, receipt] of this.#tickets) if (receipt.expires <= this.now()) this.#tickets.delete(ticket);
    if (input?.action === 'conversation-inspect' && fields(input, ['action', 'key']) && validKey(input.key)) {
      const row = await this.#snapshot(input.key), ticket = randomUUID();
      if (this.#tickets.size >= 64) this.#tickets.delete(this.#tickets.keys().next().value);
      this.#tickets.set(ticket, { key: row.key, sessionId: row.sessionId, updatedAt: row.updatedAt, expires: this.now() + 300000 });
      return { ticket, key: row.key, title: String(row.label || row.derivedTitle || row.displayName || 'Cuộc trò chuyện').slice(0, 300) };
    }
    if (input?.action !== 'conversation-delete' || !fields(input, ['action', 'ticket']) || typeof input.ticket !== 'string') throw new Error('Thao tác hội thoại chưa hợp lệ.');
    const receipt = this.#tickets.get(input.ticket);
    if (!receipt) throw new Error('Xác nhận đã hết hạn. Hãy chọn Xóa lại từ menu hội thoại.');
    if (this.#busy.has(receipt.key)) throw new Error('Đang xóa cuộc trò chuyện này.');
    this.#busy.add(receipt.key);
    try {
      const row = await this.#snapshot(receipt.key);
      if (row.sessionId !== receipt.sessionId || row.updatedAt !== receipt.updatedAt) throw new Error('Cuộc trò chuyện đã thay đổi. Hãy kiểm tra rồi xác nhận xóa lại.');
      // A receipt is one-use even when a response is lost: never replay deletion.
      this.#tickets.delete(input.ticket);
      const result = await this.request('sessions.delete', { key: row.key, expectedSessionId: row.sessionId,
        expectedSessionUpdatedAt: row.updatedAt, deleteTranscript: true });
      if (result?.ok !== true || result.key !== row.key || result.deleted !== true) throw new Error('Chưa xác nhận đã xóa. Hãy tải lại danh sách trước khi thử lại.');
      const after = await this.request('sessions.describe', { key: row.key });
      if (after?.session !== null) throw new Error('Chưa xác nhận đã xóa. Hãy tải lại danh sách.');
      return { ok: true, key: row.key, ...(result.worktreePreserved ? { warning: 'Đã xóa hội thoại; thư mục làm việc được giữ lại.' } : {}) };
    } finally { this.#busy.delete(receipt.key); }
  }
}
