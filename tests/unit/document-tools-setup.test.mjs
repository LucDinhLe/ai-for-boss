import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {prepareDocumentTools} from '../../apps/desktop/electron/document-tools-setup.mjs';
test('document setup preserves other plugins, uses native revision and restarts only once',async()=>{
 const directory=path.resolve('packages/document-tools'),configPath=path.resolve('fixture/openclaw.json');
 let config={plugins:{allow:['other'],load:{paths:['C:/other-plugin']},entries:{other:{enabled:true}}}},restarts=0,patch;
 const options={directory,configPath,restart:async()=>{restarts++;},request:async(method,p)=>{
  if(method==='config.get')return {valid:true,hash:'revision',path:configPath,config};
  if(method==='config.patch'){assert.equal(p.baseHash,'revision');patch=JSON.parse(p.raw);config={plugins:{...config.plugins,...patch.plugins,entries:{...config.plugins.entries,...patch.plugins.entries}}};return {};}
  if(method==='plugins.list')return {plugins:[{id:'aifb-documents',installed:true,enabled:true}]};
  throw new Error(method);
 }};
 await prepareDocumentTools(options);assert.equal(restarts,1);
 assert.deepEqual(patch.plugins.allow,['other','aifb-documents']);assert.equal(patch.plugins.load.paths[0],'C:/other-plugin');assert.equal(config.plugins.entries.other.enabled,true);
 await prepareDocumentTools(options);assert.equal(restarts,1);
 config.plugins.enabled=false;await assert.rejects(prepareDocumentTools(options));assert.equal(restarts,1);
});
