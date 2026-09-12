import {mkdir,readFile,writeFile,rename,appendFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {capsFor,describeUsage,overCap,modeFor} from './contract.mjs';

const MAX_SESSIONS=5000, MAX_RUNS=2000;
/**
 * Per-session contract and usage ledger plus a one-line-per-turn JSONL trace.
 * The ledger is the single source the prompt tail, the tool gate and the usage
 * page read, so a user sees cost per task instead of per week. Writes are
 * serialised and atomic like the planning-profile store; the trace is append-only.
 */
export class Ledger {
 constructor(directory){this.directory=directory;this.tail=Promise.resolve();this.data=null;this.runs=new Map();}
 async load(){
  if(this.data)return this.data;
  try{this.data=JSON.parse(await readFile(path.join(this.directory,'ledger.json'),'utf8'));}
  catch(e){if(e.code!=='ENOENT')throw e;this.data={version:1,sessions:{}};}
  if(this.data.version!==1||typeof this.data.sessions!=='object')this.data={version:1,sessions:{}};
  return this.data;
 }
 transact(fn){
  const work=this.tail.then(async()=>{const data=await this.load(),result=await fn(data);await mkdir(this.directory,{recursive:true});
   const target=path.join(this.directory,'ledger.json'),temp=`${target}.${randomUUID()}.tmp`;
   await writeFile(temp,JSON.stringify(data),{flag:'wx'});await rename(temp,target);return result;});
  this.tail=work.catch(()=>{});return work;
 }
 session(data,sessionKey){return data.sessions[sessionKey]??(data.sessions[sessionKey]={mode:null,sessionId:null,turns:0,steps:0,tokens:0,blocked:0,updatedAt:0});}
 /** Contract set from the composer; sessionId pins it to the current conversation. */
 setContract(sessionKey,sessionId,mode){
  if(mode!==null&&!modeFor(mode))throw new Error('Chế độ chưa hợp lệ.');
  return this.transact(data=>{
   if(Object.keys(data.sessions).length>=MAX_SESSIONS&&!data.sessions[sessionKey])throw new Error('Sổ theo dõi đã đầy.');
   const row=this.session(data,sessionKey);row.mode=mode;row.sessionId=sessionId;row.updatedAt=Date.now();return this.view(sessionKey,row);
  });
 }
 async contract(sessionKey,sessionId){
  await this.tail;const row=(await this.load()).sessions[sessionKey];
  return row&&row.sessionId===sessionId?row.mode:null;
 }
 view(sessionKey,row){return {sessionKey,mode:row.mode,turns:row.turns,steps:row.steps,tokens:row.tokens,blocked:row.blocked,updatedAt:row.updatedAt};}
 async usage(sessionKey){
  await this.tail;const data=await this.load();
  const rows=Object.entries(data.sessions).filter(([key])=>!sessionKey||key===sessionKey).map(([key,row])=>this.view(key,row));
  const totals=rows.reduce((sum,row)=>({turns:sum.turns+row.turns,steps:sum.steps+row.steps,tokens:sum.tokens+row.tokens,blocked:sum.blocked+row.blocked}),{turns:0,steps:0,tokens:0,blocked:0});
  const byMode={};for(const row of rows){const key=row.mode??'mac-dinh';byMode[key]??={turns:0,tokens:0};byMode[key].turns+=row.turns;byMode[key].tokens+=row.tokens;}
  return {sessions:rows.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,200),totals,byMode};
 }
 /** In-memory per-run counters; a run is one user turn. */
 run(ctx){
  const id=ctx.runId??`${ctx.sessionKey}:${ctx.sessionId}`;
  let run=this.runs.get(id);
  if(!run){
   if(this.runs.size>=MAX_RUNS)this.runs.delete(this.runs.keys().next().value);
   run={sessionKey:ctx.sessionKey,sessionId:ctx.sessionId,agentId:ctx.agentId,mode:undefined,steps:0,tokens:0,calls:0,provider:null,model:null,thinking:null,blocked:0,startedAt:Date.now()};
   this.runs.set(id,run);
  }
  return run;
 }
 async modeOf(run){if(run.mode===undefined)run.mode=run.sessionKey?await this.contract(run.sessionKey,run.sessionId):null;return run.mode;}
 async recordOutput(ctx,event){
  if(!ctx.sessionKey)return;
  const run=this.run(ctx),usage=event.usage??{};
  run.calls++;run.provider=event.provider??run.provider;run.model=event.model??run.model;run.thinking=event.reasoningEffort??run.thinking;
  const total=Number.isFinite(usage.total)?usage.total:(usage.input??0)+(usage.output??0)+(usage.cacheRead??0)+(usage.cacheWrite??0);
  if(Number.isFinite(total)&&total>0)run.tokens+=total;
 }
 /** Returns a Vietnamese block reason when this call would exceed the contract, else null. */
 async gateTool(ctx,toolName){
  if(!ctx.sessionKey||toolName==='aifb_record_decision')return null;
  const run=this.run(ctx),mode=await this.modeOf(run),caps=capsFor(mode);
  run.steps++;
  if(!overCap(run,caps))return null;
  run.blocked++;
  return `${describeUsage(run,caps,mode)} Đã chạm trần của chế độ này nên công cụ "${toolName}" không được chạy. Dừng lại, tóm tắt việc đã làm và kết quả tới giờ bằng tiếng Việt, rồi hỏi anh chị có muốn nâng trần (chọn chế độ Kỹ hoặc Quyết định quan trọng) hay chốt tại đây.`;
 }
 /** Dynamic prompt tail: contract guidance plus the live budget line. */
 async promptTail(ctx){
  if(!ctx.sessionKey)return null;
  const run=this.run(ctx),mode=await this.modeOf(run),caps=capsFor(mode),spec=modeFor(mode);
  return [spec?.guidance,describeUsage(run,caps,mode)].filter(Boolean).join('\n');
 }
 async endRun(ctx,event){
  const id=ctx.runId??`${ctx.sessionKey}:${ctx.sessionId}`,run=this.runs.get(id);
  if(!run)return;this.runs.delete(id);if(!run.sessionKey)return;
  const mode=await this.modeOf(run);
  const line={ts:new Date().toISOString(),sessionKey:run.sessionKey,agentId:run.agentId,runId:ctx.runId??null,mode,provider:run.provider,model:run.model,thinking:run.thinking,
   calls:run.calls,steps:run.steps,tokens:run.tokens,blocked:run.blocked,success:event?.success!==false,durationMs:event?.durationMs??Date.now()-run.startedAt};
  await this.transact(async data=>{
   const row=this.session(data,run.sessionKey);row.turns++;row.steps+=run.steps;row.tokens+=run.tokens;row.blocked+=run.blocked;row.updatedAt=Date.now();
   await appendFile(path.join(this.directory,'trace.jsonl'),JSON.stringify(line)+'\n');
  });
 }
}
