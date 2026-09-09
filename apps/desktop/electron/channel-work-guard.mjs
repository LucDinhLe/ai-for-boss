import { WorkerNotSubmittedError } from './worker-policy.mjs';

const waitForWorker = () => new Error('Hãy chờ công việc hoàn tất hoặc dừng trước khi thay đổi kênh chat.');
const record = value => value && typeof value === 'object' && !Array.isArray(value);
function historyState(result) {
  if (!record(result) || !record(result.sessionInfo)) return result?.inFlightRun ? 'active' : 'unknown';
  const info = result.sessionInfo;
  if (result.inFlightRun || info.hasActiveRun === true || Array.isArray(info.activeRunIds) && info.activeRunIds.length) return 'active';
  return info.hasActiveRun === false || Array.isArray(info.activeRunIds) && info.activeRunIds.length === 0 ? 'idle' : 'unknown';
}

/** Serialize channel changes against local submissions and native run readback. */
export class ChannelWorkGuard {
  #sessions = new Map();
  #channelBusy = false;
  constructor({ requestHistory, otherBusy = () => false }) { Object.assign(this, { requestHistory, otherBusy }); }
  get busy() { return this.#channelBusy; }
  async send(key, operation) {
    if (this.#channelBusy) throw new WorkerNotSubmittedError(waitForWorker());
    if (typeof key !== 'string' || !key.trim()) throw new WorkerNotSubmittedError(new Error('Chưa xác định được cuộc trò chuyện.'));
    const state = this.#sessions.get(key) ?? { pending: 0, nativePossible: false };
    this.#sessions.set(key, state); state.pending++;
    try {
      const result = await operation();
      // A send acknowledgement confirms submission, not the end of its run.
      state.nativePossible = true;
      return result;
    } catch (error) {
      if (!(error instanceof WorkerNotSubmittedError)) state.nativePossible = true;
      throw error;
    } finally {
      state.pending--;
      if (!state.pending && !state.nativePossible && this.#sessions.get(key) === state) this.#sessions.delete(key);
    }
  }
  observeHistory(key, result) {
    if (typeof key !== 'string' || !key.trim()) return;
    const status = historyState(result), state = this.#sessions.get(key);
    if (status === 'active') {
      if (state) state.nativePossible = true;
      else this.#sessions.set(key, { pending: 0, nativePossible: true });
    } else if (status === 'idle' && !state?.pending) this.#sessions.delete(key);
  }
  assertExclusive() {
    if (!this.#channelBusy || this.otherBusy() || this.#sessions.size) throw waitForWorker();
  }
  async run(operation) {
    if (this.#channelBusy) throw new Error('Một thiết lập kênh chat đang được xử lý. Hãy chờ hoàn tất.');
    this.#channelBusy = true;
    try {
      if (this.otherBusy() || [...this.#sessions.values()].some(state => state.pending)) throw waitForWorker();
      for (const key of this.#sessions.keys()) {
        let result;
        try { result = await this.requestHistory(key); } catch { throw waitForWorker(); }
        if (historyState(result) !== 'idle') throw waitForWorker();
        this.observeHistory(key, result);
      }
      this.assertExclusive();
      return await operation();
    } finally { this.#channelBusy = false; }
  }
}
