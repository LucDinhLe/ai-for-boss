import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { ChannelWorkGuard } from '../../apps/desktop/electron/channel-work-guard.mjs';
import { isTrustedRendererEvent, MANAGEMENT_REQUEST_CHANNEL, ADVISOR_REQUEST_CHANNEL, GATEWAY_REQUEST_CHANNEL } from '../../apps/desktop/electron/security-policy.mjs';

const source = readFileSync(new URL('../../apps/desktop/electron/main.mjs', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const idle = { sessionInfo: { hasActiveRun: false, activeRunIds: [] } }, active = { inFlightRun: { runId: 'native-run' }, sessionInfo: { hasActiveRun: true } };
function harness(request = async () => idle, manage = async () => ({ ok: true })) {
  const handlers = new Map(), calls = [], frame = {}, mainWindow = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  const context = vm.createContext({ ChannelWorkGuard, isTrustedRendererEvent, MANAGEMENT_REQUEST_CHANNEL, ADVISOR_REQUEST_CHANNEL, GATEWAY_REQUEST_CHANNEL,
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) }, mainWindow, smoke: false, shuttingDown: false, projectService: null,
    adapter: { request: (method, params) => { calls.push({ kind: 'gateway', method, params }); return request(method, params); } },
    setupChannel: { connected: true, manage: packet => { calls.push({ kind: 'management', packet }); return manage(packet); } },
    supervisionService: { status: () => null, run: async packet => { calls.push({ kind: 'supervision', packet }); return {}; }, cancel: () => ({ cancelled: true }) },
    advisorService: { busy: false, request: packet => { calls.push({ kind: 'advisor', packet }); return {}; } }
  });
  const declaration = source.slice(source.indexOf('const channelWorkGuard ='), source.indexOf('\napp.enableSandbox();'));
  assert.ok(declaration.includes('requestHistory:'));
  vm.runInContext(declaration, context);
  for (const name of ['MANAGEMENT_REQUEST_CHANNEL', 'ADVISOR_REQUEST_CHANNEL', 'GATEWAY_REQUEST_CHANNEL']) {
    const handler = source.match(new RegExp(`ipcMain\\.handle\\(${name},[\\s\\S]*?\\n\\}\\);`))?.[0]; assert.ok(handler);
    vm.runInContext(handler, context);
  }
  const event = { sender: mainWindow.webContents, senderFrame: frame };
  return { calls, context, gateway: (method, params) => handlers.get(GATEWAY_REQUEST_CHANNEL)(event, { method, params }),
    manage: packet => handlers.get(MANAGEMENT_REQUEST_CHANNEL)(event, packet), advisor: packet => handlers.get(ADVISOR_REQUEST_CHANNEL)(event, packet) };
}

test('real main handlers exclude pending send and require fresh idle after ACK before channel preparation', async () => {
  const pending = deferred(); let history = active;
  const h = harness(method => method === 'sessions.send' ? pending.promise : Promise.resolve(history));
  const send = h.gateway('sessions.send', { key: 'agent:test:worker', message: 'synthetic' });
  await assert.rejects(h.manage({ action: 'channel-setup', channel: 'zalo' }), /chờ công việc/u);
  assert.equal(h.calls.filter(call => call.kind === 'management').length, 0);
  pending.resolve({ runId: 'native-run' }); await send;
  await assert.rejects(h.manage({ action: 'channel-setup', channel: 'zalo' }), /chờ công việc/u);
  history = idle; assert.deepEqual(await h.manage({ action: 'channel-setup', channel: 'zalo' }), { ok: true });
  const reads = h.calls.filter(call => call.method === 'sessions.history'); assert.equal(reads.length, 2);
  for (const read of reads) assert.deepEqual(JSON.parse(JSON.stringify(read.params)), { key: 'agent:test:worker', limit: 1 });
});

test('real channel lease blocks worker dispatch and Advisor start until restart finishes while cancellation remains available', async () => {
  const restart = deferred();
  const h = harness(undefined, packet => packet.action === 'channel-cancel' ? { status: 'cancelled' } : restart.promise);
  const change = h.manage({ action: 'channel-setup', channel: 'discord' });
  await assert.rejects(h.gateway('sessions.send', { key: 'agent:test:worker' }), { code: 'AIFB_WORKER_NOT_SUBMITTED' });
  for (const action of ['supervise', 'plan', 'review']) assert.throws(() => h.advisor({ action }), /Đang chuẩn bị kênh/u);
  assert.throws(() => h.advisor({ action: 'supervision-status' }), /phiên/);
  assert.throws(() => h.advisor({ action: 'supervision-cancel' }), /phiên/);
  assert.equal(h.advisor({ action: 'supervision-status', key: 'agent:test:worker' }), null);
  assert.deepEqual(h.manage({ action: 'channel-cancel', sessionId: 'owned' }), { status: 'cancelled' });
  assert.equal(h.calls.some(call => call.kind === 'gateway' || call.kind === 'supervision' || call.kind === 'advisor'), false);
  restart.resolve({ sessionId: 'new-owned' }); assert.deepEqual(await change, { sessionId: 'new-owned' });
  await h.gateway('sessions.send', { key: 'agent:test:worker' });
  assert.equal(h.calls.filter(call => call.method === 'sessions.send').length, 1);
});

test('old generic idle history arriving after send ACK cannot clear tracked worker ownership', async () => {
  const oldRead = deferred(); let first = true;
  const h = harness(method => method === 'sessions.send' ? Promise.resolve({ accepted: true })
    : first ? (first = false, oldRead.promise) : Promise.resolve(active));
  const reading = h.gateway('sessions.history', { key: 'agent:test:worker', limit: 1 });
  await h.gateway('sessions.send', { key: 'agent:test:worker' });
  oldRead.resolve(idle); await reading;
  await assert.rejects(h.manage({ action: 'channel-start', channel: 'telegram', accountId: 'test' }), /chờ công việc/u);
  assert.equal(h.calls.filter(call => call.method === 'sessions.history').length, 2, 'channel guard rechecks native history under exclusive lease');
  assert.equal(h.calls.some(call => call.kind === 'management'), false);
});

test('generic native activity is tracked even without a local send and supervised work also excludes channel changes', async () => {
  const h = harness(async () => active);
  await h.gateway('sessions.history', { key: 'agent:external:worker', limit: 1 });
  await assert.rejects(h.manage({ action: 'channel-pairing-approve', channel: 'telegram', accountId: 'test', requestId: 'test' }), /chờ công việc/u);
  assert.equal(h.calls.some(call => call.kind === 'management'), false);
  const supervised = harness(); supervised.context.supervisionService.status = () => ({ busy: true });
  await assert.rejects(supervised.manage({ action: 'channel-qr-start', channel: 'whatsapp' }), /chờ công việc/u);
  assert.equal(supervised.calls.length, 0);
});
