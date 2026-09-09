import {readFile,realpath} from 'node:fs/promises';
import path from 'node:path';

/** Fixed host-owned plugin; never accepts a renderer path or arbitrary plugin id. */
export async function prepareDocumentTools({directory,configPath,request,restart}) {
 const id='aifb-documents', root=await realpath(directory);
 const manifest=JSON.parse(await readFile(path.join(root,'openclaw.plugin.json'),'utf8'));
 if(manifest.id!==id||JSON.stringify(manifest.contracts?.tools)!=='["aifb_export_document"]')throw new Error('Bộ xuất tài liệu không hợp lệ.');
 const snapshot=await request('config.get',{});
 if(snapshot.valid!==true||!snapshot.hash||path.resolve(snapshot.path)!==path.resolve(configPath))throw new Error('Chưa xác nhận cấu hình ứng dụng.');
 const plugins=snapshot.config.plugins??{};
 if(plugins.enabled===false||plugins.deny?.includes(id))throw new Error('Bộ xuất tài liệu đang bị tắt trong chính sách plugin.');
 if(plugins.allow!==undefined&&(!Array.isArray(plugins.allow)||plugins.allow.some(p=>typeof p!=='string')))throw new Error('Danh sách plugin chưa hợp lệ.');
 const old=plugins.load?.paths??[];
 if(!Array.isArray(old)||old.some(p=>typeof p!=='string'))throw new Error('Đường dẫn plugin chưa hợp lệ.');
 const same=p=>path.resolve(p).toLowerCase()===root.toLowerCase();
 // Replace only a previous version in this same installation family.
 const family=p=>path.basename(p)==='document-tools'&&path.basename(path.dirname(p))==='resources'
  &&/^0\.0\.5-beta\.\d+$/.test(path.basename(path.dirname(path.dirname(p))))
  &&path.dirname(path.dirname(path.dirname(p))).toLowerCase()===path.dirname(path.dirname(path.dirname(root))).toLowerCase();
 const paths=[...old.filter(p=>!same(p)&&!family(p)),root];
 const allow=plugins.allow===undefined?undefined:[...new Set([...plugins.allow,id])];
 if(JSON.stringify(old)!==JSON.stringify(paths)||plugins.entries?.[id]?.enabled!==true||allow&&JSON.stringify(allow)!==JSON.stringify(plugins.allow)) {
  await request('config.patch',{baseHash:snapshot.hash,replacePaths:['plugins.load.paths',...(allow?['plugins.allow']:[])],raw:JSON.stringify({plugins:{load:{paths},...(allow?{allow}:{}),entries:{[id]:{enabled:true}}}})});
  await restart();
 }
 const rows=(await request('plugins.list',{})).plugins;
 if(!rows?.some(p=>p.id===id&&p.installed&&p.enabled))throw new Error('Chưa nạp được bộ xuất tài liệu.');
 return {ready:true};
}
