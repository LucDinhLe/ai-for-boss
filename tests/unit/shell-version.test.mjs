import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadShellContract, createUnavailableShellContract } from '../../apps/desktop/electron/shell-contract.mjs';

test('About uses the executing package version even when generated metadata is stale', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aifb-shell-version-'));
  try {
    const file = path.join(directory, 'contract.json');
    const stale = createUnavailableShellContract(); stale.product.version = '0.0.5-beta.27';
    await writeFile(file, JSON.stringify(stale));
    assert.equal((await loadShellContract(file, '0.0.5-beta.30')).product.version, '0.0.5-beta.30');
    assert.equal(JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8')).product.version, '0.0.5-beta.27');
    await assert.rejects(loadShellContract(file, ''), /runningVersion/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
