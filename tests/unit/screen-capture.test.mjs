import test from 'node:test';
import assert from 'node:assert/strict';
import { captureScreens } from '../../apps/desktop/electron/screen-capture.mjs';
test('screen capture requires an exact explicit action and bounds IPC image data', async () => {
  let calls = 0;
  const api = { getSources: async options => { calls++; assert.deepEqual(options.types, ['screen']); return [{ thumbnail: { isEmpty: () => false, toPNG: () => Buffer.from('fixture') } }]; } };
  await assert.rejects(captureScreens({ action: 'screen-capture', hidden: true }, api)); assert.equal(calls, 0);
  const result = await captureScreens({ action: 'screen-capture' }, api); assert.equal(calls, 1); assert.equal(result.screens.length, 1);
  await assert.rejects(captureScreens({ action: 'screen-capture' }, { getSources: async () => [{ thumbnail: { isEmpty: () => false, toPNG: () => Buffer.alloc(9 * 1024 * 1024) } }] }));
});
