import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { installerManifest, payloadInclude, safeInstallerVersion, nsisString } from '../../scripts/build-internal-installer.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afi-'));
  const source = path.join(root, 'source');
  for (const [name, value] of Object.entries({ 'AI-for-Boss.exe': 'test executable', 'resources/app.asar': 'test shell',
    'resources/runtime/node/node.exe': 'test runtime', 'resources/node_modules/openclaw/package.json': '{"name":"openclaw"}', 'resources/node_modules/openclaw/readme.md': 'immutable core' })) {
    await fs.mkdir(path.dirname(path.join(source, name)), { recursive: true }); await fs.writeFile(path.join(source, name), value);
  }
  if (process.platform === 'win32') await fs.copyFile(path.join(process.env.SystemRoot, 'System32', 'version.dll'), path.join(root, 'System.dll'));
  return { root, source };
}
test('installer manifest fingerprints a complete separated payload and quotes NSIS paths', async () => {
  const { root, source } = await fixture();
  try {
    const manifest = await installerManifest(source, '0.0.5-beta.21');
    assert.equal(manifest.files.length, 5); assert.ok(manifest.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)));
    assert.match(payloadInclude(source, manifest), /SetOutPath "\$Stage\\resources\\runtime\\node"/);
    assert.equal(nsisString('cash$path'), 'cash$$path');
    assert.throws(() => safeInstallerVersion('../outside'));
    assert.throws(() => safeInstallerVersion('beta.')); assert.throws(() => safeInstallerVersion('CON'));
    assert.throws(() => nsisString('bad\nFile injected'));
    await fs.unlink(path.join(source, 'resources/app.asar'));
    await assert.rejects(installerManifest(source, 'beta.21'), /missing/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('installer refuses links and Windows junctions in its source tree', async () => {
  const { root, source } = await fixture();
  try { await fs.symlink(path.join(source, 'resources'), path.join(source, 'link'), process.platform === 'win32' ? 'junction' : 'dir'); await assert.rejects(installerManifest(source, 'beta.21'), /real files/); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('Windows upgrade reuses only matching immutable core files and never the shell', { skip: process.platform !== 'win32' }, async () => {
  const { root, source } = await fixture();
  try {
    const install = path.join(root, 'installed'), script = path.join(root, 'support.ps1');
    await fs.copyFile(path.join(repo, 'installer/install-support.ps1'), script);
    const invoke = (action, version, manifest, shouldPass = true) => {
      const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', action, '-Root', install,
        '-Version', version, '-Manifest', manifest, '-Desktop', root, '-StartMenu', root, '-StatusWindow', '1'], { cwd: root, encoding: 'utf8', windowsHide: true });
      if (shouldPass) assert.equal(result.status, 0, result.stdout + result.stderr);
      else assert.notEqual(result.status, 0, 'linked source must be rejected');
    };
    const old = '0.0.5-beta.31', next = '0.0.5-beta.32';
    const oldManifest = path.join(root, 'old.json'), nextManifest = path.join(root, 'next.json');
    await fs.writeFile(oldManifest, JSON.stringify(await installerManifest(source, old)));
    await fs.writeFile(nextManifest, JSON.stringify(await installerManifest(source, next)));
    invoke('Prepare', old, oldManifest); await fs.cp(source, path.join(install, 'staging', old), { recursive: true }); invoke('Commit', old, oldManifest);
    const previous = path.join(install, 'versions', old), stage = path.join(install, 'staging', next);
    await fs.writeFile(path.join(previous, 'resources/node_modules/openclaw/readme.md'), 'modified old core');
    invoke('Prepare', next, nextManifest);
    assert.equal((await fs.stat(path.join(previous, 'resources/runtime/node/node.exe'))).ino, (await fs.stat(path.join(stage, 'resources/runtime/node/node.exe'))).ino);
    await assert.rejects(fs.stat(path.join(stage, 'resources/app.asar')), { code: 'ENOENT' });
    await assert.rejects(fs.stat(path.join(stage, 'resources/node_modules/openclaw/readme.md')), { code: 'ENOENT' });
    const runtime = path.join(previous, 'resources/runtime'), outside = path.join(root, 'saved-runtime');
    await fs.rename(runtime, outside); await fs.symlink(outside, runtime, 'junction');
    invoke('Prepare', next, nextManifest, false);
    assert.equal(await fs.readFile(path.join(outside, 'node/node.exe'), 'utf8'), 'test runtime');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('Windows install engine preserves prior, foreign and modified files and rejects tamper', { skip: process.platform !== 'win32', timeout: 90000 }, async () => {
  const { root, source } = await fixture();
  // Exercise the real PowerShell 5 install/verify/remove flow with an unchanged
  // native npm content-addressed filename, not merely a short mock cache file.
  const cache = path.join(source, 'ci/cache/_cacache/content-v2/sha512/01/99', 'a'.repeat(124));
  await fs.mkdir(path.dirname(cache), { recursive: true }); await fs.writeFile(cache, 'pinned npm cache content');
  const install = path.join(root, 'cài'), manifestFile = path.join(root, 'manifest.json'), version = 'qa-' + Date.now();
  const manifest = await installerManifest(source, version); await fs.writeFile(manifestFile, JSON.stringify(manifest));
  const invoke = (action, target = install) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
    path.join(repo, 'installer/install-support.ps1'), '-Action', action, '-Root', target, '-Version', version, '-Manifest', manifestFile,
    '-Desktop', path.join(root, 'desktop'), '-StartMenu', path.join(root, 'start'), '-StatusWindow', '1'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const pass = (action, target) => { const result = invoke(action, target); assert.equal(result.status, 0, result.stdout + result.stderr); };
  try {
    const tooLong = { ...manifest, files: [...manifest.files, { path: 'resources/' + 'x'.repeat(180) + '.txt', bytes: 1, sha256: '0'.repeat(64) }] };
    const longTarget = path.join(root, 'long-destination');
    await fs.writeFile(manifestFile, JSON.stringify(tooLong));
    assert.notEqual(invoke('Prepare', longTarget).status, 0);
    await assert.rejects(fs.access(longTarget), 'long install paths must fail before creating the destination');
    const invalidTarget = path.join(root, 'invalid');
    for (const unsafePath of ['../outside.txt', '/outside.txt', 'C:/outside.txt', 'nested\\outside.txt']) {
      await fs.writeFile(manifestFile, JSON.stringify({ ...manifest, files: [...manifest.files, { path: unsafePath, bytes: 0, sha256: '0'.repeat(64) }] }));
      assert.notEqual(invoke('Prepare', invalidTarget).status, 0, unsafePath);
      await assert.rejects(fs.access(invalidTarget), 'invalid manifest paths must fail before creating the destination');
    }
    await fs.writeFile(manifestFile, JSON.stringify(manifest));
    const validPrepare = invoke('Prepare', invalidTarget);
    assert.equal(validPrepare.status, 0, 'the same short destination accepts a valid manifest: ' + validPrepare.stdout + validPrepare.stderr);
    const foreign = path.join(root, 'documents'); await fs.mkdir(foreign); await fs.writeFile(path.join(foreign, 'important.txt'), 'keep');
    assert.notEqual(invoke('Prepare', foreign).status, 0); assert.equal(await fs.readFile(path.join(foreign, 'important.txt'), 'utf8'), 'keep');
    const linkedRoot = path.join(root, 'linked-install'); await fs.symlink(foreign, linkedRoot, 'junction');
    assert.notEqual(invoke('Prepare', linkedRoot).status, 0);
    assert.equal(await fs.readFile(path.join(foreign, 'important.txt'), 'utf8'), 'keep'); await fs.unlink(linkedRoot);
    pass('Prepare'); const stage = path.join(install, 'staging', version); await fs.cp(source, stage, { recursive: true });
    const intent = path.join(stage, '.aifb-stage-intent.json'); await fs.unlink(intent);
    await fs.writeFile(path.join(stage, 'AI-for-Boss.exe'), 'unowned colliding file');
    assert.notEqual(invoke('Prepare').status, 0);
    assert.equal(await fs.readFile(path.join(stage, 'AI-for-Boss.exe'), 'utf8'), 'unowned colliding file');
    await fs.copyFile(manifestFile, intent); pass('Prepare'); await fs.cp(source, stage, { recursive: true });
    const stagedLock = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$handle = [IO.File]::Open($env:AIFB_TEST_LOCK_PATH, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None); [Console]::WriteLine("locked"); [Console]::ReadLine() | Out-Null; $handle.Dispose()'],
    { env: { ...process.env, AIFB_TEST_LOCK_PATH: path.join(stage, 'AI-for-Boss.exe') }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    assert.match(String((await once(stagedLock.stdout, 'data'))[0]), /locked/);
    try { assert.notEqual(invoke('Prepare').status, 0); assert.notEqual(invoke('Commit').status, 0); await fs.access(intent); }
    finally { stagedLock.stdin.end('\n'); await once(stagedLock, 'close'); }
    pass('Prepare'); await fs.cp(source, stage, { recursive: true });
    const stagedResources = path.join(stage, 'resources'), savedResources = path.join(stage, 'resources-owned');
    await fs.rename(stagedResources, savedResources); await fs.symlink(path.join(source, 'resources'), stagedResources, 'junction');
    try { assert.notEqual(invoke('Commit').status, 0); await fs.access(intent); assert.equal(await fs.readFile(path.join(source, 'resources/app.asar'), 'utf8'), 'test shell'); }
    finally { await fs.unlink(stagedResources); await fs.rename(savedResources, stagedResources); }
    const stagedShell = path.join(stagedResources, 'app.asar'); await fs.unlink(stagedShell);
    assert.notEqual(invoke('Commit').status, 0); await fs.access(intent);
    await fs.mkdir(stagedShell); assert.notEqual(invoke('Commit').status, 0); await fs.rmdir(stagedShell);
    await fs.copyFile(path.join(source, 'resources/app.asar'), stagedShell);
    await fs.writeFile(path.join(stage, 'AI-for-Boss.exe'), 'test executablf'); assert.notEqual(invoke('Commit').status, 0);
    await assert.rejects(fs.access(path.join(install, 'versions', version)));
    pass('Prepare'); await fs.cp(source, stage, { recursive: true }); pass('Commit'); pass('Verify'); pass('Prepare');
    const installed = path.join(install, 'versions', version);
    const held = await fs.open(path.join(installed, 'AI-for-Boss.exe'), 'r');
    try { assert.notEqual(invoke('Remove').status, 0); assert.equal(await fs.readFile(path.join(installed, 'AI-for-Boss.exe'), 'utf8'), 'test executable'); }
    finally { await held.close(); }
    const old = path.join(install, 'versions', 'prior'); await fs.mkdir(old); await fs.writeFile(path.join(old, 'keep.txt'), 'previous');
    await fs.writeFile(path.join(installed, 'my-document.txt'), 'foreign'); await fs.writeFile(path.join(installed, 'resources/app.asar'), 'modified');
    assert.notEqual(invoke('Verify').status, 0); pass('Remove');
    assert.equal(await fs.readFile(path.join(installed, 'my-document.txt'), 'utf8'), 'foreign');
    assert.equal(await fs.readFile(path.join(installed, 'resources/app.asar'), 'utf8'), 'modified');
    assert.equal(await fs.readFile(path.join(old, 'keep.txt'), 'utf8'), 'previous');
    await assert.rejects(fs.access(path.join(installed, 'AI-for-Boss.exe')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('NSIS installer never recursively removes or overwrites a previous version', async () => {
  const script = await fs.readFile(path.join(repo, 'installer/ai-for-boss.nsi'), 'utf8');
  assert.doesNotMatch(script, /RMDir\s+\/r|taskkill|MUI_FINISHPAGE_RUN/);
  assert.doesNotMatch(script, /StrCpy \$INSTDIR "\$EXEDIR"/);
  assert.match(script, /RequestExecutionLevel user/); assert.match(script, /CRCCheck force/);
  assert.ok(script.indexOf('Support Verify') < script.indexOf('Support Activate'));
  assert.match(script, /ClearErrors\s+WriteUninstaller[^\r\n]+\s+\$\{If\} \$\{Errors\}/);
});


test('PowerShell installer source declares UTF-8 for Windows legacy code pages', async () => {
  const bytes = await fs.readFile(path.join(repo, 'installer/install-support.ps1'));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
});
