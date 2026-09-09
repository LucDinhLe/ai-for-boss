import { AdvisorService } from './advisor-service.mjs';
import { SupervisionService } from './supervision-service.mjs';

/** Each conversation owns its worker/reviewer lifecycle; global maintenance sees all jobs. */
export class SessionSupervision {
  #sessions = new Map();
  constructor(options, create = options => {
    const advisor = new AdvisorService(options);
    return { advisor, service: new SupervisionService({ ...options, advisor }) };
  }) { this.options = options; this.create = create; }
  run(input) {
    if (typeof input?.key !== 'string' || !/^agent:[a-z0-9_-]+:.{1,200}$/u.test(input.key)) throw new Error('Phiên giám sát không hợp lệ.');
    let entry = this.#sessions.get(input.key);
    if (!entry) { entry = this.create(this.options); this.#sessions.set(input.key, entry); }
    return entry.service.run(input);
  }
  status(key) {
    if (key !== undefined) return this.#sessions.get(key)?.service.status() ?? null;
    return [...this.#sessions.values()].map(entry => entry.service.status()).find(state => state?.busy) ?? null;
  }
  cancel(key) {
    if (!key) throw new Error('Cần chỉ rõ phiên để dừng giám sát.');
    return this.#sessions.get(key)?.service.cancel() ?? Promise.resolve({ stopped: true });
  }
  connectionRestored() { return Promise.allSettled([...this.#sessions.values()].map(entry => entry.advisor.connectionRestored())); }
  cancelForShutdown() { for (const entry of this.#sessions.values()) entry.advisor.cancelForShutdown(); }
  ownedRuntimeStopped() {
    for (const entry of this.#sessions.values()) { entry.advisor.ownedRuntimeStopped(); entry.service.ownedRuntimeStopped(); }
  }
}
