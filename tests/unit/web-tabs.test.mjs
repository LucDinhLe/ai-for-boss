import test from 'node:test';
import assert from 'node:assert/strict';
import { webUrl, publicWebUrl, publicAddress } from '../../apps/desktop/electron/web-tabs.mjs';
import { ChromeBridge, CHROME_EXTENSION_URL } from '../../apps/desktop/electron/chrome-bridge.mjs';
test('web URLs deny local services, credentials and non-web protocols including DNS-to-private hosts', async () => {
  assert.equal(webUrl('example.com/a'), 'https://example.com/a');
  for (const url of ['file:///C:/secret', 'javascript:alert(1)', 'https://a:b@example.com', 'http://localhost', 'http://127.1', 'http://2130706433', 'http://10.0.0.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://internal', 'http://a.local']) assert.throws(() => webUrl(url));
  assert.equal(publicAddress('8.8.8.8'), true); assert.equal(publicAddress('fe80::1'), false);
  await assert.rejects(publicWebUrl('https://example.com', async () => [{ address: '127.0.0.1' }]));
  await assert.rejects(publicWebUrl('https://example.com', async () => [{ address: '8.8.8.8' }, { address: '10.0.0.1' }]));
});
test('Chrome bridge keeps pairing in host clipboard and fixes native read routes', async () => {
  const calls = []; let clipboardValue = '', opened;
  const bridge = new ChromeBridge({ request: async params => { calls.push(params); return { cdpPort: 19693, tabs: [{ targetId: 't1', title: 'Test', url: 'https://example.com' }] }; },
    getSupervisor: () => ({}), getPairing: async () => 'ws://127.0.0.1:19693/extension#synthetic-fixture', clipboard: { writeText: v => { clipboardValue = v; }, readText: () => clipboardValue, clear: () => { clipboardValue = ''; } }, openExternal: async url => { opened = url; } });
  assert.deepEqual(await bridge.run({ action: 'chrome-pair' }), { copied: true, expiresInSeconds: 60 });
  assert.equal(clipboardValue, 'ws://127.0.0.1:19693/extension#synthetic-fixture');
  const tabs = await bridge.run({ action: 'chrome-tabs' }); assert.equal(tabs.tabs[0].id, 't1');
  assert.ok(calls.every(call => call.target === 'host' && call.query.profile === 'chrome' && call.method === 'GET'));
  await assert.rejects(bridge.run({ action: 'chrome-tabs', path: '/cookies' }));
  await assert.rejects(bridge.run({ action: 'chrome-share', id: 'foreign' }));
  await bridge.run({ action: 'chrome-store' }); assert.equal(opened, CHROME_EXTENSION_URL);
});

test('Chrome sharing reads only the selected tab and discards a page that changes during snapshot', async () => {
  let moved = false, reads = 0;
  const bridge = new ChromeBridge({ validateUrl: async url => assert.equal(url, 'https://example.com/'), request: async params => {
    if (params.path === '/snapshot') { assert.equal(params.query.targetId, 'selected'); return { snapshot: 'Selected content' }; }
    reads++;
    return { tabs: [{ targetId: 'selected', title: 'Page', url: moved && reads % 2 === 0 ? 'https://example.com/other' : 'https://example.com/' }] };
  } });
  assert.equal((await bridge.run({ action: 'chrome-share', id: 'selected' })).text, 'Selected content');
  moved = true;
  await assert.rejects(bridge.run({ action: 'chrome-share', id: 'selected' }), /đã đổi/);
});
