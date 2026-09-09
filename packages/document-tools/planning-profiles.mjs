import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

// Model proposals select these bounded style variants, never arbitrary policy text.
import {profiles} from '../../apps/desktop/electron/planning-guidance.mjs';
export class PlanningProfiles {
 constructor(directory){this.directory=directory;this.tail=Promise.resolve();this.data=null;}
 async load(){if(this.data)return this.data;try{this.data=JSON.parse(await readFile(path.join(this.directory,'profiles.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;this.data={active:{},sessions:{}};}return this.data;}
 transact(fn){const work=this.tail.then(async()=>{const data=await this.load(),result=await fn(data);await mkdir(this.directory,{recursive:true});const target=path.join(this.directory,'profiles.json'),temp=`${target}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(data),{flag:'wx'});await rename(temp,target);return result;});this.tail=work.catch(()=>{});return work;}
 set(model,variant){return this.transact(data=>{const key=JSON.stringify([model.provider,model.id]);if(variant===null)delete data.active[key];else data.active[key]=variant;return {ok:true};});}
 async context(event,ctx){
  if(!ctx.sessionId||!ctx.sessionKey||ctx.sessionKey.includes(':explicit:model-run-')||!ctx.modelProviderId||!ctx.modelId)return;
  await this.tail;
  const current=await this.load(),modelKey=JSON.stringify([ctx.modelProviderId,ctx.modelId]),sessionKey=JSON.stringify([ctx.sessionId,modelKey]);
  if(Object.hasOwn(current.sessions,sessionKey)){const v=current.sessions[sessionKey];return Number.isInteger(v)&&profiles[v]?{appendSystemContext:profiles[v]}:undefined;}
  if(!Object.hasOwn(current.active,modelKey))return;
  return this.transact(data=>{
   const model=JSON.stringify([ctx.modelProviderId,ctx.modelId]),key=JSON.stringify([ctx.sessionId,model]);
   if(!Object.hasOwn(data.sessions,key)) {
    if(Object.keys(data.sessions).length>=10000)throw new Error('Planning profile session limit reached');
    // Never insert newly promoted guidance into already-running old conversations.
    data.sessions[key]=event.messages?.length>1?null:(data.active[model]??null);
   }
   const variant=data.sessions[key];
   return Number.isInteger(variant)&&profiles[variant]?{appendSystemContext:profiles[variant]}:undefined;
  });
 }
}
export function registerPlanningProfiles(api){
 if(!api.runtime.state||!api.registerGatewayMethod||!api.on)return;
 const store=new PlanningProfiles(path.join(api.runtime.state.resolveStateDir(),'aifb-planning-profiles'));
 api.registerGatewayMethod('aifb.profiles.set',async({params,respond})=>{try{
  if(Object.keys(params).some(k=>!['model','variant'].includes(k))||!params.model||Object.keys(params.model).some(k=>!['provider','id'].includes(k))
   ||![params.model.provider,params.model.id].every(s=>typeof s==='string'&&s.length>0&&s.length<=200)
   ||params.variant!==null&&(!Number.isInteger(params.variant)||!profiles[params.variant]))throw new Error('Invalid profile');
  respond(true,await store.set(params.model,params.variant));
 }catch{respond(false,undefined,{code:'INVALID_REQUEST',message:'Chưa lưu được hồ sơ kế hoạch.'});}},{scope:'operator.admin'});
 api.on('before_prompt_build',(event,ctx)=>store.context(event,ctx));
}
