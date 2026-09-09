import {randomUUID} from 'node:crypto';
import {findSelectableModel} from './model-catalogue.mjs';
/** Owns only isolated no-tool native model runs. Never cancels a user session. */
export class OptimizerInference {
 constructor(getSetup){this.getSetup=getSetup;this.unresolved=null;}
 async infer(model,prompt,signal){
  const setup=this.getSetup();
  if(this.unresolved)throw new Error('Lượt thử trước chưa xác nhận dừng. Khởi động lại Gateway trước khi thử tiếp.');
  signal.throwIfAborted();
  const request=(method,params)=>setup.workspaceRequest(method,params);
  if(!await findSelectableModel(request,model))throw new Error('Model thử nghiệm chưa khả dụng.');
  const roster=await request('agents.list',{}),agentId=roster.defaultId;
  if(!roster.agents?.some(a=>a.id===agentId))throw new Error('Chưa có agent sẵn sàng.');
  const requestId=randomUUID(),pair={sessionKey:`agent:${agentId}:explicit:model-run-${requestId}`,runId:requestId};
  let terminal=false,aborting;
  const abort=()=>{aborting=setup.abortAdvisorModel(pair).then(result=>{if(result?.aborted===true)terminal=true;}).catch(()=>{});};
  signal.addEventListener('abort',abort,{once:true});
  try{
   signal.throwIfAborted();
   const result=await setup.runAdvisorModel({requestId,agentId,model,prompt,timeoutMs:120000,onAccepted:()=>{if(signal.aborted)abort();}});
   terminal=true;signal.throwIfAborted();
   const meta=result.result?.meta,parts=result.result?.payloads;
   if(result.status!=='ok'||!Array.isArray(parts)||parts.some(p=>typeof p.text!=='string'||p.isError)
    ||meta?.aborted||meta?.error||meta?.failureSignal||meta?.terminalToolFailure||meta?.yielded||meta?.continuationPending||meta?.pendingToolCalls?.length
    ||Number(meta?.toolSummary?.calls)>0||['error','aborted','length','timeout','tool_calls','toolUse'].includes(meta?.stopReason))throw new Error('Model chưa trả kết quả thử nghiệm đầy đủ.');
   const text=parts.map(p=>p.text).join('\n');if(text.length>64000)throw new Error('Kết quả thử nghiệm vượt giới hạn.');
   const usage=meta?.agentMeta?.usage;
   return {text,inputTokens:Number.isSafeInteger(usage?.input)?usage.input:null,outputTokens:Number.isSafeInteger(usage?.output)?usage.output:null};
  }finally{
   signal.removeEventListener('abort',abort);
   if(!terminal){abort();await aborting;if(!terminal)this.unresolved=pair;}
  }
 }
 stopped(){this.unresolved=null;}
}
