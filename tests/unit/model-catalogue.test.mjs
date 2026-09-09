import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModelCatalogue, findSelectableModel } from '../../apps/desktop/electron/model-catalogue.mjs';

const model = (id, available = true, provider = 'fixture') => ({ id, name: id, provider, available });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('full discovery precedes the fresh native selection view and preserves configured rows', async () => {
  const calls = [], discovery = deferred();
  const pending = loadModelCatalogue(async (method, params) => {
    calls.push({ method, params });
    if (params.view === 'all') return discovery.promise;
    return { models: [model('new-model'), model('explicit-model')] };
  }, { agentId: 'research', refresh: true });
  assert.equal(calls.length, 1);
  discovery.resolve({ models: [model('new-model'), model('hidden-model'), model('no-auth', false, 'other')] });
  const result = await pending;
  assert.deepEqual(calls, [{ method: 'models.list', params: { agentId: 'research', view: 'all', refresh: true } },
    { method: 'models.list', params: { agentId: 'research' } }]);
  assert.equal(result.models.length, 4);
  assert.equal(result.models.find(m => m.id === 'new-model').selectable, true);
  assert.equal(result.models.find(m => m.id === 'hidden-model').selectable, false);
  assert.equal(result.models.find(m => m.id === 'hidden-model').selectionReason, 'not-offered');
  assert.equal(result.models.find(m => m.id === 'explicit-model').selectable, true);
  assert.deepEqual(result.connectedProviders, ['fixture']);
});

test('fresh auth failure overrides earlier browse readiness and cannot be called selectable', async () => {
  const result = await loadModelCatalogue(async (_method, params) => ({ models: [params.view === 'all'
    ? model('model') : { ...model('model', false), unavailableReason: 'auth-failed' }] }));
  assert.equal(result.models[0].available, false);
  assert.equal(result.models[0].selectable, false);
});

test('failed provider discovery remains visible alongside retained usable models and exposes no profile fields', async () => {
  const result = await loadModelCatalogue(async () => ({ models: [model('retained')],
    providerOutcomes: [{ provider: 'fixture', status: 'unavailable', profileId: 'native-profile-id' }] }), { refresh: true });
  assert.equal(result.models[0].selectable, true); assert.equal(result.refreshed, false);
  assert.deepEqual(result.providerOutcomes, [{ provider: 'fixture', status: 'unavailable' }]);
  assert.equal(JSON.stringify(result).includes('native-profile-id'), false);
});

test('lazy host membership discovers an omitted model, rechecks native policy, and makes no mutation', async () => {
  const calls = [];
  const found = await findSelectableModel(async (method, params) => {
    calls.push({ method, params });
    return { models: calls.length === 1 ? [model('initial')] : [model('new')] };
  }, model('new'), { agentId: 'worker' });
  assert.equal(found.id, 'new');
  assert.deepEqual(calls.map(c => c.params), [{ agentId: 'worker' }, { agentId: 'worker', view: 'all' }, { agentId: 'worker' }]);
  assert.ok(calls.every(c => c.method === 'models.list'));
  assert.equal(await findSelectableModel(async (_method, params) => ({ models: [model(params.view === 'all' ? 'denied' : 'allowed')] }), model('denied')), null);
});

test('known auth failure does not trigger discovery and exact provider identity is required', async () => {
  let count = 0;
  assert.equal(await findSelectableModel(async () => { count++; return { models: [model('known', false)] }; }, model('known')), null);
  assert.equal(count, 1);
  assert.equal(await findSelectableModel(async () => ({ models: [model('same-name', true, 'provider-a')] }), model('same-name', true, 'provider-b')), null);
});

test('failed policy read, malformed catalogues and caller-supplied extra authority fail closed', async () => {
  await assert.rejects(loadModelCatalogue(async (_method, params) => {
    if (!params.view) throw new Error('connection changed');
    return { models: [model('browse-only')] };
  }), /connection changed/u);
  for (const invalid of [null, {}, { models: null }, { models: [model('x'), model('x')] }, { models: [{ id: 'x' }] }]) {
    await assert.rejects(loadModelCatalogue(async () => invalid), /Danh mục/u);
  }
  for (const input of [{ agentId: '../main' }, { refresh: 'true' }, { config: {} }, []]) {
    await assert.rejects(loadModelCatalogue(async () => assert.fail('invalid input must not reach native'), input), /Yêu cầu/u);
  }
});
