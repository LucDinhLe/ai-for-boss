import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import plugin from '../../packages/harness-plugin/index.mjs';
import {MODES,MODE_IDS,capsFor,thinkingFor,overCap,DEFAULT_CAPS} from '../../packages/harness-plugin/contract.mjs';
import {recordDecision,recentDecisions} from '../../packages/harness-plugin/decisions.mjs';

const key='agent:main:chat-1', sessionId='s-1';
function fakeApi(stateDir,session){
 const hooks={},methods={},tools=[];
 return {hooks,methods,tools,api:{
  runtime:{state:{resolveStateDir:()=>stateDir},agent:{session:{getSessionEntry:({agentId,sessionKey})=>agentId==='main'&&sessionKey===key?session:null}}},
  on:(name,fn)=>{hooks[name]=fn;},
  registerGatewayMethod:(name,fn,opts)=>{assert.equal(opts.scope,'operator.admin');methods[name]=fn;},
  registerTool:(factory,opts)=>{tools.push({factory,opts});}
 }};
}
const call=(fn,params)=>new Promise(resolve=>fn({params,respond:(ok,payload,error)=>resolve({ok,payload,error})}));

test('contract table: three buttons, thinking preference follows the model, caps fall back to the safety net',()=>{
 assert.deepEqual(MODE_IDS,['nhanh','ky','quyet-dinh']);
 assert.ok(MODES.nhanh.steps<MODES.ky.steps&&MODES.ky.steps<MODES['quyet-dinh'].steps);
 assert.equal(thinkingFor('nhanh',[{id:'medium'},{id:'low'}]),'low');
 assert.equal(thinkingFor('quyet-dinh',['off','medium']),'medium');
 assert.equal(thinkingFor('ky',[]),null);
 assert.deepEqual(capsFor(null),DEFAULT_CAPS);
 assert.equal(overCap({steps:9,tokens:0},capsFor('nhanh')),true);
 // A mode never carries a model or provider: the account the learner pays for stays in charge.
 for(const mode of Object.values(MODES))assert.ok(!('model' in mode)&&!('provider' in mode));
});

test('budget gate counts steps per run, blocks in Vietnamese at the cap, and writes one trace line per turn',async()=>{
 const stateDir=await mkdtemp(path.join(os.tmpdir(),'aifb-harness-')),workspace=await mkdtemp(path.join(os.tmpdir(),'aifb-ws-'));
 const session={sessionId,permissionMode:'workspace',sessionRoot:workspace};
 const {hooks,methods,api}=fakeApi(stateDir,session);
 plugin.register(api);
 assert.deepEqual((await call(methods['aifb.harness.contract'],{key,sessionId})).payload,{mode:null});
 assert.equal((await call(methods['aifb.harness.contract'],{key,sessionId,mode:'bay'})).ok,false);
 assert.equal((await call(methods['aifb.harness.contract'],{key,sessionId:'other',mode:'nhanh'})).ok,false);
 assert.equal((await call(methods['aifb.harness.contract'],{key,sessionId,mode:'nhanh'})).payload.mode,'nhanh');
 const ctx={runId:'r1',sessionKey:key,sessionId,agentId:'main',workspaceDir:workspace};
 const prompt=await hooks.before_prompt_build({prompt:'x',messages:[]},ctx);
 assert.match(prompt.appendSystemContext,/Quy tắc điều hành/);
 assert.match(prompt.appendContext,/Chế độ Nhanh: đã dùng 0\/8 bước/);
 await hooks.llm_output({usage:{input:1000,output:200},provider:'openai',model:'gpt-5',reasoningEffort:'low'},ctx);
 let blocked=null;
 for(let i=0;i<9;i++){const result=await hooks.before_tool_call({toolName:'read',params:{}},ctx);if(result?.block){blocked={i,result};break;}}
 assert.equal(blocked.i,8);
 assert.match(blocked.result.blockReason,/9\/8 bước/);
 assert.match(blocked.result.blockReason,/nâng trần/);
 // The decision tool is never gated so the model can still record what the user chose.
 assert.equal(await hooks.before_tool_call({toolName:'aifb_record_decision',params:{}},ctx),undefined);
 await hooks.agent_end({success:true,durationMs:10},ctx);
 const trace=(await readFile(path.join(stateDir,'aifb-harness','trace.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 assert.equal(trace.length,1);
 assert.deepEqual({mode:trace[0].mode,steps:trace[0].steps,tokens:trace[0].tokens,blocked:trace[0].blocked,provider:trace[0].provider,thinking:trace[0].thinking},
  {mode:'nhanh',steps:9,tokens:1200,blocked:1,provider:'openai',thinking:'low'});
 const usage=(await call(methods['aifb.harness.usage'],{})).payload;
 assert.equal(usage.totals.turns,1);assert.equal(usage.byMode.nhanh.tokens,1200);
 assert.equal((await call(methods['aifb.harness.usage'],{key:'bad key'})).ok,false);
 // Session without a contract uses the safety net only.
 const other={runId:'r2',sessionKey:key,sessionId:'s-2',agentId:'main'};
 assert.equal(await hooks.before_tool_call({toolName:'read',params:{}},other),undefined);
 assert.match((await hooks.before_prompt_build({prompt:'x',messages:[]},other)).appendContext,/Chế độ Mặc định/);
});

test('decision memory writes a readable table and a machine log, and feeds the newest ten back',async()=>{
 const workspace=await mkdtemp(path.join(os.tmpdir(),'aifb-ws-'));
 assert.equal(await recentDecisions(workspace),'');
 for(let i=1;i<=12;i++)await recordDecision(workspace,{decision:`Chọn gói ${i}`,rationale:'rẻ hơn',rejected:['gói khác'],decidedBy:'Lực'});
 const page=await readFile(path.join(workspace,'QUYET-DINH.md'),'utf8');
 assert.match(page,/^# Sổ quyết định/);
 assert.equal(page.match(/^\| \d{4}-\d{2}-\d{2} \|/gm).length,12);
 const recent=await recentDecisions(workspace);
 assert.match(recent,/Chọn gói 12/);assert.doesNotMatch(recent,/Chọn gói 2\b/);
 assert.deepEqual((await readdir(workspace)).sort(),['QUYET-DINH.jsonl','QUYET-DINH.md']);
});

test('decision tool requires a writable, unchanged session inside the workspace',async()=>{
 const stateDir=await mkdtemp(path.join(os.tmpdir(),'aifb-harness-')),workspace=await mkdtemp(path.join(os.tmpdir(),'aifb-ws-'));
 const session={sessionId,permissionMode:'read-only',sessionRoot:workspace};
 const {tools,api}=fakeApi(stateDir,session);
 plugin.register(api);
 assert.deepEqual(tools[0].opts,{names:['aifb_record_decision'],optional:true});
 assert.equal(tools[0].factory({sessionKey:key,workspaceDir:workspace,sandboxed:true}),null);
 const tool=tools[0].factory({sessionKey:key,sessionId,agentId:'main',workspaceDir:workspace});
 await assert.rejects(tool.execute('id',{decision:'x'}),/write permission/);
 session.permissionMode='workspace';
 const result=await tool.execute('id',{decision:'Giữ giá cũ tới hết quý'});
 assert.match(result.content[0].text,/Giữ giá cũ/);
});

test('plugin manifest declares the tool, the skill root and no config surface',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../packages/harness-plugin/openclaw.plugin.json',import.meta.url),'utf8'));
 assert.equal(manifest.id,'aifb-harness');
 assert.deepEqual(manifest.contracts.tools,['aifb_record_decision']);
 assert.equal(manifest.toolMetadata.aifb_record_decision.optional,true);
 assert.deepEqual(manifest.skills,['skills']);
 assert.deepEqual(manifest.configSchema.properties,{});
});
