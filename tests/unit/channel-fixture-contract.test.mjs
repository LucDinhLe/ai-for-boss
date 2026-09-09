import assert from 'node:assert/strict';
import test from 'node:test';
import { assertAccountInput, isUnexpectedInstallerStep } from '../../scripts/channel-fixture-contract.mjs';

test('informational native channel note is not an install attempt', () => {
  assert.equal(isUnexpectedInstallerStep({ type: 'note', title: 'How channels work',
    message: 'Matrix: open protocol; install the plugin to enable.\nTelegram: register a bot with @BotFather.' }), false);
  assert.equal(isUnexpectedInstallerStep({ type: 'select', message: 'Install WhatsApp plugin?' }), true);
  assert.equal(isUnexpectedInstallerStep({ type: 'note', title: 'Plugin install', message: 'Install failed.' }), true);
});
test('generic picker and plugin-source picker cannot pass exact native account proof', () => {
  const native = { step: { type: 'select', message: 'Telegram account', options: [{ value: 'default' }, { value: '__new__', label: 'Add a new account' }] } };
  assert.doesNotThrow(() => assertAccountInput('telegram', native));
  for (const message of ['Select channel', 'Install Telegram plugin?']) assert.throws(() => assertAccountInput('telegram', { step: { ...native.step, message } }));
  assert.throws(() => assertAccountInput('whatsapp', { step: { type: 'select', message: 'Install WhatsApp plugin?' } }));
  assert.doesNotThrow(() => assertAccountInput('whatsapp', { setupRoute: 'native-config', step: { type: 'text', id: 'owned:accountId' } }));
});
