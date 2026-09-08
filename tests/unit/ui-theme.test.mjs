import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUiTheme } from '../../apps/desktop/electron/ui-theme.mjs';

test('light and dark update Chromium preference without opening tabs or a Gateway', () => {
  const native = { themeSource: 'system' };
  assert.deepEqual(applyUiTheme({ action: 'ui-theme', theme: 'light' }, native), { theme: 'light' });
  assert.deepEqual(applyUiTheme({ action: 'ui-theme', theme: 'dark' }, native), { theme: 'dark' });
  for (const input of [{ action: 'ui-theme', theme: 'system' }, { action: 'ui-theme', theme: 'light', url: 'https://example.com' }, null]) {
    assert.throws(() => applyUiTheme(input, native));
    assert.equal(native.themeSource, 'dark');
  }
});
