import {existsSync,readFileSync,renameSync,writeFileSync} from 'node:fs';

/**
 * Removing plugin paths a previous version left behind (spec 0061).
 *
 * `plugins.load.paths` records where the shell's own plugins live, and each
 * entry carries the installed version folder. When an upgrade removes the older
 * version, that entry points at a folder that is gone, and the core rejects the
 * WHOLE config file as invalid rather than skipping the one path. The Gateway
 * then never starts — and the registration that would have rewritten the path
 * runs only after the Gateway is up, so the app can never repair itself.
 *
 * Measured on beta38: an upgrade from beta37 left both plugin paths pointing at
 * the deleted `versions\0.0.5-beta.37\resources\...`, and the app stayed on
 * "Ứng dụng chưa sẵn sàng" through every restart.
 *
 * So the host prunes before it spawns. A path that does not exist cannot load a
 * plugin under any circumstance; keeping it only guarantees the whole config is
 * refused. Everything else in the file is left exactly as it was.
 */
export function keptPaths(paths,exists) {
 if(!Array.isArray(paths))return null;
 const kept=paths.filter(entry=>typeof entry==='string'&&exists(entry));
 return kept.length===paths.length?null:kept;
}

/** Rewrites the config only when something was actually removed; never throws. */
export function repairPluginPaths(file,{read=readFileSync,write=writeFileSync,rename=renameSync,exists=existsSync}={}) {
 let config;
 try { config=JSON.parse(read(file,'utf8')); } catch { return {repaired:false,removed:[]}; }
 const paths=config?.plugins?.load?.paths;
 const kept=keptPaths(paths,exists);
 if(!kept)return {repaired:false,removed:[]};
 const removed=paths.filter(entry=>!kept.includes(entry));
 config.plugins.load.paths=kept;
 // Temp then rename: a half-written config would be worse than the stale one.
 const temp=`${file}.aifb-repair`;
 try { write(temp,JSON.stringify(config,null,2)+'\n'); rename(temp,file); }
 catch { return {repaired:false,removed}; }
 return {repaired:true,removed};
}
