import assert from "node:assert/strict";
import test from "node:test";
import { projectAgentProgress } from "../../apps/desktop/electron/agent-progress.mjs";
import { GatewayAdapter, OPERATOR_SCOPES } from "../../apps/desktop/electron/gateway-adapter.mjs";
import { newChatRun, reduceAgentProgress, reduceChatRun, recoverChatRun } from "../../apps/desktop/src/chat-state.ts";
import { toTranscriptMessages } from "../../apps/desktop/src/gateway-client.ts";

const event = (seq, stream, data, extra = {}) => ({ sessionKey: "session-a", runId: "run-a", seq, ts: 1000 + seq, stream, data, ...extra });
const apply = (run, payload) => reduceAgentProgress(run, payload, "session-a");

test("skill and agent presentation comes from specific native arguments without exposing paths, tasks or results", () => {
  const skill = projectAgentProgress(event(1, 'tool', { name: 'read', phase: 'start', toolCallId: 'skill',
    args: { path: 'C:/private/workspace/skills/team/business-review/SKILL.md', secret: 'DO_NOT_COPY' } }));
  assert.deepEqual(skill.data.activity, { kind: 'skill', label: 'business-review' });
  assert.doesNotMatch(JSON.stringify(skill), /private|workspace|DO_NOT_COPY/);
  const child = projectAgentProgress(event(2, 'tool', { name: 'sessions_spawn', phase: 'start', toolCallId: 'child',
    args: { agentId: 'researcher', label: 'Kiểm dữ kiện', task: 'DO_NOT_COPY', token: 'DO_NOT_COPY' } }));
  assert.deepEqual(child.data.activity, { kind: 'agent', agentId: 'researcher', label: 'Kiểm dữ kiện' });
  assert.doesNotMatch(JSON.stringify(child), /DO_NOT_COPY|task|token/);
  for (const args of [{ path: '/private/report.md' }, { path: '/skills/test/not-SKILL.md' }, { path: '/skills/test/SKILL.md?token=x' },
    { path: '/skills/../SKILL.md' }, { path: '/skills/' + 'x/'.repeat(5000) + 'test/SKILL.md' }]) {
    assert.equal(projectAgentProgress(event(1, 'tool', { name: 'read', phase: 'start', toolCallId: 'x', args })).data.activity, undefined);
  }
  assert.equal(projectAgentProgress(event(2, 'tool', { name: 'sessions_spawn', phase: 'start', toolCallId: 'child', args: { label: '<script>bad</script>', agentId: '../x' } })).data.activity, undefined);
  let run = apply(apply(newChatRun('run-a'), skill), child);
  run = apply(run, projectAgentProgress(event(3, 'tool', { name: 'read', phase: 'result', toolCallId: 'skill' })));
  assert.deepEqual(run.progress.tools.map(tool => tool.id), ['skill', 'child'], 'updates preserve call order');
  assert.equal(run.progress.tools[0].activity.label, 'business-review', 'result without args keeps original presentation');
  assert.equal(apply(run, event(4, 'tool', { name: 'write', phase: 'start', toolCallId: 'skill' })), run, 'a call cannot change identity');
  run = apply(run, projectAgentProgress(event(4, 'plan', { phase: 'update', steps: [], explanation: 'Check evidence first.' })));
  assert.equal(run.progress.explanation, 'Check evidence first.');
  assert.equal(run.busy, true, 'presentation cannot settle execution');
});

test("host progress projection excludes raw tool arguments, results, paths, arbitrary diagnostics and unknown streams", () => {
  const projected = projectAgentProgress(event(1, "tool", { name: "session_status", phase: "result", toolCallId: "call-1",
    isError: false, args: { token: "secret" }, result: "private output", error: "private error", command: "private command" }, { secret: "secret" }));
  assert.deepEqual(projected.data, { name: "session_status", phase: "result", toolCallId: "call-1", isError: false });
  assert.equal(JSON.stringify(projected).includes("private"), false);
  assert.equal(JSON.stringify(projected).includes("secret"), false);
  assert.deepEqual(projectAgentProgress(event(2, "lifecycle", { phase: "error", error: "private" })).data, { phase: "error" });
  for (const candidate of [event(1, "unknown", {}), event(1, "tool", { name: "command with text", phase: "start", toolCallId: "1" }),
    event(1, "thinking", {}), event(1, "thinking", { text: "secret" }, { sessionKey: undefined }),
    event(1, "thinking", { text: "secret" }, { runId: "" }), event(-1, "thinking", { text: "x" }),
    event(1.2, "thinking", { text: "x" }), event(1, "thinking", { text: "x" }, { ts: Infinity })]) assert.equal(projectAgentProgress(candidate), null);
  assert.equal(projectAgentProgress(event(1, "thinking", { text: "x".repeat(50_000), hiddenSignature: "secret" })).data.text.length, 24_000);
});

test("adapter advertises scoped progress without new permissions and sanitizes before IPC", async () => {
  let options; const forwarded = [];
  class FakeClient { constructor(value) { options = value; } start() {} async stopAndWait() {} }
  const adapter = new GatewayAdapter({ stateDirectory: "/unused", Client: FakeClient,
    identityLoader: () => ({ deviceId: "fixture" }), onEvent: value => forwarded.push(value) });
  adapter.connect({ url: "ws://127.0.0.1:1", token: "fixture" });
  assert.deepEqual(options.scopes, [...OPERATOR_SCOPES]);
  assert.deepEqual(options.caps, ["tool-events", "session-scoped-events", "exec-approvals"]);
  options.onHelloOk({ protocol: 4 });
  options.onEvent({ event: "agent", payload: event(1, "thinking", { text: "Visible provider summary", signature: "secret" }) });
  assert.equal(forwarded.length, 1); assert.equal(forwarded[0].payload.data.signature, undefined);
  options.onEvent({ event: "agent", payload: event(2, "command_output", { text: "private" }) });
  assert.equal(forwarded.length, 1);
  await adapter.disconnect();
  options.onEvent({ event: "agent", payload: event(3, "thinking", { text: "late" }) });
  assert.equal(forwarded.length, 1);
});

test("reasoning updates from native snapshots/deltas once, independently of answer sequences", () => {
  let run = newChatRun("run-a");
  run = apply(run, event(2, "thinking", { text: "Read" }));
  run = apply(run, event(3, "thinking", { text: "Read the brief", delta: " the brief" }));
  assert.equal(run.progress.reasoning, "Read the brief");
  assert.equal(run.text, "");
  assert.equal(apply(run, event(3, "thinking", { delta: "repeat" })), run);
  run = reduceChatRun(run, { sessionKey: "session-a", runId: "run-a", seq: 1, state: "delta", deltaText: "Final answer" }, "session-a");
  assert.equal(run.progress.reasoning, "Read the brief"); assert.equal(run.text, "Final answer");
  run = apply(run, event(4, "thinking", { delta: "Corrected", replace: true, progressTokens: 12 }));
  assert.equal(run.progress.reasoning, "Corrected"); assert.equal(run.progress.reasoningTokens, 12);
});

test("public tools/plan/lifecycle never unlock a run; final proof wins and late events cannot resurrect it", () => {
  let run = apply(newChatRun("run-a"), event(1, "tool", { toolCallId: "one", name: "session_status", phase: "start" }));
  assert.equal(run.progress.tools.length, 1);
  run = apply(run, event(2, "tool", { toolCallId: "one", name: "session_status", phase: "result", isError: true, result: "secret" }));
  assert.equal(run.progress.tools.length, 1); assert.equal(run.progress.tools[0].failed, true);
  assert.equal(JSON.stringify(run).includes("secret"), false);
  run = apply(run, event(3, "plan", { steps: [{ step: "Check requirement", status: "completed" }, { step: "bad", status: "unverified" }] }));
  assert.equal(run.progress.plan.length, 1);
  run = apply(run, event(4, "lifecycle", { phase: "end" }));
  assert.equal(run.busy, true); assert.equal(run.terminal, false);
  run = reduceChatRun(run, { sessionKey: "session-a", runId: "run-a", seq: 5, state: "aborted" }, "session-a");
  assert.equal(run.terminal, true); assert.equal(run.progress.tools.length, 1);
  assert.equal(apply(run, event(6, "thinking", { text: "late" })), run);
});

test("progress never adopts unknown, cross-session, retired or unowned run identities", () => {
  const run = newChatRun("run-a");
  for (const value of [event(1, "thinking", { text: "wrong" }, { sessionKey: "session-b" }),
    event(1, "thinking", { text: "wrong" }, { runId: "run-b" }), event(-1, "thinking", { text: "wrong" }),
    event(1, "secret", { text: "wrong" })]) assert.equal(apply(run, value), run);
  const idle = newChatRun(); assert.equal(apply(idle, event(1, "thinking", { text: "wrong" })), idle);
  assert.equal(apply({ ...idle, busy: true, activeRunIds: ["run-a"] }, event(1, "thinking", { text: "wrong" })).runId, null);
});

test("reconnect retains only same-run progress and safely rebuilds public snapshot events", () => {
  const run = apply(newChatRun("run-a"), event(3, "thinking", { text: "Current" }));
  const same = recoverChatRun(run, { sessionKey: "session-a", inFlightRun: { runId: "run-a", text: "", events: [
    event(4, "tool", { toolCallId: "one", name: "read", phase: "start", args: "secret" })] } });
  assert.equal(same.progress.reasoning, "Current"); assert.equal(same.progress.tools.length, 1);
  const next = recoverChatRun(run, { inFlightRun: { runId: "run-b", text: "New" } });
  assert.equal(next.progress, undefined);
  const withPlan = recoverChatRun(newChatRun(), { inFlightRun: { runId: "run-a", text: "", plan: { steps: [{ step: "Native plan", status: "pending" }] } } });
  assert.equal(withPlan.progress.plan[0].step, "Native plan"); assert.equal(withPlan.progress.reasoning, "");
  assert.equal(recoverChatRun(run, { sessionInfo: { hasActiveRun: false } }).busy, false);
});

test("published reasoning stays separate from answer text and signatures are discarded", () => {
  const messages = toTranscriptMessages([{ role: "assistant", content: [
    { type: "thinking", thinking: "Visible summary", signature: "secret signature" },
    { type: "reasoning", text: "Another summary" }, { type: "text", text: "The answer" }] }], "session-a");
  assert.equal(messages[0].content, "The answer"); assert.equal(messages[0].reasoning, "Visible summary\nAnother summary");
  assert.equal(JSON.stringify(messages).includes("signature"), false);
  const only = toTranscriptMessages([{ role: "assistant", content: [{ type: "thinking", thinking: "Only summary" }] }], "session-a");
  assert.equal(only.length, 1); assert.equal(only[0].content, "");
});
