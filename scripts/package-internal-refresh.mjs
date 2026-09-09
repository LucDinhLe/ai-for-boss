/** Fresh Electron shell around an immutable, verified local runtime. No old build deletion. */
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, lstat, link, writeFile, access, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { listPackage, extractFile } from '@electron/asar';
import { packager } from '@electron/packager';
import { verifyChannelInstaller } from './stage-channel-installer.mjs';
import { packagedChannelBundlePath } from '../apps/desktop/electron/channel-bundle-path.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv[process.argv.indexOf(name) + 1];
for (const name of ['--base', '--target', '--expected-asar', '--electron-cache']) if (!process.argv.includes(name) || !arg(name)) throw new Error(`Missing ${name}`);
const base = path.resolve(arg('--base')), target = path.resolve(arg('--target'));
const app = path.join(root, 'apps/desktop'), evidence = process.argv.includes('--evidence')
  ? path.resolve(arg('--evidence')) : path.join(root, 'artifacts/product-completion');
if (!evidence.startsWith(path.join(root, 'artifacts') + path.sep)) throw new Error('Evidence must stay in repository artifacts');
const pkg = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'));
const generatedContract = JSON.parse(await readFile(path.join(app, 'generated/shell-contract.json'), 'utf8'));
if (generatedContract.product?.version !== pkg.version) throw new Error('Stale shell version metadata: run contracts:generate before packaging');
const refresh = process.argv.includes('--refresh-shell');
if (!/^0\.0\.5-beta\.\d+$/.test(pkg.version) || path.basename(target) !== pkg.version || path.dirname(base) !== path.dirname(target) || path.basename(path.dirname(target)) !== 'InternalBuilds') throw new Error('Expected a new sibling internal version');
if (!refresh) { try { await access(target); throw new Error('Target already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const previousReceipt = refresh ? JSON.parse(await readFile(path.join(evidence, 'package-refresh.json'), 'utf8')) : null;
if (refresh && (previousReceipt.target !== target || previousReceipt.version !== pkg.version
  || await hash(path.join(target, 'resources/app.asar')) !== previousReceipt.changes.find(change => change.path === 'resources/app.asar')?.afterSha256)) throw new Error('Refresh requires the exact prior package receipt');
const baseAsar = path.join(base, 'resources/app.asar');
if (await hash(baseAsar) !== arg('--expected-asar')) throw new Error('Base archive identity mismatch');
const coreVersion = JSON.parse(await readFile(path.join(base, 'resources/node_modules/openclaw/package.json'), 'utf8')).version;
if (coreVersion !== '2026.9.1') throw new Error('Core version differs');
const documentSource = path.join(app,'resources/document-tools');
await access(path.join(documentSource,'index.mjs'));
const channelSource = path.join(app, 'resources/bundle/channel-installer');
const channelReceipt = await verifyChannelInstaller(channelSource);
const runtimePin = JSON.parse(await readFile(path.join(root, 'manifests/runtime/bundled-runtime.lock.json'), 'utf8'));
if (channelReceipt.coreVersion !== coreVersion || channelReceipt.nodeVersion !== runtimePin.node.version) throw new Error('Installer pins differ from the immutable engine');
if (refresh) {
  try { await lstat(path.join(target, 'resources/channel-plugins')); throw new Error('Refresh target contains obsolete plugins; use a fresh version directory'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await mkdir(evidence, { recursive: true });
const stage = await mkdtemp(path.join(root, 'tmp/package-refresh-')), appStage = path.join(stage, 'app');
await mkdir(appStage);
for (const name of ['electron', 'dist', 'generated', 'package.json']) await cp(path.join(app, name), path.join(appStage, name), { recursive: true });
const [fresh] = await packager({ dir: appStage, out: path.join(stage, 'packed'), name: 'AI for Boss', executableName: 'AI-for-Boss',
  icon: path.join(root, 'docs/brand/assets/app-icons/icon.ico'), electronVersion: '43.3.0', electronZipDir: path.resolve(arg('--electron-cache')),
  platform: 'win32', arch: 'x64', appVersion: pkg.version, asar: true, overwrite: false, prune: false });
async function files(directory, relative = '') {
  const list = [];
  for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
    const item = path.join(relative, entry.name), stats = await lstat(path.join(directory, item));
    if (stats.isSymbolicLink()) throw new Error(`Unexpected link: ${item}`);
    if (entry.isDirectory()) list.push(...await files(directory, item));
    else if (entry.isFile()) list.push({ path: item, size: stats.size });
    else throw new Error(`Unexpected file: ${item}`);
  }
  return list;
}
let unchangedElectronFiles = 0, linkedFiles = 0, linkedBytes = 0, copiedFiles = 0;
const changed = ['AI-for-Boss.exe', path.join('resources', 'app.asar')];
for (const file of await files(fresh)) if (!changed.includes(file.path)) {
  if (await hash(path.join(fresh, file.path)) !== await hash(path.join(base, file.path))) throw new Error(`Electron runtime mismatch: ${file.path}`);
  unchangedElectronFiles++;
}
if (!refresh) await mkdir(target);
if (!refresh) for (const file of await files(base)) {
  if (/^(?:resources[\\/]channel-(?:plugins|installer)|ci)[\\/]/u.test(file.path)) continue;
  const from = path.join(base, file.path), to = path.join(target, file.path);
  await mkdir(path.dirname(to), { recursive: true });
  if (/^resources[\\/](?:node_modules|runtime)[\\/]/.test(file.path)) {
    await link(from, to);
    const before = await lstat(from), after = await lstat(to);
    if (!before.ino || before.ino !== after.ino || before.dev !== after.dev || before.size !== after.size || after.nlink < 2) throw new Error('Immutable link identity mismatch');
    linkedFiles++; linkedBytes += file.size;
  } else { await copyFile(from, to); copiedFiles++; }
}
if (refresh) { linkedFiles = previousReceipt.linkedFiles; linkedBytes = previousReceipt.linkedBytes; copiedFiles = previousReceipt.copiedFiles; }
// The native installer toolkit/cache is versioned beside the core, never inside a linked core tree.
const channelTarget = packagedChannelBundlePath(path.join(target, 'resources'));
const legacyChannelTarget = path.join(target, 'resources/channel-installer');
if (refresh && channelTarget !== legacyChannelTarget) {
  // Only migrate an exact, verified toolkit in this unpublished package. Never
  // adopt unrelated contents or mutate the previous version's linked engine.
  let legacyExists = false;
  try { await lstat(legacyChannelTarget); legacyExists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (legacyExists) {
    const legacy = await verifyChannelInstaller(legacyChannelTarget);
    if (legacy.markerSha256 !== channelReceipt.markerSha256) throw new Error('Legacy installer toolkit differs from its source');
    try { await access(channelTarget); throw new Error('Both installer locations exist; refusing to overwrite'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(legacyChannelTarget, channelTarget);
  }
}
await cp(documentSource,path.join(target,'resources/document-tools'),{recursive:true});
await cp(channelSource, channelTarget, { recursive: true });
const channelTargetInventory = await verifyChannelInstaller(channelTarget);
const channelSourceAfter = await verifyChannelInstaller(channelSource);
if (channelReceipt.markerSha256 !== channelTargetInventory.markerSha256 || channelReceipt.markerSha256 !== channelSourceAfter.markerSha256) throw new Error('Installer source changed during packaging');
const sourceFiles = (await files(appStage)).map(file => file.path).filter(file => file !== 'package.json');
for (const relative of sourceFiles) if (!(await readFile(path.join(appStage, relative))).equals(await readFile(path.join(app, relative)))) throw new Error(`Source changed during packaging: ${relative}`);
const changes = [];
for (const relative of changed) {
  const beforeSha256 = await hash(path.join(base, relative)), afterSha256 = await hash(path.join(fresh, relative));
  await copyFile(path.join(fresh, relative), path.join(target, relative));
  if (await hash(path.join(target, relative)) !== afterSha256 || await hash(path.join(base, relative)) !== beforeSha256) throw new Error('Shell readback mismatch');
  changes.push({ path: relative.replaceAll('\\', '/'), beforeSha256, afterSha256 });
}
const asar = path.join(target, 'resources/app.asar');
for (const relative of sourceFiles) if (!(await readFile(path.join(appStage, relative))).equals(extractFile(asar, relative))) throw new Error(`Source readback mismatch: ${relative}`);
const entries = listPackage(asar).map(entry => entry.replaceAll('\\', '/').replace(/^\/+/, '')).filter(Boolean);
if (entries.some(entry => entry !== 'package.json' && !/^(dist|electron|generated)(\/|$)/.test(entry))) throw new Error('Unexpected archive contents');
const tree = await files(target), totalBytes = tree.reduce((sum, file) => sum + file.size, 0);
const receipt = { recordedAt: new Date().toISOString(), version: pkg.version, scope: 'Fresh official Electron shell; immutable unchanged core reuse', base, target,
  linkedFiles, linkedBytes, copiedFiles, unchangedElectronFiles, changes, sourceReadbackFiles: sourceFiles.length, appAsarEntries: entries.length,
  totalFiles: tree.length, totalBytes, coreVersion, previousBuildPreserved: true, signed: false, fullCoreRehash: false, shellRefresh: refresh,
  channelInstaller: { pinSha256: channelReceipt.pinSha256, pluginLockSha256: channelReceipt.pluginLockSha256, markerSha256: channelReceipt.markerSha256,
    npmVersion: channelReceipt.npm.version, plugins: channelTargetInventory.plugins, files: channelTargetInventory.files,
    bytes: channelTargetInventory.bytes, separateFromCore: true, readbackVerified: true },
  invariant: 'Never modify linked core files in place; upgrade by replacing files in a new version directory.' };
await writeFile(path.join(evidence, 'package-refresh.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
