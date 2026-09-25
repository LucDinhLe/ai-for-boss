import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { sweepTemporaries, writeJson } from '../../apps/desktop/electron/backup-service.mjs';

const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aifb-write-'));

test('a refused rename is retried, and a final refusal leaves no temp file behind (0068)', async () => {
  const root = dir(), file = path.join(root, 'aifb-layout.json');
  let calls = 0;
  const busy = async (from, to) => { if (++calls < 3) throw Object.assign(new Error('busy'), { code: 'EPERM' }); fs.renameSync(from, to); };
  await writeJson(file, { a: 1 }, { rename: busy, wait: async () => {} });
  assert.equal(calls, 3);
  assert.deepEqual(fs.readdirSync(root), ['aifb-layout.json']);
  const never = async () => { throw Object.assign(new Error('locked'), { code: 'EPERM' }); };
  await assert.rejects(writeJson(file, { a: 2 }, { rename: never, wait: async () => {} }));
  assert.deepEqual(fs.readdirSync(root), ['aifb-layout.json'], 'the temp file is removed even when the write fails');
});

test('the sweep removes only the leftovers of that one file', async () => {
  const root = dir(), file = path.join(root, 'aifb-layout.json');
  for (const name of ['aifb-layout.json', 'aifb-layout.json.049d7672-7cfd-42e8-8d1d-7d719692ab0a.tmp',
    'aifb-layout.json.0a61d33b-7433-4640-a587-e72b2c5f313b.tmp', 'other.json.049d7672-7cfd-42e8-8d1d-7d719692ab0a.tmp', 'notes.tmp'])
    fs.writeFileSync(path.join(root, name), '{}');
  assert.equal(await sweepTemporaries(file), 2);
  assert.deepEqual(fs.readdirSync(root).sort(), ['aifb-layout.json', 'notes.tmp', 'other.json.049d7672-7cfd-42e8-8d1d-7d719692ab0a.tmp']);
});
