import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createChannelConfigForm } from './channel-config-form.mjs';

const optional = ['zalo', 'whatsapp', 'discord', 'googlechat'];
const configFormChannels = new Set(['zalo', 'whatsapp', 'discord', 'googlechat']);
export const PRIORITY_CHANNELS = Object.freeze(['telegram', ...optional]);
const actions = new Set(['channel-bundle-status', 'channel-setup', 'channel-next', 'channel-cancel',
  'channel-qr-start', 'channel-qr-wait', 'channel-qr-clear', 'channel-pairing-list', 'channel-pairing-approve', 'channel-pairing-dismiss']);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const display = (value, max = 1000) => typeof value === 'string' ? value.slice(0, max) : '';
function fields(value, allowed, required = allowed) {
  if (!record(value) || Object.keys(value).some(key => !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) throw new Error('Yêu cầu kênh chưa hợp lệ.');
}
function channel(value) { if (!PRIORITY_CHANNELS.includes(value)) throw new Error('Kênh chưa được hỗ trợ trong bản cài này.'); return value; }
function account(value) { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(value)) throw new Error('Tài khoản kênh chưa hợp lệ.'); return value; }
const samePath = (a, b) => typeof a === 'string' && typeof b === 'string' && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
function wizardResult(raw, id) {
  if (!record(raw)) throw new Error('Trình kết nối chưa phản hồi đúng.');
  const result = { sessionId: id, done: raw.done === true, status: display(raw.status, 30), error: display(raw.error, 1500) };
  if (raw.step) {
    const step = raw.step;
    if (typeof step.id !== 'string' || !['note', 'select', 'text', 'confirm', 'multiselect', 'progress', 'action'].includes(step.type)) throw new Error('Bước kết nối chưa được hỗ trợ.');
    result.step = { id: step.id, type: step.type, title: display(step.title, 300), message: display(step.message, 16000),
      sensitive: step.sensitive === true, placeholder: display(step.placeholder, 1000),
      multiline: step.multiline === true, confirmLabel: display(step.confirmLabel, 60), declineLabel: display(step.declineLabel, 60),
      ...step.sensitive ? {} : { initialValue: step.initialValue },
      ...(Array.isArray(step.options) ? { options: step.options.slice(0, 100).map(option => ({ value: option.value,
        label: display(option.label, 500), hint: display(option.hint, 1000) })) } : {}) };
    if (typeof step.externalUrl === 'string') {
      try { const url = new URL(step.externalUrl); if (url.protocol === 'https:' && !url.username && !url.password) result.step.externalUrl = url.href; } catch { /* No unsafe link. */ }
    }
  }
  if (Array.isArray(raw.accounts)) result.accounts = raw.accounts.filter(row => PRIORITY_CHANNELS.includes(row.channel)
    && typeof row.accountId === 'string').slice(0, 20).map(row => ({ channel: row.channel, accountId: row.accountId }));
  return result;
}
function qrResult(raw, ticket) {
  const png = typeof raw?.qrDataUrl === 'string' && raw.qrDataUrl.length <= 700000
    && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(raw.qrDataUrl) ? raw.qrDataUrl : null;
  return { ticket, connected: raw?.connected === true, qrDataUrl: png, message: display(raw?.message, 1000) };
}

/** Only the five shipped official channels; native core still owns configuration and authentication. */
export class ChannelSetupService {
  #wizard = null;
  #retiredWizards = new Set();
  #qr = null;
  #busy = false;
  #epoch = 0;
  #restarting = false;
  constructor({ request, bundleRoot, configPath, restartRuntime, installPlugin }) { Object.assign(this, { request, bundleRoot, configPath, restartRuntime, installPlugin }); }
  handles(input) {
    if (input?.action === 'channel-setup') return PRIORITY_CHANNELS.includes(input.channel);
    if (input?.action === 'channel-next') return Boolean(this.#wizard && input.sessionId === this.#wizard.id);
    if (input?.action === 'channel-cancel') return Boolean(this.#wizard && input.sessionId === this.#wizard.id) || this.#retiredWizards.has(input.sessionId);
    return actions.has(input?.action);
  }
  clear() {
    if (!this.#restarting) {
      if (this.#wizard?.form) { try { this.#wizard.form.cancel(); } catch { /* An already submitted config write must settle truthfully. */ } }
      else if (this.#wizard) this.#retiredWizards.add(this.#wizard.id);
      this.#epoch++; this.#wizard = null; this.#qr = null;
    }
  }
  async #cancelWizard(id) {
    if (this.#wizard?.id === id && this.#wizard.form) {
      this.#wizard.form.cancel(); this.#wizard = null; this.#epoch++;
      return { sessionId: id, done: true, status: 'cancelled', setupRoute: 'native-config' };
    }
    let raw;
    try { raw = await this.request('wizard.cancel', { sessionId: id }); }
    catch (error) {
      if (error?.details?.code !== 'WIZARD_NOT_FOUND' && !/^wizard not found$/iu.test(error?.message ?? '')) throw error;
      raw = { done: true, status: 'cancelled' };
    }
    const result = wizardResult(raw, id);
    if (result.done || ['cancelled', 'done', 'error'].includes(result.status)) {
      result.done = true; this.#retiredWizards.delete(id);
      if (this.#wizard?.id === id) { this.#wizard = null; this.#epoch++; }
    }
    return result;
  }
  async #bundle() {
    let marker;
    try {
      marker = JSON.parse(await fs.readFile(path.join(this.bundleRoot, 'channel-installer.json'), 'utf8'));
      await fs.access(path.join(this.bundleRoot, 'npm/node_modules/npm/bin/npm-cli.js'));
      await fs.access(path.join(this.bundleRoot, 'cache'));
    } catch { marker = null; }
    return optional.map(id => {
      const source = marker?.plugins?.find(row => row.id === id && row.name === `@openclaw/${id}` && row.version === '2026.9.1'
        && row.spec === `@openclaw/${id}@2026.9.1`);
      const available = marker?.coreVersion === '2026.9.1' && typeof source?.integrity === 'string' && source.integrity.startsWith('sha512-');
      const directory = this.bundleRoot && path.join(path.dirname(this.bundleRoot), 'channel-plugins/node_modules/@openclaw', id);
      return { id, available, directory, integrity: source?.integrity, version: available ? '2026.9.1' : null };
    });
  }
  async #restart() {
    if (!this.restartRuntime) throw new Error('Chưa thể tải lại kết nối sau khi chuẩn bị plugin.');
    this.#restarting = true;
    try { await this.restartRuntime(); } finally { this.#restarting = false; }
  }
  async #prepare(selected) {
    if (selected === 'telegram') return;
    const bundle = await this.#bundle();
    const shipped = bundle.find(row => row.id === selected);
    if (!shipped?.available) throw new Error('Bản cài thiếu plugin chính thức của kênh này.');
    const snapshot = await this.request('config.get', {});
    if (snapshot?.valid !== true || !record(snapshot.config) || !samePath(snapshot.path, this.configPath) || !snapshot.hash) throw new Error('Chưa đọc được cấu hình Gateway của ứng dụng.');
    const plugins = snapshot.config.plugins ?? {};
    if (plugins.enabled === false || plugins.deny?.includes(selected)) throw new Error('Plugin đang bị chặn trong chính sách Gateway.');
    const oldPaths = plugins.load?.paths ?? [];
    if (!Array.isArray(oldPaths) || oldPaths.some(value => typeof value !== 'string')) throw new Error('Đường dẫn plugin hiện tại chưa hợp lệ.');
    const paths = oldPaths.filter(value => !bundle.some(row => samePath(value, row.directory)));
    if (paths.length !== oldPaths.length) {
      this.#restarting = true;
      try {
        await this.request('config.patch', { baseHash: snapshot.hash, raw: JSON.stringify({ plugins: { load: { paths } } }) });
        await this.#restart();
      } finally { this.#restarting = false; }
    }
    const validSource = detail => detail?.plugin?.installed === true && detail.plugin.version === '2026.9.1'
      && detail.plugin.origin === 'global' && detail.source?.kind === 'npm'
      && detail.source.spec === `@openclaw/${selected}@2026.9.1` && detail.source.packageName === `@openclaw/${selected}`
      && detail.source.integrity === shipped.integrity;
    let inventory = await this.request('plugins.list', {});
    let plugin = inventory.plugins?.find(row => row.id === selected && row.installed === true);
    if (plugin && !validSource(await this.request('plugins.inspect', { pluginId: selected }))) {
      throw new Error('Kênh đã có plugin từ nguồn hoặc phiên bản khác. Cần kiểm tra bản đang cài trước khi thay thế.');
    }
    if (!plugin) {
      if (!this.installPlugin) throw new Error('Chưa tìm thấy bộ cài plugin đi kèm ứng dụng.');
      this.#restarting = true;
      try { await this.installPlugin(selected); await this.#restart(); } finally { this.#restarting = false; }
      if (!validSource(await this.request('plugins.inspect', { pluginId: selected }))) throw new Error('Chưa xác nhận nguồn chính thức và phiên bản của plugin.');
      inventory = await this.request('plugins.list', {});
      plugin = inventory.plugins?.find(row => row.id === selected && row.installed === true);
    }
    if (!plugin) throw new Error('Gateway chưa nhận plugin đã cài.');
    if (!plugin.enabled) {
      const enabled = await this.request('plugins.setEnabled', { pluginId: selected, enabled: true });
      if (enabled.restartRequired) await this.#restart();
      const after = await this.request('plugins.list', {});
      if (!after.plugins?.some(row => row.id === selected && row.installed && row.enabled)) throw new Error('Chưa xác nhận plugin đã bật.');
    }
  }
  async run(input) {
    if (!actions.has(input?.action)) throw new Error('Thao tác kênh chưa được hỗ trợ.');
    if (input.action === 'channel-bundle-status') {
      fields(input, ['action']);
      return { channels: [{ id: 'telegram', available: true, version: '2026.9.1' }, ...(await this.#bundle()).map(({ id, available, version }) => ({ id, available, version }))] };
    }
    if (input.action === 'channel-qr-clear') {
      fields(input, ['action', 'ticket']); if (input.ticket !== this.#qr?.ticket) throw new Error('Mã quét không thuộc cửa sổ này.');
      this.#qr = null; return { cleared: true };
    }
    if (input.action === 'channel-cancel') {
      fields(input, ['action', 'sessionId']);
      if ((!this.#wizard || input.sessionId !== this.#wizard.id) && !this.#retiredWizards.has(input.sessionId)) throw new Error('Hướng dẫn không thuộc cửa sổ này.');
      return this.#cancelWizard(input.sessionId);
    }
    if (this.#busy) throw new Error('Đang xử lý thiết lập kênh trước.');
    this.#busy = true; const epoch = this.#epoch;
    try { return await this.#run(input, epoch); } finally { this.#busy = false; }
  }
  async #run(input, epoch) {
    const current = () => { if (epoch !== this.#epoch) throw new Error('Kết nối đã thay đổi. Mở lại thiết lập kênh.'); };
    if (input.action === 'channel-setup') {
      fields(input, ['action', 'channel']); const id = channel(input.channel);
      if (this.#wizard) throw new Error('Hãy hoàn tất hoặc hủy hướng dẫn đang mở.');
      for (const retired of this.#retiredWizards) {
        const cancelled = await this.#cancelWizard(retired); current();
        if (!cancelled.done) throw new Error('Hướng dẫn trước đang hoàn tất bước lưu. Chờ phản hồi rồi thử lại.');
      }
      await this.#prepare(id); current();
      // Pinned 2026.9.1 re-enters its unpinned installer for these already-active
      // official plugins. Keep the core intact and write the explicit account
      // fields through its validated, revision-checked public config contract.
      if (configFormChannels.has(id)) {
        const form = await createChannelConfigForm(id, { request: this.request, configPath: this.configPath }); current();
        const sessionId = randomUUID(); this.#wizard = { id: sessionId, step: form.step, channel: id, form };
        return { ...wizardResult({ done: false, status: 'running', step: form.step }, sessionId), setupRoute: 'native-config' };
      }
      const raw = await this.request('wizard.start', { flow: 'channels', channel: id });
      if (epoch !== this.#epoch) {
        if (raw.sessionId && !raw.done) { this.#retiredWizards.add(raw.sessionId); await this.#cancelWizard(raw.sessionId).catch(() => {}); }
        current();
      }
      const result = wizardResult(raw, raw.sessionId);
      this.#wizard = result.done ? null : { id: result.sessionId, step: result.step, channel: id };
      return result;
    }
    if (input.action === 'channel-next' || input.action === 'channel-cancel') {
      fields(input, ['action', 'sessionId', 'answer'], ['action', 'sessionId']);
      if (!this.#wizard || input.sessionId !== this.#wizard.id) throw new Error('Hướng dẫn không thuộc cửa sổ này.');
      const params = { sessionId: input.sessionId };
      if (input.action === 'channel-next' && Object.hasOwn(input, 'answer')) {
        fields(input.answer, ['stepId', 'value']); const step = this.#wizard.step;
        const answerLimit = this.#wizard.form ? 140000 : 16384;
        if (!step || step.id !== input.answer.stepId || JSON.stringify(input.answer.value)?.length > answerLimit) throw new Error('Câu trả lời chưa hợp lệ.');
        const value = input.answer.value;
        if ((step.type === 'text' && typeof value !== 'string') || (step.type === 'confirm' && typeof value !== 'boolean')
          || (step.type === 'select' && !step.options?.some(option => JSON.stringify(option.value) === JSON.stringify(value)))
          || (step.type === 'multiselect' && (!Array.isArray(value) || value.some(item => !step.options?.some(option => JSON.stringify(option.value) === JSON.stringify(item)))))) throw new Error('Lựa chọn chưa hợp lệ.');
        params.answer = input.answer;
      }
      if (this.#wizard.form) {
        const owned = this.#wizard;
        const raw = await owned.form.next(params.answer, current); current();
        const result = { ...wizardResult(raw, owned.id), setupRoute: 'native-config' };
        if (result.done) this.#wizard = null;
        else owned.step = result.step ?? owned.step;
        return result;
      }
      let raw;
      try { raw = await this.request(input.action === 'channel-cancel' ? 'wizard.cancel' : 'wizard.next', params); }
      catch (error) {
        // Native may queue the final progress step after its runner has completed. A no-answer next is authoritative.
        if (input.action !== 'channel-next' || !params.answer || !/wizard not running/iu.test(error.message ?? '')) throw error;
        raw = await this.request('wizard.next', { sessionId: params.sessionId });
      }
      current(); const result = wizardResult(raw, params.sessionId);
      if (result.done || ['cancelled', 'error'].includes(result.status)) this.#wizard = null;
      else this.#wizard.step = result.step ?? this.#wizard.step;
      return result;
    }
    if (input.action === 'channel-qr-start') {
      fields(input, ['action', 'channel', 'accountId']);
      if (channel(input.channel) !== 'whatsapp') throw new Error('Kênh này không dùng mã QR WhatsApp.');
      const accountId = account(input.accountId);
      const state = await this.request('channels.status', { channel: 'whatsapp', probe: false });
      current();
      const selected = state.channelAccounts?.whatsapp?.find(row => row.accountId === accountId);
      if (!selected) throw new Error('Hãy thiết lập tài khoản WhatsApp trước.');
      if (selected.enabled === false) throw new Error('Hãy bật tài khoản WhatsApp trước khi liên kết.');
      const ticket = randomUUID(); this.#qr = { ticket, accountId, currentQrDataUrl: undefined };
      const raw = await this.request('web.login.start', { accountId, timeoutMs: 20000, force: false }); current();
      if (this.#qr?.ticket !== ticket) throw new Error('Đã đóng mã quét.');
      const result = qrResult(raw, ticket); this.#qr.currentQrDataUrl = result.qrDataUrl ?? undefined; return result;
    }
    if (input.action === 'channel-qr-wait') {
      fields(input, ['action', 'ticket']); if (!this.#qr || input.ticket !== this.#qr.ticket) throw new Error('Mã quét không thuộc cửa sổ này.');
      const pending = this.#qr;
      const raw = await this.request('web.login.wait', { accountId: pending.accountId, timeoutMs: 15000,
        ...pending.currentQrDataUrl ? { currentQrDataUrl: pending.currentQrDataUrl } : {} }); current();
      if (this.#qr !== pending) throw new Error('Đã đóng mã quét.');
      const result = qrResult(raw, pending.ticket); if (result.qrDataUrl) pending.currentQrDataUrl = result.qrDataUrl; return result;
    }
    if (input.action === 'channel-pairing-list') {
      fields(input, ['action', 'channel', 'accountId']); const id = channel(input.channel), accountId = account(input.accountId);
      const result = await this.request('channels.pairing.list', { channel: id, accountId }); current();
      return { requests: (result.requests ?? []).filter(row => row.channel === id && row.accountId === accountId).slice(0, 30)
        .map(row => ({ requestId: display(row.requestId, 200), senderId: display(row.senderId, 200), senderLabel: display(row.senderLabel, 300), expiresAt: display(row.expiresAt, 100) })) };
    }
    if (input.action === 'channel-pairing-approve' || input.action === 'channel-pairing-dismiss') {
      fields(input, ['action', 'channel', 'accountId', 'requestId']);
      const id = channel(input.channel), accountId = account(input.accountId);
      const list = await this.request('channels.pairing.list', { channel: id, accountId }); current();
      if (!list.requests?.some(row => row.channel === id && row.accountId === accountId && row.requestId === input.requestId)) throw new Error('Yêu cầu ghép đôi đã hết hạn hoặc không thuộc tài khoản.');
      const approve = input.action === 'channel-pairing-approve';
      const result = await this.request(approve ? 'channels.pairing.approve' : 'channels.pairing.dismiss', {
        channel: id, accountId, requestId: input.requestId, ...approve ? { notify: false, bootstrapCommandOwner: false } : {} }); current();
      return { ok: result.requestId === input.requestId };
    }
    throw new Error('Thao tác kênh chưa được hỗ trợ.');
  }
}
