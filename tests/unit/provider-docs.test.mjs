import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolveProviderDoc } from '../../apps/desktop/electron/provider-docs.mjs';

const catalogue = JSON.parse(readFileSync(new URL('../../apps/desktop/electron/native-catalog.json', import.meta.url), 'utf8'));
test('every packaged official auth method resolves only to its own OpenClaw docs', () => {
  assert.ok(catalogue.authMethods.length > 20);
  for (const method of catalogue.authMethods) {
    const url = new URL(resolveProviderDoc({ action: 'provider-doc', methodId: method.id }, catalogue));
    assert.equal(url.origin, 'https://docs.openclaw.ai'); assert.equal(url.pathname + url.hash, method.docsPath);
  }
  assert.deepEqual(catalogue.authMethods.filter(method => method.provider === 'openai').map(method => method.method).sort(), ['api-key', 'device-code', 'oauth']);
  assert.deepEqual(catalogue.authMethods.filter(method => method.provider === 'anthropic').map(method => method.method).sort(), ['api-key', 'cli', 'setup-token']);
});

test('renderer cannot supply a URL, another method or path that escapes official docs', () => {
  for (const input of [{ action: 'provider-doc', methodId: 'missing' }, { action: 'provider-doc', methodId: 'openai', url: 'https://evil.test' },
    { action: 'execute', methodId: 'openai' }, null]) assert.throws(() => resolveProviderDoc(input, catalogue));
  for (const docsPath of ['https://evil.test', '//evil.test/x', '/providers/../x', '/providers/%2e%2e/x', '/providers/openai?credential=x', '/providers/openai\\x']) {
    assert.throws(() => resolveProviderDoc({ action: 'provider-doc', methodId: 'fake' }, { authMethods: [{ id: 'fake', docsPath }] }));
  }
  assert.throws(() => resolveProviderDoc({ action: 'provider-doc', methodId: 'fake' }, { authMethods: [{ id: 'fake' }, { id: 'fake' }] }));
});
