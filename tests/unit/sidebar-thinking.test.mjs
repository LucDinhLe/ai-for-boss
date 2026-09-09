import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { conversationTitle } from '../../apps/desktop/src/workspace-ui.ts';

const require = createRequire(import.meta.url), exports = {};
const read = name => fs.readFileSync(new URL(`../../apps/desktop/src/${name}`, import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(read('WorkspaceSidebar.tsx'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText, { exports, require: id => id === './BrandMark' ? { __esModule: true, default: () => null }
  : id === './workspace-ui' ? { conversationTitle } : id.endsWith('.css') ? {} : require(id) });
const base = { sessions: [], projects: [], activeKey: 'session-a', activeView: 'chat', disabled: false,
  onNewSession() {}, onNavigate() {}, onOpenSession() {}, onPinSession() {}, onOpenProject() {}, onToggle() {} };
const render = patch => renderToStaticMarkup(createElement(exports.default, { ...base, ...patch }));

test('left navigation contains projects and sessions but no Thinking page even while busy', () => {
  for (const disabled of [false, true]) {
    const html = render({ disabled });
    assert.doesNotMatch(html, />Thinking<|sidebar-thinking/);
    assert.match(html, /Dự án/); assert.match(html, /Nhắn tin/);
  }
});
