/** Optional official channel packages stay beside, never inside, the immutable core. */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestRoot = path.join(repo, 'manifests/channel-plugins');
export const CHANNEL_PACKAGES = Object.freeze(['discord', 'googlechat', 'whatsapp', 'zalo']);
const hash = value => createHash('sha256').update(value).digest('hex');
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
async function walk(root, relative = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, child));
    else if (entry.isFile()) files.push(child);
    else throw new Error(`Channel bundle may not contain links: ${child}`);
  }
  return files.sort();
}
export async function channelBundleInventory(root) {
  const files = await walk(root);
  const entries = [];
  const payloads = files.filter(file => file !== 'channel-plugins.json');
  for (let offset = 0; offset < payloads.length; offset += 24) {
    entries.push(...await Promise.all(payloads.slice(offset, offset + 24).map(async file => {
      const content = await fs.readFile(path.join(root, file));
      return { path: file.replaceAll('\\', '/'), bytes: content.length, sha256: hash(content) };
    })));
  }
  const plugins = [];
  for (const id of CHANNEL_PACKAGES) {
    const base = path.join(root, 'node_modules/@openclaw', id);
    const pkg = JSON.parse(await fs.readFile(path.join(base, 'package.json'), 'utf8'));
    const manifest = JSON.parse(await fs.readFile(path.join(base, 'openclaw.plugin.json'), 'utf8'));
    if (pkg.name !== `@openclaw/${id}` || pkg.version !== '2026.9.1' || manifest.id !== id
      || pkg.openclaw?.compat?.pluginApi !== '>=2026.9.1') throw new Error(`Unexpected official package identity: ${id}`);
    for (const entry of [...pkg.openclaw.runtimeExtensions ?? [], pkg.openclaw.runtimeSetupEntry]) {
      if (!entry || !path.resolve(base, entry).startsWith(`${base}${path.sep}`) || !await exists(path.resolve(base, entry))) throw new Error(`Missing compiled entry for ${id}`);
    }
    plugins.push({ id, name: pkg.name, version: pkg.version, pluginApi: pkg.openclaw.compat.pluginApi,
      runtime: pkg.openclaw.runtimeExtensions, setup: pkg.openclaw.runtimeSetupEntry });
  }
  if (entries.some(entry => /(^|\/)node_modules\/openclaw\//u.test(entry.path))) throw new Error('Channel bundle contains a duplicate OpenClaw core.');
  return { plugins, files: entries.length, bytes: entries.reduce((total, entry) => total + entry.bytes, 0), entries };
}
export async function stageChannelPlugins({ force = false, npm = process.platform === 'win32' ? 'npm.cmd' : 'npm' } = {}) {
  const root = path.join(repo, 'apps/desktop/resources/bundle/channel-plugins');
  const packageBytes = await fs.readFile(path.join(manifestRoot, 'package.json'));
  const lockBytes = await fs.readFile(path.join(manifestRoot, 'package-lock.json'));
  const lockHash = hash(lockBytes);
  const marker = path.join(root, 'channel-plugins.json');
  if (!force && await exists(marker)) {
    const prior = JSON.parse(await fs.readFile(marker, 'utf8'));
    if (prior.lockSha256 === lockHash) {
      const actual = await channelBundleInventory(root);
      if (JSON.stringify(actual.entries) === JSON.stringify(prior.entries)) return { root, ...prior };
    }
    throw new Error('Staged channel bundle differs from its pin; use --force to rebuild this staging directory.');
  }
  if (await exists(root)) {
    if (!force) throw new Error('Incomplete channel staging exists; review its failure before using --force.');
    // Fixed staging root; it is a sibling of core node_modules and never a previous release.
    const real = await fs.realpath(root), expected = path.resolve(root);
    if (real.toLowerCase() !== expected.toLowerCase()) throw new Error('Refusing linked channel staging directory.');
    await fs.rm(root, { recursive: true, force: true });
  }
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(path.join(root, 'package.json'), packageBytes);
  await fs.writeFile(path.join(root, 'package-lock.json'), lockBytes);
  await new Promise((resolve, reject) => {
    const child = spawn(npm, ['ci', '--ignore-scripts', '--omit=dev', '--legacy-peer-deps', '--no-audit', '--no-fund'], {
      cwd: root, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Channel npm ci exited ${code}`)));
  });
  const lock = JSON.parse(lockBytes);
  const inventory = await channelBundleInventory(root);
  const result = { schemaVersion: 1, coreVersion: '2026.9.1', lockSha256: lockHash, packageSha256: hash(packageBytes),
    installScriptsExecuted: false, peerCoreInstalled: false, createdAt: new Date().toISOString(),
    sources: CHANNEL_PACKAGES.map(id => { const pkg = lock.packages[`node_modules/@openclaw/${id}`];
      return { id, name: `@openclaw/${id}`, version: pkg.version, resolved: pkg.resolved, integrity: pkg.integrity }; }), ...inventory };
  await fs.writeFile(marker, `${JSON.stringify(result, null, 2)}\n`);
  return { root, ...result };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await stageChannelPlugins({ force: process.argv.includes('--force') });
  console.log(JSON.stringify({ root: result.root, files: result.files, bytes: result.bytes, plugins: result.plugins, lockSha256: result.lockSha256 }));
}
