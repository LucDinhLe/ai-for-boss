import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { newChatRun } from '../../apps/desktop/src/chat-state.ts';

const require = createRequire(import.meta.url), exports = {};
const source = fs.readFileSync(new URL('../../apps/desktop/src/RunProgress.tsx', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports, require: id => id === './MessageContent' ? { __esModule: true, default: ({ content }) => createElement('p', null, content) }
    : id === './WorkspaceSidebar' ? { WorkbenchIcon: ({ name }) => createElement('svg', { 'data-icon': name }) }
      : id.endsWith('.css') ? {} : require(id)
});
const progress = { seq: 1, updatedAt: 1, phase: 'thinking', reasoning: 'Public reasoning', tools: [], plan: [] };
const render = (patch, props = {}) => renderToStaticMarkup(createElement(exports.default, { connected: true, run: { ...newChatRun('run'), ...patch }, ...props }));

test('live activity has one real phase and no invented reasoning placeholder', () => {
  const html = render({});
  assert.match(html, /Đã gửi yêu cầu/); assert.doesNotMatch(html, /Suy nghĩ từ|Nội dung suy nghĩ sẽ hiện/);
  assert.match(render({ progress }), /Public reasoning/);
});
test('completed matching reasoning-only activity disappears, while unproven or unique information remains collapsed', () => {
  const run = { terminal: true, busy: false, state: 'final', progress };
  assert.equal(render(run, { reasoningInTranscript: true }), '');
  assert.match(render(run), /run-progress__completed/); assert.match(render(run), /Public reasoning/);
  assert.doesNotMatch(render(run), /<details[^>]*\bopen/);
  const html = render({ ...run, progress: { ...progress, reasoningTokens: 0, plan: [{ step: 'Real plan', status: 'completed' }],
    tools: [{ id: 'one', name: 'read', phase: 'start' }] } }, { reasoningInTranscript: true });
  assert.doesNotMatch(html, /Public reasoning/); assert.match(html, /Real plan/); assert.match(html, /Đọc tệp/);
  assert.match(html, /Chưa có kết quả/); assert.match(html, /0 token/);
});
test('errors and user stop stay visible without requiring expansion', () => {
  assert.match(render({ terminal: true, busy: false, state: 'error', progress: { ...progress, reasoning: '' } }), /role="status"[^]*Lượt làm việc gặp lỗi/);
  assert.match(render({ terminal: true, busy: false, state: 'aborted', progress: { ...progress, reasoning: '' } }), /Đã dừng/);
});
