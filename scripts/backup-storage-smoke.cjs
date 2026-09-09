// Native OS key protection; isolated runner profile and synthetic bytes only.
const { app, safeStorage } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
app.whenReady().then(async () => {
  const { encryptBackup, decryptBackup } = await import('../apps/desktop/electron/backup-crypto.mjs');
  assert.equal(safeStorage.isEncryptionAvailable(), true);
  const protect = value => safeStorage.encryptString(value).toString('base64');
  const unprotect = value => safeStorage.decryptString(Buffer.from(value, 'base64'));
  const original = Buffer.from('Synthetic recovery fixture: no account credentials');
  const file = path.join(app.getPath('userData'), 'fixture.aifb');
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(file, encryptBackup(original, { protect, version: 'fixture' }));
  const persisted = await fs.readFile(file);
  assert.equal(persisted.includes(original), false);
  assert.deepEqual(decryptBackup(persisted, { unprotect }), original);
  persisted[persisted.length - 1] ^= 1;
  assert.throws(() => decryptBackup(persisted, { unprotect }));
  console.log(JSON.stringify({ nativeOSKeyProtection: true, diskRoundTrip: true, tamperRejected: true, realAccounts: false }));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
