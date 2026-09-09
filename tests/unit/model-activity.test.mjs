import assert from 'node:assert/strict';
import test from 'node:test';
import { acknowledgeChatRun, newChatRun, reduceChatRun, reduceAgentProgress, recoverChatRun } from '../../apps/desktop/src/chat-state.ts';
import { isModelActive } from '../../apps/desktop/src/model-activity.ts';

const key = 'agent:main:fixture';
const activity = (run, patch = {}) => isModelActive({ connected: true, activeKey: key, historyReady: true, run, supervision: null, ...patch });

test('local send/file-save reservation, draft and unknown state never signal model activity', () => {
  assert.equal(activity(newChatRun()), false);
  assert.equal(activity(newChatRun('request')), false);
  assert.equal(activity({ ...newChatRun('request'), busy: true, nativeActive: false }), false);
  assert.equal(activity({ ...newChatRun(), busy: true }), false);
});

test('same-run native events start activity, and terminal/idle/explicit lifecycle end stop it immediately', () => {
  const pending = newChatRun('request');
  const running = reduceChatRun(pending, { sessionKey: key, runId: 'request', seq: 0, state: 'delta', deltaText: 'Public reply' }, key);
  assert.equal(activity(running), true);
  for (const state of ['final', 'error', 'aborted']) {
    assert.equal(activity(reduceChatRun(running, { sessionKey: key, runId: 'request', seq: 1, state }, key)), false);
  }
  const progress = reduceAgentProgress(pending, { sessionKey: key, runId: 'request', seq: 0, ts: 1,
    stream: 'thinking', data: { text: 'Public summary' } }, key);
  assert.equal(activity(progress), true);
  const ended = reduceAgentProgress(progress, { sessionKey: key, runId: 'request', seq: 1, ts: 2,
    stream: 'lifecycle', data: { phase: 'end' } }, key);
  assert.equal(ended.busy, true, 'Lifecycle progress does not release the send lock');
  assert.equal(activity(ended), false, 'But a finished model is no longer animated');
  assert.equal(activity(recoverChatRun(running, { sessionInfo: { hasActiveRun: false } })), false);
});

test('verified ACK/snapshot activity requires current connection and history; stale or unrelated native IDs do not qualify', () => {
  const acknowledged = acknowledgeChatRun(newChatRun('request'), 'request', { runId: 'request', status: 'started' });
  assert.equal(activity(acknowledged), true);
  assert.equal(activity(acknowledged, { connected: false }), false);
  assert.equal(activity(acknowledged, { historyReady: false }), false);
  assert.equal(activity(acknowledged, { activeKey: null }), false);
  assert.equal(activity(recoverChatRun(newChatRun(), { sessionInfo: { hasActiveRun: true, activeRunIds: ['native-current'] } })), true);
  assert.equal(activity(recoverChatRun(newChatRun(), { inFlightRun: { runId: 'native-current', text: '' } })), true);
  assert.equal(activity({ ...newChatRun('current'), activeRunIds: ['old'] }), false);
  const wrong = reduceAgentProgress(newChatRun('current'), { sessionKey: 'agent:main:other', runId: 'old', seq: 2, ts: 1,
    stream: 'thinking', data: { text: 'Other conversation' } }, key);
  assert.equal(activity(wrong), false);
});

test('unknown ACK/history does not create activity and a late acceptance cannot restart terminal activity', () => {
  const pending = newChatRun('request');
  assert.equal(activity(acknowledgeChatRun(pending, 'request', { runId: 'request', status: 'unknown' })), false);
  const running = acknowledgeChatRun(pending, 'request', { runId: 'request', status: 'started' });
  const unknown = recoverChatRun(running, {});
  assert.equal(unknown.busy, true, 'Unknown status must retain the stop/send ownership lock');
  assert.equal(activity(unknown), false);
  for (const status of ['ok', 'timeout', 'error']) {
    const ended = acknowledgeChatRun(running, 'request', { runId: 'request', status });
    assert.equal(activity(ended), false);
    assert.equal(activity(acknowledgeChatRun(ended, 'request', { runId: 'request', status: 'started' })), false);
  }
});

test('workspace/context preparation is not model activity; a newer output frame supersedes an old progress end', () => {
  const accepted = acknowledgeChatRun(newChatRun('request'), 'request', { runId: 'request', status: 'started' });
  for (const phase of ['preparing_workspace', 'naming_worktree', 'creating_worktree', 'running_setup', 'provisioning_environment', 'preparing_context']) {
    const preparing = reduceAgentProgress(accepted, { sessionKey: key, runId: 'request', seq: 0, ts: 1,
      stream: 'run_status', data: { phase } }, key);
    assert.equal(activity(preparing), false, phase);
    assert.equal(activity(acknowledgeChatRun(preparing, 'request', { runId: 'request', status: 'started' })), false, 'Late ACK cannot override current preparation');
    const status = reduceChatRun(accepted, { sessionKey: key, runId: 'request', seq: 0, state: 'status', phase }, key);
    assert.equal(activity(status), false);
    assert.equal(activity(acknowledgeChatRun(status, 'request', { runId: 'request', status: 'started' })), false);
    assert.equal(activity(recoverChatRun(preparing, { inFlightRun: { runId: 'request', text: '' } })), false,
      'An aggregate in-flight snapshot cannot pretend a known preparatory phase is model output');
  }
  const ended = reduceAgentProgress(accepted, { sessionKey: key, runId: 'request', seq: 100, ts: 1,
    stream: 'lifecycle', data: { phase: 'end' } }, key);
  assert.equal(activity(ended), false);
  assert.equal(activity(acknowledgeChatRun(ended, 'request', { runId: 'request', status: 'started' })), false);
  const next = reduceChatRun(ended, { sessionKey: key, runId: 'request', seq: 0, state: 'delta', deltaText: 'New output' }, key);
  assert.equal(activity(next), true, 'Each native stream has its own sequence; new model output is fresh evidence');
  assert.equal(activity(acknowledgeChatRun(next, 'request', { runId: 'request', status: 'started' })), true);
});

test('Advisor activity requires same-session native model evidence in a live phase, never merely a busy planning label', () => {
  const run = newChatRun();
  const base = { id: 'job', key, phase: 'planning', busy: true, accepted: false, plan: '', planReview: null, finalReview: null, error: null };
  assert.equal(activity(run, { supervision: base }), false);
  for (const phase of ['planning', 'revising-plan', 'plan-review', 'working', 'revising-result', 'final-review']) {
    assert.equal(activity(run, { supervision: { ...base, phase, modelActive: true } }), true);
  }
  for (const patch of [{ key: 'agent:main:other' }, { phase: 'completed' }, { phase: 'error' }, { phase: 'cancelled' },
    { phase: 'needs-changes' }, { phase: 'unknown' }, { busy: false }, { modelActive: false }]) {
    assert.equal(activity(run, { supervision: { ...base, modelActive: true, ...patch } }), false);
  }
});

test('supervised worker preparation/end overrides its admission flag, but a separate Advisor review still uses native host evidence', () => {
  const supervision = { id: 'job', key, phase: 'working', busy: true, accepted: true, modelActive: true,
    plan: '', planReview: null, finalReview: null, error: null };
  for (const phase of ['preparing_context', 'preparing_workspace', 'end', 'error']) {
    const progress = reduceAgentProgress(newChatRun('worker'), { sessionKey: key, runId: 'worker', seq: 0, ts: 1,
      stream: 'run_status', data: { phase } }, key);
    assert.equal(activity(progress, { supervision }), false);
    assert.equal(activity(progress, { supervision: { ...supervision, phase: 'final-review' } }), true);
  }
});
