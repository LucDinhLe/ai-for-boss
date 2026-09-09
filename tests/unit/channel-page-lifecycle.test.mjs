import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../../apps/desktop/src/NativePage.tsx', import.meta.url), 'utf8');
const walk = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function fixture(readChannels = async () => ({ channels: [{ id: 'test', channel: 'whatsapp', configured: true }] })) {
  const exports = {}, hooks = [], effects = [];
  let cursor = 0;
  const react = {
    useState(initial) { const id = cursor++; if (!(id in hooks)) hooks[id] = initial;
      return [hooks[id], value => { hooks[id] = typeof value === 'function' ? value(hooks[id]) : value; }]; },
    useRef(initial) { const id = cursor++; return hooks[id] ??= { current: initial }; },
    useCallback(callback) { const id = cursor++; return hooks[id] ??= callback; },
    useEffect(callback, dependencies) {
      const id = cursor++, before = hooks[id];
      if (!before || dependencies.some((value, index) => !Object.is(value, before.dependencies[index])))
        effects.push(() => { before?.cleanup?.(); hooks[id] = { dependencies, cleanup: callback() }; });
    }
  };
  vm.runInNewContext(ts.transpileModule(source + '\nexport const FixtureReadPage = ReadPage;', { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { exports, require: id => {
    if (id === 'react') return react;
    if (id === './WorkspaceSidebar') return { WorkbenchIcon: 'icon' };
    if (id === './workbench-api') return { readChannels };
    if (id.startsWith('./')) return { __esModule: true, default: id === './ChannelPanel' ? 'channel-panel' : 'stub' };
    return require(id);
  } });
  const render = (Component, props) => { cursor = 0; const tree = Component(props); for (const effect of effects.splice(0)) effect(); return tree; };
  return { exports, render };
}
const props = { view: 'messages', ready: true, activeKey: 'session', projects: [], onUseSkill() {}, onOpenProject() {}, onRefreshProjects() {}, onConnect() {} };
const panel = tree => walk(tree).find(node => node.type === 'channel-panel');

test('messages keep the same child identity across Gateway restart; actual navigation still unmounts it', () => {
  const f = fixture();
  const live = walk(f.render(f.exports.default, props)).find(node => node.type === f.exports.FixtureReadPage);
  const offline = walk(f.render(f.exports.default, { ...props, ready: false })).find(node => node.type === f.exports.FixtureReadPage);
  assert.ok(live && offline); assert.equal(offline.type, live.type); assert.equal(offline.key, live.key);
  assert.equal(offline.props.ready, false);
  assert.equal(walk(f.render(f.exports.default, { ...props, view: 'projects' })).some(node => node.type === f.exports.FixtureReadPage), false);
  const other = walk(f.render(f.exports.default, { ...props, activeKey: 'other' })).find(node => node.type === f.exports.FixtureReadPage);
  assert.notEqual(other.key, live.key, 'session navigation remains a real lifecycle boundary');
});

test('offline readback is paused and reconnect keeps the wizard child while reading fresh channel state', async () => {
  let reads = 0, finish;
  const f = fixture(() => { reads++; return reads === 1 ? Promise.resolve({ channels: [{ id: 'first' }] }) : new Promise(resolve => { finish = resolve; }); });
  const render = patch => f.render(f.exports.FixtureReadPage, { ...props, ...patch });
  render({ ready: false }); await settle(); assert.equal(reads, 0);
  render({}); await settle();
  const first = panel(render({})); assert.ok(first);
  const offline = render({ ready: false });
  assert.equal(panel(offline).type, first.type); assert.equal(panel(offline).props.channels, first.props.channels);
  assert.equal(panel(offline).props.ready, false); assert.equal(walk(offline).find(node => node.type === 'button').props.disabled, true);
  render({}); assert.equal(reads, 2);
  assert.equal(panel(render({})).props.channels, first.props.channels, 'pending read retains prior child and channel rows');
  render({ ready: false }); finish({ channels: [{ id: 'stale' }] }); await settle();
  assert.equal(panel(render({ ready: false })).props.channels[0].id, 'first', 'late pre-disconnect readback cannot replace retained data');
});

test('post-setup refresh retains ChannelPanel so its pending WhatsApp QR continues until native readback', async () => {
  let reads = 0, finish;
  const f = fixture(() => { reads++; return reads === 1 ? Promise.resolve({ channels: [{ id: 'before' }] }) : new Promise(resolve => { finish = resolve; }); });
  const render = () => f.render(f.exports.FixtureReadPage, props);
  render(); await settle(); const before = panel(render());
  before.props.onRefresh(); const refreshing = panel(render());
  assert.ok(refreshing); assert.equal(refreshing.type, before.type); assert.equal(refreshing.props.channels, before.props.channels);
  assert.equal(reads, 2);
  finish({ channels: [{ id: 'after' }] }); await settle();
  assert.equal(panel(render()).props.channels[0].id, 'after');
});
