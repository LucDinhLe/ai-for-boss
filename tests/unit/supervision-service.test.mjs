import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SupervisionService, skipsReview, reviewEvidence } from '../../apps/desktop/electron/supervision-service.mjs';
import { WorkerNotSubmittedError } from '../../apps/desktop/electron/worker-policy.mjs';
const model = { id: 'm', provider: 'p' };
const approve = { pass: true, decision: 'approve', summary: 'OK', issues: [] };
function fixture({ decision = approve, waitError = false } = {}) {
  const calls = [], inputs = [], key = 'agent:main:aifb-test'; let sent = false, sentMessage = '';
  const adapter = { hello: { policy: { maxPayload: 100000 } }, request: async (method, params) => {
    calls.push(method);
    if (method === 'models.list') return { models: [{ ...model, available: true }] };
    if (method === 'chat.history') return { sessionInfo: { model: 'm', modelProvider: 'p' }, messages: sent
      ? [{ role: 'user', content: sentMessage }, { role: 'tool', toolName:'calculate', content:'Revenue = 370' }, { role: 'assistant', content: 'Kết quả' }] : [] };
    if (method === 'sessions.send') { sent = true; sentMessage = params.message; return { runId: params.idempotencyKey, status: 'accepted' }; }
    if (method === 'chat.abort') return { aborted: true };
    throw new Error(method);
  } };
  const setup = { workspaceRequest: async () => ({ status: waitError ? 'error' : 'ok', endedAt: Date.now() }) };
  const advisor = { request: async input => {
    inputs.push(input);
    if (input.action === 'cancel') return { status: 'cancelled' };
    assert.equal(input.action, 'review'); assert.equal(input.checkpoint, 'final');
    return { status: 'completed', result: typeof decision === 'function' ? decision(input, inputs) : decision };
  } };
  const service = new SupervisionService({ advisor, getAdapter: () => adapter, getSetup: () => setup, isReady: () => true });
  return { service, inputs, calls, input: { action: 'supervise', id: randomUUID(), key, message: 'Phân tích doanh thu', model, advisorModel: model } };
}
test('executor gets original request and attachments before any reviewer call; one final review includes tool evidence', async () => {
  const f=fixture(), adapter=f.service.getAdapter(), prior=adapter.request; let sent;
  f.input.attachments=[{type:'file',fileName:'data.txt',mimeType:'text/plain',content:Buffer.from('Input facts').toString('base64'),sizeBytes:11}];
  adapter.request=async (method,params)=>{if(method==='sessions.send'){assert.equal(f.inputs.length,0);sent=params;}return prior(method,params);};
  const result=await f.service.run(f.input);
  assert.equal(sent.message,f.input.message); assert.deepEqual(sent.attachments,f.input.attachments);
  assert.equal(result.phase,'completed');assert.equal(result.reviewCalls,1);assert.equal(result.busy,false);
  assert.equal(f.inputs.length,1);assert.match(f.inputs[0].evidence,/Revenue = 370/);
  await assert.rejects(f.service.run(f.input),/đã được tiếp nhận/);
});
test('greetings skip reviewer even if its model has become unavailable; short work is not mistaken for greeting',async()=>{
  for(const message of ['chào em,','Xin chào!','thanks','cảm ơn anh']){
    const f=fixture(); f.input.message=message;f.input.advisorModel={provider:'offline',id:'missing'};
    assert.equal((await f.service.run(f.input)).phase,'review-skipped');assert.equal(f.inputs.length,0);assert.equal(f.calls.filter(x=>x==='sessions.send').length,1);
  }
  assert.equal(skipsReview({message:'chào em, phân tích số liệu này'}),false);
  assert.equal(skipsReview({message:'hi',attachments:[{}]}),false);
});
test('reviewer failure preserves completed work, releases settled review and never resubmits work',async()=>{
  const f=fixture();f.service.advisor.request=async()=>({status:'failed',message:'Bad JSON'});
  const result=await f.service.run(f.input);
  assert.equal(result.phase,'unreviewed');assert.equal(result.busy,false);assert.equal(result.error,null);assert.match(result.warning,/Bad JSON/);
  assert.equal(f.calls.filter(x=>x==='sessions.send').length,1);assert.equal(result.finalReview,null);
});
test('review correction is bounded to one executor repair and two reviews',async()=>{
  const f=fixture({decision:{...approve,pass:false,decision:'revise',issues:[{title:'Missing',recommended_fix:'Check totals'}]}});
  const result=await f.service.run(f.input);assert.equal(result.phase,'needs-changes');assert.equal(result.workAttempt,2);assert.equal(result.reviewCalls,2);
  assert.equal(f.calls.filter(x=>x==='sessions.send').length,2);
});
test('native failed run can be reviewed but cannot be labelled completed just because reviewer approves',async()=>{
  const f=fixture({waitError:true});const result=await f.service.run(f.input);
  assert.equal(result.phase,'needs-changes');assert.match(f.inputs[0].content,/thất bại/);assert.equal(result.workAttempt,1);
  assert.equal(result.finalReview,null);
});

test('failed current turn never reuses an earlier assistant answer as review content',async()=>{
  const f=fixture({waitError:true}),adapter=f.service.getAdapter(),prior=adapter.request;
  adapter.request=async(method,params)=>{
    const result=await prior(method,params);
    if(method==='chat.history' && result.messages.length) result.messages=[{role:'assistant',content:'OLD ANSWER'},result.messages[0]];
    return result;
  };
  await f.service.run(f.input);assert.doesNotMatch(f.inputs[0].content,/OLD ANSWER/);
});

test('failed executor plus unavailable reviewer is not described as successful work',async()=>{
  const f=fixture({waitError:true});f.service.advisor.request=async()=>({status:'error',message:'Unavailable'});
  const result=await f.service.run(f.input);assert.match(result.warning,/thực thi báo lỗi/);assert.equal(result.busy,false);
});

test('tool evidence with escaping stays bounded and contains whole JSON',()=>{
  const evidence=reviewEvidence([{role:'user',content:'new'},...Array.from({length:6},()=>({role:'tool',content:'\u0001'.repeat(300)}))]);
  assert.ok(evidence.length<2400);assert.ok(Array.isArray(JSON.parse(evidence.split('\n')[1])));
});
test('Stop during review cannot dispatch repair; later old review cannot release next session job',async()=>{
  const f=fixture(), pending=[];
  f.service.advisor.request=input=>input.action==='cancel'?Promise.resolve({status:'cancelled'}):new Promise(resolve=>pending.push(resolve));
  const first=f.service.run(f.input);
  for(let i=0;i<80&&!pending.length;i++)await Promise.resolve();assert.equal(pending.length,1);
  await f.service.cancel();const next={...f.input,id:randomUUID()},second=f.service.run(next);
  for(let i=0;i<80&&pending.length<2;i++)await Promise.resolve();assert.equal(pending.length,2);
  pending[0]({status:'completed',result:approve});await first;assert.equal(f.service.status().id,next.id);assert.equal(f.service.status().busy,true);
  await f.service.cancel();pending[1]({status:'completed',result:approve});await second;
  assert.equal(f.calls.filter(x=>x==='sessions.send').length,2);
});
test('changing transcript during review prevents stale approval or repair',async()=>{
  const f=fixture(),a=f.service.getAdapter(),prior=a.request;let reviewed=false;
  f.service.advisor.request=async()=>{reviewed=true;return {status:'completed',result:approve};};
  a.request=async(m,p)=>{const r=await prior(m,p);if(m==='chat.history'&&reviewed)r.messages.push({role:'user',content:'Changed'});return r;};
  const result=await f.service.run(f.input);assert.equal(result.phase,'error');assert.equal(result.finalReview,null);
});
test('review evidence excludes unrelated earlier tool results and remains bounded',()=>{
  const evidence=reviewEvidence([{role:'tool',content:'old secret'},{role:'user',content:'new'},{role:'tool',content:'x'.repeat(20000)}]);
  assert.doesNotMatch(evidence,/old secret/);assert.ok(evidence.length<1000);
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



test('missing native wait receipt releases explicitly idle worker without review or replay', async () => {
  const f = fixture(), adapter = f.service.getAdapter(), prior = adapter.request;
  let sent = false;
  adapter.request = async (method, params) => {
    if (method === 'sessions.send') sent = true;
    const result = await prior(method, params);
    if (method === 'chat.history' && sent) result.sessionInfo.hasActiveRun = false;
    return result;
  };
  f.service.getSetup().workspaceRequest = async () => ({ status: 'timeout' });
  const result = await f.service.run(f.input);
  assert.equal(result.phase, 'unreviewed'); assert.equal(result.busy, false);
  assert.equal(f.inputs.length, 0); assert.equal(f.calls.filter(x => x === 'sessions.send').length, 1);
});


test('Stop can confirm native idle after the completion receipt is lost', async () => {
  const f = fixture(), adapter = f.service.getAdapter(), prior = adapter.request;
  let release; const waiting = new Promise(resolve => { release = resolve; }); let stopped = false;
  f.service.getSetup().workspaceRequest = async (_method, params) => params.timeoutMs === 0 ? { status: 'timeout' } : waiting;
  adapter.request = async (method, params) => {
    if (method === 'chat.abort') stopped = true;
    const result = await prior(method, params);
    if (method === 'chat.history' && stopped) result.sessionInfo.hasActiveRun = false;
    return result;
  };
  const running = f.service.run(f.input);
  for (let i=0;i<30 && !f.calls.includes('sessions.send');i++) await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal((await f.service.cancel()).stopped, true);
  release({ status: 'timeout' }); await running;
  assert.equal(f.service.status().busy, false); assert.equal(f.inputs.length, 0);
});
