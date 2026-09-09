import { mkdir, readFile, writeFile, rename, realpath, lstat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** Receipts are created by the exporter, never reconstructed from model text. */
export class OwnedFiles {
 constructor(directory) { this.directory = directory; this.tail = Promise.resolve(); }
 async load() {
  try { const data = JSON.parse(await readFile(path.join(this.directory, 'files.json'), 'utf8'));
   if (!Array.isArray(data) || data.length > 10000) throw new Error('Invalid file receipts'); return data;
  } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
 }
 async save(rows) {
  await mkdir(this.directory, {recursive:true});
  const file = path.join(this.directory, 'files.json'), temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(rows), {flag:'wx'}); await rename(temp, file);
 }
 record(key, sessionId, file, bytes) {
  const run = this.tail.then(async () => { const rows = (await this.load()).filter(r=>!(r.file===file&&r.key===key&&r.sessionId===sessionId));
   if (rows.length >= 10000) throw new Error('File receipt limit reached');
   rows.push({id:randomUUID(), key, sessionId, file, hash:hash(bytes), bytes:bytes.length}); await this.save(rows);
  }); this.tail = run.catch(()=>{}); return run;
 }
 async inspect(key, sessionId) {
  await this.tail;
  const rows = await this.load(), result = [];
  for (const row of rows.filter(r => r.key === key && r.sessionId === sessionId)) {
   try {
    const stat = await lstat(row.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== row.bytes
      || stat.size > 25*1024*1024 || await realpath(row.file) !== row.file
      || rows.some(r => r.file === row.file && (r.key !== key || r.sessionId !== sessionId))
      || hash(await readFile(row.file)) !== row.hash) continue;
    result.push({...row, name:`${path.basename(path.dirname(row.file))}/${path.basename(row.file)}`});
   } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return result;
 }
}
