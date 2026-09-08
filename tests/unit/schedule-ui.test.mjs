import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url), exports = {};
const code = fs.readFileSync(new URL('../../apps/desktop/src/SchedulePanel.tsx', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { exports, crypto, require(name) { if (name === './gateway-client' || name === './workbench-api') return {};
    if (name === './WorkspaceSidebar') return { WorkbenchIcon: () => null }; return require(name); } });
test('one managed schedule row contains its status, timing, edit/pause/remove and history action', () => {
  const jobs = [{ id: 'managed', name: 'Daily review', managed: true, enabled: true, nextRunAtMs: null, lastRunAtMs: null, lastRunStatus: 'error', error: 'Test error' },
    { id: 'native', name: 'Unmanaged schedule', managed: false, enabled: true, nextRunAtMs: null, lastRunAtMs: null, lastRunStatus: 'ok', error: '' }];
  const html = renderToStaticMarkup(createElement(exports.default, { jobs, sessionKey: 'agent:fixture:main', onRefresh() {}, onShowRuns() {} }));
  assert.equal((html.match(/Daily review/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Unmanaged schedule/);
  assert.match(html, /Đang bật.*Lần tới: Chưa có/); assert.match(html, /Lần trước: Chưa có.*Có lỗi/);
  for (const label of ['Xem lịch sử', 'Sửa', 'Tạm dừng', 'Xóa', 'Test error']) assert.ok(html.includes(label));
});
