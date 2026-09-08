import assert from 'node:assert/strict';
import test from 'node:test';
import { thinkingStatus } from '../../apps/desktop/src/thinking-status.ts';
import { newChatRun, reduceAgentProgress } from '../../apps/desktop/src/chat-state.ts';

const key = 'agent:main:test';
const base = { activeKey: key, connected: true, historyReady: true, run: newChatRun(), supervision: null, pending: false, stopping: false };
test('left Thinking status reflects public progress without leaking content or unrelated supervision', () => {
  const run = reduceAgentProgress(newChatRun('turn'), { sessionKey: key, runId: 'turn', seq: 0, ts: 1,
    stream: 'thinking', data: { text: 'private fixture text must not be copied into the rail' } }, key);
  assert.equal(thinkingStatus({ ...base, run }), 'Đang suy nghĩ');
  assert.equal(thinkingStatus({ ...base, pending: true }), 'Đang chuẩn bị yêu cầu');
  assert.equal(thinkingStatus({ ...base, run: newChatRun('pending') }), 'Đang chờ mô hình xác nhận');
  assert.equal(thinkingStatus({ ...base, supervision: { key: 'agent:other:test', busy: true, phase: 'final-review' } }), 'Xem hoạt động của phiên');
  assert.equal(thinkingStatus({ ...base, supervision: { key, busy: true, phase: 'final-review' } }), 'Advisor đang kiểm kết quả');
  assert.equal(thinkingStatus({ ...base, run, connected: false }), 'Đang chờ kết nối');
  assert.equal(thinkingStatus({ ...base, run, historyReady: false }), 'Đang tải hoạt động');
  assert.equal(thinkingStatus({ ...base, run, stopping: true }), 'Đang dừng…');
  assert.equal(thinkingStatus({ ...base, run, activeKey: null }), 'Chọn cuộc trò chuyện');
});
