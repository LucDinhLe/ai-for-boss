import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { isSelectableModel } from '../../apps/desktop/src/chat-state.ts';

const require = createRequire(import.meta.url);
const walk = node => node == null || typeof node === 'boolean' ? [] : Array.isArray(node) ? node.flatMap(walk)
  : typeof node !== 'object' ? [] : [node, ...walk(node.props?.children)];
function render(name, props) {
  const exports = {};
  const source = fs.readFileSync(new URL(`../../apps/desktop/src/${name}.tsx`, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { exports, require: id => {
    if (id === 'react') return { useState: initial => [initial, () => {}], useRef: current => ({ current }), useEffect() {} };
    if (id === './chat-state') return { isSelectableModel };
    if (id === './WorkspaceSidebar') return { WorkbenchIcon: 'icon' };
    if (id === './WorkspaceControls') return { ContextMeter: 'context-meter' };
    if (id === './LayoutControls') return { LayoutOptions: 'layout-options' };
    if (id.startsWith('./')) return { __esModule: true, default: id === './ModelPicker' ? 'model-picker' : 'stub' };
    return require(id);
  } });
  return exports.default(props);
}
const models = [
  { id: 'ready', provider: 'provider', name: 'Ready', available: true },
  { id: 'denied', provider: 'provider', name: 'Not offered', available: true, selectable: false },
  { id: 'unknown', provider: 'provider', name: 'No connection', available: false }
];
const base = { runtime: { connected: true, setupReady: true }, shell: null, usage: { model: 'ready', modelProvider: 'provider', usedTokens: null, contextTokens: null },
  models, advisorModels: models, layout: {}, projects: [], sessionKey: 'session', modelDisabled: false, pending: false,
  onLayout() {}, onClose() {}, onConnect() {}, onNavigate() {}, onRetry() {}, onRefreshInfo() {}, onUseSkill() {},
  agents: [], agentId: 'main', choice: { enabled: false, model: { provider: 'provider', id: 'ready' } },
  disabled: false, contextPending: false, reviewBusy: false, onAgent() {}, onManageAgents() {} };
const picker = tree => walk(tree).find(node => node.type === 'model-picker');
const toggle = tree => walk(tree).find(node => node.props?.role === 'switch');

for (const name of ['SettingsCenter', 'WorkspaceControls']) {
  test(`${name} forwards complete discovery and allows native-approved legacy selection during background loading`, () => {
    const calls = [], props = { ...base, catalogueLoading: true, catalogueError: 'Danh mục chưa tải đủ',
      onBrowseModels: refresh => calls.push(['browse', refresh]), onModel: model => calls.push(['model', model]), onChoice: choice => calls.push(['choice', choice]) };
    const control = picker(render(name, props));
    assert.equal(control.props.models, models); assert.equal(control.props.disabled, false);
    assert.equal(control.props.loading, true); assert.equal(control.props.error, props.catalogueError);
    control.props.onOpen(); control.props.onRefresh();
    assert.deepEqual(calls, [['browse', false], ['browse', true]]);
    for (const model of [models[1], models[2], { id: 'absent', provider: 'provider', available: true }, { ...models[1], selectable: true }]) control.props.onSelect(model);
    assert.equal(calls.length, 2, 'full catalogue does not grant selection permission');
    control.props.onSelect(models[0]); assert.equal(calls.length, 3);
    if (name === 'SettingsCenter') assert.equal(calls[2][1], models[0]);
    else { assert.equal(calls[2][1].model.id, 'ready'); assert.equal(calls[2][1].enabled, false); }
    const noCallbacks = picker(render(name, { ...props, onBrowseModels: undefined, models: [], advisorModels: [] }));
    assert.equal(noCallbacks.props.onOpen, undefined); assert.equal(noCallbacks.props.onRefresh, undefined);
    assert.equal(noCallbacks.props.disabled, false);
  });

  test(`${name} preserves pending/startup and busy selection gates independently of catalogue refresh`, () => {
    const calls = [], props = { ...base, disabled: true, modelDisabled: true, catalogueLoading: false,
      onBrowseModels: () => calls.push('browse'), onModel: () => calls.push('model'), onChoice: () => calls.push('choice') };
    const control = picker(render(name, props));
    assert.equal(control.props.disabled, true);
    control.props.onOpen(); control.props.onRefresh(); control.props.onSelect(models[0]);
    if (name === 'WorkspaceControls') toggle(render(name, props)).props.onClick();
    assert.deepEqual(calls, []);
    if (name === 'SettingsCenter') for (const patch of [{ pending: true }, { sessionKey: null }]) {
      assert.equal(picker(render(name, { ...props, modelDisabled: false, ...patch })).props.disabled, true);
    }
  });
}

test('Advisor enable requires a selectable model; disabling a now-unavailable choice stays possible', () => {
  const choices = [];
  const props = { ...base, onChoice: choice => choices.push(choice), choice: { enabled: false, model: { provider: 'provider', id: 'denied' } } };
  let control = toggle(render('WorkspaceControls', props));
  assert.equal(control.props.disabled, true); control.props.onClick(); assert.equal(choices.length, 0);
  props.choice.enabled = true;
  control = toggle(render('WorkspaceControls', props));
  assert.equal(control.props.disabled, false); control.props.onClick(); assert.equal(choices[0].enabled, false);
  props.choice = { enabled: false, model: { provider: 'provider', id: 'ready' } };
  toggle(render('WorkspaceControls', props)).props.onClick(); assert.equal(choices[1].enabled, true);
});

test('Advisor picker uses default-agent permission while context retains the worker catalogue', () => {
  const choices = [], reviewer = { id: 'review', provider: 'provider', name: 'Review', available: true, selectable: true };
  const workerModels = [{ ...models[0], selectable: true }, { ...reviewer, selectable: false }];
  const advisorModels = [{ ...models[0], selectable: false }, reviewer];
  const props = { ...base, models: workerModels, advisorModels, onChoice: value => choices.push(value),
    choice: { enabled: false, model: { provider: reviewer.provider, id: reviewer.id } } };
  const tree = render('WorkspaceControls', props), control = picker(tree);
  assert.equal(control.props.models, advisorModels);
  control.props.onSelect(workerModels[0]); assert.equal(choices.length, 0, 'worker permission cannot authorize Advisor');
  control.props.onSelect(reviewer); assert.equal(choices[0].model.id, 'review');
  const enable = toggle(tree); assert.equal(enable.props.disabled, false);
  enable.props.onClick(); assert.equal(choices[1].enabled, true);
});
