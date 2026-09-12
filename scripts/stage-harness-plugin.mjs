/**
 * Stage the dependency-free harness plugin and the role templates next to the
 * document plugin under apps/desktop/resources. Plain copies: no bundler, no
 * node_modules, so the payload manifest sees exactly the files in git.
 */
import {cp,mkdir,rm,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const jobs=[['packages/harness-plugin','apps/desktop/resources/harness-plugin'],['packages/agent-templates','apps/desktop/resources/agent-templates']];
async function count(directory){let n=0;for(const entry of await readdir(directory,{withFileTypes:true})){n+=entry.isDirectory()?await count(path.join(directory,entry.name)):1;}return n;}
for(const [from,to] of jobs){
 const source=path.join(root,from),target=path.join(root,to);
 await stat(path.join(source,from.endsWith('harness-plugin')?'openclaw.plugin.json':'README.md'));
 await rm(target,{recursive:true,force:true});await mkdir(path.dirname(target),{recursive:true});
 await cp(source,target,{recursive:true,filter:src=>!/(^|[\\/])(node_modules|\.git)([\\/]|$)/u.test(src)});
 console.log(`Staged ${from} → ${to} (${await count(target)} files).`);
}
