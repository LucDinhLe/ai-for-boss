import {build} from '../packages/document-tools/node_modules/esbuild/lib/main.js';
import {mkdir,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'packages/document-tools');
const target=path.join(root,'apps/desktop/resources/document-tools');
await mkdir(target,{recursive:true});
await build({entryPoints:[path.join(source,'index.mjs')],outfile:path.join(target,'index.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',
 banner:{js:"import {createRequire as __aifbRequire} from 'node:module'; import {fileURLToPath as __aifbURL} from 'node:url'; import {dirname as __aifbDir} from 'node:path'; const require=__aifbRequire(import.meta.url); const __dirname=__aifbDir(__aifbURL(import.meta.url));"}});
for(const name of ['fonts','openclaw.plugin.json','README.md'])await cp(path.join(source,name),path.join(target,name),{recursive:true});
await cp(path.join(source,'node_modules/pdfkit/js/data'),path.join(target,'data'),{recursive:true});
const pkg=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));delete pkg.dependencies;delete pkg.devDependencies;
await writeFile(path.join(target,'package.json'),JSON.stringify(pkg,null,2)+'\n');
const notices=[];
async function licenses(directory) {
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const full=path.join(directory,entry.name);
  if(entry.isDirectory())await licenses(full);
  else if(entry.isFile()&&/^(license|licence|copying|notice)(\.|$)/i.test(entry.name))notices.push('\n--- '+path.relative(source,full)+' ---\n'+await readFile(full,'utf8'));
 }
}
await licenses(path.join(source,'node_modules'));
await writeFile(path.join(target,'THIRD-PARTY-NOTICES.txt'),notices.join('\n'));
console.log('Staged document plugin with bundled dependencies.');
