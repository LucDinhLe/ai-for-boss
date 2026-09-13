import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';

export const HOST_PLUGINS=Object.freeze([
 Object.freeze({id:'aifb-documents',folder:'document-tools',tools:Object.freeze(['aifb_export_document']),label:'Bộ xuất tài liệu'}),
 Object.freeze({id:'aifb-harness',folder:'harness-plugin',tools:Object.freeze(['aifb_record_decision']),label:'Bộ điều hành AI for Boss'})
]);

/** Resolve the packaged or development location of a host plugin folder. */
export function hostPluginDirectory(folder,{packaged,resourcesPath,electronDirectory}) {
 return packaged?path.join(resourcesPath,folder):path.resolve(electronDirectory,'../resources',folder);
}

/**
 * Register every host-owned plugin in ONE config patch and AT MOST ONE Gateway
 * restart. Measured on beta37's first run, registering the two plugins one at a
 * time cost two restarts and 56 seconds before the app was usable (spec 0059).
 *
 * Fixed ids and fixed tool contracts only: this never accepts a renderer path
 * or an arbitrary plugin id, and a plugin whose manifest does not match its
 * declared contract fails the whole registration instead of loading.
 */
export async function prepareHostPlugins(entries,{configPath,request,restart}) {
 const resolved=[];
 for(const entry of entries) {
  const root=await realpath(entry.directory);
  const manifest=JSON.parse(await readFile(path.join(root,'openclaw.plugin.json'),'utf8'));
  if(manifest.id!==entry.id||JSON.stringify(manifest.contracts?.tools)!==JSON.stringify([...entry.tools]))throw new Error(`${entry.label} không hợp lệ.`);
  resolved.push({...entry,root});
 }
 if(!resolved.length)return {ready:true,registered:[]};
 const snapshot=await request('config.get',{});
 if(snapshot.valid!==true||!snapshot.hash||path.resolve(snapshot.path)!==path.resolve(configPath))throw new Error('Chưa xác nhận cấu hình ứng dụng.');
 const plugins=snapshot.config.plugins??{};
 if(plugins.enabled===false)throw new Error('Plugin của ứng dụng đang bị tắt trong chính sách plugin.');
 for(const item of resolved)if(plugins.deny?.includes(item.id))throw new Error(`${item.label} đang bị tắt trong chính sách plugin.`);
 if(plugins.allow!==undefined&&(!Array.isArray(plugins.allow)||plugins.allow.some(p=>typeof p!=='string')))throw new Error('Danh sách plugin chưa hợp lệ.');
 const old=plugins.load?.paths??[];
 if(!Array.isArray(old)||old.some(p=>typeof p!=='string'))throw new Error('Đường dẫn plugin chưa hợp lệ.');
 const same=(p,root)=>path.resolve(p).toLowerCase()===root.toLowerCase();
 // Replace only a previous version in this same installation family.
 const family=(p,item)=>path.basename(p)===item.folder&&path.basename(path.dirname(p))==='resources'
  &&/^0\.0\.5-beta\.\d+$/.test(path.basename(path.dirname(path.dirname(p))))
  &&path.dirname(path.dirname(path.dirname(p))).toLowerCase()===path.dirname(path.dirname(path.dirname(item.root))).toLowerCase();
 const paths=[...old.filter(p=>!resolved.some(item=>same(p,item.root)||family(p,item))),...resolved.map(item=>item.root)];
 const allow=plugins.allow===undefined?undefined:[...new Set([...plugins.allow,...resolved.map(item=>item.id)])];
 const patchEntries={};
 let grantsAdded=false,enableNeeded=false;
 for(const item of resolved) {
  const hooks=plugins.entries?.[item.id]?.hooks??{};
  const grants={...(hooks.allowConversationAccess===undefined?{allowConversationAccess:true}:{}),...(hooks.allowPromptInjection===undefined?{allowPromptInjection:true}:{})};
  if(Object.keys(grants).length)grantsAdded=true;
  if(plugins.entries?.[item.id]?.enabled!==true)enableNeeded=true;
  patchEntries[item.id]={enabled:true,hooks:{...hooks,...grants}};
 }
 if(JSON.stringify(old)!==JSON.stringify(paths)||enableNeeded||grantsAdded||allow&&JSON.stringify(allow)!==JSON.stringify(plugins.allow)) {
  await request('config.patch',{baseHash:snapshot.hash,replacePaths:['plugins.load.paths',...(allow?['plugins.allow']:[])],
   raw:JSON.stringify({plugins:{load:{paths},...(allow?{allow}:{}),entries:patchEntries}})});
  await restart();
 }
 const rows=(await request('plugins.list',{})).plugins;
 for(const item of resolved)if(!rows?.some(p=>p.id===item.id&&p.installed&&p.enabled))throw new Error(`Chưa nạp được ${item.label.toLowerCase()}.`);
 return {ready:true,registered:resolved.map(item=>item.id)};
}

/** Single-plugin entry point kept for the document-export fixture and its tests. */
export function prepareHostPlugin({directory,configPath,request,restart,...spec}) {
 return prepareHostPlugins([{...spec,directory}],{configPath,request,restart});
}
