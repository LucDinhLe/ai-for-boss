import { spawn } from 'node:child_process';
import { publicWebUrl } from './web-tabs.mjs';
export const CHROME_EXTENSION_URL = 'https://chromewebstore.google.com/detail/openclaw/kcdjddhmeafeomebliikmbpblkmkfoig';

/** The public CLI owns key creation. Secret output is never returned or logged. */
export function pairingCode(supervisor, spawnChild = spawn) {
  if (!supervisor?.url || !supervisor.nodeExecutable || !supervisor.openclawEntry) throw new Error('Bật Gateway trước khi ghép Chrome.');
  return new Promise((resolve, reject) => {
    const child = spawnChild(supervisor.nodeExecutable, [supervisor.openclawEntry, 'browser', 'extension', 'pair', '--json'], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, OPENCLAW_STATE_DIR: supervisor.stateDirectory, OPENCLAW_NO_AUTO_UPDATE: '1' }
    });
    let output = '', overflow = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error('Ghép nối chưa phản hồi. Hãy thử lại.')); }, 120000); timer.unref();
    child.stdout.on('data', chunk => { if (output.length + chunk.length > 64000) { overflow = true; child.kill(); } else output += chunk.toString(); });
    child.stderr.on('data', () => {});
    child.on('error', () => { clearTimeout(timer); reject(new Error('Chưa tạo được mã ghép nối.')); });
    child.on('close', code => { clearTimeout(timer); try {
      if (code !== 0 || overflow) throw new Error();
      const result = JSON.parse(output); if (typeof result.pairingString !== 'string' || result.pairingString.length < 20 || result.pairingString.length > 16000) throw new Error();
      resolve(result.pairingString);
    } catch { reject(new Error('Chưa tạo được mã ghép nối từ OpenClaw. Hãy kiểm tra Gateway.')); } finally { output = ''; } });
  });
}
export class ChromeBridge {
  constructor({ request, getSupervisor, clipboard, openExternal, getPairing = pairingCode, onPaired = () => {}, validateUrl = publicWebUrl }) { Object.assign(this, { request, getSupervisor, clipboard, openExternal, getPairing, onPaired, validateUrl }); this.busy = false; }
  native(path, query = {}) { return this.request({ method: 'GET', path, query: { profile: 'chrome', ...query }, target: 'host' }); }
  async run(input) {
    const allowed = { 'chrome-store': [], 'chrome-pair': [], 'chrome-tabs': [], 'chrome-share': ['id'] }[input?.action];
    if (!allowed || Object.keys(input).some(k => k !== 'action' && !allowed.includes(k)) || allowed.some(k => !Object.hasOwn(input, k))) throw new Error('Thao tác Chrome chưa hợp lệ.');
    if (this.busy) throw new Error('Đang kết nối Chrome.'); this.busy = true;
    try {
      if (input.action === 'chrome-store') { await this.openExternal(CHROME_EXTENSION_URL); return { opened: true }; }
      if (input.action === 'chrome-pair') {
        const status = await this.native('/');
        const pairing = await this.getPairing(this.getSupervisor());
        const route = new URL(pairing);
        if (route.protocol !== 'ws:' || route.hostname !== '127.0.0.1' || route.pathname !== '/extension' || !route.hash || Number(route.port) !== status.cdpPort) throw new Error('Mã ghép chưa khớp Chrome của ứng dụng.');
        this.clipboard.writeText(pairing); this.onPaired();
        const timer = setTimeout(() => { if (this.clipboard.readText() === pairing) this.clipboard.clear(); }, 60000); timer.unref();
        return { copied: true, expiresInSeconds: 60 };
      }
      const response = await this.native('/tabs');
      const tabs = (response.tabs ?? []).slice(0, 100).filter(t => typeof t.targetId === 'string').map(t => ({ id: t.targetId, title: String(t.title ?? '').slice(0, 300), url: String(t.url ?? '').slice(0, 4096) }));
      if (input.action === 'chrome-tabs') return { tabs };
      const tab = tabs.find(t => t.id === input.id); if (!tab) throw new Error('Tab không còn được chia sẻ từ Chrome.');
      await this.validateUrl(tab.url);
      const result = await this.native('/snapshot', { targetId: tab.id, format: 'ai', maxChars: '16000' });
      if (typeof result.snapshot !== 'string') throw new Error('Chrome chưa trả nội dung trang.');
      const after = await this.native('/tabs');
      if (!after.tabs?.some(t => t.targetId === tab.id && t.url === tab.url)) throw new Error('Tab Chrome đã đổi; hãy chọn lại nội dung.');
      return { ...tab, text: result.snapshot.slice(0, 16000) };
    } finally { this.busy = false; }
  }
}
