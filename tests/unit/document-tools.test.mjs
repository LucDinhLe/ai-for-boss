import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,realpath,readFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import plugin from '../../packages/document-tools/index.mjs';
import {renderDocument} from '../../packages/document-tools/render.mjs';
const require=createRequire(new URL('../../packages/document-tools/package.json',import.meta.url));
const JSZip=require('jszip'), ExcelJS=require('exceljs');
const input={title:'Báo cáo doanh thu',paragraphs:['Tổng doanh thu: 370 triệu đồng.'],headers:['Tháng','Doanh thu'],rows:[['Một',100],['Hai',120],['Ba',150]],sumLastColumn:true};
test('Office packages contain readable Vietnamese and an actual Excel formula',async()=>{
 const doc=await JSZip.loadAsync(await renderDocument({...input,format:'docx'}));
 assert.match(await doc.file('word/document.xml').async('string'),/Báo cáo doanh thu/);
 const book=new ExcelJS.Workbook();await book.xlsx.load(await renderDocument({...input,format:'xlsx'}));
 assert.deepEqual(book.worksheets[0].getCell('B5').value,{formula:'SUM(B2:B4)',result:370});
 const ppt=await JSZip.loadAsync(await renderDocument({...input,format:'pptx',slides:[1,2,3].map(n=>({title:'Tháng '+n,bullets:['Doanh thu tăng']}))}));
 assert.equal(Object.keys(ppt.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,3);
 const pdf=await renderDocument({...input,format:'pdf'});
 assert.equal(pdf.subarray(0,4).toString(),'%PDF');assert.match(pdf.toString('latin1'),/\/ToUnicode/);
});
test('tool rejects read-only, changed identity and cancellation before writing; creates unique files',async()=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'aifb-doc-test-')));
 try {
  let session={sessionId:'one',permissionMode:'workspace',sessionRoot:root},factory;
  plugin.register({registerTool:f=>{factory=f;},runtime:{agent:{session:{getSessionEntry:()=>session}}}});
  const tool=factory({agentId:'fixture',sessionKey:'agent:fixture:test',sessionId:'one',workspaceDir:root,fsPolicy:{root}});
  session.permissionMode='read-only';await assert.rejects(tool.execute('x',{...input,format:'docx'}));assert.deepEqual(await readdir(root),[]);
  session={...session,permissionMode:'workspace',sessionId:'other'};await assert.rejects(tool.execute('x',{...input,format:'docx'}));
  session.sessionId='one';const controller=new globalThis.AbortController();controller.abort();await assert.rejects(tool.execute('x',{...input,format:'docx'},controller.signal));
  const first=await tool.execute('x',{...input,format:'docx'}),second=await tool.execute('x',{...input,format:'docx'});
  assert.notEqual(first.details.path,second.details.path);assert.ok((await readFile(first.details.path)).length>1000);
  assert.equal(factory({sessionKey:'x',workspaceDir:root,sandboxed:true}),null);
 }finally{await rm(root,{recursive:true});}
});
test('format and size limits reject non-document payloads',async()=>{
 for(const bad of [{format:'exe'}, {title:'x'.repeat(201)}, {rows:[[{formula:'evil'}]]}, {paragraphs:Array(101).fill('x')}])await assert.rejects(renderDocument({...input,format:'docx',...bad}));
});
