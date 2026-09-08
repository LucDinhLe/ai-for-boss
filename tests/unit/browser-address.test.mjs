import test from 'node:test';
import assert from 'node:assert/strict';
import { browserDestination } from '../../apps/desktop/src/browser-address.ts';
test('browser address accepts websites and encodes search without allowing executable protocols', () => {
  assert.equal(browserDestination('example.com'), 'https://example.com/');
  assert.equal(browserDestination(' https://example.com/a?q=1 '), 'https://example.com/a?q=1');
  assert.equal(browserDestination('kế hoạch & doanh thu'), 'https://www.google.com/search?q=' + encodeURIComponent('kế hoạch & doanh thu'));
  assert.equal(browserDestination('openclaw'), 'https://www.google.com/search?q=openclaw');
  for (const value of ['', 'javascript:alert(1)', 'file:///C:/secret', 'data:text/html,hello']) assert.throws(() => browserDestination(value));
});
