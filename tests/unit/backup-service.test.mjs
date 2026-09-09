import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { encryptBackup, decryptBackup } from '../../apps/desktop/electron/backup-crypto.mjs';
import { BackupService } from '../../apps/desktop/electron/backup-service.mjs';
const password = 'a sufficiently long fixture password';
test('recovery encryption authenticates password, header and payload', () => {
  const content = Buffer.from('fixture provider credential — never plaintext');
  const bytes = encryptBackup(content, { password, version: 'test' });
  assert.equal(bytes.includes(content), false);
  assert.deepEqual(decryptBackup(bytes, { password }), content);
  assert.throws(() => decryptBackup(bytes, { password: 'wrong password here' }));
  const changed = Buffer.from(bytes); changed[changed.length - 20] ^= 1;
  assert.throws(() => decryptBackup(changed, { password }));
  assert.throws(() => encryptBackup(content, { password: 'short' }));
});
async function fixture(overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-backup-'));
  await fs.mkdir(path.join(root, 'openclaw-state'));
  await fs.writeFile(path.join(root, 'openclaw-state', 'sentinel.txt'), 'original');
  const native = async args => {
    if (args[0] === 'config') return '{}';
    if (args[1] === 'create') {
      await fs.writeFile(args[args.indexOf('--output') + 1], await fs.readFile(path.join(root, 'openclaw-state', 'sentinel.txt')));
      return JSON.stringify({ verified: true, assets: [{ kind: 'state' }] });
    }
    if (args[1] === 'restore') {
      const target = args[args.indexOf('--target') + 1];
      await fs.mkdir(path.join(target, 'archive', 'state'), { recursive: true });
      await fs.writeFile(path.join(target, 'archive', 'manifest.json'), JSON.stringify({ runtimeVersion: '2026.9.1', assets: [{ kind: 'state', archivePath: 'archive/state', sourcePath: path.join(root, 'openclaw-state') }] }));
      await fs.copyFile(args[2], path.join(target, 'archive/state/sentinel.txt')); return '{}';
    }
    throw new Error('Unexpected command');
  };
  const service = new BackupService({ root, version: 'fixture', native, protect: x => x, unprotect: x => x,
    exclusive: operation => operation(), pause: async () => {}, onRestored: async () => {}, confirm: async () => true, ...overrides });
  await service.initialize(); return { root, service };
}
test('retention preserves foreign files; restore replaces state and preserves rollback', async () => {
  const { root, service } = await fixture();
  try {
    const foreign = path.join(service.directory, 'foreign.aifb'); await fs.writeFile(foreign, 'keep');
    for (let i = 0; i < 4; i++) await service.run({ action: 'data-backup' });
    assert.equal(service.records.length, 3); assert.equal(await fs.readFile(foreign, 'utf8'), 'keep');
    await fs.writeFile(path.join(service.state, 'sentinel.txt'), 'newer');
    await service.run({ action: 'data-restore', id: service.records[0].id });
    assert.equal(await fs.readFile(path.join(service.state, 'sentinel.txt'), 'utf8'), 'original');
    const rollback = (await fs.readdir(service.directory)).find(x => x.startsWith('rollback-'));
    assert.equal(await fs.readFile(path.join(service.directory, rollback, 'state/sentinel.txt'), 'utf8'), 'newer');
    await assert.rejects(service.run({ action: 'data-delete', id: '../foreign' }));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('activation failure restores the previous state and layout', async () => {
  const { root, service } = await fixture({ onRestored: async () => { throw new Error('fixture activation failure'); } });
  try {
    await service.run({ action: 'data-backup' });
    await fs.writeFile(path.join(service.state, 'sentinel.txt'), 'newer');
    await assert.rejects(service.run({ action: 'data-restore', id: service.records[0].id }), /activation failure/);
    assert.equal(await fs.readFile(path.join(service.state, 'sentinel.txt'), 'utf8'), 'newer');
    assert.equal(service.busy, false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
