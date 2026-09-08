import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { channelInstallerInventory, verifyChannelInstaller } from '../../scripts/stage-channel-installer.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
async function fixture(t) {
  const parent = await fs.realpath(os.tmpdir()), directory = await fs.mkdtemp(path.join(parent, 'aifb-installer-package-test-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(await fs.realpath(directory), directory);
    assert.ok(path.basename(directory).startsWith('aifb-installer-package-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const root = path.join(directory, 'payload'), pins = path.join(directory, 'manifests/channel-installer');
  await fs.mkdir(pins, { recursive: true });
  await fs.mkdir(path.join(directory, 'manifests/channel-plugins'), { recursive: true });
  const pin = { schemaVersion: 1, coreVersion: '2026.9.1', nodeVersion: '24.19.0', registry: 'https://registry.npmjs.org/',
    npm: { name: 'npm', version: '11.17.0', tarball: 'https://registry.npmjs.org/npm/-/npm-11.17.0.tgz', integrity: 'sha512-fixture', shasum: 'fixture' },
    plugins: [{ id: 'discord', name: '@openclaw/discord', version: '2026.9.1' }] };
  const plugin = pin.plugins[0], dependencyLock = { packages: {} };
  const nativeLock = { schemaVersion: 1, coreVersion: pin.coreVersion, plugin: `${plugin.name}@${plugin.version}`, packages: [] };
  const pluginLock = { packages: { [`node_modules/${plugin.name}`]: { version: plugin.version,
    resolved: 'https://registry.npmjs.org/@openclaw/discord/-/discord-2026.9.1.tgz', integrity: 'sha512-official-fixture' } } };
  const pinBytes = json(pin), lockBytes = json(pluginLock);
  await fs.writeFile(path.join(pins, 'toolkit.lock.json'), pinBytes);
  await fs.writeFile(path.join(directory, 'manifests/channel-plugins/package-lock.json'), lockBytes);
  await fs.writeFile(path.join(pins, 'discord.package-lock.json'), json(dependencyLock));
  await fs.writeFile(path.join(pins, 'native-discord.lock.json'), json(nativeLock));
  for (const [file, data] of Object.entries({ 'npm/npm.cmd': 'fixture wrapper', 'npm/node_modules/npm/bin/npm-cli.js': 'fixture cli',
    'npm/node_modules/npm/package.json': json({ name: 'npm', version: '11.17.0' }), 'cache/_cacache/content-v2/fixture': 'public fixture cache' })) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), data);
  }
  const marker = { schemaVersion: 1, coreVersion: pin.coreVersion, nodeVersion: pin.nodeVersion, registry: pin.registry,
    pinSha256: hash(pinBytes), pluginLockSha256: hash(lockBytes), installScriptsExecuted: false, isolatedUserConfig: true,
    npm: { ...pin.npm, sha256: 'a'.repeat(64), cli: 'npm/node_modules/npm/bin/npm-cli.js', binDirectory: 'npm' }, cacheDirectory: 'cache',
    plugins: [{ ...plugin, ...pluginLock.packages[`node_modules/${plugin.name}`], spec: nativeLock.plugin,
      offlineView: true, offlinePack: true, offlineInstall: true, offlineNativeInstall: true,
      lockSha256: hash(JSON.stringify(dependencyLock)), dependencyPackages: 0,
      nativeLockSha256: hash(JSON.stringify(nativeLock)), nativeDependencyPackages: 0 }], ...await channelInstallerInventory(root) };
  const writeMarker = () => fs.writeFile(path.join(root, 'channel-installer.json'), json(marker));
  await writeMarker();
  return { directory, root, pins, marker, writeMarker, verify: () => verifyChannelInstaller(root, { repositoryRoot: directory }) };
}

test('installer package validates its repository pins, native closure and exact copied payload', async t => {
  const f = await fixture(t), before = await f.verify(), copied = path.join(f.directory, 'copied');
  await fs.cp(f.root, copied, { recursive: true });
  const after = await verifyChannelInstaller(copied, { repositoryRoot: f.directory });
  assert.equal(after.markerSha256, before.markerSha256);
  assert.deepEqual(after.entries, before.entries);
  assert.equal(after.files, 4);
  assert.equal(after.plugins[0].offlineNativeInstall, true);
});

test('changed or missing toolkit/cache bytes cannot pass their own unchanged marker', async t => {
  const f = await fixture(t), file = path.join(f.root, 'cache/_cacache/content-v2/fixture');
  await fs.writeFile(file, 'tampered');
  await assert.rejects(f.verify, /readback mismatch/u);
  await fs.unlink(file);
  await assert.rejects(f.verify, /readback mismatch/u);
});

test('unlisted files and user configuration are rejected even with a resealed inventory', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'npmrc'), 'unexpected local config');
  await assert.rejects(f.verify, /readback mismatch/u);
  Object.assign(f.marker, await channelInstallerInventory(f.root));
  await f.writeMarker();
  await assert.rejects(f.verify, /readback mismatch/u);
});

test('native install proof, exact plugin integrity, runtime and npm identities are required', async t => {
  const f = await fixture(t), original = structuredClone(f.marker);
  for (const mutate of [
    marker => { marker.plugins[0].offlineNativeInstall = false; },
    marker => { marker.plugins[0].integrity = 'sha512-other'; },
    marker => { marker.coreVersion = 'other'; },
    marker => { marker.nodeVersion = 'other'; },
    marker => { marker.npm.version = 'other'; },
    marker => { marker.npm.cli = '../outside.js'; },
    marker => { marker.cacheDirectory = '../outside'; },
    marker => { marker.installScriptsExecuted = true; }
  ]) {
    Object.assign(f.marker, structuredClone(original)); mutate(f.marker); await f.writeMarker();
    await assert.rejects(f.verify, /pins|exact lock/u);
  }
});

test('dependency lock drift cannot be hidden behind a valid payload inventory', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.pins, 'native-discord.lock.json'), json({ schemaVersion: 1, coreVersion: '2026.9.1',
    plugin: '@openclaw/discord@2026.9.1', packages: [{ path: 'node_modules/other', resolved: 'https://private.invalid/other', integrity: 'sha512-other' }] }));
  await assert.rejects(f.verify, /exact lock/u);
});

test('directory links cannot enter the standalone installer payload', async t => {
  const f = await fixture(t), linked = path.join(f.directory, 'linked');
  await fs.symlink(f.root, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => channelInstallerInventory(linked), /regular directory/u);
});
