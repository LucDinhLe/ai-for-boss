import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {prepareHostPlugin,HOST_PLUGINS,hostPluginDirectory} from '../../apps/desktop/electron/host-plugin-setup.mjs';
import {MODES,MODE_IDS} from '../../packages/harness-plugin/contract.mjs';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('host plugin registry: two fixed plugins whose manifests match their declared tool contracts',async()=>{
 assert.deepEqual(HOST_PLUGINS.map(p=>p.id),['aifb-documents','aifb-harness']);
 for(const spec of HOST_PLUGINS){
  const manifest=JSON.parse(await read(`packages/${spec.folder==='document-tools'?'document-tools':'harness-plugin'}/openclaw.plugin.json`));
  assert.equal(manifest.id,spec.id);assert.deepEqual(manifest.contracts.tools,[...spec.tools]);
 }
 assert.equal(hostPluginDirectory('harness-plugin',{packaged:true,resourcesPath:'C:/app/resources',electronDirectory:'ignored'}),path.join('C:/app/resources','harness-plugin'));
 assert.equal(hostPluginDirectory('harness-plugin',{packaged:false,resourcesPath:'x',electronDirectory:'/repo/apps/desktop/electron'}),path.resolve('/repo/apps/desktop/electron','../resources','harness-plugin'));
});

test('harness registration replaces only its own family, grants the two hook permissions and restarts once',async()=>{
 const directory=path.resolve('packages/harness-plugin'),configPath=path.resolve('fixture/openclaw.json');
 const previous=path.join(path.dirname(path.dirname(path.dirname(directory))),'0.0.5-beta.36','resources','harness-plugin');
 let config={plugins:{load:{paths:['C:/other-plugin',previous]},entries:{other:{enabled:true}}}},restarts=0,patch;
 const spec=HOST_PLUGINS.find(p=>p.id==='aifb-harness');
 const options={...spec,directory,configPath,restart:async()=>{restarts++;},request:async(method,p)=>{
  if(method==='config.get')return {valid:true,hash:'rev',path:configPath,config};
  if(method==='config.patch'){patch=JSON.parse(p.raw);assert.deepEqual(p.replacePaths,['plugins.load.paths']);config={plugins:{...config.plugins,...patch.plugins,entries:{...config.plugins.entries,...patch.plugins.entries}}};return {};}
  if(method==='plugins.list')return {plugins:[{id:'aifb-harness',installed:true,enabled:true}]};
  throw new Error(method);
 }};
 await prepareHostPlugin(options);
 assert.equal(restarts,1);
 assert.equal(patch.plugins.load.paths.length,2,'the beta36 copy of the same family is replaced, the unrelated plugin kept');
 assert.equal(patch.plugins.load.paths[0],'C:/other-plugin');
 assert.deepEqual(patch.plugins.entries['aifb-harness'],{enabled:true,hooks:{allowConversationAccess:true,allowPromptInjection:true}});
 await prepareHostPlugin(options);assert.equal(restarts,1);
 await assert.rejects(prepareHostPlugin({...options,tools:['something_else']}),/không hợp lệ/);
});

test('shell wiring: plugins register on setup connect, the decision tool is in the host allowlist, harness methods go through the workspace broker only',async()=>{
 const main=await read('apps/desktop/electron/main.mjs');
 assert.match(main,/status\.phase === "connected"\) \{[^\n]*void prepareHostPlugins\(\)/);
 assert.match(main,/hostPluginPasses >= 2/,'a broken config can never restart-loop');
 assert.match(main,/action === 'harness-contract'/);assert.match(main,/action === 'harness-usage'/);
 assert.doesNotMatch(main,/prepareDocuments\(/,'the old per-plugin entry point is not called directly');
 const policy=await read('apps/desktop/electron/host-execution-policy.mjs');
 assert.match(policy,/'aifb_export_document', 'aifb_record_decision'/);
 const setup=await read('apps/desktop/electron/setup-channel.mjs');
 assert.match(setup,/'aifb\.harness\.contract', 'aifb\.harness\.usage'\]\.includes\(method\)/);
 assert.match(setup,/async assignAgentSkills\(agentId,skills\)/);
 assert.match(setup,/replacePaths:\['agents\.list'\]/);
 // Skill assignment is a fixed host call: never reachable as a generic renderer method.
 assert.doesNotMatch(setup,/'config\.patch'\]\.includes/);
});

test('renderer contract table mirrors the plugin table (ids, labels, hints, thinking preference)',async()=>{
 const source=await read('apps/desktop/src/task-contract.ts');
 for(const id of MODE_IDS){
  const mode=MODES[id];
  const thinking=mode.thinking.map(level=>`"${level}"`).join(', ');
  assert.ok(source.includes(`{ id: "${id}", label: "${mode.label}", hint: "${mode.hint}", thinking: [${thinking}] }`),id);
 }
 assert.doesNotMatch(source,/steps|tokens/,'caps live in the plugin only');
});

test('build pipeline stages and packages the harness plugin and role templates',async()=>{
 const pkg=JSON.parse(await read('package.json'));
 assert.match(pkg.scripts.build,/stage-harness-plugin\.mjs/);
 const packager=await read('scripts/package-desktop.mjs');
 assert.match(packager,/\['document-tools','harness-plugin','agent-templates'\]/);
 const workspace=await read('pnpm-workspace.yaml');
 assert.match(workspace,/"!packages\/harness-plugin"/);assert.match(workspace,/"!packages\/agent-templates"/);
 const harnessPkg=JSON.parse(await read('packages/harness-plugin/package.json'));
 assert.equal(harnessPkg.dependencies,undefined,'no third-party code rides in with the harness');
});
