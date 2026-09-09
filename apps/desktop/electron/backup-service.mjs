import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import JSZip from 'jszip';
import { encryptBackup, decryptBackup } from './backup-crypto.mjs';

const exists = async file => fs.lstat(file).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
const json = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const uuid = /^[a-f0-9-]{36}$/u;
async function boundedEntry(entry, limit) {
  if (!entry) throw new Error('Bản sao lưu thiếu thành phần bắt buộc.');
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const stream = entry.nodeStream();
    stream.on('data', chunk => {
      size += chunk.length;
      if (size > limit) { stream.pause(); stream.destroy?.(); reject(new Error('Thành phần sao lưu vượt giới hạn.')); }
      else chunks.push(chunk);
    });
    stream.once('error', reject); stream.once('end', () => resolve(Buffer.concat(chunks)));
  });
}
export function cleanLayout(value) {
  const n = (key, min, max, fallback) => Number.isInteger(value?.[key]) && value[key] >= min && value[key] <= max ? value[key] : fallback;
  return { leftHidden: value?.leftHidden === true, rightHidden: value?.rightHidden === true, railWidth: n('railWidth', 180, 320, 230),
    dockWidth: n('dockWidth', 240, 960, 320), textSize: n('textSize', 12, 18, 14), theme: value?.theme === 'dark' ? 'dark' : 'light' };
}
async function plain(file) {
  let current = path.resolve(file);
  while (true) {
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Không dùng liên kết thư mục cho sao lưu và khôi phục.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}
async function writeJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, file);
}
export function nativeBackupRunner({ node, entry, state, environment = process.env }) {
  const children = new Set();
  const run = (args, stateOverride = state) => new Promise((resolve, reject) => {
    let output = '', settled = false;
    const child = spawn(node, [entry, ...args], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
      ...environment, OPENCLAW_STATE_DIR: stateOverride, OPENCLAW_CONFIG_PATH: path.join(stateOverride, 'openclaw.json'), OPENCLAW_NO_RESPAWN: '1',
      OPENCLAW_SKIP_CHANNELS: '1', OPENCLAW_SKIP_PROVIDERS: '1', OPENCLAW_DISABLE_BONJOUR: '1' } });
    children.add(child);
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(output); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Sao lưu quá thời gian cho phép; dữ liệu hiện tại được giữ nguyên.')); }, 20 * 60_000);
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 4 * 1024 * 1024) { child.kill(); finish(new Error('Kết quả kiểm tra vượt giới hạn.')); } });
    child.stderr.resume(); // Never return native diagnostic text containing paths/config/credentials to the renderer.
    child.once('error', () => { children.delete(child); finish(new Error('Chưa khởi chạy được công cụ sao lưu.')); });
    child.once('exit', code => { children.delete(child); finish(code === 0 ? null : new Error('OpenClaw chưa xác nhận thao tác sao lưu. Dữ liệu hiện tại được giữ nguyên.')); });
  });
  run.stop = () => Promise.all([...children].map(child => new Promise(resolve => { child.once('exit', resolve); child.once('error', resolve); child.kill(); })));
  return run;
}

/** Fixed profile roots, native archive verification and encrypted recovery. No renderer paths. */
export class BackupService {
  #layoutTail = Promise.resolve();
  constructor({ root, version, native, protect, unprotect, chooseSave, chooseOpen, confirm, exclusive, pause, onRestored }) {
    Object.assign(this, { root: path.resolve(root), version, native, protect, unprotect, chooseSave, chooseOpen, confirm, exclusive, pause, onRestored });
    this.directory = path.join(this.root, 'backups'); this.state = path.join(this.root, 'openclaw-state');
    this.settings = { enabled: true, everyDays: 1, retain: 3, includeWorkspace: false };
    this.records = []; this.busy = false; this.message = ''; this.startedAt = null;
  }
  async initialize() {
    await plain(this.directory); await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (await exists(path.join(this.directory, 'index.json'))) {
      const data = await json(path.join(this.directory, 'index.json'));
      this.settings = this.validateSettings(data.settings);
      if (!Array.isArray(data.records) || data.records.some(r => !uuid.test(r.id) || !Number.isFinite(r.createdAt))) throw new Error('Danh sách sao lưu cần kiểm tra.');
      this.records = data.records;
    }
  }
  validateSettings(value) {
    if (typeof value?.enabled !== 'boolean' || ![1, 7].includes(value.everyDays) || ![3, 5, 10].includes(value.retain) || typeof value.includeWorkspace !== 'boolean') throw new Error('Cài đặt sao lưu không hợp lệ.');
    return { enabled: value.enabled, everyDays: value.everyDays, retain: value.retain, includeWorkspace: value.includeWorkspace };
  }
  async save() { await writeJson(path.join(this.directory, 'index.json'), { settings: this.settings, records: this.records }); }
  describe() { return { settings: this.settings, records: this.records, busy: this.busy, message: this.message, startedAt: this.startedAt, directory: this.directory }; }
  async layout(value) {
    const file = path.join(this.root, 'aifb-layout.json');
    if (value !== undefined) {
      const write = this.#layoutTail.then(() => writeJson(file, cleanLayout(value)));
      this.#layoutTail = write.catch(() => {}); await write;
    } else await this.#layoutTail;
    return await exists(file) ? cleanLayout(await json(file)) : null;
  }
  async work(operation) {
    if (this.busy) throw new Error('Một thao tác dữ liệu đang chạy.');
    this.busy = true; this.startedAt = Date.now(); this.message = 'Đang chuẩn bị…';
    try { this.running = this.exclusive(operation); return await this.running; }
    catch (error) { this.message = error.message; throw error; }
    finally { this.busy = false; this.startedAt = null; this.running = null; }
  }
  async stop() { await this.native.stop?.(); await this.running?.catch(() => {}); }
  async create({ password, includeWorkspace = this.settings.includeWorkspace, destination } = {}) {
    const temporary = await fs.mkdtemp(path.join(this.directory, 'working-'));
    try {
      this.message = 'OpenClaw đang tạo và kiểm tra bản sao lưu…';
      const archive = path.join(temporary, 'core.tar.gz');
      const result = JSON.parse(await this.native(['backup', 'create', '--output', archive, '--verify', ...(includeWorkspace ? [] : ['--no-include-workspace']), '--json']));
      if (result.verified !== true || !Array.isArray(result.assets)) throw new Error('Chưa xác nhận toàn vẹn bản sao lưu.');
      if ((await fs.stat(archive)).size > 700 * 1024 * 1024) throw new Error('Bản sao lưu vượt giới hạn 700 MB của bản thử.');
      this.message = 'Đang mã hóa và lưu bản sao lưu…';
      const zip = new JSZip(); zip.file('core.tar.gz', await fs.readFile(archive));
      const shell = { layout: await this.layout() };
      const projects = path.join(this.root, 'aifb-projects');
      if (await exists(projects)) {
        await plain(projects);
        for (const entry of await fs.readdir(projects, { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
          const file = path.join(projects, entry.name); await plain(file);
          if ((await fs.stat(file)).size > 8 * 1024 * 1024) throw new Error('Dữ liệu dự án vượt giới hạn sao lưu.');
          zip.file(`projects/${entry.name}`, await fs.readFile(file));
        }
      }
      zip.file('shell.json', JSON.stringify(shell));
      zip.file('manifest.json', JSON.stringify({ schema: 1, version: this.version, native: result }));
      const data = encryptBackup(await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }), { password, protect: this.protect, version: this.version });
      const id = randomUUID(), file = destination ?? path.join(this.directory, `${id}.aifb`);
      await fs.writeFile(file, data, { flag: 'wx', mode: 0o600 });
      if (!destination) {
        this.records.unshift({ id, createdAt: Date.now(), bytes: data.length, version: this.version, includeWorkspace }); await this.save();
        // Retain only indexed archives; never enumerate/delete foreign files.
        while (this.records.length > this.settings.retain) {
          const old = this.records.at(-1), target = path.join(this.directory, `${old.id}.aifb`); await plain(target);
          await fs.unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; }); this.records.pop(); await this.save();
        }
      }
      this.message = 'Đã lưu bản sao lưu có mã hóa và đã kiểm tra.';
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
  }
  async restore(file, password) {
    await plain(file);
    if ((await fs.stat(file)).size > 768 * 1024 * 1024) throw new Error('Tệp vượt giới hạn của bản thử.');
    this.message = 'Đang mở và kiểm tra bản sao lưu…';
    const zip = await JSZip.loadAsync(decryptBackup(await fs.readFile(file), { password, unprotect: this.unprotect }));
    let expanded = 0;
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      if (!['core.tar.gz', 'shell.json', 'manifest.json'].includes(name) && !/^projects\/[a-zA-Z0-9_.-]+\.json$/u.test(name)) throw new Error('Bản sao lưu có đường dẫn ngoài phạm vi.');
      expanded += entry._data?.uncompressedSize ?? 0;
      if (expanded > 768 * 1024 * 1024) throw new Error('Dữ liệu giải nén vượt giới hạn.');
    }
    const temporary = await fs.mkdtemp(path.join(this.directory, 'restore-'));
    try {
      const archive = path.join(temporary, 'core.tar.gz');
      await fs.writeFile(archive, await boundedEntry(zip.file('core.tar.gz'), 700 * 1024 * 1024), { mode: 0o600 });
      const restored = path.join(temporary, 'verified');
      await this.native(['backup', 'restore', archive, '--target', restored, '--json']);
      // Read the manifest verified/extracted by OpenClaw, not wrapper-supplied paths.
      const roots = await fs.readdir(restored);
      if (roots.length !== 1) throw new Error('Bố cục phục hồi không hợp lệ.');
      const manifest = await json(path.join(restored, roots[0], 'manifest.json'));
      const assets = manifest.assets;
      if (manifest.runtimeVersion !== '2026.9.1') throw new Error('Bản sao lưu dùng phiên bản lõi khác; cần kiểm tra migration trước khi phục hồi.');
      if (!Array.isArray(assets) || assets.length !== 1 || assets[0].kind !== 'state') throw new Error('Bản này có thư mục bên ngoài dữ liệu ứng dụng. Chưa hỗ trợ tự ghi đè các thư mục đó; dữ liệu hiện tại được giữ nguyên.');
      if (path.resolve(assets[0].sourcePath).toLowerCase() !== this.state.toLowerCase()) throw new Error('Bản thử chỉ khôi phục vào đúng thư mục dữ liệu ban đầu. Chưa tự chuyển đường dẫn cấu hình sang máy hoặc tài khoản khác.');
      const stagedState = path.resolve(restored, assets[0].archivePath);
      if (!stagedState.startsWith(restored + path.sep)) throw new Error('Đường dẫn phục hồi không hợp lệ.');
      await plain(stagedState);
      // New shell device identity on recovery; never reuse its pairing token.
      for (const name of ['device-identity.json', 'device-token.json']) await fs.unlink(path.join(stagedState, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
      this.message = 'Đang kiểm tra cấu hình phục hồi…';
      await this.native(['config', 'validate', '--json'], stagedState);
      const shell = JSON.parse(await boundedEntry(zip.file('shell.json'), 1024 * 1024));
      const stagedProjects = path.join(temporary, 'projects'); await fs.mkdir(stagedProjects);
      for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir && name.startsWith('projects/')) await fs.writeFile(path.join(stagedProjects, path.basename(name)), await boundedEntry(entry, 8 * 1024 * 1024), { mode: 0o600 });
      if (!await this.confirm('Khôi phục sẽ thay cấu hình, lịch sử và thông tin kết nối hiện tại. Bản hiện tại được giữ để hoàn tác. Gateway sẽ dừng để anh kiểm tra trước khi tiếp tục.')) return;
      await this.pause();
      await plain(this.state);
      const rollback = path.join(this.directory, `rollback-${randomUUID()}`); await fs.mkdir(rollback, { mode: 0o700 });
      const projects = path.join(this.root, 'aifb-projects'); await plain(projects);
      const priorState = await exists(this.state), priorProjects = await exists(projects), priorLayout = await this.layout();
      let installedState = false, installedProjects = false;
      try {
        if (priorState) await fs.rename(this.state, path.join(rollback, 'state'));
        await fs.rename(stagedState, this.state);
        installedState = true;
        if (priorProjects) await fs.rename(projects, path.join(rollback, 'projects'));
        await fs.rename(stagedProjects, projects);
        installedProjects = true;
        if (shell.layout) await this.layout(shell.layout);
        await this.onRestored();
      } catch (error) {
        if (installedState) await fs.rename(this.state, path.join(temporary, 'failed-state'));
        if (await exists(path.join(rollback, 'state'))) {
          await fs.rename(path.join(rollback, 'state'), this.state);
        }
        if (installedProjects) await fs.rename(projects, path.join(temporary, 'failed-projects'));
        if (await exists(path.join(rollback, 'projects'))) {
          await fs.rename(path.join(rollback, 'projects'), projects);
        }
        if (priorLayout) await this.layout(priorLayout);
        else await fs.unlink(path.join(this.root, 'aifb-layout.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
        throw error;
      }
      this.message = 'Đã khôi phục. Gateway đang dừng; kiểm tra kênh và lịch tự động trước khi tiếp tục. Bản trước nằm trong thư mục rollback.';
    } finally { await fs.rm(temporary, { recursive: true, force: true }); }
    return true;
  }
  async run(input) {
    const allowed = { 'data-status': ['action'], 'data-settings': ['action', 'settings'], 'data-backup': ['action'], 'data-export': ['action', 'password', 'includeWorkspace'],
      'data-import': ['action', 'password'], 'data-restore': ['action', 'id'], 'data-delete': ['action', 'id'], 'data-layout': ['action', 'layout'] };
    if (!input || !allowed[input.action] || Object.keys(input).some(key => !allowed[input.action].includes(key))) throw new Error('Thao tác dữ liệu không hợp lệ.');
    if (input.action === 'data-status') return this.describe();
    if (input.action === 'data-layout') return { layout: await this.layout(input.layout) };
    await this.work(async () => {
      if (input.action === 'data-settings') { this.settings = this.validateSettings(input.settings); await this.save(); this.message = 'Đã lưu cài đặt sao lưu.'; }
      else if (input.action === 'data-backup') await this.create();
      else if (input.action === 'data-export') {
        if (typeof input.password !== 'string' || input.password.length < 12 || input.password.length > 1024 || typeof input.includeWorkspace !== 'boolean') throw new Error('Nhập mật khẩu sao lưu ít nhất 12 ký tự.');
        const destination = await this.chooseSave(); if (destination) await this.create({ destination, password: input.password, includeWorkspace: input.includeWorkspace });
      } else if (input.action === 'data-import') { const file = await this.chooseOpen(); if (file) await this.restore(file, input.password); }
      else {
        if (!uuid.test(input.id) || !this.records.some(r => r.id === input.id)) throw new Error('Không tìm thấy bản sao lưu.');
        const file = path.join(this.directory, `${input.id}.aifb`);
        if (input.action === 'data-restore') await this.restore(file);
        else if (await this.confirm('Xóa bản sao lưu đã chọn? Dữ liệu đang sử dụng được giữ nguyên.')) { await plain(file); await fs.unlink(file); this.records = this.records.filter(r => r.id !== input.id); await this.save(); }
      }
    });
    return { ...this.describe(), layout: await this.layout() };
  }
  async automatic() {
    if (!this.settings.enabled || this.busy || Date.now() - (this.records[0]?.createdAt ?? 0) < this.settings.everyDays * 86_400_000) return;
    try { await this.work(() => this.create()); } catch { /* Error remains visible in Settings; retry at next idle check. */ }
  }
}
