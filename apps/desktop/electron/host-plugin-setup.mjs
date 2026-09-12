import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';

/**
 * Host-owned plugins live under `<install>/<version>/resources/<folder>`; the
 * shell registers each with the core over the setup channel. Fixed ids and
 * fixed tool contracts only: this never accepts a renderer path or an arbitrary
 * plugin id, and it restarts the Gateway at most once per registration change.
 */
export async function prepareHostPlugin({id,folder,tools,label,directory,configPath,request,restart}) {
 const root=await realpath(directory);
 const manifest=JSON.parse(await readFile(path.join(root,'openclaw.plugin.json'),'utf8'));
 if(manifest.id!==id||JSON.stringify(manifest.contracts?.tools)!==JSON.stringify(tools))throw new Error(`${label} không hợp lệ.`);
 const snapshot=await request('config.get',{});
 if(snapshot.valid!==true||!snapshot.hash||path.resolve(snapshot.path)!==path.resolve(configPath))throw new Error('Chưa xác nhận cấu hình ứng dụng.');
 const plugins=snapshot.config.plugins??{};
 if(plugins.enabled===false||plugins.deny?.includes(id))throw new Error(`${label} đang bị tắt trong chính sách plugin.`);
 if(plugins.allow!==undefined&&(!Array.isArray(plugins.allow)||plugins.allow.some(p=>typeof p!=='string')))throw new Error('Danh sách plugin chưa hợp lệ.');
 const old=plugins.load?.paths??[];
 if(!Array.isArray(old)||old.some(p=>typeof p!=='string'))throw new Error('Đường dẫn plugin chưa hợp lệ.');
 const same=p=>path.resolve(p).toLowerCase()===root.toLowerCase();
 // Replace only a previous version in this same installation family.
 const family=p=>path.basename(p)===folder&&path.basename(path.dirname(p))==='resources'
  &&/^0\.0\.5-beta\.\d+$/.test(path.basename(path.dirname(path.dirname(p))))
  &&path.dirname(path.dirname(path.dirname(p))).toLowerCase()===path.dirname(path.dirname(path.dirname(root))).toLowerCase();
 const paths=[...old.filter(p=>!same(p)&&!family(p)),root];
 const allow=plugins.allow===undefined?undefined:[...new Set([...plugins.allow,id])];
 const hooks=plugins.entries?.[id]?.hooks??{};
 const grants={...(hooks.allowConversationAccess===undefined?{allowConversationAccess:true}:{}),...(hooks.allowPromptInjection===undefined?{allowPromptInjection:true}:{})};
 if(JSON.stringify(old)!==JSON.stringify(paths)||plugins.entries?.[id]?.enabled!==true||Object.keys(grants).length||allow&&JSON.stringify(allow)!==JSON.stringify(plugins.allow)) {
  await request('config.patch',{baseHash:snapshot.hash,replacePaths:['plugins.load.paths',...(allow?['plugins.allow']:[])],raw:JSON.stringify({plugins:{load:{paths},...(allow?{allow}:{}),entries:{[id]:{enabled:true,hooks:{...hooks,...grants}}}}})});
  await restart();
 }
 const rows=(await request('plugins.list',{})).plugins;
 if(!rows?.some(p=>p.id===id&&p.installed&&p.enabled))throw new Error(`Chưa nạp được ${label.toLowerCase()}.`);
 return {ready:true};
}

export const HOST_PLUGINS=Object.freeze([
 Object.freeze({id:'aifb-documents',folder:'document-tools',tools:Object.freeze(['aifb_export_document']),label:'Bộ xuất tài liệu'}),
 Object.freeze({id:'aifb-harness',folder:'harness-plugin',tools:Object.freeze(['aifb_record_decision']),label:'Bộ điều hành AI for Boss'})
]);

/** Resolve the packaged or development location of a host plugin folder. */
export function hostPluginDirectory(folder,{packaged,resourcesPath,electronDirectory}) {
 return packaged?path.join(resourcesPath,folder):path.resolve(electronDirectory,'../resources',folder);
}
