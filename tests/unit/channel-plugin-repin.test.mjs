import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeLockChange } from '../../scripts/stage-channel-installer.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('a lock drift is described package by package, for npm and native lock shapes alike', () => {
  const npmBefore = { packages: { '': { version: '1' }, 'node_modules/a': { version: '1.0.0' }, 'node_modules/b': { version: '2.0.0' } } };
  const npmAfter = { packages: { '': { version: '1' }, 'node_modules/a': { version: '1.0.1' }, 'node_modules/c': { version: '3.0.0' } } };
  assert.deepEqual(describeLockChange(npmBefore, npmAfter).sort(), ['+ node_modules/c 3.0.0', '- node_modules/b 2.0.0', '~ node_modules/a 1.0.0 -> 1.0.1'].sort());
  const nativeBefore = { packages: [{ path: 'node_modules/x', version: '1.0.0' }] };
  const nativeAfter = { packages: [{ path: 'node_modules/x', version: '1.0.0' }] };
  assert.deepEqual(describeLockChange(nativeBefore, nativeAfter), []);
});

test('staging refuses a drifted closure unless the repin workflow asked for a rewrite', async () => {
  const source = await fs.readFile(path.join(repo, 'scripts/stage-channel-installer.mjs'), 'utf8');
  assert.match(source, /process\.env\.AIFB_REPIN_CHANNEL_PLUGINS === '1'/, 'repin is an explicit opt-in');
  assert.match(source, /if \(!repinChannelPlugins\) \{\s*throw new Error/u, 'the default is still to refuse');
  assert.doesNotMatch(source, /flag: 'wx' \}\);\s*\n\s*\} else/u, 'no silent first-write path is left beside the guard');
  const workflow = await fs.readFile(path.join(repo, '.github/workflows/repin-channel-plugins.yml'), 'utf8');
  assert.match(workflow, /AIFB_REPIN_CHANNEL_PLUGINS: '1'/);
  assert.match(workflow, /manifests\/channel-installer/);
  assert.doesNotMatch(workflow, /git push[^\n]*main/u, 'the repin workflow never writes to main');
  assert.match(workflow, /chore\/repin-channel-plugins-/, 'changes land on a review branch');
  for (const [, reference] of workflow.matchAll(/uses: (\S+)/gu)) assert.match(reference, /@[0-9a-f]{40}$/u, `${reference} is pinned`);
  const release = await fs.readFile(path.join(repo, '.github/workflows/release-windows.yml'), 'utf8');
  assert.doesNotMatch(release, /AIFB_REPIN_CHANNEL_PLUGINS/, 'a release build never rewrites pins');
});
