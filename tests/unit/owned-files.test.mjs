import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,realpath,rm,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {OwnedFiles} from '../../packages/document-tools/owned-files.mjs';
import {trashOwnedFiles} from '../../apps/desktop/electron/trash-owned-files.mjs';
test('persisted receipts exclude imports, changed and shared files; revalidate before recycle',async()=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'aifb-owned-test-')));
 try{
  const store=new OwnedFiles(path.join(root,'receipts')),file=path.join(root,'output.docx'),original=path.join(root,'import.docx');
  await writeFile(file,'doc');await writeFile(original,'import');await store.record('key','id',file,Buffer.from('doc'));
  const rows=await new OwnedFiles(store.directory).inspect('key','id');assert.equal(rows.length,1);
  await writeFile(file,'mod');assert.equal((await store.inspect('key','id')).length,0);
  const deleted=[];assert.deepEqual(await trashOwnedFiles(rows,f=>deleted.push(f)),{failed:1});assert.equal(deleted.length,0);
  await writeFile(file,'doc');assert.deepEqual(await trashOwnedFiles(rows,f=>deleted.push(f)),{failed:0});assert.equal(deleted[0],file);assert.equal(await readFile(original,'utf8'),'import');
  await store.record('other','id2',file,Buffer.from('doc'));assert.equal((await store.inspect('key','id')).length,0);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('symbolic links are never cleanup candidates',async t=>{
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),'aifb-link-test-')));try{
 const file=path.join(root,'output'),link=path.join(root,'link');await writeFile(file,'doc');
 try{await symlink(file,link);}catch(e){if(e.code==='EPERM'){t.skip('OS symlink privilege unavailable');return;}throw e;}
 const store=new OwnedFiles(path.join(root,'receipts'));await store.record('k','s',link,Buffer.from('doc'));assert.deepEqual(await store.inspect('k','s'),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
