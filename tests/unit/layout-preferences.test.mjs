import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAYOUT, parseLayout } from '../../apps/desktop/src/layout-preferences.ts';
test('layout preferences reject corrupt and out-of-range stored values', () => {
  for (const value of [null, '{', 'null', '[]', '42']) assert.deepEqual(parseLayout(value), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout(JSON.stringify({ railWidth: 999999, dockWidth: -10, textSize: 0, theme: 'script', leftHidden: 'true', credential: 'must-not-survive' })), DEFAULT_LAYOUT);
  assert.deepEqual(parseLayout(JSON.stringify({ railWidth: 260, dockWidth: 400, textSize: 16, theme: 'dark', leftHidden: true, rightHidden: true })),
    { railWidth: 260, dockWidth: 400, textSize: 16, theme: 'dark', leftHidden: true, rightHidden: true });
});
