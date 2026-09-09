import assert from 'node:assert/strict';
import test from 'node:test';
import { SetupChannel } from '../../apps/desktop/electron/setup-channel.mjs';

function fixture(respond) {
  const instances = [];
  class Client {
    constructor(options) { this.options = options; this.calls = []; instances.push(this); }
    start() {}
    async stopAndWait() {}
    request(method, params) { this.calls.push({ method, params }); return respond(method, params, this.calls.length); }
  }
  const channel = new SetupChannel({ stateDirectory: '/unused-synthetic-provider-fixture', Client,
    identityLoader: () => ({ deviceId: 'fixture' }) });
  channel.connect({ url: 'ws://127.0.0.1:43123', token: 'synthetic' });
  const client = instances[0];
  const hello = () => client.options.onHelloOk({ auth: { scopes: ['operator.admin'] } });
  hello();
  return { channel, client, hello };
}
const lateAnswer = { sessionId: 'synthetic-wizard', answer: { stepId: 'finished-progress', value: true } };
const stopped = () => Object.assign(new Error('wizard not running'), { code: 'INVALID_REQUEST' });

test('a precise late wizard answer reads the same native terminal without inferring success', async () => {
  for (const terminal of [
    { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } },
    { done: true, status: 'error', error: 'native persistence failed' },
    { done: true, status: 'cancelled' }
  ]) {
    const { channel, client } = fixture(async (_method, _params, count) => { if (count === 1) throw stopped(); return terminal; });
    assert.deepEqual(await channel.request('wizard.next', lateAnswer), terminal);
    assert.deepEqual(client.calls, [{ method: 'wizard.next', params: lateAnswer },
      { method: 'wizard.next', params: { sessionId: 'synthetic-wizard' } }]);
  }
});

test('generic errors, missing wizards and unanswered failures are never retried as activation', async () => {
  for (const error of [new Error('wizard not running'), Object.assign(new Error('wizard not found'), { code: 'INVALID_REQUEST' }),
    Object.assign(new Error('wizard not running'), { code: 'UNAVAILABLE' })]) {
    const { channel, client } = fixture(async () => { throw error; });
    await assert.rejects(channel.request('wizard.next', lateAnswer), caught => caught === error);
    assert.equal(client.calls.length, 1);
  }
  const { channel, client } = fixture(async () => { throw stopped(); });
  await assert.rejects(channel.request('wizard.next', { sessionId: 'synthetic-wizard' }), /wizard not running/);
  assert.equal(client.calls.length, 1);
});

test('same-client reconnect invalidates pending setup replies and prevents terminal fallback', async () => {
  for (const reject of [false, true]) {
    let settle;
    const { channel, client, hello } = fixture(() => new Promise((resolve, fail) => { settle = reject ? fail : resolve; }));
    const pending = channel.request('wizard.next', lateAnswer);
    const rejected = assert.rejects(pending, /Gateway đã kết nối lại/);
    client.options.onClose(); hello();
    settle(reject ? stopped() : { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } });
    await rejected;
    assert.equal(client.calls.length, 1);
  }
});

test('native terminal read failure remains an error and workspace deletion never enters generic setup', async () => {
  const { channel, client } = fixture(async (_method, _params, count) => { if (count === 1) throw stopped(); throw new Error('wizard not found'); });
  await assert.rejects(channel.request('wizard.next', lateAnswer), /wizard not found/);
  for (const method of ['sessions.describe', 'sessions.delete']) await assert.rejects(channel.request(method, {}), /not allowed/);
  assert.equal(client.calls.length, 2);
});
