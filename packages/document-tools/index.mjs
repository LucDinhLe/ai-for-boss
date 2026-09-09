import {realpath,mkdtemp,open} from 'node:fs/promises';
import path from 'node:path';
import {renderDocument} from './render.mjs';
import {OwnedFiles} from './owned-files.mjs';
import {registerPlanningProfiles} from './planning-profiles.mjs';

const string={type:'string'};
export const parameters={type:'object',additionalProperties:false,required:['format','title'],properties:{
 format:{type:'string',enum:['docx','xlsx','pptx','pdf']},title:string,
 paragraphs:{type:'array',items:string},headers:{type:'array',items:string},
 rows:{type:'array',items:{type:'array',items:{anyOf:[{type:'number'},string]}}},sumLastColumn:{type:'boolean'},
 slides:{type:'array',items:{type:'object',additionalProperties:false,required:['title','bullets'],properties:{title:string,bullets:{type:'array',items:string}}}}
}};
export default {id:'aifb-documents',name:'AI for Boss Documents',register(api){
 registerPlanningProfiles(api);
 const files = api.runtime.state ? new OwnedFiles(path.join(api.runtime.state.resolveStateDir(),'aifb-document-receipts')) : null;
 api.registerGatewayMethod?.('aifb.documents.inspect', async ({params,respond}) => {
  try {
   if(Object.keys(params).some(k=>!['key','sessionId'].includes(k)) || typeof params.key!=='string' || typeof params.sessionId!=='string')throw new Error('Invalid request');
   const agentId=/^agent:([a-z0-9_-]+):/u.exec(params.key)?.[1];
   const session=agentId&&api.runtime.agent.session.getSessionEntry({agentId,sessionKey:params.key});
   if(!session||session.sessionId!==params.sessionId)throw new Error('Session changed');
   respond(true,{files:await files.inspect(params.key,params.sessionId)});
  }catch{respond(false,undefined,{code:'INVALID_REQUEST',message:'Không đọc được danh sách tệp thuộc phiên.'});}
 },{scope:'operator.admin'});
 api.registerTool(ctx=>{
  if(!ctx.sessionKey||!ctx.workspaceDir||ctx.sandboxed)return null;
  return {name:'aifb_export_document',label:'Xuất tài liệu',description:'Create and attach a new Word DOCX, Excel XLSX, PowerPoint PPTX or Unicode PDF using bundled libraries. Prefer this tool for ordinary document export; no Python, shell commands or dependency installation needed. Provide structured content, not code. sumLastColumn adds an Excel SUM formula. Output contains a MEDIA path to include in the final reply.',parameters,
   async execute(_id,input,signal){
    signal?.throwIfAborted();
    const check=async()=>{const session=api.runtime.agent.session.getSessionEntry({agentId:ctx.agentId,sessionKey:ctx.sessionKey});if(!session||session.sessionId!==ctx.sessionId||!['guarded','workspace','full'].includes(session.permissionMode))throw new Error('Document export requires write permission for this session.');const root=await realpath(session.sessionRoot??ctx.workspaceDir);if(root!==await realpath(ctx.fsPolicy?.root??ctx.workspaceDir))throw new Error('Workspace boundary mismatch.');return root;};
    const root=await check();const data=await renderDocument(input);signal?.throwIfAborted();if(data.length>25*1024*1024)throw new Error('Document exceeds 25 MB.');if(await check()!==root)throw new Error('Workspace changed.');
    const directory=await mkdtemp(path.join(root,'aifb-export-'));if(path.dirname(await realpath(directory))!==root)throw new Error('Export path escaped workspace.');
    const file=path.join(directory,`document.${input.format}`);const handle=await open(file,'wx');try{await handle.writeFile(data);}finally{await handle.close();}
    if(files)await files.record(ctx.sessionKey,ctx.sessionId,file,data);
    return {content:[{type:'text',text:`Created ${input.format.toUpperCase()} (${data.length} bytes). Include this attachment in your final reply:\nMEDIA:${file}`}],details:{format:input.format,bytes:data.length,path:file}};
   }};
 },{names:['aifb_export_document'],optional:true});
}};
