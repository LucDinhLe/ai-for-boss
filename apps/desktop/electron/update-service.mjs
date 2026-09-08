import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { verifyUpdateEnvelope, verifyUpdateDirectory, stageComponentUpdate } from './component-update.mjs';
const FEED = 'https://raw.githubusercontent.com/LucDinhLe/ai-for-boss-preview/main/releases/preview.json';
const number = version => Number(/^0\.0\.5-beta\.([0-9]+)$/u.exec(version)?.[1] ?? -1);
async function download(url, limit, fetcher) {
  const response = await fetcher(url, { signal: globalThis.AbortSignal.timeout(180000), redirect: 'follow' });
  if (!response.ok) throw new Error('Chưa tải được bản cập nhật. Hãy thử lại sau.');
  const final = new URL(response.url || url);
  if (final.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com'].includes(final.hostname)) throw new Error('Nguồn cập nhật không hợp lệ.');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw new Error('Gói cập nhật vượt kích thước cho phép.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export class UpdateService {
  constructor({ publicKey, version, currentRoot, dataRoot, fetcher = fetch }) {
    Object.assign(this, { publicKey, version, currentRoot, dataRoot, fetcher });
    this.root = path.join(dataRoot, 'versions'); this.file = path.join(dataRoot, 'state.json');
    this.state = { autoCheck: true, autoDownload: false, floor: 0 }; this.busy = false; this.message = ''; this.available = null;
  }
  async initialize() {
    try {
      const value = JSON.parse(await readFile(this.file, 'utf8'));
      if (typeof value.autoCheck !== 'boolean' || typeof value.autoDownload !== 'boolean' || !Number.isSafeInteger(value.floor) || value.floor < 0) throw new Error();
      this.state = value;
    } catch (error) { if (error.code !== 'ENOENT') this.message = 'Đã bỏ qua trạng thái cập nhật không đọc được.'; }
  }
  async save() {
    await mkdir(this.dataRoot, { recursive: true });
    const temporary = this.file + '.tmp'; await writeFile(temporary, JSON.stringify(this.state)); await rename(temporary, this.file);
  }
  describe() {
    return { currentVersion: this.version, availableVersion: this.available?.manifest.version ?? null, readyVersion: this.state.ready?.version ?? null,
      autoCheck: this.state.autoCheck, autoDownload: this.state.autoDownload, busy: this.busy, message: this.message };
  }
  async check() {
    const envelope = JSON.parse((await download(FEED, 13 * 1024 * 1024, this.fetcher)).toString());
    const manifest = verifyUpdateEnvelope(envelope, this.publicKey, this.state.floor);
    if (manifest.version === this.state.rejected) { this.available = null; this.message = 'Bản ' + manifest.version + ' đã khởi động lỗi. Đang giữ bản trước và chờ bản sửa.'; return; }
    this.available = number(manifest.version) > number(this.version) ? { manifest, envelope } : null;
    this.message = this.available ? 'Có bản thử mới: ' + manifest.version : 'Đang dùng bản thử mới nhất trên kênh này.';
  }
  async prepare() {
    await this.check(); if (!this.available) return;
    if (this.state.ready?.version === this.available.manifest.version) return;
    const result = await stageComponentUpdate({ envelope: this.available.envelope, publicKey: this.publicKey, minimumSequence: this.state.floor,
      currentRoot: this.currentRoot, updateRoot: this.root, download: (url, size) => download(url, size, this.fetcher) });
    this.state.ready = { version: result.version, envelope: this.available.envelope };
    await this.save(); this.message = 'Đã tải và kiểm tra. Bản mới sẽ được chọn khi mở lại ứng dụng.';
  }
  async run(input) {
    if (input?.action === 'update-status' && Object.keys(input).length === 1) return this.describe();
    if (this.busy) throw new Error('Đang xử lý bản cập nhật.');
    this.busy = true;
    try {
      if (input?.action === 'update-settings' && Object.keys(input).sort().join(',') === 'action,autoCheck,autoDownload'
        && typeof input.autoCheck === 'boolean' && typeof input.autoDownload === 'boolean') {
        this.state.autoCheck = input.autoCheck; this.state.autoDownload = input.autoDownload; await this.save();
      } else if (input?.action === 'update-check' && Object.keys(input).length === 1) await this.check();
      else if (input?.action === 'update-download' && Object.keys(input).length === 1) await this.prepare();
      else throw new Error('Thao tác cập nhật không hợp lệ.');
    } catch (error) { this.message = error.message; throw error; }
    finally { this.busy = false; }
    return this.describe();
  }
  async startupTarget() {
    if (this.state.pending) {
      const pending = verifyUpdateEnvelope(this.state.pending.envelope, this.publicKey);
      if (pending.version === this.version) return null;
      // Previous launch did not report a ready renderer/Gateway. Keep the old executable.
      this.state.rejected = pending.version; delete this.state.pending; delete this.state.active; await this.save();
      this.message = 'Bản mới chưa khởi động thành công. Đã quay về bản trước.'; return null;
    }
    const candidate = this.state.ready ?? this.state.active;
    if (!candidate) return null;
    const manifest = verifyUpdateEnvelope(candidate.envelope, this.publicKey, this.state.floor);
    if (manifest.version !== candidate.version || number(manifest.version) <= number(this.version)) return null;
    const directory = path.join(this.root, manifest.version); await verifyUpdateDirectory(directory, manifest);
    this.state.pending = candidate; delete this.state.ready; await this.save();
    return path.join(directory, 'AI-for-Boss.exe');
  }
  async markHealthy() {
    if (!this.state.pending) return;
    const manifest = verifyUpdateEnvelope(this.state.pending.envelope, this.publicKey);
    if (manifest.version !== this.version) return;
    this.state.active = this.state.pending; this.state.floor = Math.max(this.state.floor, manifest.sequence); delete this.state.pending;
    await this.save();
  }
  async background() {
    if (!this.state.autoCheck || this.busy) return;
    try { await this.run({ action: this.state.autoDownload ? 'update-download' : 'update-check' }); } catch { /* Status remains available in Settings. */ }
  }
}
