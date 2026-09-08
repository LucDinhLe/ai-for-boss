import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';

const channels = Object.freeze({ zalo: { label: 'Zalo', credential: 'botToken' }, discord: { label: 'Discord', credential: 'token' }, googlechat: { label: 'Google Chat', credential: 'serviceAccount' }, whatsapp: { label: 'WhatsApp' } });
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => record(value) && Object.hasOwn(value, key) ? value[key] : undefined;
const samePath = (a, b) => typeof a === 'string' && (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));
const schemaError = () => new Error('Bộ chạy chưa cung cấp cấu hình tài khoản phù hợp. Hãy tải lại kênh.');
const cancelled = () => new Error('Thiết lập này đã đóng. Hãy mở lại nếu cần.');
const commitError = 'Chưa xác nhận được việc lưu tài khoản. Cấu hình có thể đã được lưu; hãy tải lại danh sách kênh và kiểm tra trước khi thiết lập lại.';
function hasControl(value) { for (let index = 0; index < value.length; index++) { const code = value.charCodeAt(index); if (code < 32 && ![9, 10, 13].includes(code) || code === 127) return true; } return false; }
function text(value, max = 8192) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > max || hasControl(value)) throw new Error('Thông tin chưa hợp lệ hoặc quá dài.');
  return value.trim();
}
function accountId(value) {
  const id = text(value, 64);
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Tên tài khoản dùng chữ thường, số, dấu gạch ngang hoặc gạch dưới; tối đa 64 ký tự.');
  return id;
}
function https(value) {
  const raw = text(value, 2048);
  let parsed; try { parsed = new URL(raw); } catch { throw new Error('Hãy nhập địa chỉ HTTPS đầy đủ.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) throw new Error('Hãy nhập địa chỉ HTTPS không chứa tài khoản, mật khẩu hoặc phần #.');
  return raw;
}
function serviceAccount(value) {
  const raw = text(value, 65536);
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error('Nội dung phải là JSON tài khoản dịch vụ Google hợp lệ.'); }
  if (!record(parsed) || parsed.type !== 'service_account' || typeof parsed.client_email !== 'string' || !/^[^\s@]+@[^\s@]+$/u.test(parsed.client_email)
    || typeof parsed.private_key !== 'string' || !parsed.private_key.includes('-----BEGIN ' + 'PRIVATE KEY-----')) throw new Error('JSON cần là tài khoản dịch vụ Google, có client_email và private_key.');
  if (parsed.token_uri !== undefined && !['https://oauth2.googleapis.com/token', 'https://accounts.google.com/o/oauth2/token'].includes(parsed.token_uri)) throw new Error('Địa chỉ cấp token trong JSON không phải địa chỉ Google được hỗ trợ.');
  return raw;
}

/** Compatibility form for affected pinned native channel wizards. All persistence remains public config RPC. */
export async function createChannelConfigForm(channel, { request, configPath }) {
  if (!Object.hasOwn(channels, channel) || typeof request !== 'function' || typeof configPath !== 'string' || !path.isAbsolute(configPath)) throw schemaError();
  const form = new ChannelConfigForm(channel, request, configPath);
  await form.initialize();
  return form;
}

class ChannelConfigForm {
  #id = randomUUID(); #field = 'accountId'; #step; #values = {}; #hash; #closed = false; #pending = false; #committing = false;
  constructor(channel, request, configPath) { Object.assign(this, { channel, request, configPath }); }
  get step() { return this.#step ? structuredClone(this.#step) : undefined; }
  get committing() { return this.#committing; }
  async #read(method, params) {
    try { return await this.request(method, params); } catch { throw new Error('Chưa đọc được cấu hình từ Gateway. Hãy thử lại khi kết nối sẵn sàng.'); }
  }
  #snapshot(value) {
    if (!record(value) || value.valid !== true || !samePath(value.path, this.configPath) || !record(value.config) || typeof value.hash !== 'string' || !value.hash) throw schemaError();
    return value;
  }
  #assertOpen(currentCheck) { if (this.#closed) throw cancelled(); currentCheck?.(); }
  async initialize() {
    const schemaPath = `channels.${this.channel}`;
    const schema = await this.#read('config.schema.lookup', { path: schemaPath });
    if (schema?.path !== schemaPath || !Array.isArray(schema.children) || !schema.children.some(item => item.key === 'accounts')) throw schemaError();
    this.#snapshot(await this.#read('config.get', {}));
    this.#setStep('accountId');
  }
  #setStep(field) {
    this.#field = field;
    const title = `Thiết lập ${channels[this.channel].label}`;
    const steps = {
      accountId: { type: 'text', message: 'Tên tài khoản trong ứng dụng (ví dụ: default hoặc cong-viec)', initialValue: 'default' },
      authMethod: { type: 'select', message: 'Thông tin tài khoản dịch vụ Google', options: [{ value: 'inline', label: 'Dán JSON tài khoản dịch vụ' }, { value: 'file', label: 'Đường dẫn tệp JSON trên máy này' }] },
      credential: { type: 'text', sensitive: true, ...(this.channel === 'googlechat' && this.#values.authMethod === 'inline' ? { multiline: true } : {}), message: this.channel === 'googlechat' ? this.#values.authMethod === 'file' ? 'Đường dẫn đầy đủ đến tệp JSON tài khoản dịch vụ Google' : 'Dán JSON tài khoản dịch vụ Google' : `Bot token ${channels[this.channel].label} (không phải API key của mô hình AI)` },
      audienceType: { type: 'select', message: 'Cách Google xác minh webhook', options: [{ value: 'app-url', label: 'Địa chỉ ứng dụng (khuyên dùng)' }, { value: 'project-number', label: 'Số dự án Google Cloud' }] },
      audience: { type: 'text', message: this.#values.audienceType === 'project-number' ? 'Số dự án Google Cloud' : 'Địa chỉ HTTPS của ứng dụng đã khai báo trong Google Chat' },
      appPrincipal: { type: 'text', message: 'Mã OAuth 2.0 client ID (uniqueId, 21 chữ số) của ứng dụng Google Chat. Có thể lấy trường client_id trong JSON tài khoản dịch vụ; không dùng địa chỉ email.' },
      webhookUrl: { type: 'text', message: 'Địa chỉ HTTPS công khai nhận tin nhắn Google Chat. Gateway cần được truy cập tại địa chỉ này.', ...(this.#values.audienceType === 'app-url' ? { initialValue: this.#values.audience } : {}) },
      confirm: { type: 'confirm', message: `Lưu và bật tài khoản “${this.#values.accountId}” của ${channels[this.channel].label}? Giữ nguyên quyền nhắn tin và thiết lập từng tài khoản khác. ${this.#values.enableChannel ? 'Kênh hiện đang tắt: hành động này cũng bật lại kênh; các tài khoản không bị tắt riêng có thể hoạt động. ' : ''}Việc lưu chưa xác nhận kết nối với nhà cung cấp.${this.channel === 'whatsapp' ? ' Tiếp theo, liên kết điện thoại bằng mã QR trong WhatsApp → Thiết bị liên kết.' : ''}`, initialValue: false, confirmLabel: 'Lưu và bật tài khoản', declineLabel: 'Hủy thiết lập' }
    };
    this.#step = { id: `${this.#id}:${field}`, title, ...steps[field] };
  }
  cancel() {
    if (this.#committing) throw new Error('Đang xác nhận việc lưu tài khoản. Vui lòng chờ kết quả.');
    this.#close(); return { done: true, status: 'cancelled' };
  }
  #close() { this.#closed = true; this.#values = {}; this.#hash = undefined; this.#step = undefined; }
  async next(answer, currentCheck) {
    this.#assertOpen(currentCheck);
    if (this.#pending) throw new Error('Đang xử lý bước này. Vui lòng chờ.');
    if (!record(answer) || Object.keys(answer).some(key => !['stepId', 'value'].includes(key)) || answer.stepId !== this.#step.id || !Object.hasOwn(answer, 'value')) throw new Error('Bước thiết lập đã thay đổi. Hãy dùng thông tin đang hiển thị.');
    this.#pending = true;
    try {
      const value = answer.value;
      switch (this.#field) {
        case 'accountId': {
          const id = accountId(value), schemaPath = `channels.${this.channel}.accounts.${id}`;
          const schema = await this.#read('config.schema.lookup', { path: schemaPath }); this.#assertOpen(currentCheck);
          const expected = this.channel === 'googlechat' ? ['enabled', 'serviceAccount', 'serviceAccountFile', 'audienceType', 'audience', 'appPrincipal', 'webhookUrl'] : this.channel === 'whatsapp' ? ['enabled'] : ['enabled', channels[this.channel].credential];
          if (schema?.path !== schemaPath || !Array.isArray(schema.children) || expected.some(key => !schema.children.some(child => child.key === key))) throw schemaError();
          const snapshot = this.#snapshot(await this.#read('config.get', {})); this.#assertOpen(currentCheck);
          const root = own(snapshot.config.channels, this.channel);
          this.#hash = snapshot.hash; this.#values.accountId = id; this.#values.enableChannel = root?.enabled === false;
          this.#setStep(this.channel === 'googlechat' ? 'authMethod' : this.channel === 'whatsapp' ? 'confirm' : 'credential'); break;
        }
        case 'authMethod':
          if (!['inline', 'file'].includes(value)) throw new Error('Hãy chọn cách cung cấp tài khoản dịch vụ.');
          this.#values.authMethod = value; this.#setStep('credential'); break;
        case 'credential': {
          let credential;
          if (this.channel === 'googlechat' && this.#values.authMethod === 'inline') {
            credential = serviceAccount(value);
            const clientId = JSON.parse(credential).client_id;
            if (typeof clientId === 'string' && /^\d{21}$/u.test(clientId)) this.#values.appPrincipal = clientId;
          }
          else {
            credential = text(value, this.channel === 'googlechat' ? 4096 : 8192);
            if (!credential || (this.channel === 'googlechat' ? !path.isAbsolute(credential) : /\s/u.test(credential))) throw new Error(this.channel === 'googlechat' ? 'Hãy nhập đường dẫn tuyệt đối đến tệp JSON.' : 'Bot token không được để trống hoặc chứa khoảng trắng.');
          }
          this.#values.credential = credential; this.#setStep(this.channel === 'googlechat' ? 'audienceType' : 'confirm'); break;
        }
        case 'audienceType':
          if (!['app-url', 'project-number'].includes(value)) throw new Error('Hãy chọn cách xác minh webhook.');
          this.#values.audienceType = value; this.#setStep('audience'); break;
        case 'audience': {
          const audience = this.#values.audienceType === 'app-url' ? https(value) : text(value, 30);
          if (this.#values.audienceType === 'project-number' && !/^\d{1,30}$/u.test(audience)) throw new Error('Số dự án chỉ gồm chữ số.');
          this.#values.audience = audience;
          this.#setStep(this.#values.audienceType === 'app-url' && !this.#values.appPrincipal ? 'appPrincipal' : 'webhookUrl'); break;
        }
        case 'appPrincipal': {
          const principal = text(value, 21);
          if (!/^\d{21}$/u.test(principal)) throw new Error('Mã OAuth 2.0 client ID phải gồm 21 chữ số.');
          this.#values.appPrincipal = principal; this.#setStep('webhookUrl'); break;
        }
        case 'webhookUrl': this.#values.webhookUrl = https(value); this.#setStep('confirm'); break;
        case 'confirm':
          if (typeof value !== 'boolean') throw new Error('Hãy xác nhận hoặc hủy việc lưu.');
          if (!value) return this.cancel();
          return await this.#commit(currentCheck);
        default: throw cancelled();
      }
      return { done: false, status: 'running', step: this.step };
    } finally { this.#pending = false; }
  }
  async #commit(currentCheck) {
    const current = this.#snapshot(await this.#read('config.get', {})); this.#assertOpen(currentCheck);
    if (current.hash !== this.#hash) throw new Error('Cấu hình đã thay đổi trong lúc nhập. Hãy đóng và mở lại thiết lập để bảo toàn thay đổi mới.');
    const account = this.#values.accountId;
    const credentialKey = this.channel === 'googlechat' && this.#values.authMethod === 'file' ? 'serviceAccountFile' : channels[this.channel].credential;
    const patch = { enabled: true, ...(credentialKey ? { [credentialKey]: this.#values.credential } : {}) };
    if (this.channel === 'googlechat') Object.assign(patch, { audienceType: this.#values.audienceType, audience: this.#values.audience, webhookUrl: this.#values.webhookUrl });
    if (this.channel === 'googlechat' && this.#values.audienceType === 'app-url') patch.appPrincipal = this.#values.appPrincipal;
    // A stored alternate credential would otherwise win over the explicitly entered file.
    const channelConfig = own(current.config.channels, this.channel);
    const previous = own(own(channelConfig, 'accounts'), account);
    if (this.channel === 'googlechat' && credentialKey === 'serviceAccountFile' && (own(previous, 'serviceAccount') !== undefined || own(channelConfig, 'serviceAccount') !== undefined)) throw new Error('Tài khoản này đang có JSON trực tiếp ưu tiên hơn tệp. Hãy dùng JSON trực tiếp để giữ nguyên các thông tin đã lưu.');
    const channelPatch = { ...(this.#values.enableChannel ? { enabled: true } : {}), accounts: { [account]: patch } };
    this.#assertOpen(currentCheck); this.#committing = true;
    try {
      // Native `note` is a restart notification that can wake the system agent.
      // Saving account settings must not create an unrelated model turn.
      const ack = await this.request('config.patch', { raw: JSON.stringify({ channels: { [this.channel]: channelPatch } }), baseHash: current.hash });
      this.#assertOpen(currentCheck);
      if (ack?.ok !== true || !samePath(ack.path, this.configPath) || (typeof ack.hash !== 'string' && ack.noop !== true)) throw schemaError();
      let saved;
      for (let attempt = 0; attempt < 12; attempt++) {
        saved = this.#snapshot(await this.request('config.get', {})); this.#assertOpen(currentCheck);
        if (saved.hash !== (ack.hash ?? current.hash)) throw schemaError();
        if (typeof saved.configRevisionHash === 'string' && saved.configRevisionHash && saved.appliedConfigHash === saved.configRevisionHash) break;
        if (attempt < 11) await pause(250);
        this.#assertOpen(currentCheck);
      }
      const after = own(own(own(saved.config.channels, this.channel), 'accounts'), account);
      // Secrets are redacted. Exact native write ACK + unchanged projected revision proves which write this readback describes.
      if (saved.hash !== (ack.hash ?? current.hash) || typeof saved.configRevisionHash !== 'string' || !saved.configRevisionHash || saved.appliedConfigHash !== saved.configRevisionHash
        || (channelPatch.enabled === true && saved.config.channels?.[this.channel]?.enabled !== true)
        || !record(after) || after.enabled !== true || (credentialKey && !own(after, credentialKey))
        || Object.entries(patch).some(([key, value]) => key !== credentialKey && after[key] !== value)) throw schemaError();
      const result = { done: true, status: 'done', accounts: [{ channel: this.channel, accountId: account }], message: this.channel === 'whatsapp' ? 'Đã lưu tài khoản WhatsApp. Tiếp tục liên kết điện thoại bằng mã QR; việc lưu tài khoản chưa xác nhận đã liên kết.' : 'Đã lưu tài khoản. Trạng thái kênh cho biết kết nối thực tế; chưa xác minh đăng nhập với nhà cung cấp.' };
      this.#close(); return result;
    } catch {
      this.#close(); return { done: true, status: 'error', error: commitError };
    } finally { this.#committing = false; }
  }
}
