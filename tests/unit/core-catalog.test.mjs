import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NativeManagement } from '../../apps/desktop/electron/native-management.mjs';
test('MCP inventory projects only names, transport and flags; no server is contacted and config cannot be selected', async () => {
  const calls = [], secret = 'SYNTHETIC_PRIVATE_VALUE';
  const service = new NativeManagement(async (method, params) => {
    calls.push({ method, params });
    return { config: { secret, mcp: { servers: { finance: { transport: 'stdio', command: secret, args: [secret], env: { KEY: secret }, enabled: false },
      docs: { transport: 'http', url: secret, headers: { Authorization: secret }, oauth: { clientSecret: secret } } } } }, raw: secret };
  }, {});
  assert.deepEqual(await service.run({ action: 'mcp-inventory' }), { servers: [
    { id: 'finance', enabled: false, transport: 'stdio' }, { id: 'docs', enabled: true, transport: 'http' }] });
  assert.deepEqual(calls, [{ method: 'config.get', params: {} }]);
  for (const packet of [{ action: 'mcp-inventory', path: 'secrets' }, { action: 'mcp-inventory', probe: true }, { action: 'plugin-inventory', install: 'x' }]) await assert.rejects(service.run(packet));
  assert.equal(calls.length, 1);
  service.request = async () => ({}); await assert.rejects(service.run({ action: 'mcp-inventory' }));
});
test('plugin inventory excludes raw diagnostics, paths and installation instructions', async () => {
  const service = new NativeManagement(async (method, params) => {
    assert.equal(method, 'plugins.list'); assert.deepEqual(params, {});
    return { plugins: [{ id: 'example', name: 'Example', description: 'Find knowledge', installed: true, enabled: false, state: 'disabled', category: 'memory', source: 'PRIVATE', error: 'PRIVATE', install: { command: 'PRIVATE' } }], diagnostics: ['PRIVATE'] };
  }, {});
  assert.deepEqual(await service.run({ action: 'plugin-inventory' }), { mutationAllowed: false, diagnosticCount: 1,
    plugins: [{ id: 'example', label: 'Example', description: 'Find knowledge', installed: true, enabled: false, state: 'disabled', category: 'memory',
      version: '', packageName: '', origin: '', kinds: [] }] });
});
test('generated core catalogue has provider/plugin coverage with source fingerprints, without pretending external plugins are bundled', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../apps/desktop/electron/native-catalog.json', import.meta.url)));
  assert.equal(catalog.version, '2026.9.1'); assert.ok(catalog.providers.length > 60); assert.ok(catalog.plugins.length > 100);
  for (const kind of ['providers', 'plugins', 'channels']) assert.equal(new Set(catalog[kind].map(row => row.id)).size, catalog[kind].length);
  assert.equal(catalog.plugins.find(row => row.id === 'discord').bundled, false);
  assert.equal(catalog.plugins.find(row => row.id === 'openai').bundled, true);
  for (const row of catalog.sources) assert.match(row.sha256, /^[a-f0-9]{64}$/);
  assert.ok(catalog.sources.some(row => row.path === 'docs/plugins/plugin-inventory.md'));
});
