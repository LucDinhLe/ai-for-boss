import {readFile,appendFile,open,realpath,mkdir} from 'node:fs/promises';
import path from 'node:path';

export const DECISION_LOG='QUYET-DINH.jsonl', DECISION_PAGE='QUYET-DINH.md', RECENT_LIMIT=10, RECENT_CHARS=2500;
const string={type:'string',minLength:1,maxLength:2000};
export const parameters={type:'object',additionalProperties:false,required:['decision'],properties:{
 decision:string,rationale:{type:'string',maxLength:2000},rejected:{type:'array',maxItems:10,items:string},
 decidedBy:{type:'string',maxLength:200},outcome:{type:'string',maxLength:2000}}};

const cell=value=>String(value??'').replace(/\r?\n/g,' ').replace(/\|/g,'\\|').trim();
const today=()=>new Date().toISOString().slice(0,10);
/** Markdown table people read, JSONL the plugin reads back. Both live in the agent workspace. */
export async function recordDecision(workspace,input){
 const root=await realpath(workspace);
 const entry={ts:new Date().toISOString(),decision:input.decision,rationale:input.rationale??'',rejected:input.rejected??[],decidedBy:input.decidedBy??'',outcome:input.outcome??''};
 await mkdir(root,{recursive:true});
 const page=path.join(root,DECISION_PAGE);
 try{const handle=await open(page,'wx');try{await handle.writeFile('# Sổ quyết định\n\nMỗi dòng là một điều anh chị đã chốt. Trợ lý đọc lại mười dòng gần nhất trước mỗi lượt.\n\n| Ngày | Quyết định | Căn cứ | Đã loại | Người chốt | Kết quả |\n| --- | --- | --- | --- | --- | --- |\n');}finally{await handle.close();}}
 catch(e){if(e.code!=='EEXIST')throw e;}
 await appendFile(page,`| ${today()} | ${cell(entry.decision)} | ${cell(entry.rationale)} | ${cell(entry.rejected.join('; '))} | ${cell(entry.decidedBy)} | ${cell(entry.outcome)} |\n`);
 await appendFile(path.join(root,DECISION_LOG),JSON.stringify(entry)+'\n');
 return entry;
}
/** Last N decisions as a compact Vietnamese block for the dynamic prompt tail; empty string when none. */
export async function recentDecisions(workspace){
 let raw;
 try{raw=await readFile(path.join(workspace,DECISION_LOG),'utf8');}catch(e){if(e.code==='ENOENT')return '';throw e;}
 const lines=raw.split('\n').filter(Boolean).slice(-RECENT_LIMIT).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(e=>e&&typeof e.decision==='string');
 if(!lines.length)return '';
 let text='Quyết định gần đây của người dùng (đọc, không hỏi lại những điều đã chốt):\n';
 for(const e of lines.reverse()){
  const row=`- ${String(e.ts).slice(0,10)}: ${e.decision}${e.rationale?` (vì ${e.rationale})`:''}${e.outcome?` → ${e.outcome}`:''}\n`;
  if(text.length+row.length>RECENT_CHARS)break;text+=row;
 }
 return text.trimEnd();
}
