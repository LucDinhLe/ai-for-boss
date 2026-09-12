import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Ledger} from './ledger.mjs';
import {MODE_IDS} from './contract.mjs';
import {parameters,recordDecision,recentDecisions} from './decisions.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const keyPattern=/^agent:([a-z0-9][a-z0-9_-]{0,63}):[^\s\0]{1,4000}$/u;
const stripFrontmatter=text=>text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/u,'').trim();
const bad=(respond,message)=>respond(false,undefined,{code:'INVALID_REQUEST',message});

/**
 * AI for Boss harness: task contract (three buttons), per-turn budget gate,
 * decision memory and a JSONL trace. Same shape as aifb-documents; owns no
 * model routing and never widens tool policy. The operating rules skill is the
 * single source of truth for the static system context injected here.
 */
export default {id:'aifb-harness',name:'AI for Boss Harness',register(api){
 if(!api.runtime?.state||!api.on)return;
 const ledger=new Ledger(path.join(api.runtime.state.resolveStateDir(),'aifb-harness'));
 let rules=null;
 const loadRules=async()=>rules??=stripFrontmatter(await readFile(path.join(here,'skills','quy-tac-dieu-hanh','SKILL.md'),'utf8')).slice(0,12000);
 const sessionOf=(params)=>{
  const agentId=keyPattern.exec(params.key)?.[1];
  const session=agentId&&api.runtime.agent.session.getSessionEntry({agentId,sessionKey:params.key});
  return session&&session.sessionId===params.sessionId?session:null;
 };
 api.registerGatewayMethod?.('aifb.harness.contract',async({params,respond})=>{
  try{
   if(Object.keys(params).some(k=>!['key','sessionId','mode'].includes(k))||typeof params.key!=='string'||typeof params.sessionId!=='string'
    ||params.mode!==undefined&&params.mode!==null&&!MODE_IDS.includes(params.mode))throw new Error('Invalid request');
   if(!sessionOf(params))throw new Error('Session changed');
   if(params.mode===undefined){const current=await ledger.contract(params.key,params.sessionId);return respond(true,{mode:current});}
   respond(true,await ledger.setContract(params.key,params.sessionId,params.mode));
  }catch{bad(respond,'Chưa đặt được chế độ cho phiên này.');}
 },{scope:'operator.admin'});
 api.registerGatewayMethod?.('aifb.harness.usage',async({params,respond})=>{
  try{
   if(Object.keys(params).some(k=>k!=='key')||params.key!==undefined&&(typeof params.key!=='string'||!keyPattern.test(params.key)))throw new Error('Invalid request');
   respond(true,await ledger.usage(params.key));
  }catch{bad(respond,'Chưa đọc được sổ sử dụng.');}
 },{scope:'operator.admin'});
 api.on('before_prompt_build',async(event,ctx)=>{
  const [staticRules,tail,decisions]=await Promise.all([loadRules().catch(()=>null),ledger.promptTail(ctx).catch(()=>null),
   ctx.workspaceDir?recentDecisions(ctx.workspaceDir).catch(()=>''):'']);
  const appendContext=[tail,decisions].filter(Boolean).join('\n\n');
  return {...(staticRules?{appendSystemContext:`# Quy tắc điều hành AI for Boss\n\n${staticRules}`}:{}),...(appendContext?{appendContext}:{})};
 });
 api.on('llm_output',(event,ctx)=>ledger.recordOutput(ctx,event));
 api.on('before_tool_call',async(event,ctx)=>{
  const reason=await ledger.gateTool(ctx,event.toolName).catch(()=>null);
  return reason?{block:true,blockReason:reason}:undefined;
 });
 api.on('agent_end',(event,ctx)=>ledger.endRun(ctx,event).catch(()=>{}));
 api.registerTool(ctx=>{
  if(!ctx.sessionKey||!ctx.workspaceDir||ctx.sandboxed)return null;
  return {name:'aifb_record_decision',label:'Ghi sổ quyết định',description:'Record a decision the user has just made (what was decided, why, rejected alternatives, who decided, outcome if known) into the workspace decision log QUYET-DINH.md. Call it only after the user explicitly confirms a choice; never for your own suggestions.',parameters,
   async execute(_id,input,signal){
    signal?.throwIfAborted();
    const session=api.runtime.agent.session.getSessionEntry({agentId:ctx.agentId,sessionKey:ctx.sessionKey});
    if(!session||session.sessionId!==ctx.sessionId||!['guarded','workspace','full'].includes(session.permissionMode))throw new Error('Recording a decision requires write permission for this session.');
    const root=await realpath(session.sessionRoot??ctx.workspaceDir);
    if(root!==await realpath(ctx.fsPolicy?.root??ctx.workspaceDir))throw new Error('Workspace boundary mismatch.');
    const entry=await recordDecision(root,input);
    return {content:[{type:'text',text:`Đã ghi vào sổ quyết định (QUYET-DINH.md): ${entry.decision}`}],details:{recordedAt:entry.ts}};
   }};
 },{names:['aifb_record_decision'],optional:true});
}};
