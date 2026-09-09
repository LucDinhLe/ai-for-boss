import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { isSelectableModel, newChatRun } from '../../apps/desktop/src/chat-state.ts';

const require = createRequire(import.meta.url);
const directory = fileURLToPath(new URL('../../apps/desktop/src/', import.meta.url));
const cache = new Map();
function component(name) {
  if (cache.has(name)) return cache.get(name);
  const exports = {};
  cache.set(name, exports);
  const source = fs.readFileSync(path.join(directory, `${name}.tsx`), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { exports, require: id => {
    if (id === './WorkspaceSidebar') return { WorkbenchIcon: ({ name: icon }) => createElement('svg', { 'data-icon': icon }) };
    if (id === './ModelPicker' || id === './GatewayControl') return { __esModule: true, default: () => null };
    if (id === './chat-state') return { isSelectableModel };
    if (id.endsWith('.css')) return {};
    return id.startsWith('./') ? component(id.slice(2)) : require(id);
  }, URL });
  return exports;
}
const ThinkingView = component('ThinkingView').default;
const base = { activeKey: 'session-a', sessionTitle: 'Kế hoạch tuần', connected: true,
  messages: [], run: newChatRun(), onClose() {} };
const render = props => renderToStaticMarkup(createElement(ThinkingView, { ...base, ...props }));
test('streamed answer updates progress even without a provider reasoning payload', () => {
  const run = { ...newChatRun('current'), state: 'delta', seq: 2, text: 'Hello', nativeActive: true };
  assert.match(render({ run }), /Đang viết câu trả lời/);
  assert.match(render({ run }), /Đã nhận 5 ký tự trả lời/);
  assert.doesNotMatch(render({ run, connected: false }), /Đang viết câu trả lời/);
  assert.match(render({ run: { ...run, progress: { phase: 'tool', tools: [], plan: [], reasoning: '' } } }), /Đang dùng công cụ/);
});
const message = (id, reasoning, patch = {}) => ({ id, role: 'assistant', reasoning, content: 'Answer stays in chat', timestamp: 1, ...patch });
const progress = { seq: 1, updatedAt: 1, phase: 'thinking', reasoning: 'Native public reasoning', tools: [], plan: [] };
const supervision = { id: 'supervision-a', key: 'session-a', phase: 'plan-review', busy: true, accepted: true,
  plan: 'Native supervision plan', consultation: 'Native public consultation', planReview: null, finalReview: null, error: null };

test('Thinking has truthful no-session and empty-session states without stale or fabricated activity', () => {
  const html = render({ activeKey: null, run: { ...newChatRun('old-run'), progress }, messages: [message('old', 'Old private session')], supervision, onStop() {} });
  assert.match(html, /Chưa chọn cuộc trò chuyện/);
  assert.doesNotMatch(html, /Old private|Native public|Native supervision|>Dừng</);
  assert.match(render({}), /Chưa có hoạt động được ghi nhận/);
  assert.doesNotMatch(render({}), /Đang suy nghĩ|%|run-progress/);
  assert.match(render({}), /data-icon="thinking"/);
});

test('live view separates waiting/reconnect from provider activity and keeps reported plans/tools/tokens', () => {
  const waiting = render({ run: newChatRun('run'), onStop() {} });
  assert.match(waiting, /Đang chờ mô hình xác nhận/); assert.doesNotMatch(waiting, /Đang suy nghĩ|Đã gửi yêu cầu/);
  const run = { ...newChatRun('run'), progress: { ...progress, reasoningTokens: 0,
    plan: [{ step: 'Read the supplied report', status: 'in_progress' }],
    tools: [{ id: 'tool-1', name: 'read', phase: 'start', failed: false }] } };
  const html = render({ run });
  assert.match(html, /Native public reasoning/); assert.match(html, /Read the supplied report/);
  assert.match(html, /Đọc tệp/); assert.match(html, /Đang chạy/); assert.match(html, /0 token suy nghĩ/);
  assert.match(html, /run-progress__reasoning" open/); assert.doesNotMatch(html, /run-progress__completed/);
  const reconnect = render({ run, connected: false });
  assert.match(reconnect, /Đang nối lại/); assert.match(reconnect, /Native public reasoning/);
  assert.doesNotMatch(reconnect, /data-active="true"/);
});

test('public transcript reasoning keeps native order and row identity, with same-run dedup only when proven', () => {
  const messages = [message('first', 'Identical public text'), message('ignored-user', 'Not assistant reasoning', { role: 'user' }),
    message('second', 'Identical public text'), message('third', 'Native public reasoning')];
  const run = { ...newChatRun('run'), terminal: true, busy: false, state: 'final', progress };
  const html = render({ messages, run, reasoningInTranscript: true });
  assert.equal(html.match(/Identical public text/g)?.length, 2);
  assert.equal(html.match(/Native public reasoning/g)?.length, 1);
  assert.ok(html.indexOf('data-message-id="first"') < html.indexOf('data-message-id="second"'));
  assert.ok(html.indexOf('data-message-id="second"') < html.indexOf('data-message-id="third"'));
  assert.doesNotMatch(html, /Not assistant reasoning|Answer stays in chat/);
  assert.equal(render({ messages, run }).match(/Native public reasoning/g)?.length, 2);
  assert.equal(render({ messages: [], run, reasoningInTranscript: true }).match(/Native public reasoning/g)?.length, 1);
});

test('completed, interrupted and error runs remain truthful even without detailed activity', () => {
  for (const [state, label] of [['final', 'Hoạt động đã hoàn tất'], ['error', 'Lượt làm việc gặp lỗi'], ['aborted', 'Đã dừng']]) {
    const html = render({ run: { ...newChatRun('run'), busy: false, terminal: true, state }, onStop() {} });
    assert.match(html, new RegExp(label)); assert.match(html, /không có kế hoạch, công cụ/);
    assert.doesNotMatch(html, />Dừng<|Đang suy nghĩ/);
  }
  assert.match(render({ run: { ...newChatRun('run'), busy: false, terminal: true, state: 'started' } }), /Lượt làm việc đã kết thúc/);
  const html = render({ run: { ...newChatRun('run'), busy: false, terminal: true, state: 'error', progress: { ...progress,
    tools: [{ id: 'unknown', name: 'read', phase: 'start', failed: false }] } } });
  assert.match(html, /Chưa có kết quả/); assert.doesNotMatch(html, /Đang chạy/);
});

test('Advisor information and stopping controls belong only to the selected session', () => {
  const other = render({ supervision: { ...supervision, key: 'session-b' }, onStop() {} });
  assert.doesNotMatch(other, /Native supervision|Native public consultation|>Dừng</);
  const here = render({ supervision, onStop() {} });
  assert.match(here, /Native supervision plan/); assert.match(here, /Native public consultation/);
  assert.match(here, /Đang kiểm kế hoạch/); assert.match(here, />Dừng</);
  assert.match(render({ supervision, onStop() {}, stopping: true }), /disabled=""[^]*Đang dừng/);
  assert.match(render({ supervision, onStop() {}, stopDisabled: true }), /disabled=""[^]*>Dừng</);
});

test('local preparation exposes Stop without claiming model activity or treating older review as current', () => {
  const html = render({ pendingBusy: true, onStop() {}, supervision: { ...supervision, busy: false, phase: 'completed' } });
  assert.match(html, /Đang chuẩn bị yêu cầu/); assert.match(html, /Yêu cầu chưa được mô hình xác nhận/);
  assert.match(html, />Dừng</); assert.match(html, /Hoạt động trước đó/);
  assert.doesNotMatch(html, /data-active="true"|Đang suy nghĩ/);
  assert.match(render({ pendingBusy: true, onStop() {} }), />Dừng</);
  assert.doesNotMatch(render({ activeKey: null, pendingBusy: true, onStop() {} }), />Dừng</);
});

test('live Advisor leads while stopped worker activity remains available in a labelled closed record', () => {
  const run = { ...newChatRun('earlier-run'), busy: false, terminal: true, state: 'aborted', progress };
  const html = render({ supervision, run });
  assert.ok(html.indexOf('Giám sát của Advisor') < html.indexOf('thinking-view__recorded'));
  assert.match(html, /Hoạt động mô hình đã ghi nhận/); assert.match(html, /Đã dừng/);
  assert.match(html, /Native public reasoning/); assert.doesNotMatch(html, /class="thinking-view__recorded" open/);
  const active = render({ supervision, run: { ...run, busy: true, terminal: false, state: 'delta' } });
  assert.doesNotMatch(active, /thinking-view__recorded/);
  assert.match(active, /Native public reasoning/);
});

test('Stop and Collapse delegate once without discarding data or invoking native methods', () => {
  let stopped = 0, backed = 0;
  const props = { ...base, messages: [message('public', 'Retained text')], run: newChatRun('run'),
    onStop() { stopped++; }, onClose() { backed++; } };
  const tree = ThinkingView(props);
  const nodes = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    nodes.push(node); visit(node.props?.children);
  };
  visit(tree);
  const buttons = nodes.filter(node => node.type === 'button');
  assert.equal(buttons.length, 2);
  buttons[0].props.onClick(); buttons[1].props.onClick();
  assert.equal(stopped, 1); assert.equal(backed, 1);
  assert.equal(props.messages[0].reasoning, 'Retained text'); assert.equal(props.run.runId, 'run');
});

test('reasoning renders as source-safe text and invalid timestamps do not crash the view', () => {
  const html = render({ messages: [message('unsafe', '<script>alert(1)</script> [Link](javascript:alert)', { timestamp: NaN })] });
  assert.doesNotMatch(html, /<script|href=|<time/); assert.match(html, /&lt;script&gt;/);
});
