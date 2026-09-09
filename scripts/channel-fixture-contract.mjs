import assert from 'node:assert/strict';

export const configFormChannels = new Set(['zalo', 'whatsapp', 'discord', 'googlechat']);
export function stepEvidence(step) {
  return { type: step.type, title: step.title, message: step.sensitive ? '[sensitive input requested]' : step.message,
    sensitive: step.sensitive === true, options: step.options?.map(option => ({ value: option.value, label: option.label })) };
}
export function isUnexpectedInstallerStep(step) {
  // Native's general channel note describes unrelated plugins. Only reject an
  // actual installer step or its whole question; exact account validation follows.
  return /^Plugin install(?:$|\s*:)/iu.test(step.title ?? '')
    || /^Install [^\r\n]+ plugin\?$/iu.test((step.message ?? '').trim())
    || /returning to.*selection/iu.test(step.message ?? '');
}
export function assertAccountInput(id, reply) {
  const step = reply.step;
  if (configFormChannels.has(id)) {
    assert.equal(reply.setupRoute, 'native-config'); assert.equal(step?.type, 'text');
    assert.ok(step?.id.endsWith(':accountId'), `${id} host form must request only its exact account ID first`);
    return;
  }
  assert.equal(id, 'telegram'); assert.equal(step?.type, 'select'); assert.equal(step?.message, 'Telegram account');
  assert.ok(step.options.some(option => option.value === '__new__' && option.label === 'Add a new account'));
  assert.ok(step.options.some(option => option.value === 'default'), `${id} actual native account selector`);
}
