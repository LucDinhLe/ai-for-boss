/** Standard pinned npm plus a public-only offline cache, separate from the immutable engine. */
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestRoot = path.join(repo, 'manifests/channel-installer');
const markerName = 'channel-installer.json';
const execute = promisify(execFile), activeChildren = new Set();
const sha256 = data => createHash('sha256').update(data).digest('hex');
async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
function inside(root, file) { const relative = path.relative(root, file); return relative && !relative.startsWith('..') && !path.isAbsolute(relative); }
async function command(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '', stderr = '', failure = null;
    if (child.pid) activeChildren.add(child);
    const stop = async error => {
      if (failure || child.exitCode !== null) return;
      failure = error;
      try {
        if (process.platform === 'win32') await execute(path.join(process.env.SystemRoot, 'System32/taskkill.exe'),
          ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000 });
        else process.kill(-child.pid, 'SIGKILL');
      } catch (cause) {
        if (activeChildren.has(child)) reject(new Error('Unable to confirm owned staging process-tree cleanup; temporary files retained', { cause }));
      }
      setTimeout(() => { if (activeChildren.has(child)) reject(new Error('Owned staging process did not close; temporary files retained')); }, 2000).unref();
    };
    const deadline = setTimeout(() => { void stop(new Error('Staging command exceeded ten-minute deadline')); }, 600000);
    child.stdout.on('data', data => { stdout += data.toString(); if (stdout.length > 8 * 1024 * 1024) void stop(new Error('Command output exceeded staging limit')); });
    child.stderr.on('data', data => { stderr = (stderr + data.toString()).slice(-6000); });
    child.once('error', error => { clearTimeout(deadline); reject(error); });
    child.once('close', code => {
      clearTimeout(deadline); activeChildren.delete(child);
      if (failure) reject(failure);
      else if (code === 0) resolve(stdout);
      else reject(new Error(`Staging command failed (${code}): ${stderr}`));
    });
  });
}
async function managedDependencies(stateDirectory, plugin, pin) {
  const projects = path.join(stateDirectory, 'npm/projects'), matches = [];
  for (const entry of await fs.readdir(projects, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projects, entry.name, 'package-lock.json');
    if (!await exists(file)) continue;
    const lock = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!lock.packages?.['']?.dependencies?.[plugin.name]) continue;
    const packages = [];
    for (const [name, value] of Object.entries(lock.packages)) {
      if (!value.resolved || value.link) continue;
      if (!value.resolved.startsWith(pin.registry) || !value.integrity) throw new Error(`Unexpected managed package source: ${name}`);
      packages.push({ path: name, version: value.version, resolved: value.resolved, integrity: value.integrity });
    }
    matches.push({ schemaVersion: 1, coreVersion: pin.coreVersion, plugin: `${plugin.name}@${plugin.version}`, packages });
  }
  if (matches.length !== 1) throw new Error(`Expected one native managed project for ${plugin.id}`);
  return matches[0];
}
async function seedNativeInstaller({ work, toolkit, userconfig, pin, pluginSources, commands }) {
  const core = path.join(repo, 'apps/desktop/resources/bundle/node_modules/openclaw');
  const nodeExecutable = path.join(repo, 'apps/desktop/resources/runtime/node', process.platform === 'win32' ? 'node.exe' : 'node');
  if (JSON.parse(await fs.readFile(path.join(core, 'package.json'), 'utf8')).version !== pin.coreVersion) throw new Error('Native installer must use the pinned staged engine');
  if (await exists(path.join(path.dirname(nodeExecutable), 'node_modules/npm/bin/npm-cli.js'))) throw new Error('Staged runtime must not resolve an adjacent npm instead of the pinned toolkit');
  if ((await command(nodeExecutable, ['--version'], { env: isolatedEnvironment(work, toolkit, userconfig) })).trim() !== `v${pin.nodeVersion}`) throw new Error('Native installer Node version differs from its pin');
  const recorded = new Map();
  // Native install synchronizes the engine's managed peer closure after ordinary npm install.
  // Seed that actual path, then repeat in a fresh profile with registry access disabled.
  for (const offline of [false, true]) {
    const profile = path.join(work, offline ? 'native-offline' : 'native-online'), stateDirectory = path.join(profile, 'state');
    for (const name of ['', 'state', 'appdata', 'localappdata', 'tmp']) await fs.mkdir(path.join(profile, name), { recursive: true });
    const config = path.join(profile, 'openclaw.json');
    await fs.writeFile(config, JSON.stringify({ gateway: { mode: 'local', bind: 'loopback' },
      update: { checkOnStart: false, auto: { enabled: false } }, telemetry: { enabled: false },
      cron: { enabled: false, triggers: { enabled: false } }, plugins: {}, channels: {}, tools: { profile: 'minimal', deny: ['*'] } }));
    await fs.writeFile(path.join(profile, 'global-npmrc'), '');
    const env = { ...isolatedEnvironment(profile, toolkit, userconfig), OPENCLAW_HOME: profile, OPENCLAW_STATE_DIR: stateDirectory,
      PATH: [toolkit, path.dirname(nodeExecutable), process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32')].filter(Boolean).join(path.delimiter),
      OPENCLAW_CONFIG_PATH: config, OPENCLAW_SKIP_CHANNELS: '1', OPENCLAW_DISABLE_BONJOUR: '1', OPENCLAW_EXEC_SHELL_SNAPSHOT: '0',
      OPENCLAW_NO_RESPAWN: '1', OPENCLAW_NO_AUTO_UPDATE: '1', ...(offline ? { NPM_CONFIG_OFFLINE: 'true' } : {}) };
    for (const plugin of pluginSources) {
      const args = ['plugins', 'install', plugin.spec, '--pin'];
      commands.push({ command: 'openclaw', args, offline });
      await command(nodeExecutable, [path.join(core, 'openclaw.mjs'), ...args], { env, cwd: profile });
      const lock = await managedDependencies(stateDirectory, plugin, pin);
      if (!offline) recorded.set(plugin.id, lock);
      else {
        if (JSON.stringify(recorded.get(plugin.id)) !== JSON.stringify(lock)) throw new Error(`Native offline dependency closure changed for ${plugin.id}`);
        const file = path.join(manifestRoot, `native-${plugin.id}.lock.json`);
        if (await exists(file)) {
          if (JSON.stringify(JSON.parse(await fs.readFile(file, 'utf8'))) !== JSON.stringify(lock)) throw new Error(`Native dependency resolution changed for ${plugin.id}; review and repin`);
        } else await fs.writeFile(file, JSON.stringify(lock, null, 2) + '\n', { flag: 'wx' });
        plugin.offlineNativeInstall = true;
        plugin.nativeLockSha256 = sha256(Buffer.from(JSON.stringify(lock)));
        plugin.nativeDependencyPackages = lock.packages.length;
      }
      console.log(`[channel installer] ${plugin.id}: genuine native install passed ${offline ? 'offline' : 'online'}`);
    }
  }
}
function integrity(data, expected) {
  const [algorithm, digest] = expected.split('-', 2);
  if (!['sha512', 'sha256'].includes(algorithm) || createHash(algorithm).update(data).digest('base64') !== digest) throw new Error('Public package integrity mismatch');
}
async function extract(archive, destination, env) {
  const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32/tar.exe') : 'tar';
  const list = await command(tar, ['-tf', archive], { env });
  for (const entry of list.split(/\r?\n/u).filter(Boolean)) {
    if (!entry.startsWith('package/') || entry.includes('\\') || entry.split('/').includes('..') || [...entry].some(character => character.charCodeAt(0) < 32)) throw new Error('Unsafe package archive path');
  }
  const details = await command(tar, ['-tvf', archive], { env });
  if (details.split(/\r?\n/u).some(line => line && !['-', 'd'].includes(line[0]))) throw new Error('Package archives must contain only regular files and directories');
  await fs.mkdir(destination, { recursive: true });
  await command(tar, ['-xf', archive, '-C', destination], { env });
}
async function files(root, relative = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) result.push(...await files(root, child));
    else if (entry.isFile()) result.push(child);
    else throw new Error(`Linked file is not allowed in installer staging: ${child}`);
  }
  return result.sort();
}
export async function channelInstallerInventory(root) {
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Installer root must be a regular directory');
  const paths = (await files(root)).filter(file => file !== markerName);
  const entries = [];
  for (let offset = 0; offset < paths.length; offset += 16) entries.push(...await Promise.all(paths.slice(offset, offset + 16).map(async file => {
    const data = await fs.readFile(path.join(root, file)); return { path: file.replaceAll('\\', '/'), bytes: data.length, sha256: sha256(data) };
  })));
  const marker = path.join(root, markerName);
  const plugins = await exists(marker) ? JSON.parse(await fs.readFile(marker, 'utf8')).plugins : undefined;
  return { files: entries.length, bytes: entries.reduce((total, item) => total + item.bytes, 0), entries, ...(plugins ? { plugins } : {}) };
}
/** Validate both source and copied payloads against repository pins, never just their own marker. */
export async function verifyChannelInstaller(root, { repositoryRoot = repo } = {}) {
  const pinsRoot = path.join(repositoryRoot, 'manifests/channel-installer');
  const [pinBytes, pluginLockBytes, markerBytes] = await Promise.all([
    fs.readFile(path.join(pinsRoot, 'toolkit.lock.json')),
    fs.readFile(path.join(repositoryRoot, 'manifests/channel-plugins/package-lock.json')),
    fs.readFile(path.join(root, markerName))
  ]);
  const pin = JSON.parse(pinBytes), pluginLock = JSON.parse(pluginLockBytes), marker = JSON.parse(markerBytes);
  if (marker.schemaVersion !== 1 || marker.coreVersion !== pin.coreVersion || marker.nodeVersion !== pin.nodeVersion
    || marker.pinSha256 !== sha256(pinBytes) || marker.pluginLockSha256 !== sha256(pluginLockBytes)
    || marker.registry !== pin.registry || marker.installScriptsExecuted !== false || marker.isolatedUserConfig !== true
    || marker.npm?.cli !== 'npm/node_modules/npm/bin/npm-cli.js' || marker.npm?.binDirectory !== 'npm' || marker.cacheDirectory !== 'cache'
    || Object.entries(pin.npm).some(([key, value]) => marker.npm?.[key] !== value)
    || !/^[a-f0-9]{64}$/u.test(marker.npm?.sha256 ?? '')
    || !Array.isArray(marker.plugins) || marker.plugins.length !== pin.plugins.length) throw new Error('Installer marker differs from its official pins');
  for (const [index, expected] of pin.plugins.entries()) {
    const plugin = marker.plugins[index], locked = pluginLock.packages[`node_modules/${expected.name}`];
    const dependencyLock = JSON.parse(await fs.readFile(path.join(pinsRoot, `${expected.id}.package-lock.json`), 'utf8'));
    const nativeLock = JSON.parse(await fs.readFile(path.join(pinsRoot, `native-${expected.id}.lock.json`), 'utf8'));
    const resolvedDependencies = Object.values(dependencyLock.packages ?? {}).filter(entry => entry.resolved);
    if (!locked || plugin.id !== expected.id || plugin.name !== expected.name || plugin.version !== expected.version
      || plugin.spec !== `${expected.name}@${expected.version}` || locked.version !== expected.version
      || plugin.integrity !== locked.integrity || plugin.resolved !== locked.resolved || !plugin.resolved.startsWith(pin.registry)
      || plugin.offlineView !== true || plugin.offlinePack !== true || plugin.offlineInstall !== true
      || plugin.offlineNativeInstall !== true || nativeLock.schemaVersion !== 1 || nativeLock.coreVersion !== pin.coreVersion
      || nativeLock.plugin !== plugin.spec || !Array.isArray(nativeLock.packages)
      || plugin.nativeLockSha256 !== sha256(Buffer.from(JSON.stringify(nativeLock))) || plugin.nativeDependencyPackages !== nativeLock.packages.length
      || nativeLock.packages.some(entry => !entry.resolved?.startsWith(pin.registry) || !entry.integrity)
      || plugin.lockSha256 !== sha256(Buffer.from(JSON.stringify(dependencyLock)))
      || plugin.dependencyPackages !== resolvedDependencies.length
      || resolvedDependencies.some(entry => !entry.resolved.startsWith(pin.registry) || !entry.integrity)) throw new Error(`Installer plugin differs from its exact lock: ${expected.id}`);
  }
  const inventory = await channelInstallerInventory(root);
  const npmPackage = JSON.parse(await fs.readFile(path.join(root, 'npm/node_modules/npm/package.json'), 'utf8'));
  if (npmPackage.name !== pin.npm.name || npmPackage.version !== pin.npm.version
    || !inventory.entries.some(entry => entry.path === marker.npm.cli)
    || !inventory.entries.some(entry => entry.path === 'npm/npm.cmd')
    || !inventory.entries.some(entry => entry.path.startsWith('cache/_cacache/'))
    || inventory.entries.some(entry => !entry.path.startsWith('npm/') && !entry.path.startsWith('cache/_cacache/'))
    || marker.files !== inventory.files || marker.bytes !== inventory.bytes
    || JSON.stringify(marker.entries) !== JSON.stringify(inventory.entries)) throw new Error('Installer payload readback mismatch');
  return { ...marker, markerSha256: sha256(markerBytes), root };
}
async function cleanupWork(work, temporaryParent) {
  if (activeChildren.size) throw new Error(`Staging processes are not confirmed closed; retained owned work directory: ${work}`);
  if (!inside(temporaryParent, work) || path.dirname(work) !== temporaryParent || !path.basename(work).startsWith('aifb-npm-stage-')
    || (await fs.realpath(work)).toLowerCase() !== path.resolve(work).toLowerCase()) throw new Error('Unsafe staging cleanup path');
  await fs.rm(work, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}
function isolatedEnvironment(work, toolRoot, userconfig) {
  const env = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key];
  return Object.assign(env, { HOME: work, USERPROFILE: work, APPDATA: path.join(work, 'appdata'), LOCALAPPDATA: path.join(work, 'localappdata'),
    TEMP: work, TMP: work, PATH: [toolRoot, path.dirname(process.execPath), process.env.SystemRoot && path.join(process.env.SystemRoot, 'System32')].filter(Boolean).join(path.delimiter),
    NPM_CONFIG_USERCONFIG: userconfig, NPM_CONFIG_GLOBALCONFIG: path.join(work, 'global-npmrc'),
    NPM_CONFIG_IGNORE_SCRIPTS: 'true', NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false', NPM_CONFIG_UPDATE_NOTIFIER: 'false' });
}
export async function stageChannelInstaller({ force = false } = {}) {
  const pinBytes = await fs.readFile(path.join(manifestRoot, 'toolkit.lock.json')), pin = JSON.parse(pinBytes);
  if (process.version !== `v${pin.nodeVersion}`) throw new Error(`Use pinned Node ${pin.nodeVersion} for installer staging`);
  const pluginLockBytes = await fs.readFile(path.join(repo, 'manifests/channel-plugins/package-lock.json'));
  const pluginLock = JSON.parse(pluginLockBytes), root = path.join(repo, 'apps/desktop/resources/bundle/channel-installer');
  const pinSha256 = sha256(pinBytes), pluginLockSha256 = sha256(pluginLockBytes), marker = path.join(root, markerName);
  if (await exists(marker) && !force) {
    return verifyChannelInstaller(root);
  }
  if (await exists(root)) {
    if (!force || (await fs.realpath(root)).toLowerCase() !== path.resolve(root).toLowerCase()) throw new Error('Incomplete or linked installer staging requires review');
    await fs.rm(root, { recursive: true, force: true });
  }
  await fs.mkdir(root, { recursive: true });
  const temporaryParent = await fs.realpath(os.tmpdir()), work = await fs.mkdtemp(path.join(temporaryParent, 'aifb-npm-stage-'));
  const cache = path.join(work, 'cache'), toolkit = path.join(root, 'npm'), userconfig = path.join(work, 'npmrc');
  const env = isolatedEnvironment(work, toolkit, userconfig), commands = [], pluginSources = [];
  try {
    await fs.writeFile(path.join(work, 'global-npmrc'), '');
    await fs.writeFile(userconfig, `registry=${pin.registry}\ncache=${cache.replaceAll('\\', '/')}\noffline=false\nignore-scripts=true\naudit=false\nfund=false\nupdate-notifier=false\n`);
    const response = await fetch(pin.npm.tarball);
    if (!response.ok) throw new Error(`Pinned npm download failed: ${response.status}`);
    const npmBytes = Buffer.from(await response.arrayBuffer()); integrity(npmBytes, pin.npm.integrity);
    if (createHash('sha1').update(npmBytes).digest('hex') !== pin.npm.shasum) throw new Error('Pinned npm shasum mismatch');
    const archive = path.join(work, 'npm.tgz'); await fs.writeFile(archive, npmBytes);
    const unpacked = path.join(work, 'npm-extract'); await extract(archive, unpacked, env);
    const npmPackage = path.join(unpacked, 'package'), npmMetadata = JSON.parse(await fs.readFile(path.join(npmPackage, 'package.json'), 'utf8'));
    if (npmMetadata.name !== 'npm' || npmMetadata.version !== pin.npm.version) throw new Error('Unexpected npm toolkit');
    await fs.mkdir(path.join(toolkit, 'node_modules'), { recursive: true });
    await fs.cp(npmPackage, path.join(toolkit, 'node_modules/npm'), { recursive: true, dereference: false });
    for (const name of ['npm', 'npm.cmd', 'npx', 'npx.cmd']) await fs.copyFile(path.join(npmPackage, 'bin', name), path.join(toolkit, name));
    const cli = path.join(toolkit, 'node_modules/npm/bin/npm-cli.js');
    const npm = async (args, cwd, offline = false) => {
      commands.push({ command: 'npm', args, offline });
      return command(process.execPath, [cli, ...args], { cwd, env: { ...env, ...(offline ? { NPM_CONFIG_OFFLINE: 'true' } : {}) } });
    };
    if ((await npm(['--version'], work)).trim() !== pin.npm.version) throw new Error('npm toolkit cannot run with pinned Node');
    const installArgs = ['install', '--omit=dev', '--omit=peer', '--legacy-peer-deps', '--loglevel=error', '--ignore-scripts', '--no-audit', '--no-fund'];
    for (const plugin of pin.plugins) {
      const expected = pluginLock.packages[`node_modules/${plugin.name}`], spec = `${plugin.name}@${plugin.version}`;
      if (!expected || expected.version !== plugin.version || !expected.resolved?.startsWith(pin.registry)) throw new Error('Plugin lock does not match official exact pin');
      const metadataArgs = ['view', spec, 'name', 'version', 'dist.integrity', 'dist.shasum', 'openclaw', '--json'];
      const metadata = JSON.parse(await npm(metadataArgs, work));
      if (metadata.name !== plugin.name || metadata.version !== plugin.version || metadata['dist.integrity'] !== expected.integrity) throw new Error(`Public metadata changed for ${spec}`);
      const packed = JSON.parse(await npm(['pack', spec, '--ignore-scripts', '--json'], work));
      const tarball = path.resolve(work, packed[0]?.filename ?? '');
      if (!inside(work, tarball) || packed.length !== 1) throw new Error('Unexpected npm pack path');
      integrity(await fs.readFile(tarball), expected.integrity);
      const seed = path.join(work, `seed-${plugin.id}`); await extract(tarball, seed, env);
      await npm(installArgs, path.join(seed, 'package'));
      // Repeat the exact native operations in offline mode against a new unpacked project.
      await npm(metadataArgs, work, true); await npm(['pack', spec, '--ignore-scripts', '--json'], work, true);
      const trial = path.join(work, `offline-${plugin.id}`); await extract(tarball, trial, env);
      await npm(installArgs, path.join(trial, 'package'), true);
      const lock = JSON.parse(await fs.readFile(path.join(trial, 'package/package-lock.json'), 'utf8'));
      const resolved = Object.entries(lock.packages ?? {}).filter(([, value]) => value.resolved).map(([name, value]) => ({ path: name, version: value.version, resolved: value.resolved, integrity: value.integrity }));
      if (resolved.some(item => !item.resolved.startsWith(pin.registry) || !item.integrity)) throw new Error(`Non-registry dependency in ${spec}`);
      const pinnedDependencies = path.join(manifestRoot, `${plugin.id}.package-lock.json`);
      if (await exists(pinnedDependencies)) {
        const previous = JSON.parse(await fs.readFile(pinnedDependencies, 'utf8'));
        if (JSON.stringify(previous) !== JSON.stringify(lock)) throw new Error(`Transitive dependency resolution changed for ${spec}; review and repin before rebuilding`);
      } else await fs.writeFile(pinnedDependencies, JSON.stringify(lock, null, 2) + '\n', { flag: 'wx' });
      pluginSources.push({ ...plugin, spec, resolved: expected.resolved, integrity: expected.integrity, offlineView: true, offlinePack: true, offlineInstall: true,
        lockSha256: sha256(Buffer.from(JSON.stringify(lock))), dependencyPackages: resolved.length });
      console.log(`[channel installer] ${plugin.id}: exact view/pack/install passed offline`);
    }
    await seedNativeInstaller({ work, toolkit, userconfig, pin, pluginSources, commands });
    await fs.cp(path.join(cache, '_cacache'), path.join(root, 'cache/_cacache'), { recursive: true, dereference: false });
    const result = { schemaVersion: 1, coreVersion: pin.coreVersion, nodeVersion: pin.nodeVersion, pinSha256, pluginLockSha256,
      npm: { ...pin.npm, sha256: sha256(npmBytes), cli: 'npm/node_modules/npm/bin/npm-cli.js', binDirectory: 'npm' }, cacheDirectory: 'cache',
      plugins: pluginSources, installScriptsExecuted: false, registry: pin.registry, isolatedUserConfig: true, commands,
      createdAt: new Date().toISOString(), ...await channelInstallerInventory(root) };
    await fs.writeFile(marker, JSON.stringify(result, null, 2) + '\n');
    return { root, ...result };
  } finally {
    await cleanupWork(work, temporaryParent);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await stageChannelInstaller({ force: process.argv.includes('--force') });
  console.log(JSON.stringify({ root: result.root, npm: result.npm.version, files: result.files, bytes: result.bytes, plugins: result.plugins }));
}
