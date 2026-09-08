import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { verifyUpdateEnvelope, stageComponentUpdate, updatePath } from '../../apps/desktop/electron/component-update.mjs';
import { UpdateService } from '../../apps/desktop/electron/update-service.mjs';
const require = createRequire(new URL('../../apps/desktop/package.json', import.meta.url));
const JSZip = require('jszip'), hash = data => createHash('sha256').update(data).digest('hex');
async function fixture() {
  const keys = generateKeyPairSync('ed25519'), archives = new Map(), components = {};
  const files = { ui: { 'AI-for-Boss.exe': 'fixture executable', 'resources/app.asar': 'fixture shell' },
    core: { 'resources/runtime/node/node.exe': 'fixture node', 'resources/node_modules/openclaw/package.json': '{"version":"fixture"}' } };
  for (const [kind, items] of Object.entries(files)) {
    const zip = new JSZip(); for (const [name, data] of Object.entries(items)) zip.file(name, data);
    const bytes = await zip.generateAsync({ type: 'nodebuffer' });
    const list = Object.entries(items).map(([name, data]) => ({ path: name, bytes: Buffer.byteLength(data), sha256: hash(data) }));
    const url = 'https://github.com/LucDinhLe/ai-for-boss-preview/releases/download/test/' + kind + '.zip';
    components[kind] = { id: hash(JSON.stringify(list)), sha256: hash(bytes), bytes: bytes.length, files: list, url }; archives.set(url, bytes);
  }
  const manifest = { schema: 1, product: 'AI for Boss', version: '0.0.5-beta.32', sequence: 32, platform: 'win32', arch: 'x64', protocol: 4, components };
  const envelope = value => { const payload = JSON.stringify(value); return { payload, signature: sign(null, Buffer.from(payload), keys.privateKey).toString('base64') }; };
  return { ...keys, manifest, files, archives, envelope };
}
test('signed feed rejects tampering, rollback, foreign hosts and unsafe file names', async () => {
  const f = await fixture(), signed = f.envelope(f.manifest);
  assert.equal(verifyUpdateEnvelope(signed, f.publicKey, 31).version, f.manifest.version);
  assert.throws(() => verifyUpdateEnvelope({ ...signed, payload: signed.payload.replace('beta.32', 'beta.99') }, f.publicKey));
  assert.throws(() => verifyUpdateEnvelope(signed, f.publicKey, 33));
  const foreign = structuredClone(f.manifest); foreign.components.ui.url = 'https://attacker.example/ui.zip';
  assert.throws(() => verifyUpdateEnvelope(f.envelope(foreign), f.publicKey));
  for (const value of ['../secret', 'C:/secret', 'resources/../secret', 'resources\\x', 'aux.txt', 'x/evil.']) assert.throws(() => updatePath(value));
});
test('UI update reuses unchanged core, verifies the new package, and leaves current application untouched', async () => {
  const f = await fixture(), root = await mkdtemp(path.join(os.tmpdir(), 'aifb-update-test-'));
  try {
    const currentRoot = path.join(root, 'current'), updateRoot = path.join(root, 'versions'), downloads = [];
    for (const [name, data] of Object.entries(f.files.core)) { const target = path.join(currentRoot, name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, data); }
    const result = await stageComponentUpdate({ envelope: f.envelope(f.manifest), publicKey: f.publicKey, minimumSequence: 31, currentRoot, updateRoot,
      download: async url => { downloads.push(url); return f.archives.get(url); } });
    assert.deepEqual(downloads, [f.manifest.components.ui.url]);
    assert.equal(await readFile(path.join(result.directory, 'resources/app.asar'), 'utf8'), 'fixture shell');
    assert.equal(await readFile(path.join(currentRoot, 'resources/runtime/node/node.exe'), 'utf8'), 'fixture node');
    assert.equal((await stageComponentUpdate({ envelope: f.envelope(f.manifest), publicKey: f.publicKey, currentRoot, updateRoot, download: async () => { throw new Error('Must not overwrite'); } })).directory, result.directory);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('corrupt download never produces an activatable version', async () => {
  const f = await fixture(), root = await mkdtemp(path.join(os.tmpdir(), 'aifb-update-test-'));
  try {
    await assert.rejects(stageComponentUpdate({ envelope: f.envelope(f.manifest), publicKey: f.publicKey, currentRoot: path.join(root, 'missing'), updateRoot: root,
      download: async () => Buffer.from('corrupt') }));
    await assert.rejects(readFile(path.join(root, f.manifest.version, '.aifb-update.json')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('prepared update activates only at startup, records health, and rolls back an unsuccessful next launch', async () => {
  const f = await fixture(), root = await mkdtemp(path.join(os.tmpdir(), 'aifb-update-test-'));
  try {
    const options = { publicKey: f.publicKey, version: '0.0.5-beta.31', currentRoot: path.join(root, 'current'), dataRoot: path.join(root, 'updates'),
      fetcher: async url => new globalThis.Response(url.endsWith('preview.json') ? JSON.stringify(f.envelope(f.manifest)) : f.archives.get(url)) };
    const old = new UpdateService(options); await old.initialize();
    await old.run({ action: 'update-download' });
    assert.equal(old.state.pending, undefined); assert.equal(old.describe().readyVersion, f.manifest.version);
    const executable = await old.startupTarget(); assert.ok(executable.endsWith('AI-for-Boss.exe'));
    const next = new UpdateService({ ...options, version: f.manifest.version, currentRoot: path.dirname(executable) });
    await next.initialize(); assert.equal(await next.startupTarget(), null); await next.markHealthy();
    assert.equal(next.state.active.version, f.manifest.version); assert.equal(next.state.floor, 32);
    await old.initialize(); assert.equal(await old.startupTarget(), executable);
    // Simulate a crash before markHealthy; reopening the old shortcut stays on the old build.
    const recovery = new UpdateService(options); await recovery.initialize(); assert.equal(await recovery.startupTarget(), null);
    assert.equal(recovery.state.active, undefined); assert.equal(recovery.state.rejected, f.manifest.version);
    await recovery.run({ action: 'update-check' }); assert.equal(recovery.describe().availableVersion, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
