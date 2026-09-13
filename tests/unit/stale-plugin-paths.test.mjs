import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { keptPaths, repairPluginPaths } from '../../apps/desktop/electron/stale-plugin-paths.mjs';

const beta37 = 'C:\\Programs\\AI for Boss Internal\\versions\\0.0.5-beta.37\\resources\\harness-plugin';
const beta38 = 'C:\\Programs\\AI for Boss Internal\\versions\\0.0.5-beta.38\\resources\\harness-plugin';

function fixture(config, { present = [beta38] } = {}) {
  const written = [], renamed = [];
  const result = repairPluginPaths('C:\\state\\openclaw.json', {
    read: () => typeof config === 'string' ? config : JSON.stringify(config),
    write: (file, body) => written.push({ file, body }),
    rename: (from, to) => renamed.push({ from, to }),
    exists: entry => present.includes(entry)
  });
  return { result, written, renamed };
}

test('a path left behind by the previous version is removed, and everything else is kept exactly', () => {
  const config = { plugins: { load: { paths: [beta37, beta38] }, entries: { 'aifb-harness': { enabled: true } } },
    agents: { list: [{ id: 'dieu-hanh' }] } };
  const { result, written, renamed } = fixture(config);
  assert.equal(result.repaired, true);
  assert.deepEqual(result.removed, [beta37]);
  assert.equal(renamed.length, 1, 'written to a temp file then renamed, never half-written in place');
  assert.equal(renamed[0].from, written[0].file);
  assert.equal(renamed[0].to, 'C:\\state\\openclaw.json');
  const saved = JSON.parse(written[0].body);
  assert.deepEqual(saved.plugins.load.paths, [beta38]);
  assert.deepEqual(saved.plugins.entries, config.plugins.entries, 'the rest of the plugin block is untouched');
  assert.deepEqual(saved.agents, config.agents, 'nothing outside plugins.load.paths is rewritten');
});

test('the upgrade that bricked beta38: every recorded path is gone, so the list empties and the core can load again', () => {
  const { result, written } = fixture({ plugins: { load: { paths: [beta37, beta37.replace('harness-plugin', 'document-tools')] } } }, { present: [] });
  assert.equal(result.repaired, true);
  assert.equal(result.removed.length, 2);
  assert.deepEqual(JSON.parse(written[0].body).plugins.load.paths, [], 'the shell re-registers its own plugins once the Gateway is up');
});

test('nothing is written when there is nothing to remove', () => {
  for (const config of [
    { plugins: { load: { paths: [beta38] } } },
    { plugins: { load: { paths: [] } } },
    { plugins: { entries: {} } },
    {}
  ]) {
    const { result, written, renamed } = fixture(config);
    assert.equal(result.repaired, false);
    assert.deepEqual(result.removed, []);
    assert.equal(written.length + renamed.length, 0);
  }
});

test('a config the host cannot parse or cannot write is left alone rather than damaged', () => {
  const unreadable = repairPluginPaths('C:\\state\\openclaw.json', { read: () => { throw new Error('EACCES'); } });
  assert.deepEqual(unreadable, { repaired: false, removed: [] });
  assert.deepEqual(fixture('{ not json').result, { repaired: false, removed: [] });
  const failed = repairPluginPaths('C:\\state\\openclaw.json', {
    read: () => JSON.stringify({ plugins: { load: { paths: [beta37] } } }),
    write: () => { throw new Error('EPERM'); }, rename: () => {}, exists: () => false
  });
  assert.equal(failed.repaired, false, 'a failed write never reports success');
  assert.deepEqual(failed.removed, [beta37]);
});

test('a non-string or non-array paths value is not something this function invents a shape for', () => {
  assert.equal(keptPaths(undefined, () => true), null);
  assert.equal(keptPaths('a string', () => true), null);
  assert.deepEqual(keptPaths([beta38, 42], entry => entry === beta38), [beta38]);
});

test('shell wiring: the prune runs before the Gateway is spawned, not after it connects', async () => {
  const main = await fs.promises.readFile(new URL('../../apps/desktop/electron/main.mjs', import.meta.url), 'utf8');
  const runtime = main.slice(main.indexOf('async function startRuntime()'));
  const prune = runtime.indexOf('repairPluginPaths(');
  const spawn = runtime.indexOf('new GatewaySupervisor(');
  assert.ok(prune > 0 && spawn > 0 && prune < spawn, 'the config is repaired before the supervisor is constructed');
  assert.match(runtime.slice(prune - 200, prune + 200), /path\.join\(directory, 'openclaw\.json'\)/);
});
