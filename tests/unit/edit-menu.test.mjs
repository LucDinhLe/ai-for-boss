import test from 'node:test';
import assert from 'node:assert/strict';
import { installEditMenu } from '../../apps/desktop/electron/edit-menu.mjs';

test('right-click Paste uses Electron native editing in the originating frame, only for editable content', () => {
  let listener, template, popup;
  const window = { isDestroyed: () => false, webContents: { on(name, callback) { assert.equal(name, 'context-menu'); listener = callback; } } };
  installEditMenu(window, { buildFromTemplate(items) { template = items; return { popup(options) { popup = options; } }; } });
  listener({}, { isEditable: false }); assert.equal(template, undefined);
  const frame = {}; listener({}, { isEditable: true, frame });
  assert.equal(template.find(item => item.label === 'Dán').role, 'paste');
  assert.equal(popup.window, window); assert.equal(popup.frame, frame);
});
