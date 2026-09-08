import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SupervisionService } from '../../apps/desktop/electron/supervision-service.mjs';
import { WorkerNotSubmittedError } from '../../apps/desktop/electron/worker-policy.mjs';
import { validateReviewRequest } from '../../apps/desktop/electron/advisor-contract.mjs';
import { documentReviewContext } from '../../apps/desktop/electron/document-context.mjs';
const model = { id: 'm', provider: 'p' };
const approve = { pass: true, decision: 'approve', summary: 'OK', issues: [] };
const document = text => ({ type: 'file', fileName: 'Kế hoạch.docx.txt', mimeType: 'text/plain', content: Buffer.from(text).toString('base64'), sizeBytes: Buffer.byteLength(text) });

test('supervision activity follows the exact accepted review or worker, not phase or preflight', async () => {
  const f = fixture(), priorReview = f.service.advisor.request, reviews = [];
  let activeReview = null, finishReview, finishSend, finishWait;
  f.service.advisor.isModelActive = id => id === activeReview;
  f.service.advisor.request = async packet => {
    if (packet.action === 'plan') { reviews.push(packet); await new Promise(resolve => { finishReview = resolve; }); }
    return priorReview(packet);
  };
  const adapter = f.service.getAdapter(), request = adapter.request;
  adapter.request = async (method, params) => {
    if (method === 'sessions.send') await new Promise(resolve => { finishSend = resolve; });
    return request(method, params);
  };
  f.service.getSetup().workspaceRequest = () => new Promise(resolve => { finishWait = resolve; });
  const running = f.service.run(f.input);
  for (let i = 0; i < 40 && !finishReview; i++) await Promise.resolve();
  assert.ok(finishReview); assert.equal(f.service.status().phase, 'planning'); assert.equal(f.service.status().modelActive, false);
  activeReview = reviews[0].id; assert.equal(f.service.status().modelActive, true);
  activeReview = randomUUID(); assert.equal(f.service.status().modelActive, false);
  finishReview();
  for (let i = 0; i < 80 && !finishSend; i++) await Promise.resolve();
  assert.ok(finishSend); assert.equal(f.service.status().phase, 'working'); assert.equal(f.service.status().modelActive, false);
  finishSend();
  for (let i = 0; i < 40 && !finishWait; i++) await Promise.resolve();
  assert.ok(finishWait); assert.equal(f.service.status().modelActive, true);
  f.service.isReady = () => false; assert.equal(f.service.status().modelActive, false);
  f.service.isReady = () => true;
  finishWait({ status: 'ok', endedAt: Date.now() }); await running;
  assert.equal(f.service.status().modelActive, false);
});

test('document contents reach planning, Advisor plan review, worker and final review without replacing original request', async () => {
  const f = fixture(), text = 'Kế hoạch tiếng Việt\nNgân sách\t127.350.000 đồng\nHoàn thành\t30/09/2026';
  f.input.attachments = [document(text)];
  const adapter = f.service.getAdapter(), request = adapter.request, sends = [];
  adapter.request = async (method, params) => { if (method === 'sessions.send') sends.push(params); return request(method, params); };
  assert.equal((await f.service.run(f.input)).phase, 'completed');
  assert.equal(sends.length, 1); assert.deepEqual(sends[0].attachments, f.input.attachments);
  for (const input of f.inputs) {
    assert.match(input.evidence, /127\.350\.000 đồng/); assert.match(input.evidence, /30\/09\/2026/);
    assert.match(input.evidence, /không phải chỉ dẫn/); assert.equal(input.goal, f.input.message);
    validateReviewRequest({ ...input, action: 'review' });
  }
});

test('large and escaped document excerpts stay bounded, labelled partial and independently parseable for every file', () => {
  const texts = ['Đầu' + '\n"\\'.repeat(6000) + 'CUỐI', 'x'.repeat(55000), 'y'.repeat(55000), 'z'.repeat(55000)];
  const context = documentReviewContext(texts.map(document));
  assert.ok(context.length < 5500); assert.match(context, /chưa đọc toàn bộ/);
  const packets = context.split('\n').slice(1).map(line => JSON.parse(line));
  assert.equal(packets.length, 4); assert.match(packets[0].text, /CUỐI$/u);
  assert.equal(documentReviewContext([{ type: 'file', mimeType: 'application/pdf' }]), '');
  for (const value of [{ ...document('abc'), content: 'bad!' }, { ...document('abc'), sizeBytes: 10 }, document('a\0b')]) assert.throws(() => documentReviewContext([value]));
});
function fixture({ decision = approve, changed = false, waitError = false } = {}) {
  const calls = [], inputs = [], key = 'agent:main:aifb-test'; let sent = false, reads = 0, sentMessage = '';
  const adapter = { hello: { policy: { maxPayload: 100000 } }, request: async (method, params) => {
    calls.push(method);
    if (method === 'models.list') return { models: [{ ...model, available: true }] };
    if (method === 'chat.history') return { sessionInfo: { model: 'm', modelProvider: 'p' }, messages: sent
      ? [{ role: 'user', content: sentMessage }, { role: 'assistant', content: 'Kết quả' }]
      : (++reads > 1 && changed ? [{ role: 'user', content: 'Changed' }] : []) };
    if (method === 'sessions.send') { sent = true; sentMessage = params.message; return { runId: params.idempotencyKey, status: 'accepted' }; }
    if (method === 'chat.abort') return { aborted: true };
    throw new Error(method);
  } };
  const setup = { workspaceRequest: async () => ({ status: waitError ? 'error' : 'ok', endedAt: Date.now() }) };
  const advisor = { request: async input => {
    inputs.push(input);
    if (input.action === 'cancel') return { status: 'cancelled' };
    if (input.action === 'plan') return { status: 'completed', plan: 'Kế hoạch', consultation: 'Các bước có đáp ứng yêu cầu chưa?' };
    return { status: 'completed', result: typeof decision === 'function' ? decision(input, inputs) : decision };
  } };
  const service = new SupervisionService({ advisor, getAdapter: () => adapter, getSetup: () => setup, isReady: () => true });
  return { service, inputs, calls, input: { action: 'supervise', id: randomUUID(), key, message: 'Mục tiêu', model, advisorModel: model } };
}
test('automatic supervision makes one plan, gates worker on approval, then reviews its result', async () => {
  const f = fixture(), result = await f.service.run(f.input);
  assert.equal(result.phase, 'completed'); assert.equal(result.busy, false); assert.equal(result.accepted, true);
  assert.deepEqual(f.inputs.map(p => [p.action, p.checkpoint]), [['plan', 'plan'], ['review', 'plan'], ['review', 'final']]);
  assert.equal(f.calls.filter(c => c === 'sessions.send').length, 1);
  assert.equal(f.inputs.at(-1).content, 'Kết quả');
});
test('repeated plan revision stops at the cap without worker dispatch', async () => {
  const f = fixture({ decision: { ...approve, pass: false, decision: 'revise' } }), result = await f.service.run(f.input);
  assert.equal(result.phase, 'needs-changes'); assert.equal(result.accepted, false);
  assert.equal(f.calls.includes('sessions.send'), false); assert.equal(f.inputs.length, 4);
  assert.equal(result.planAttempt, 2);
});

test('long previous plan and document context cannot displace Advisor corrections from planning retry', async () => {
  let reviews = 0;
  const f = fixture({ decision: input => input.checkpoint === 'plan' && ++reviews === 1
    ? { ...approve, pass: false, decision: 'revise', issues: [{ title: 'Hạn', recommended_fix: 'Bổ sung mốc nghiệm thu 30/09/2026' }] } : approve });
  const prior = f.service.advisor.request;
  f.service.advisor.request = async input => { const result = await prior(input); return input.action === 'plan' ? { ...result, plan: 'Kế hoạch dài '.repeat(300) } : result; };
  f.input.attachments = [document('Nội dung kế hoạch '.repeat(2500))];
  assert.equal((await f.service.run(f.input)).phase, 'completed');
  const retry = f.inputs.filter(input => input.action === 'plan')[1];
  assert.match(retry.evidence, /Bổ sung mốc nghiệm thu 30\/09\/2026/);
  validateReviewRequest({ ...retry, action: 'review' });
});

test('worker receives Advisor feedback and consults again before work; final revise is returned to worker once', async () => {
  let planReviews = 0, finalReviews = 0;
  const revise = { pass: false, decision: 'revise', summary: 'Bổ sung mốc hoàn thành', issues: [{ title: 'Thiếu mốc', recommended_fix: 'Nêu thời hạn' }] };
  const f = fixture({ decision: input => (input.checkpoint === 'plan' ? ++planReviews : ++finalReviews) === 1 ? revise : approve });
  const result = await f.service.run(f.input);
  assert.equal(result.phase, 'completed'); assert.equal(result.planAttempt, 2); assert.equal(result.workAttempt, 2);
  assert.equal(f.inputs.length, 6); assert.equal(f.calls.filter(c => c === 'sessions.send').length, 2);
  assert.match(f.inputs.filter(i => i.action === 'plan')[1].evidence, /Nêu thời hạn/);
  assert.match(f.inputs.filter(i => i.action === 'review')[0].evidence, /Các bước có đáp ứng/);
  await assert.rejects(f.service.run(f.input), /đã được tiếp nhận/);
});

test('clarify does not guess a user decision; missing worker consultation fails closed', async () => {
  const f = fixture({ decision: { ...approve, pass: false, decision: 'clarify' } });
  assert.equal((await f.service.run(f.input)).phase, 'needs-changes');
  assert.equal(f.inputs.length, 2); assert.equal(f.calls.includes('sessions.send'), false);
  const invalid = fixture(); invalid.service.advisor.request = async () => ({status:'completed',plan:'Plan without consultation'});
  assert.equal((await invalid.service.run(invalid.input)).phase, 'error'); assert.equal(invalid.calls.includes('sessions.send'), false);
});

test('final revision cap does not turn rejected results into approved or continue forever', async () => {
  const f = fixture({ decision: input => input.checkpoint === 'plan' ? approve : {...approve,pass:false,decision:'revise'} });
  const result = await f.service.run(f.input);
  assert.equal(result.phase,'needs-changes'); assert.equal(result.workAttempt,2);
  assert.equal(f.calls.filter(c=>c==='sessions.send').length,2); assert.equal(result.finalReview.pass,false);
});

test('a changed transcript during final review cannot be labelled approved or automatically corrected', async () => {
  const f=fixture(); const adapter=f.service.getAdapter(), request=adapter.request; let final=false;
  const prior=f.service.advisor.request;
  f.service.advisor.request=async input=>{const result=await prior(input);if(input.checkpoint==='final')final=true;return result;};
  adapter.request=async(method,params)=>{const result=await request(method,params);if(method==='chat.history'&&final)result.messages.push({role:'user',content:'New instructions'});return result;};
  const result=await f.service.run(f.input);assert.equal(result.phase,'error');assert.equal(result.finalReview,null);
  assert.equal(f.calls.filter(c=>c==='sessions.send').length,1);
});

test('cancellation during final review never dispatches automatic correction', async () => {
  const f=fixture(); const prior=f.service.advisor.request; let finish;
  f.service.advisor.request = input => input.action === 'review' && input.checkpoint === 'final' ? new Promise(resolve=>{finish=resolve;}) : prior(input);
  const running=f.service.run(f.input);
  for(let i=0;i<80&&!finish;i++) await Promise.resolve();
  assert.ok(finish); await f.service.cancel();
  finish({status:'completed',result:{...approve,pass:false,decision:'revise'}});
  assert.equal((await running).phase,'cancelled'); assert.equal(f.calls.filter(c=>c==='sessions.send').length,1);
});
test('context changes between planning and send stop the pipeline; failed worker never receives final approval', async () => {
  const changed = fixture({ changed: true }); assert.equal((await changed.service.run(changed.input)).phase, 'error');
  assert.equal(changed.calls.includes('sessions.send'), false);
  const failed = fixture({ waitError: true }); assert.equal((await failed.service.run(failed.input)).phase, 'error');
  assert.equal(failed.inputs.filter(i => i.checkpoint === 'final').length, 0);
});
test('cancellation during planning cannot dispatch worker or revive completion', async () => {
  const f = fixture(); let resolvePlan;
  f.service.advisor.request = input => input.action === 'cancel' ? Promise.resolve({ status: 'cancelled' }) : new Promise(resolve => { resolvePlan = resolve; });
  const running = f.service.run(f.input);
  for (let i = 0; i < 10 && !resolvePlan; i++) await Promise.resolve();
  assert.ok(resolvePlan); await f.service.cancel(); resolvePlan({ status: 'completed', plan: 'Late plan' });
  const result = await running; assert.equal(result.phase, 'cancelled'); assert.equal(result.accepted, false);
  assert.equal(f.calls.includes('sessions.send'), false);
});

test('late cancelled plan cannot release or cancel the next supervision job', async () => {
  const f = fixture(), plans = [];
  f.service.advisor.request = input => input.action === 'cancel' ? Promise.resolve({ status: 'cancelled' }) : new Promise(resolve => plans.push(resolve));
  const first = f.service.run(f.input);
  for (let i = 0; i < 20 && plans.length < 1; i++) await Promise.resolve();
  await f.service.cancel();
  const nextInput = { ...f.input, id: randomUUID() }, second = f.service.run(nextInput);
  for (let i = 0; i < 20 && plans.length < 2; i++) await Promise.resolve();
  plans[0]({ status: 'completed', plan: 'Late old plan' }); await first;
  assert.equal(f.service.status().id, nextInput.id); assert.equal(f.service.status().busy, true);
  await assert.rejects(f.service.run({ ...f.input, id: randomUUID() }), /giám sát/);
  await f.service.cancel(); plans[1]({ status: 'completed', plan: 'Cancelled next plan' }); await second;
  assert.equal(f.calls.includes('sessions.send'), false);
});

test('host-proven pre-submission rejection clears the worker lock and permits another job', async () => {
  const f = fixture(), adapter = f.service.getAdapter(), prior = adapter.request;
  let waits = 0;
  f.service.getSetup().workspaceRequest = async () => { waits++; return { status: 'unknown' }; };
  adapter.request = (method, params) => method === 'sessions.send'
    ? Promise.reject(new WorkerNotSubmittedError(new Error('Policy not verified'))) : prior(method, params);
  const rejected = await f.service.run(f.input);
  assert.equal(rejected.busy, false); assert.equal(rejected.accepted, false); assert.equal(rejected.phase, 'error');
  assert.equal(waits, 0); assert.equal(f.calls.includes('chat.abort'), false);
  adapter.request = prior; f.service.getSetup().workspaceRequest = async () => ({ status: 'ok', endedAt: Date.now() });
  assert.equal((await f.service.run({ ...f.input, id: randomUUID() })).phase, 'completed');
});

test('ambiguous native submission failure retains ownership even if its error code resembles a host marker', async () => {
  const f = fixture(), adapter = f.service.getAdapter(), prior = adapter.request;
  f.service.getSetup().workspaceRequest = async () => ({ status: 'unknown' });
  adapter.request = (method, params) => method === 'sessions.send'
    ? Promise.reject(Object.assign(new Error('ACK lost'), { code: 'AIFB_WORKER_NOT_SUBMITTED' })) : prior(method, params);
  const result = await f.service.run(f.input);
  assert.equal(result.busy, true); assert.equal(f.calls.includes('chat.abort'), true);
  await assert.rejects(f.service.run({ ...f.input, id: randomUUID() })); f.service.ownedRuntimeStopped();
  assert.equal(f.service.status().busy, false);
});

test('Stop while policy is pending settles without waiting forever for a nonexistent native run', async () => {
  const f = fixture(), adapter = f.service.getAdapter(), prior = adapter.request; let rejectSend;
  adapter.request = (method, params) => method === 'sessions.send' ? new Promise((_, reject) => { rejectSend = reject; }) : prior(method, params);
  f.service.getSetup().workspaceRequest = async () => ({ status: 'unknown' });
  const run = f.service.run(f.input);
  for (let i = 0; i < 80 && !rejectSend; i++) await Promise.resolve();
  assert.ok(rejectSend); assert.equal((await f.service.cancel()).stopped, false);
  rejectSend(new WorkerNotSubmittedError(new Error('Cancelled before submit')));
  const result = await run; assert.equal(result.phase, 'cancelled'); assert.equal(result.busy, false); assert.equal(result.accepted, false);
  assert.equal((await f.service.cancel()).stopped, true);
});

test('policy refusal settling during abort never asks native wait about a cleared run ID', async () => {
  const f = fixture(), adapter = f.service.getAdapter(), prior = adapter.request; let rejectSend, finishAbort, waits = 0;
  adapter.request = (method, params) => method === 'sessions.send' ? new Promise((_, reject) => { rejectSend = reject; })
    : method === 'chat.abort' ? new Promise(resolve => { finishAbort = resolve; }) : prior(method, params);
  f.service.getSetup().workspaceRequest = async () => { waits++; return { status: 'unknown' }; };
  const run = f.service.run(f.input);
  for (let i = 0; i < 80 && !rejectSend; i++) await Promise.resolve();
  const cancelled = f.service.cancel(); assert.ok(finishAbort);
  rejectSend(new WorkerNotSubmittedError(new Error('Policy refused'))); await run; finishAbort({ aborted: false });
  assert.equal((await cancelled).stopped, true); assert.equal(waits, 0); assert.equal(f.service.status().busy, false);
});
