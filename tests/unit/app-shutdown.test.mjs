import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { setImmediate } from 'node:timers';

const source = readFileSync(new URL('../../apps/desktop/electron/main.mjs', import.meta.url), 'utf8');
const start = source.indexOf('app.on("before-quit", (event) => {');
const end = source.indexOf('\napp.on("window-all-closed"', start);
assert.ok(start >= 0 && end > start);

test('quit waits for the owned runtime before destroying windows; recursive quit does not stop twice', async () => {
  const calls = [];
  let handler, releaseInstaller, releaseRuntime, finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const context = {
    shuttingDown: false, appExitCode: 0, backups: null, clearInterval:()=>{}, optimizerTimer:0, optimizer:null,
    webTabs: { dispose: () => calls.push('web') },
    advisorService: { cancelForShutdown: () => calls.push('advisor') },
    supervisionService: { cancelForShutdown: () => {} },
    channelPluginInstaller: { stop: () => { calls.push('installer'); return new Promise(resolve => { releaseInstaller = resolve; }); } },
    setupPageAccess: { clear: () => calls.push('pages') },
    adapter: { disconnect: async () => calls.push('chat') },
    setupChannel: { disconnect: async () => calls.push('setup') },
    supervisor: { stop: () => { calls.push('runtime'); return new Promise(resolve => { releaseRuntime = resolve; }); } },
    app: { on: (_name, callback) => { handler = callback; }, exit: code => { calls.push(['exit', code]); finish(); } },
    BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, destroy: () => {
      calls.push('window'); handler({ preventDefault: () => calls.push('recursive-prevent') });
    } }] }
  };
  vm.runInNewContext(source.slice(start, end), context);
  handler({ preventDefault: () => calls.push('prevent') });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['prevent', 'web', 'advisor', 'installer']);
  releaseInstaller();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['prevent', 'web', 'advisor', 'installer', 'pages', 'chat', 'setup', 'runtime']);
  handler({ preventDefault: () => calls.push('pending-prevent') });
  releaseRuntime();
  await finished;
  assert.deepEqual(calls, ['prevent', 'web', 'advisor', 'installer', 'pages', 'chat', 'setup', 'runtime', 'pending-prevent', 'window', 'recursive-prevent', ['exit', 0]]);
});

test('cleanup failures never skip the runtime or remaining windows', async () => {
  const calls = [], errors = []; let handler, finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const fail = name => { calls.push(name); throw new Error(name); };
  const context = {
    shuttingDown: false, appExitCode: 0, backups: null, clearInterval:()=>{}, optimizerTimer:0, optimizer:null, console: { error: (...args) => errors.push(args) },
    webTabs: { dispose: () => fail('web') }, advisorService: { cancelForShutdown: () => fail('advisor') },
    channelPluginInstaller: { stop: async () => fail('installer') },
    setupPageAccess: { clear: () => fail('pages') }, adapter: { disconnect: async () => fail('chat') },
    setupChannel: { disconnect: async () => fail('setup') }, supervisor: { stop: async () => fail('runtime') },
    app: { on: (_name, callback) => { handler = callback; }, exit: code => { calls.push(['exit', code]); finish(); } },
    BrowserWindow: { getAllWindows: () => [
      { isDestroyed: () => true, destroy: () => assert.fail('dead window touched') },
      { isDestroyed: () => false, destroy: () => fail('window') },
      { isDestroyed: () => false, destroy: () => calls.push('other-window') },
    ] },
  };
  vm.runInNewContext(source.slice(start, end), context); handler({ preventDefault: () => calls.push('prevent') });
  await finished;
  assert.deepEqual(calls, ['prevent', 'web', 'advisor', 'installer', 'pages', 'chat', 'setup', 'runtime', 'window', 'other-window', ['exit', 1]]);
  assert.equal(context.webTabs, null); assert.equal(errors.length, 8);
});

test('closed owner releases only its tabs and cannot clear a replacement window', () => {
  const begin = source.indexOf('  const owner = mainWindow;');
  const stop = source.indexOf('  await owner.loadFile', begin);
  const handlers = new Map(), oldWindow = { once: (name, fn) => handlers.set(name, fn) };
  let disposed = 0;
  const context = { mainWindow: oldWindow, webTabs: { window: oldWindow, dispose: () => { disposed++; } }, appExitCode: 0, smoke: true, console };
  vm.runInNewContext(source.slice(begin, stop), context); handlers.get('closed')();
  assert.equal(disposed, 1); assert.equal(context.mainWindow, null); assert.equal(context.webTabs, null);
  const replacement = {}, replacementTabs = { window: replacement };
  context.mainWindow = replacement; context.webTabs = replacementTabs; handlers.get('closed')();
  assert.equal(disposed, 1); assert.equal(context.mainWindow, replacement); assert.equal(context.webTabs, replacementTabs);
});
