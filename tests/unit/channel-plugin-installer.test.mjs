import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { setImmediate } from 'node:timers';
import test from 'node:test';
import { ChannelPluginInstaller, channelInstallerEnvironment } from '../../apps/desktop/electron/channel-plugin-installer.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const turn = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  const deadline = Date.now() + 5000;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Synthetic process was not started'); await turn(); }
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-plugin-installer-unit-'));
  t.after(async () => {
    const resolved = await fs.realpath(root);
    assert.equal(resolved.toLowerCase(), path.resolve(root).toLowerCase());
    assert.ok(path.basename(root).startsWith('aifb-plugin-installer-unit-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const bundleRoot = path.join(root, 'bundle'), stateDirectory = path.join(root, 'state');
  const payload = {
    'cache/_cacache/content-v2/owned-entry': 'generated public-cache fixture bytes',
    'npm/npm.cmd': 'generated standard-toolkit placeholder, never executed',
    'npm/node_modules/npm/bin/npm-cli.js': '// generated test-only CLI placeholder'
  };
  for (const [name, bytes] of Object.entries(payload)) {
    const file = path.join(bundleRoot, name); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, bytes);
  }
  const marker = { schemaVersion: 1, coreVersion: '2026.9.1', nodeVersion: '24.19.0',
    npm: { version: '11.17.0', cli: 'npm/node_modules/npm/bin/npm-cli.js', binDirectory: 'npm' }, cacheDirectory: 'cache',
    plugins: ['zalo', 'whatsapp', 'discord', 'googlechat'].map(id => ({ id, name: `@openclaw/${id}`, version: '2026.9.1',
      spec: `@openclaw/${id}@2026.9.1`, integrity: 'sha512-generated-test-only' })),
    entries: Object.entries(payload).map(([name, bytes]) => ({ path: name, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) })) };
  const save = () => fs.writeFile(path.join(bundleRoot, 'channel-installer.json'), JSON.stringify(marker));
  await save();
  const launches = [], children = [], stops = [];
  const installer = new ChannelPluginInstaller({ bundleRoot, stateDirectory, nodeExecutable: path.join(root, 'toolkit/node.exe'),
    openclawEntry: path.join(root, 'immutable-core/openclaw.mjs'),
    spawnProcess(command, args, options) {
      const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      // Never identify a real Windows process in unit tests.
      child.pid = null; child.exitCode = null;
      child.finish = code => { child.exitCode = code; child.emit('exit', code); };
      launches.push({ command, args, options }); children.push(child); return child;
    },
    stopProcess: async child => { stops.push(child); }
  });
  t.after(async () => { await installer.stop(); for (const child of children) if (child.exitCode === null) child.finish(1); });
  return { root, bundleRoot, stateDirectory, payload, marker, save, installer, launches, children, stops };
}

test('installer environment is offline, scoped, and cannot inherit owner credentials or npm overrides', () => {
  const home = path.resolve('generated-home'), stateDirectory = path.resolve('generated-state'), nodeExecutable = path.resolve('tools/node.exe');
  const result = channelInstallerEnvironment({ home, stateDirectory, nodeExecutable, npmDirectory: path.resolve('tools/npm'),
    env: { SystemRoot: 'C:/Windows', WINDIR: 'C:/Windows', ComSpec: 'C:/Windows/System32/cmd.exe', PATHEXT: '.EXE;.CMD',
      PATH: 'C:/owner-bin', HOME: 'owner-home', USERPROFILE: 'owner-profile', APPDATA: 'owner-appdata', OPENAI_API_KEY: 'owner-secret',
      ANTHROPIC_API_KEY: 'owner-secret', NPM_TOKEN: 'owner-secret', npm_config_registry: 'https://untrusted.invalid',
      npm_config_userconfig: 'owner-npmrc', HTTP_PROXY: 'owner-proxy', NODE_OPTIONS: '--require owner-code',
      OPENCLAW_PLUGIN_INSTALL_OVERRIDES: 'owner-override', OPENCLAW_TEST_TRUST_BUNDLED_PLUGINS_DIR: '1' } });
  assert.equal(result.HOME, home); assert.equal(result.USERPROFILE, home);
  assert.equal(result.OPENCLAW_STATE_DIR, stateDirectory);
  assert.equal(result.OPENCLAW_CONFIG_PATH, path.join(stateDirectory, 'openclaw.json'));
  assert.equal(result.NPM_CONFIG_OFFLINE, 'true'); assert.equal(result.NPM_CONFIG_IGNORE_SCRIPTS, 'true');
  assert.equal(result.NPM_CONFIG_USERCONFIG, path.join(home, 'npmrc'));
  assert.equal(result.NPM_CONFIG_GLOBALCONFIG, path.join(home, 'global-npmrc'));
  assert.equal(result.PATH.split(path.delimiter)[0], path.dirname(nodeExecutable));
  assert.equal(JSON.stringify(result).includes('owner-'), false);
  assert.equal(Object.keys(result).some(key => /TOKEN|API_KEY|PROXY|NODE_OPTIONS|INSTALL_OVERRIDES|TEST_TRUST/iu.test(key)), false);
});

test('fixed official ID invokes public native CLI with exact pin; cache copy stays owned and no provenance is fabricated', async t => {
  const f = await fixture(t);
  for (const id of ['telegram', 'slack', '@openclaw/discord', '../discord', 'discord@latest']) {
    await assert.rejects(f.installer.install(id), /chính thức/u);
  }
  const operation = f.installer.install('discord'); await until(() => f.launches.length === 1);
  const { command, args, options } = f.launches[0];
  assert.equal(command, path.join(f.root, 'toolkit/node.exe'));
  assert.deepEqual(args, [path.join(f.root, 'immutable-core/openclaw.mjs'), 'plugins', 'install', '@openclaw/discord@2026.9.1', '--pin']);
  assert.equal(options.windowsHide, true); assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
  const home = options.cwd;
  assert.equal(path.dirname(home), path.join(f.stateDirectory, 'aifb-channel-installer'));
  assert.equal(options.env.HOME, home);
  assert.equal(await fs.readFile(path.join(home, 'cache/_cacache/content-v2/owned-entry'), 'utf8'), f.payload['cache/_cacache/content-v2/owned-entry']);
  const npmrc = await fs.readFile(path.join(home, 'npmrc'), 'utf8');
  assert.ok(npmrc.includes(`cache=${path.join(home, 'cache').replaceAll('\\', '/')}\n`));
  assert.match(npmrc, /^offline=true$/mu); assert.match(npmrc, /^registry=https:\/\/registry\.npmjs\.org\/$/mu);
  assert.equal(await fs.readFile(path.join(home, 'global-npmrc'), 'utf8'), '');
  assert.deepEqual(await fs.readdir(f.stateDirectory), ['aifb-channel-installer'], 'host must not write OpenClaw config, SQLite, or trust records');
  f.children[0].finish(0); const result = await operation;
  assert.equal(result.id, 'discord'); assert.equal(result.version, '2026.9.1'); assert.equal(result.nativeExitCode, 0);
  assert.equal('trustedOfficialInstall' in result, false, 'CLI success still requires separate native inventory readback');
  assert.ok(result.elapsedMs >= 0);
  assert.equal(await fs.readFile(path.join(f.bundleRoot, 'cache/_cacache/content-v2/owned-entry'), 'utf8'), f.payload['cache/_cacache/content-v2/owned-entry']);
});

test('mismatched version/spec, malformed manifest paths and changed bytes reject before native CLI runs', async t => {
  for (const change of [
    marker => { marker.coreVersion = '2026.9.2'; },
    marker => { marker.nodeVersion = '20.0.0'; },
    marker => { marker.plugins[2].spec = '@openclaw/discord@latest'; },
    marker => { marker.plugins[2].name = '@untrusted/discord'; },
    marker => { marker.plugins[2].version = '2026.9.2'; },
    marker => { marker.entries = []; },
    marker => { marker.entries[0].sha256 = 'not-a-digest'; },
    marker => { marker.entries[0].path = '../outside'; },
    marker => { marker.entries[0].path = 'cache/../outside'; },
    marker => { marker.entries[0].path = 'cache//outside'; },
    marker => { marker.entries[0].path = path.resolve('outside'); },
    marker => { marker.entries[0].path = 'cache/name:stream'; },
    marker => { marker.entries[0].bytes++; },
    marker => { marker.entries.push({ ...marker.entries[0] }); }
  ]) {
    const f = await fixture(t); change(f.marker); await f.save();
    await assert.rejects(f.installer.install('discord')); assert.equal(f.launches.length, 0);
  }
  const f = await fixture(t);
  await fs.writeFile(path.join(f.bundleRoot, 'npm/npm.cmd'), 'changed CLI');
  await assert.rejects(f.installer.install('discord'), /thay đổi/u); assert.equal(f.launches.length, 0);
});

test('unlisted cache bytes cannot enter the verified copy or native install', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.bundleRoot, 'cache/unlisted'), 'not present in the reviewed package inventory');
  let settled = false;
  const outcome = f.installer.install('discord').then(() => { settled = true; return 'success'; }, () => { settled = true; return 'rejected'; });
  await until(() => f.launches.length > 0 || settled);
  if (f.children[0]) f.children[0].finish(0);
  assert.equal(await outcome, 'rejected');
  assert.equal(f.launches.length, 0);
  await assert.rejects(fs.access(f.stateDirectory), error => error.code === 'ENOENT', 'reject unlisted files before preparing a home');
});

test('manifest-listed junctions cannot redirect verified reads or copied cache outside the bundle', async t => {
  const f = await fixture(t);
  const outside = path.join(f.root, 'outside-bundle');
  await fs.mkdir(outside); await fs.writeFile(path.join(outside, 'payload'), 'generated foreign cache entry');
  await fs.symlink(outside, path.join(f.bundleRoot, 'cache/redirected'), process.platform === 'win32' ? 'junction' : 'dir');
  f.marker.entries.push({ path: 'cache/redirected/payload', bytes: 29, sha256: hash('generated foreign cache entry') }); await f.save();
  let settled = false;
  const outcome = f.installer.install('discord').then(() => { settled = true; return 'success'; }, () => { settled = true; return 'rejected'; });
  await until(() => f.launches.length > 0 || settled);
  if (f.children[0]) f.children[0].finish(0);
  assert.equal(await outcome, 'rejected');
  assert.equal(f.launches.length, 0);
  await assert.rejects(fs.access(f.stateDirectory), error => error.code === 'ENOENT', 'reject links before any staging copy');
  assert.equal(await fs.readFile(path.join(outside, 'payload'), 'utf8'), 'generated foreign cache entry');
});

test('duplicate starts are rejected; CLI failure is friendly and permits a clean retry', async t => {
  const f = await fixture(t); const first = f.installer.install('discord');
  await assert.rejects(f.installer.install('zalo'), /sẵn sàng/u); await until(() => f.launches.length === 1);
  f.children[0].stderr.emit('data', 'ENOTCACHED generated-private-detail-do-not-display'); f.children[0].finish(1);
  await assert.rejects(first, error => /ngoại tuyến/u.test(error.message) && !error.message.includes('generated-private'));
  const retry = f.installer.install('discord'); await until(() => f.launches.length === 2);
  f.children[1].stderr.emit('data', 'native policy consent required generated-private-detail'); f.children[1].finish(1);
  await assert.rejects(retry, error => /Chính sách OpenClaw/u.test(error.message) && !error.message.includes('generated-private'));
  const last = f.installer.install('discord'); await until(() => f.launches.length === 3);
  f.children[2].finish(0); assert.equal((await last).nativeExitCode, 0);
});

test('stop before staging and while native CLI is pending cannot produce success or a later install', async t => {
  const f = await fixture(t); await f.installer.stop();
  await assert.rejects(f.installer.install('discord'), /sẵn sàng/u); assert.equal(f.launches.length, 0);
  const pending = await fixture(t); const task = pending.installer.install('zalo'); await until(() => pending.launches.length === 1);
  const failure = assert.rejects(task, /dừng/u);
  await pending.installer.stop(); await failure;
  assert.deepEqual(pending.stops, [pending.children[0]], 'stop targets only its captured child');
  pending.children[0].finish(0);
  await assert.rejects(pending.installer.install('zalo'), /sẵn sàng/u);
});

test('spawn error and signal exit never fabricate native success or expose captured output', async t => {
  const f = await fixture(t); const task = f.installer.install('googlechat'); await until(() => f.launches.length === 1);
  f.children[0].emit('error', new Error('generated sensitive process detail'));
  await assert.rejects(task, error => /Chưa chạy được/u.test(error.message) && !error.message.includes('sensitive'));
  f.children[0].finish(1);
  const retry = f.installer.install('googlechat'); await until(() => f.launches.length === 2);
  f.children[1].stderr.emit('data', 'generated sensitive process detail'); f.children[1].finish(null);
  await assert.rejects(retry, error => !error.message.includes('sensitive'));
});

test('shutdown settles the request promptly but awaits the same captured process cleanup before resolving', async t => {
  const f = await fixture(t);
  let finishCleanup, cleanups = 0;
  f.installer.stopProcess = async child => {
    assert.equal(child, f.children[0]); cleanups++;
    await new Promise(resolve => { finishCleanup = resolve; });
  };
  const operation = f.installer.install('discord');
  const failedRequest = assert.rejects(operation, /dừng/u);
  await until(() => f.launches.length === 1);
  let shutdownDone = false;
  const shutdown = f.installer.stop().then(() => { shutdownDone = true; });
  await until(() => Boolean(finishCleanup)); await failedRequest;
  assert.equal(shutdownDone, false, 'app shutdown must await its real cleanup operation');
  const duplicateStop = f.installer.stop();
  await turn(); assert.equal(cleanups, 1, 'concurrent stop calls share the same process cleanup');
  finishCleanup(); await Promise.all([shutdown, duplicateStop]);
  assert.equal(shutdownDone, true); assert.equal(f.children[0].exitCode, null, 'cleanup completion is not a fabricated process exit');
  await assert.rejects(f.installer.install('zalo'), /sẵn sàng/u);
  f.children[0].finish(0);
});

test('deadline settles failure even if the synthetic child never emits exit', async t => {
  const f = await fixture(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let outcome = 'pending';
  const operation = f.installer.install('discord').then(() => { outcome = 'success'; }, () => { outcome = 'rejected'; });
  await until(() => f.launches.length === 1);
  t.mock.timers.tick(240001); await turn(); await turn();
  const observed = outcome;
  assert.deepEqual(f.stops, [f.children[0]], 'deadline requests cleanup of its exact owned process');
  await assert.rejects(f.installer.install('zalo'), /sẵn sàng/u, 'no overlapping install while timed-out child has not exited');
  if (f.children[0].exitCode === null) f.children[0].finish(0);
  await operation;
  assert.equal(observed, 'rejected', 'a missing child exit must not keep installer busy forever after the deadline');
  assert.equal(outcome, 'rejected', 'late exit 0 cannot change an expired request into success');
  const next = f.installer.install('zalo'); await until(() => f.launches.length === 2);
  f.children[1].finish(0); assert.equal((await next).id, 'zalo', 'an observed exit allows a new native operation');
});
