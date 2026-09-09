import {lstat,realpath,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function trashOwnedFiles(files, trash) {
 let failed=0;
 for(const file of files)try {
  const stat=await lstat(file.file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==file.bytes||stat.size>25*1024*1024
   ||await realpath(file.file)!==file.file||createHash('sha256').update(await readFile(file.file)).digest('hex')!==file.hash)throw new Error('Changed');
  await trash(file.file);
 }catch{failed++;}
 return {failed};
}
