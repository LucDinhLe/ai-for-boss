import assert from 'node:assert/strict';
import test from 'node:test';
import { modelChoices } from '../../apps/desktop/src/model-choices.ts';

const rows = Array.from({ length: 1205 }, (_, i) => ({ id: `model-${i}`, name: `Model ${i}`, provider: i < 200 ? 'connected' : 'other',
  available: i < 150, selectable: i < 100 }));
test('both pickers receive contiguous provider families in the requested priority, including unavailable rows', () => {
  const models = ['xai', 'claude-cli', 'google', 'anthropic', 'openai', 'alibaba', 'openai'].map((provider, i) => ({
    provider, id: `m${i}`, name: `M${i}`, available: i !== 6, selectable: i !== 6
  }));
  const result = modelChoices(models, '', '__all', 100);
  assert.deepEqual(result.models.map(m => m.provider), ['openai', 'openai', 'anthropic', 'claude-cli', 'google', 'xai', 'alibaba']);
  assert.equal(modelChoices(models, 'ChatGPT', '__connected', 100).total, 2);
  assert.equal(modelChoices(models, 'Gemini', '__connected', 100).models[0].provider, 'google');
  assert.equal(modelChoices(models, 'Grok', '__connected', 100).models[0].provider, 'xai');
  assert.equal(models[0].provider, 'xai', 'input inventory is never mutated');
});
test('branding does not infer authentication for another route from the same company', () => {
  const models = [{ provider: 'anthropic', id: 'a', available: true }, { provider: 'claude-cli', id: 'b', available: false }];
  assert.deepEqual(modelChoices(models, '', '__connected', 100).models, [models[0]]);
});
test('connected-provider default keeps all its supported rows and limits DOM output', () => {
  const result = modelChoices(rows, '', '__connected', 100);
  assert.equal(result.total, 200); assert.equal(result.models.length, 100);
  assert.ok(result.models.every(model => model.selectable));
  assert.equal(modelChoices(rows, '', '__connected', 200).models.length, 200);
});
test('all-provider choice exposes the complete catalogue and exact displayed ref remains searchable', () => {
  assert.equal(modelChoices(rows, '', '__all', 1300).models.length, rows.length);
  assert.deepEqual(modelChoices(rows, 'other/model-1111', '__all', 100).models, [rows[1111]]);
  assert.equal(modelChoices(rows, 'model-1111', '__connected', 100).total, 0);
  assert.equal(modelChoices(rows, '', 'other', 100).total, 1005);
});
test('current disconnected provider is visible without pretending its rows are selectable', () => {
  const result = modelChoices(rows, 'other/model-1111', '__connected', 100, 'other');
  assert.equal(result.models[0].available, false); assert.equal(result.models[0].selectable, false);
});
