import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ids = new Set(['zalo', 'whatsapp', 'discord', 'googlechat']);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const execute = promisify(execFile);
const exists = async file => { try { await fs.access(file); return true; } catch { return false; } };
const bundleError = () => new Error('Bộ plugin bị thiếu hoặc thay đổi. Hãy cài lại AI for Boss.');
async function bundleFiles(root, relative = '') {
  const directory = path.join(root, relative);
  const info = await fs.lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw bundleError();
  const result = [];
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const name = relative ? `${relative}/${item.name}` : item.name;
    if (item.isSymbolicLink()) throw bundleError();
    if (item.isDirectory()) result.push(...await bundleFiles(root, name));
    else if (item.isFile()) result.push(name);
    else throw bundleError();
  }
  return result.sort();
}
async function stopOwnedProcess(child) {
  if (child.exitCode !== null || !Number.isSafeInteger(child.pid) || child.pid <= 0) return;
  if (process.platform === 'win32') await execute(path.join(process.env.SystemRoot, 'System32/taskkill.exe'),
    ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 5000 }).catch(() => {});
  else child.kill('SIGTERM');
}

export function channelInstallerEnvironment({ home, stateDirectory, nodeExecutable, npmDirectory, env = process.env }) {
  const result = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) if (env[key]) result[key] = env[key];
  return { ...result, HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'appdata'), LOCALAPPDATA: path.join(home, 'localappdata'),
    TMP: path.join(home, 'tmp'), TEMP: path.join(home, 'tmp'),
    PATH: [path.dirname(nodeExecutable), npmDirectory, ...(env.SystemRoot ? [path.join(env.SystemRoot, 'System32')] : [])].join(path.delimiter),
    OPENCLAW_STATE_DIR: stateDirectory, OPENCLAW_CONFIG_PATH: path.join(stateDirectory, 'openclaw.json'),
    NPM_CONFIG_USERCONFIG: path.join(home, 'npmrc'), NPM_CONFIG_GLOBALCONFIG: path.join(home, 'global-npmrc'),
    NPM_CONFIG_OFFLINE: 'true', NPM_CONFIG_IGNORE_SCRIPTS: 'true', NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NO_COLOR: '1', CI: 'true' };
}

/** Fixed official plugin IDs only. Native CLI owns installation, policy and provenance. */
export class ChannelPluginInstaller {
  #child = null;
  #closed = false;
  #busy = false;
  #cancelCurrent = null;
  #stoppingChild = null;
  constructor({ bundleRoot, stateDirectory, nodeExecutable, openclawEntry, spawnProcess = spawn, stopProcess = stopOwnedProcess }) {
    Object.assign(this, { bundleRoot, stateDirectory, nodeExecutable, openclawEntry, spawnProcess, stopProcess });
  }
  async install(id) {
    if (!ids.has(id)) throw new Error('Plugin không thuộc bộ kênh chính thức của bản cài.');
    if (this.#closed || this.#busy || this.#child) throw new Error('Trình cài plugin chưa sẵn sàng.');
    this.#busy = true;
    try {
      const sourceFiles = await bundleFiles(this.bundleRoot);
      const markerBytes = await fs.readFile(path.join(this.bundleRoot, 'channel-installer.json'));
      const marker = JSON.parse(markerBytes);
      const plugin = marker.plugins?.find(item => item.id === id);
      if (marker.coreVersion !== '2026.9.1' || marker.nodeVersion !== '24.19.0' || plugin?.name !== `@openclaw/${id}`
        || plugin.version !== '2026.9.1' || plugin.spec !== `@openclaw/${id}@2026.9.1`
        || !Array.isArray(marker.entries) || !marker.entries.length) throw new Error('Bộ plugin chưa đúng phiên bản.');
      const listed = new Set();
      for (const entry of marker.entries) {
        if (typeof entry.path !== 'string' || path.isAbsolute(entry.path) || entry.path.split(/[\\/]/u).some(part => !part || part === '..' || part === '.')
          || entry.path.includes(':') || [...entry.path].some(character => character.charCodeAt(0) < 32)
          || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0
          || !/^[a-f0-9]{64}$/u.test(entry.sha256)) throw new Error('Bộ plugin chưa đúng định dạng.');
        const canonical = entry.path.replaceAll('\\', '/');
        const identity = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
        if (listed.has(identity) || canonical === 'channel-installer.json') throw new Error('Bộ plugin chưa đúng định dạng.');
        listed.add(identity);
        const target = path.resolve(this.bundleRoot, entry.path);
        if (!target.startsWith(path.resolve(this.bundleRoot) + path.sep)) throw new Error('Đường dẫn bộ plugin chưa hợp lệ.');
        const info = await fs.lstat(target);
        if (!info.isFile() || info.isSymbolicLink() || info.size !== entry.bytes || digest(await fs.readFile(target)) !== entry.sha256) throw bundleError();
        if (this.#closed) throw new Error('Đã dừng chuẩn bị plugin.');
      }
      const payloadFiles = sourceFiles.filter(name => name !== 'channel-installer.json');
      if (payloadFiles.length !== listed.size || payloadFiles.some(name => !listed.has(process.platform === 'win32' ? name.toLowerCase() : name))) throw bundleError();
      if (this.#closed) throw new Error('Đã dừng chuẩn bị plugin.');
      const home = path.join(this.stateDirectory, 'aifb-channel-installer', digest(markerBytes).slice(0, 20));
      await fs.mkdir(home, { recursive: true });
      if (!await exists(path.join(home, 'cache-ready'))) {
        await fs.cp(path.join(this.bundleRoot, 'cache'), path.join(home, 'cache'), { recursive: true });
        await fs.writeFile(path.join(home, 'cache-ready'), digest(markerBytes));
      }
      for (const name of ['tmp', 'appdata', 'localappdata']) await fs.mkdir(path.join(home, name), { recursive: true });
      await fs.writeFile(path.join(home, 'npmrc'), `cache=${path.join(home, 'cache').replaceAll('\\', '/')}\noffline=true\nignore-scripts=true\nregistry=https://registry.npmjs.org/\naudit=false\nfund=false\n`);
      await fs.writeFile(path.join(home, 'global-npmrc'), '');
      if (this.#closed) throw new Error('Đã dừng chuẩn bị plugin.');
      const started = Date.now();
      const result = await new Promise((resolve, reject) => {
        let tail = '', settled = false;
        const child = this.spawnProcess(this.nodeExecutable, [this.openclawEntry, 'plugins', 'install', plugin.spec, '--pin'], {
          cwd: home, env: channelInstallerEnvironment({ home, stateDirectory: this.stateDirectory,
            nodeExecutable: this.nodeExecutable, npmDirectory: path.join(this.bundleRoot, 'npm') }),
          windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        this.#child = child;
        let timeout;
        const finish = (error, value) => {
          if (settled) return; settled = true; clearTimeout(timeout);
          if (this.#cancelCurrent === cancel) this.#cancelCurrent = null;
          if (error) reject(error); else resolve(value);
        };
        const cancel = message => {
          // Settle the request even when a failed process cleanup emits no exit.
          // Keep the child tracked so another installation cannot overlap it.
          finish(new Error(message)); void this.#stopChild(child);
        };
        this.#cancelCurrent = cancel;
        timeout = setTimeout(() => cancel('Chuẩn bị plugin quá thời gian. Hãy thử lại sau khi tiến trình trước đã dừng.'), 240000);
        const collect = chunk => { tail = (tail + chunk.toString()).slice(-12000); };
        child.stdout?.on('data', collect); child.stderr?.on('data', collect);
        child.once('error', () => {
          if (!child.pid && this.#child === child) this.#child = null;
          finish(new Error('Chưa chạy được trình cài plugin đi kèm.'));
          if (this.#child === child) void this.#stopChild(child);
        });
        child.once('exit', code => {
          if (this.#child === child) this.#child = null;
          if (code === 0 && !this.#closed) finish(null, { id, version: plugin.version, elapsedMs: Date.now() - started, nativeExitCode: code });
          else finish(new Error(this.#closed ? 'Đã dừng chuẩn bị plugin.' : /ENOTCACHED|cache mode is .only-if-cached./iu.test(tail)
            ? 'Bộ cài còn thiếu dữ liệu plugin ngoại tuyến.' : /policy|consent|review required/iu.test(tail)
              ? 'Chính sách OpenClaw chưa cho phép cài plugin này.' : 'Chưa hoàn tất cài plugin. Hãy thử lại sau khi Gateway sẵn sàng.'));
        });
      });
      return result;
    } finally { this.#busy = false; }
  }
  async #stopChild(child) {
    if (this.#stoppingChild?.child === child) return this.#stoppingChild.promise;
    if (child !== this.#child || child.exitCode !== null) return;
    const stopping = { child, promise: null };
    this.#stoppingChild = stopping;
    stopping.promise = Promise.resolve().then(() => this.stopProcess(child))
      .catch(() => { /* Still tracked until an actual exit; no overlapping install. */ })
      .finally(() => { if (this.#stoppingChild === stopping) this.#stoppingChild = null; });
    return stopping.promise;
  }
  async stop() {
    this.#closed = true;
    this.#cancelCurrent?.('Đã dừng chuẩn bị plugin.');
    if (this.#child) await this.#stopChild(this.#child);
  }
}
