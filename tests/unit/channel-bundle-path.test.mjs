import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { packagedChannelBundlePath } from '../../apps/desktop/electron/channel-bundle-path.mjs';

test('native npm cache fits the Windows staging and installed paths without changing cache filenames', () => {
  const root = 'C:\\Users\\FixtureUser\\AppData\\Local\\Programs\\AI for Boss Internal';
  const cache = `cache/_cacache/content-v2/sha512/01/99/${'a'.repeat(124)}`;
  for (const phase of ['staging', 'versions']) {
    const version = path.win32.join(root, phase, '0.0.5-beta.26');
    const resources = path.win32.join(version, 'resources');
    const legacy = path.win32.join(resources, 'channel-installer', cache);
    assert.ok(legacy.length >= 260, 'regression fixture reproduces NSIS / PowerShell 5 failure');
    const bundle = packagedChannelBundlePath(resources, 'win32');
    assert.equal(bundle, path.win32.join(version, 'ci'));
    const current = path.win32.join(bundle, cache);
    assert.ok(current.length < 260);
    assert.ok(path.win32.dirname(current).length < 248);
    assert.equal(path.win32.relative(bundle, current), cache.replaceAll('/', '\\'));
  }
});

test('non-Windows packages keep the toolkit beside the existing resources', () => {
  assert.equal(packagedChannelBundlePath('/Applications/AI for Boss.app/Contents/Resources', 'darwin'), '/Applications/AI for Boss.app/Contents/Resources/channel-installer');
  assert.equal(packagedChannelBundlePath('/opt/aifb/resources', 'linux'), '/opt/aifb/resources/channel-installer');
});
