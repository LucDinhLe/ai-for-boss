import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && [0, 168].includes(b) || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b));
  }
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/iu.test(address);
}
export function webUrl(value) {
  if (typeof value !== 'string' || value.length > 4096 || [...value].some(c => c.charCodeAt(0) <= 32)) throw new Error('Nhập địa chỉ web hợp lệ.');
  const url = new URL(value.includes('://') ? value : 'https://' + value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Chỉ mở địa chỉ http hoặc https.');
  const host = url.hostname.replace(/^\[|\]$/gu, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !isIP(host) || isIP(host) && !publicAddress(host)) throw new Error('Địa chỉ nội bộ chưa được mở trong Web.');
  return url.href;
}
export async function publicWebUrl(value, resolve = lookup) {
  const url = webUrl(value), host = new URL(url).hostname.replace(/^\[|\]$/gu, '');
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host, { all: true });
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('Địa chỉ nội bộ chưa được mở trong Web.');
  return url;
}
export const PAGE_TEXT_SCRIPT = `(() => {
 const root=document.body;if(!root)return '';
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const parts=[];let n,size=0,count=0;
 while((n=walker.nextNode())&&size<16000&&count++<50000){const p=n.parentElement;
 if(!p||p.closest('script,style,noscript,input,textarea,select,[contenteditable],[hidden],[aria-hidden="true"]'))continue;
 const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden'||!p.getClientRects().length)continue;
 const t=n.textContent.trim();if(t){parts.push(t);size+=t.length+1;}}
 return parts.join('\\n').slice(0,16000);
})()`;

/** Remote documents have no preload, Node, product IPC or debugging listener. */
export class WebTabs {
  constructor({ window, createView, browserSession, validateUrl = publicWebUrl }) {
    Object.assign(this, { window, createView, browserSession, validateUrl });
    this.tabs = new Map(); this.active = null; this.bounds = null; this.disposed = false;
    browserSession.setPermissionCheckHandler(() => false);
    browserSession.setPermissionRequestHandler((_w, _p, callback) => callback(false));
    browserSession.setDevicePermissionHandler(() => false);
    this.onDownload = event => { event.preventDefault(); const tab = this.tabs.get(this.active); if (tab) tab.error = 'Tải tệp từ Web chưa bật. Anh có thể dùng Chrome để tải.'; };
    browserSession.on('will-download', this.onDownload);
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      if (this.disposed) { callback({ cancel: true }); return; }
      if (/^(data:|blob:|about:blank$)/u.test(details.url)) { callback({ cancel: false }); return; }
      this.validateUrl(details.url.replace(/^ws:/u, 'http:').replace(/^wss:/u, 'https:')).then(() => callback({ cancel: this.disposed }), () => callback({ cancel: true }));
    });
  }
  live(id, tab) {
    return Boolean(tab && !this.disposed && !this.window.isDestroyed() && this.tabs.get(id) === tab && !tab.contents.isDestroyed());
  }
  state() {
    const tabs = [...this.tabs].filter(([id, tab]) => this.live(id, tab)).map(([id, tab]) => ({ id, title: tab.contents.getTitle() || 'Tab mới',
      url: tab.contents.getURL() === 'about:blank' ? '' : tab.contents.getURL(), loading: tab.contents.isLoading(), error: tab.error,
      back: tab.contents.navigationHistory.canGoBack(), forward: tab.contents.navigationHistory.canGoForward() }));
    return { active: tabs.some(tab => tab.id === this.active) ? this.active : null, tabs };
  }
  layout() {
    for (const [id, tab] of this.tabs) {
      if (!this.live(id, tab)) continue;
      if (id === this.active && this.bounds) tab.view.setBounds(this.bounds);
      tab.view.setVisible(Boolean(id === this.active && this.bounds));
    }
  }
  add() {
    if (this.disposed || this.window.isDestroyed()) throw new Error('Web đã đóng.');
    if (this.tabs.size >= 12) throw new Error('Đóng bớt tab trước khi mở thêm (tối đa 12).');
    const id = randomUUID(), view = this.createView({ webPreferences: { session: this.browserSession, sandbox: true,
      contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false, navigateOnDragDrop: false, devTools: false } });
    // Retain the WebContents wrapper: view.webContents becomes undefined after close.
    const tab = { view, contents: view.webContents, error: '', generation: 0, documentVersion: 0 }; this.tabs.set(id, tab); this.active = id;
    this.window.contentView.addChildView(view);
    view.webContents.setWindowOpenHandler(({ url }) => { const generation = tab.generation; void this.validateUrl(url).then(valid => { if (this.live(id, tab) && tab.generation === generation) { const child = this.add(); return this.navigate(child, valid); } }).catch(() => {}); return { action: 'deny' }; });
    view.webContents.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => { if (mainFrame) tab.documentVersion++; });
    view.webContents.on('will-navigate', (event, url) => { try { webUrl(url); } catch { event.preventDefault(); tab.error = 'Địa chỉ này chưa được phép mở.'; } });
    view.webContents.on('will-redirect', (event, url) => { try { webUrl(url); } catch { event.preventDefault(); tab.error = 'Trang chuyển đến địa chỉ chưa được phép.'; } });
    view.webContents.on('did-fail-load', (_e, code, _description, _url, mainFrame) => { if (mainFrame && code !== -3) tab.error = 'Chưa tải được trang. Kiểm tra địa chỉ hoặc thử tải lại.'; });
    view.webContents.on('render-process-gone', () => { tab.error = 'Tab đã dừng. Hãy tải lại hoặc mở tab mới.'; });
    void view.webContents.loadURL('about:blank').catch(() => {}); this.layout(); return id;
  }
  async navigate(id, value) {
    const tab = this.tabs.get(id); if (!tab) throw new Error('Tab đã đóng.');
    const generation = ++tab.generation; const url = await this.validateUrl(value);
    if (!this.live(id, tab) || tab.generation !== generation) return;
    tab.error = ''; void tab.contents.loadURL(url).catch(() => { if (this.live(id, tab)) tab.error = 'Chưa tải được trang. Hãy thử lại.'; });
  }
  async run(input) {
    if (this.disposed || this.window.isDestroyed() || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Web chưa sẵn sàng.');
    const keys = { 'web-open': [], 'web-state': [], 'web-new': [], 'web-select': ['id'], 'web-close': ['id'], 'web-navigate': ['id', 'url'],
      'web-back': ['id'], 'web-forward': ['id'], 'web-reload': ['id'], 'web-stop': ['id'], 'web-share': ['id'], 'web-bounds': ['bounds'] }[input.action];
    if (!keys || Object.keys(input).some(k => k !== 'action' && !keys.includes(k)) || keys.some(k => !Object.hasOwn(input, k))) throw new Error('Thao tác Web chưa hợp lệ.');
    if (input.action === 'web-open' && !this.tabs.size) { const id = this.add(); await this.navigate(id, 'https://www.google.com/'); }
    else if (input.action === 'web-new') this.add();
    else if (input.action === 'web-bounds') {
      const b = input.bounds;
      if (b === null) this.bounds = null;
      else {
        const [width, height] = this.window.getContentSize();
        if (Object.keys(b).sort().join() !== 'height,width,x,y' || Object.values(b).some(v => !Number.isFinite(v)) || b.x < width * .45 || b.y < 70 || b.width < 0 || b.height < 0 || b.x + b.width > width + 2 || b.y + b.height > height + 2) throw new Error('Vùng Web chưa hợp lệ.');
        this.bounds = Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.max(0, Math.floor(v))]));
      }
      this.layout();
    } else if (keys.includes('id')) {
      const tab = this.tabs.get(input.id); if (!tab) throw new Error('Tab đã đóng.');
      const contents = tab.contents;
      if (input.action !== 'web-close' && !this.live(input.id, tab)) throw new Error('Tab đã đóng.');
      if (input.action === 'web-select') { this.active = input.id; this.layout(); }
      if (input.action === 'web-close') { this.tabs.delete(input.id); if (this.active === input.id) this.active = [...this.tabs.keys()].at(-1) ?? null; try { this.closeTabs([tab]); } finally { this.layout(); } }
      if (input.action === 'web-navigate') await this.navigate(input.id, input.url);
      if (input.action === 'web-back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
      if (input.action === 'web-forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
      if (input.action === 'web-reload') { tab.error = ''; contents.reload(); }
      if (input.action === 'web-stop') { tab.generation++; contents.stop(); }
      if (input.action === 'web-share') {
        const url = contents.getURL(), generation = tab.generation, documentVersion = tab.documentVersion; await this.validateUrl(url);
        if (!this.live(input.id, tab) || tab.generation !== generation || tab.documentVersion !== documentVersion) throw new Error('Tab đã đóng hoặc đổi trang.');
        const text = await Promise.race([contents.executeJavaScriptInIsolatedWorld(999, [{ code: PAGE_TEXT_SCRIPT }]), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Trang chưa phản hồi.')), 8000); timer.unref(); })]);
        if (!this.live(input.id, tab) || contents.getURL() !== url || tab.generation !== generation || tab.documentVersion !== documentVersion) throw new Error('Trang đã đổi; hãy chọn lại nội dung.');
        return { url, title: contents.getTitle().slice(0, 300), text: String(text).slice(0, 16000) };
      }
    }
    return this.state();
  }
  closeTabs(tabs) {
    const errors = [];
    for (const tab of tabs) {
      tab.generation++;
      try { if (!this.window.isDestroyed()) this.window.contentView.removeChildView(tab.view); } catch (error) { errors.push(error); }
      try { if (!tab.contents.isDestroyed()) tab.contents.close({ waitForBeforeUnload: false }); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, 'Không dọn được toàn bộ tab Web.');
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const tabs = [...this.tabs.values()];
    this.tabs.clear(); this.active = null; this.bounds = null;
    try { this.closeTabs(tabs); } finally { this.browserSession.removeListener('will-download', this.onDownload); }
  }
}
