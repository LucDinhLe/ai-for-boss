import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PromptOptimizer,validateOptimization} from '../../apps/desktop/electron/prompt-optimizer.mjs';
import {PlanningProfiles} from '../../packages/document-tools/planning-profiles.mjs';
const settings={enabled:true,daily:false,model:{provider:'fixture',id:'worker'},reviewer:{provider:'fixture',id:'reviewer'},maxCalls:20,cases:[
 {id:'train',task:'Create report',requirements:['Check totals'],holdout:false},{id:'test',task:'Inventory report',requirements:['Check stock'],holdout:true}]};
async function fixture(run,options={}){const directory=await mkdtemp(path.join(os.tmpdir(),'aifb-optimizer-test-'));try{
 const published=[],prompts=[];
 const optimizer=new PromptOptimizer({directory,publish:async(...args)=>{published.push(args);},infer:async(m,p)=>{
  prompts.push(p);
  if(p.startsWith('Select'))return {text:'{"variant":1}'};
  if(m.id==='reviewer')return {text:JSON.stringify({baselinePass:true,candidatePass:!options.reject,noRegression:true,reason:'Checks satisfy requirement'})};
  return {text:JSON.stringify({steps:[{text:'Check totals then export',requirements:options.missing?[]:[0]}]}),inputTokens:100,outputTokens:options.unknown?null:p.startsWith('For work')?100:50};
 }});await run(optimizer,published,prompts,directory);
 }finally{await rm(directory,{recursive:true,force:true});}}
test('separate train/holdout and independent model required',()=>{
 assert.throws(()=>validateOptimization({...settings,reviewer:settings.model}));
 assert.throws(()=>validateOptimization({...settings,cases:settings.cases.map(c=>({...c,holdout:false}))}));
});
test('only measured passing candidate is published; evidence and rollback persist',()=>fixture(async(o,p,prompts,directory)=>{
 await o.run({action:'optimizer-save',settings});await o.run({action:'optimizer-start'});await o.job.done;
 assert.equal(o.status().results[0].status,'promoted');assert.equal(p.at(-1)[1],1);
 assert.ok(!prompts[0].includes('Inventory report'));
 const reload=new PromptOptimizer({directory,infer:o.infer,publish:o.publish});await reload.load();assert.equal(reload.state.revisions.length,2);
 await reload.run({action:'optimizer-rollback',revision:reload.state.revisions[0].id});assert.equal(p.at(-1)[1],0);
}));
for(const options of [{reject:true},{unknown:true},{missing:true}])test(`no promotion with ${JSON.stringify(options)}`,()=>fixture(async(o,p)=>{
 await o.run({action:'optimizer-save',settings});await o.run({action:'optimizer-start'});await o.job.done;assert.equal(p.length,1);assert.notEqual(o.status().results[0].status,'promoted');
},options));
test('disabled has no inference; call ceiling stops batch',()=>fixture(async(o,p,prompts)=>{
 await o.run({action:'optimizer-save',settings:{...settings,enabled:false}});await o.tick();assert.equal(prompts.length,0);
 await o.run({action:'optimizer-save',settings:{...settings,maxCalls:9,cases:[...settings.cases,{...settings.cases[0],id:'extra'}]}});
 await o.run({action:'optimizer-start'});await o.job.done;assert.equal(prompts.length,9);assert.equal(o.state.results[0].status,'error');assert.equal(p.at(-1)[1],0);
}));
test('cancellation halts queued inference without promotion',()=>fixture(async(o,p)=>{
 o.infer=async(_m,_p,signal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));
 await o.run({action:'optimizer-save',settings});await o.run({action:'optimizer-start'});const done=o.job.done;await o.run({action:'optimizer-cancel'});await done;assert.equal(p.length,1);
}));
test('session profile freezes across promotions and restarts; old history unchanged',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'aifb-profiles-test-'));try{
  const store=new PlanningProfiles(directory),ctx={sessionId:'first',sessionKey:'agent:main:one',modelProviderId:'fixture',modelId:'worker'};
  await store.set(settings.model,0);const first=await store.context({messages:[]},ctx);await store.set(settings.model,1);
  assert.deepEqual(await new PlanningProfiles(directory).context({messages:[{},{}]},ctx),first);
  assert.notDeepEqual(await store.context({messages:[]},{...ctx,sessionId:'new'}),first);
  assert.equal(await store.context({messages:[{},{}]},{...ctx,sessionId:'legacy'}),undefined);
 }finally{await rm(directory,{recursive:true,force:true});}
});
