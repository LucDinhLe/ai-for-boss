import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import { WebTabs } from '../../apps/desktop/electron/web-tabs.mjs';

function fixture(validateUrl = async value => value) {
  const views = [], calls = [];
  const browserSession = Object.assign(new EventEmitter(), {
    setPermissionCheckHandler() {}, setPermissionRequestHandler() {}, setDevicePermissionHandler() {},
    webRequest: { onBeforeRequest(fn) { this.check = fn; } },
  });
  const window = {
    destroyed: false, isDestroyed() { return this.destroyed; },
    get contentView() {
      assert.equal(this.destroyed, false, 'destroyed owner accessed');
      return { addChildView() {}, removeChildView(view) { calls.push('detach'); if (view.detachError) throw new Error('detach failure'); } };
    },
  };
  const tabs = new WebTabs({ window, browserSession, validateUrl, createView: () => {
    const contents = Object.assign(new EventEmitter(), {
      destroyed: false, isDestroyed() { return this.destroyed; },
      close() { assert.equal(this.destroyed, false); calls.push('close'); this.destroyed = true; },
      setWindowOpenHandler(fn) { this.popup = fn; },
      async loadURL(url) { assert.equal(this.destroyed, false); this.url = url; calls.push(['load', url]); },
      getURL() { assert.equal(this.destroyed, false); return this.url; }, getTitle: () => 'Test', isLoading: () => false,
      navigationHistory: { canGoBack: () => false, canGoForward: () => false },
      async executeJavaScriptInIsolatedWorld() { calls.push('extract'); return 'test page'; },
    });
    const view = { contents, get webContents() { return contents.destroyed ? undefined : contents; }, setBounds() {}, setVisible() { assert.equal(contents.destroyed, false); } };
    views.push(view); return view;
  } });
  return { tabs, views, calls, window, browserSession };
}

test('destroyed owner and already closed native child are safe; disposal is repeatable', () => {
  const f = fixture(); f.tabs.add(); f.tabs.add(); f.views[0].contents.close(); f.window.destroyed = true;
  f.tabs.layout(); assert.deepEqual(f.tabs.state(), { active: null, tabs: [] });
  f.tabs.dispose(); f.tabs.dispose();
  assert.equal(f.calls.filter(c => c === 'detach').length, 0);
  assert.equal(f.calls.filter(c => c === 'close').length, 2);
  assert.equal(f.tabs.tabs.size, 0); assert.equal(f.browserSession.listenerCount('will-download'), 0);
  assert.throws(() => f.tabs.add(), /đã đóng/);
});

test('one failed detach cannot skip closing its contents or the other tabs', () => {
  const f = fixture(); f.tabs.add(); f.tabs.add(); f.views[0].detachError = true;
  assert.throws(() => f.tabs.dispose(), AggregateError);
  assert.ok(f.views.every(view => view.contents.isDestroyed()));
  assert.equal(f.tabs.tabs.size, 0); assert.equal(f.tabs.active, null);
  assert.equal(f.browserSession.listenerCount('will-download'), 0);
  assert.doesNotThrow(() => f.tabs.dispose());
});

test('closing a pre-destroyed native child leaves other tabs usable', async () => {
  const f = fixture(); const id = f.tabs.add(), kept = f.tabs.add(); f.views[0].contents.close();
  const state = await f.tabs.run({ action: 'web-close', id });
  assert.equal(state.active, kept); assert.equal(state.tabs.length, 1); f.tabs.dispose();
});

for (const action of ['navigate', 'popup', 'share']) {
  test(`late ${action} validation cannot use or recreate a closed tab`, async () => {
    let resolve;
    const f = fixture(() => new Promise(done => { resolve = done; })); const id = f.tabs.add(); let pending;
    if (action === 'navigate') pending = f.tabs.navigate(id, 'https://example.com/');
    if (action === 'popup') f.views[0].contents.popup({ url: 'https://example.com/' });
    if (action === 'share') pending = assert.rejects(f.tabs.run({ action: 'web-share', id }), /đã đóng/);
    await f.tabs.run({ action: 'web-close', id }); resolve('https://example.com/'); await pending; await setImmediate();
    assert.equal(f.views.length, 1);
    assert.equal(f.calls.filter(c => Array.isArray(c) && c[0] === 'load').length, 1);
    assert.ok(!f.calls.includes('extract')); assert.equal(f.tabs.tabs.size, 0); f.tabs.dispose();
  });
}

test('navigation pending during owner destruction makes no native calls', async () => {
  let resolve;
  const f = fixture(() => new Promise(done => { resolve = done; })); const id = f.tabs.add();
  const pending = f.tabs.navigate(id, 'https://example.com/'); f.window.destroyed = true;
  resolve('https://example.com/'); await pending;
  assert.equal(f.calls.filter(c => Array.isArray(c)).length, 1); f.tabs.dispose();
});

test('pending request validation is cancelled after disposal', async () => {
  let resolve, decision;
  const f = fixture(() => new Promise(done => { resolve = done; }));
  f.browserSession.webRequest.check({ url: 'https://example.com/' }, result => { decision = result; });
  f.tabs.dispose(); resolve('https://example.com/'); await setImmediate(); assert.deepEqual(decision, { cancel: true });
});
