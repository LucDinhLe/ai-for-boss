import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = name => fs.readFile(path.join(repo, name), 'utf8');

test('the shipped version is the same in the package, the README and nowhere else by accident', async () => {
  const version = JSON.parse(await read('apps/desktop/package.json')).version;
  assert.match(version, /^0\.0\.\d+-beta\.\d+$/);
  const readme = await read('README.md');
  // The front page drifted to an older beta once because nothing tied these
  // together. The download link, the install step and the status line must all
  // name the version this repository actually builds.
  assert.ok(readme.includes(`releases/download/${version}/AI-for-Boss-${version}-Setup.exe`), 'README links the installer for this version');
  assert.ok(readme.includes(`releases/tag/${version}`), 'README links the notes for this version');
  assert.ok(readme.includes(`AI-for-Boss-${version}-Setup.exe\``), 'the install step names this version');
  const older = [...readme.matchAll(/0\.0\.\d+-beta\.(\d+)/gu)].map(match => Number(match[1]));
  assert.ok(older.every(number => number <= Number(version.split('.').pop())), 'README never points forward to an unreleased beta');

  // documents:install runs npm ci, which refuses a lockfile whose version
  // disagrees with its package. Bumping one and not the other breaks the build.
  const tools = JSON.parse(await read('packages/document-tools/package.json'));
  const lock = JSON.parse(await read('packages/document-tools/package-lock.json'));
  assert.equal(tools.version, version);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
});

test('the release workflow refuses to build a version that main does not declare', async () => {
  const workflow = await read('.github/workflows/release-windows.yml');
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /workflow_dispatch:/, 'releases are started by hand, never by a push');
  assert.match(workflow, /apps\/desktop\/package\.json[\s\S]*?throw "apps\/desktop\/package\.json ghi/u, 'the version guard reads the package');
  assert.match(workflow, /README\.md[\s\S]*?throw "README\.md chưa nhắc tới/u, 'the version guard reads the README');
  const guard = workflow.indexOf('Check the version is the one on main');
  for (const later of ['Install locked dependencies', 'Stage the bundled Node runtime', 'Build the installer', 'Publish the pre-release']) {
    assert.ok(guard < workflow.indexOf(later), `the guard runs before ${later}`);
  }
});

test('the release workflow builds through the shipped scripts and publishes a pre-release', async () => {
  const workflow = await read('.github/workflows/release-windows.yml');
  for (const step of ['pnpm verify', 'pnpm stage:runtime', 'pnpm package:desktop',
    'node scripts/validate-feature-0.4.mjs --require-artifact', 'node scripts/build-internal-installer.mjs']) {
    assert.ok(workflow.includes(step), `the workflow runs ${step}`);
  }
  assert.match(workflow, /--prerelease/, 'nothing is published as a stable release');
  assert.match(workflow, /if: \$\{\{ !inputs\.dry_run \}\}/, 'a dry run builds without publishing');
  assert.match(workflow, /installerSha256/, 'the published notes carry the digest users check');

  // Signing keys stay with the Product Owner; the update feed is refreshed
  // outside CI until that decision changes (spec 0054).
  assert.doesNotMatch(workflow, /releases\/preview\.json|build-component-release|secrets\./u, 'no signing key or update feed in CI');

  // Third-party actions must stay pinned to a commit, as in the other workflows.
  for (const [, reference] of workflow.matchAll(/uses: (\S+)/gu)) {
    assert.match(reference, /@[0-9a-f]{40}$/u, `${reference} is pinned to a commit`);
  }
});
