import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as providerOrder from '../../apps/desktop/src/provider-order.ts';

const require = createRequire(import.meta.url);
const walk = node => node == null || typeof node === 'boolean' ? [] : Array.isArray(node) ? node.flatMap(walk)
  : typeof node !== 'object' ? [] : [node, ...walk(node.props?.children)];
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children)
  : node == null || typeof node === 'boolean' ? '' : String(node);
function render(props, { showCatalogue = false } = {}) {
  const exports = {}, catalogueMounts = [];
  const source = fs.readFileSync(new URL('../../apps/desktop/src/ProviderSettings.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { exports, require: id => {
    if (id === 'react') return { useState: initial => [typeof initial === 'boolean' ? showCatalogue : initial, () => {}] };
    if (id === './CapabilityCatalog') return { __esModule: true, default: 'catalogue' };
    if (id === './BrandIcon') return { __esModule: true, default: 'brand-icon' };
    if (id === './WorkspaceSidebar') return { WorkbenchIcon: 'icon' };
    if (id === './provider-order') return providerOrder;
    return require(id);
  } });
  const tree = exports.default(props);
  catalogueMounts.push(...walk(tree).filter(node => node.type === 'catalogue').map(node => node.props));
  return { tree, catalogueMounts };
}
const models = [
  { id: 'gpt', provider: 'openai-codex', name: 'GPT', available: true },
  { id: 'claude', provider: 'anthropic', name: 'Claude', available: true },
  { id: 'claude-2', provider: 'anthropic', name: 'Claude 2', available: true },
  { id: 'gemini', provider: 'google', name: 'Gemini', available: false }
];

test('the provider page leads with connected accounts and never scans the catalogue unless opened', () => {
  const clicks = [];
  const { tree, catalogueMounts } = render({ ready: true, models, currentProvider: 'anthropic', currentModel: 'claude', onConnect: () => clicks.push('connect') });
  const items = walk(tree).filter(node => node.type === 'li').map(text);
  assert.deepEqual(items, ['ChatGPT / OpenAI1 mô hình khả dụng', 'Claude / AnthropicĐang dùng claude'], 'only available providers, in popularity order');
  assert.doesNotMatch(text(tree), /Gemini/);
  assert.equal(catalogueMounts.length, 0, 'the full catalogue (and its native scan) is not mounted by default');
  const primary = walk(tree).find(node => node.type === 'button' && node.props.className === 'settings-primary');
  assert.equal(text(primary), 'Kết nối thêm hoặc đổi tài khoản');
  primary.props.onClick(); assert.deepEqual(clicks, ['connect']);
  assert.ok(walk(tree).some(node => node.type === 'button' && text(node) === 'Xem toàn bộ danh mục'));
});

test('a blank machine gets one clear call to action, and the opened catalogue receives the connected set', () => {
  const blank = render({ ready: true, models: [], onConnect() {} });
  assert.match(text(blank.tree), /Chưa có tài khoản nào dùng được/);
  assert.equal(text(walk(blank.tree).find(node => node.type === 'button' && node.props.className === 'settings-primary')), 'Kết nối AI');
  const offline = render({ ready: false, models, onConnect() {} });
  assert.match(text(offline.tree), /Bật Gateway/);
  assert.equal(walk(offline.tree).find(node => node.type === 'button' && node.props.className === 'settings-primary').props.disabled, true);
  const opened = render({ ready: true, models, onConnect() {} }, { showCatalogue: true });
  assert.equal(opened.catalogueMounts.length, 1);
  assert.deepEqual([...opened.catalogueMounts[0].connectedProviders], ['openai-codex', 'anthropic']);
  assert.equal(opened.catalogueMounts[0].kind, 'providers');
});
