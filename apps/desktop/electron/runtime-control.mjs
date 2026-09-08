/** Only the host-owned Gateway; never accepts commands, paths or process IDs. */
export class RuntimeControl {
  #busy = false;
  constructor({ stop, resume, health, isPaused, available }) { Object.assign(this, { stop, resume, health, isPaused, available }); }
  async run(input) {
    if (!input || Object.keys(input).length !== 1 || !['gateway-stop', 'gateway-resume', 'gateway-health'].includes(input.action)) throw new Error('Thao tác Gateway chưa hợp lệ.');
    if (!this.available() || this.#busy) throw new Error('Gateway đang xử lý thao tác trước.');
    this.#busy = true;
    try {
      if (input.action === 'gateway-stop') { await this.stop(); return { stopped: true }; }
      if (input.action === 'gateway-resume') {
        if (!this.isPaused()) throw new Error('Gateway chưa tạm dừng.');
        if (!await this.resume()) throw new Error('Chưa kết nối lại được. Hãy thử tiếp tục lần nữa.');
        return { ready: true };
      }
      if (this.isPaused()) return { paused: true, responding: false, checkedAt: Date.now() };
      const result = await this.health();
      // Deliberately project only status; native admin health can contain account details.
      return { responding: true, healthy: result?.ok === true, checkedAt: Date.now() };
    } finally { this.#busy = false; }
  }
}
