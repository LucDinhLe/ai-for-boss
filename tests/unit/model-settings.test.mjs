import test from 'node:test';
import assert from 'node:assert/strict';
import { modelSettings } from '../../apps/desktop/electron/model-settings.mjs';
const snapshot = () => ({ hash: 'old', config: { secrets: { key: 'NEVER_PROJECT' }, models: { provider: { unrelated: true } } } });
test('model settings project only public scalars; catalog-only save preserves provider defaults', async () => {
  let state = snapshot(); const calls = [];
  const request = async (method, params) => { calls.push([method, params]); if (method === 'config.get') return state;
    const patch = JSON.parse(params.raw); assert.deepEqual(patch, { models: { catalogRefresh: { enabled: false } } });
    state = { ...state, hash: 'new', config: { ...state.config, models: { ...state.config.models, ...patch.models } } }; return { ok: true, hash: 'new' }; };
  assert.deepEqual(await modelSettings(request, { action: 'model-settings' }), { revision: 'old', cacheRetention: null, catalogRefresh: true });
  const result = await modelSettings(request, { action: 'model-settings-save', revision: 'old', cacheRetention: null, catalogRefresh: false });
  assert.equal(result.applied, false); assert.equal(result.catalogRefresh, false); assert.equal(state.config.models.provider.unrelated, true);
  assert.equal(JSON.stringify(result).includes('NEVER_PROJECT'), false); assert.equal(calls.filter(([m]) => m === 'config.patch').length, 1);
});
test('stale revisions, unknown settings and invalid modes cannot write', async () => {
  for (const input of [{ action: 'model-settings', config: {} }, { action: 'model-settings-save', revision: 'old', cacheRetention: 'forever', catalogRefresh: true },
    { action: 'model-settings-save', revision: 'stale', cacheRetention: 'short', catalogRefresh: true }]) {
    await assert.rejects(modelSettings(async method => { assert.equal(method, 'config.get'); return snapshot(); }, input));
  }
});
test('save requires exact acknowledgement and readback; applied is distinct from persisted', async () => {
  for (const valid of [false, true]) {
    let state = snapshot();
    const op = modelSettings(async (method, params) => { if (method === 'config.get') return state;
      assert.deepEqual(JSON.parse(params.raw), { agents: { defaults: { params: { cacheRetention: 'short' } } }, models: { catalogRefresh: { enabled: true } } });
      state = { hash: 'new', configRevisionHash: 'revision', appliedConfigHash: 'revision', config: { agents: { defaults: { params: { cacheRetention: valid ? 'short' : 'long' } } } } };
      return { ok: true, hash: 'new' };
    }, { action: 'model-settings-save', revision: 'old', cacheRetention: 'short', catalogRefresh: true });
    if (valid) assert.equal((await op).applied, true); else await assert.rejects(op);
  }
});
