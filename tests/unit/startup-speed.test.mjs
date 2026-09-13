import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {prepareHostPlugins,HOST_PLUGINS} from '../../apps/desktop/electron/host-plugin-setup.mjs';
import {StartupTimeline,STARTUP_PHASES} from '../../apps/desktop/electron/startup-timeline.mjs';
import {BackgroundPreference,shouldHideOnClose,trayMenuTemplate} from '../../apps/desktop/electron/background-mode.mjs';
import {startupStepDetail,STARTUP_STEP_LABELS} from '../../apps/desktop/src/workspace-ui.ts';

const read=file=>readFile(new URL(`../../${file}`,import.meta.url),'utf8');

test('both host plugins register in one config patch and at most one restart',async()=>{
 const entries=HOST_PLUGINS.map(spec=>({...spec,directory:path.resolve('packages',spec.folder==='document-tools'?'document-tools':'harness-plugin')}));
 const configPath=path.resolve('fixture/openclaw.json');
 let config={plugins:{load:{paths:['C:/other-plugin']},entries:{other:{enabled:true}}}},restarts=0,patches=0,patch;
 const options={configPath,restart:async()=>{restarts++;},request:async(method,p)=>{
  if(method==='config.get')return {valid:true,hash:'rev',path:configPath,config};
  if(method==='config.patch'){patches++;patch=JSON.parse(p.raw);config={plugins:{...config.plugins,...patch.plugins,entries:{...config.plugins.entries,...patch.plugins.entries}}};return {};}
  if(method==='plugins.list')return {plugins:HOST_PLUGINS.map(spec=>({id:spec.id,installed:true,enabled:true}))};
  throw new Error(method);
 }};
 const result=await prepareHostPlugins(entries,options);
 assert.deepEqual(result.registered,['aifb-documents','aifb-harness']);
 assert.equal(patches,1,'one patch for both plugins');
 assert.equal(restarts,1,'one Gateway restart, not one per plugin');
 assert.deepEqual(Object.keys(patch.plugins.entries).sort(),['aifb-documents','aifb-harness']);
 for(const id of ['aifb-documents','aifb-harness'])
  assert.deepEqual(patch.plugins.entries[id],{enabled:true,hooks:{allowConversationAccess:true,allowPromptInjection:true}});
 assert.equal(patch.plugins.load.paths[0],'C:/other-plugin','unrelated plugins are kept');
 assert.equal(patch.plugins.load.paths.length,3);
 // Second pass is a no-op: no patch, no restart.
 await prepareHostPlugins(entries,options);
 assert.equal(patches,1);assert.equal(restarts,1);
 // A plugin the core did not load fails loudly instead of pretending to be ready.
 await assert.rejects(prepareHostPlugins(entries,{...options,request:async(method,p)=>method==='plugins.list'
  ?{plugins:[{id:'aifb-documents',installed:true,enabled:true}]}:options.request(method,p)}),/Chưa nạp được/);
});

test('startup timeline records ordered phases once and writes one line per run',async()=>{
 let clock=1000; const lines=[];
 const timeline=new StartupTimeline({file:'/tmp/aifb-timeline.jsonl',now:()=>clock,append:async(file,text)=>{lines.push(text);}});
 assert.equal(timeline.phase,'app-start');
 clock=1500; timeline.mark('runtime-start');
 clock=85000; timeline.mark('runtime-spawned');
 timeline.mark('runtime-spawned');
 timeline.mark('khong-co-thuc');
 clock=86000; timeline.mark('ready');
 assert.deepEqual(timeline.marks.map(entry=>entry.name),['app-start','runtime-start','runtime-spawned','ready']);
 assert.equal(timeline.marks[2].ms,84000);
 assert.equal(timeline.label,STARTUP_PHASES.ready);
 const written=await timeline.flush('ready');
 assert.equal(written.totalMs,85000);
 assert.equal(lines.length,1);
 assert.deepEqual(JSON.parse(lines[0]).marks.at(-1),{name:'ready',ms:85000});
 await timeline.flush('ready');
 assert.equal(lines.length,1,'one line per run');
 // Never records a path, token or message: names come from the fixed table only.
 for(const entry of JSON.parse(lines[0]).marks)assert.ok(Object.hasOwn(STARTUP_PHASES,entry.name));
});

test('the waiting screen names the step the host is on',()=>{
 assert.match(startupStepDetail('runtime-spawned'),/^Bộ chạy đang nạp bộ mở rộng\./);
 assert.match(startupStepDetail(undefined),/Lần đầu có thể mất vài phút/);
 assert.match(startupStepDetail('khong-co-thuc'),/Lần đầu có thể mất vài phút/);
 // Renderer labels and host phases are the same set, so no step shows as unknown.
 assert.deepEqual(Object.keys(STARTUP_STEP_LABELS).sort(),Object.keys(STARTUP_PHASES).sort());
});

test('background mode: closing hides while enabled, a quit always shuts down',()=>{
 assert.equal(shouldHideOnClose({enabled:true,quitting:false}),true);
 assert.equal(shouldHideOnClose({enabled:true,quitting:true}),false,'the tray quit must reach the real shutdown');
 assert.equal(shouldHideOnClose({enabled:false,quitting:false}),false);
 const menu=trayMenuTemplate({backgroundEnabled:true,paused:false,windowVisible:false});
 assert.deepEqual(menu.filter(item=>item.id).map(item=>item.id),['show','background','status','quit']);
 assert.equal(menu.find(item=>item.id==='background').checked,true);
 assert.match(menu.find(item=>item.id==='quit').label,/Thoát hẳn/);
 assert.match(trayMenuTemplate({backgroundEnabled:false,paused:true,windowVisible:true}).find(item=>item.id==='status').label,/tạm dừng/);
 // The preference survives a corrupt file by defaulting to on.
 const stored=[];
 const preference=new BackgroundPreference({file:'/tmp/aifb-background.json',read:()=>'{ broken',write:(file,text)=>stored.push(text)});
 assert.equal(preference.enabled,true);
 assert.equal(preference.set(false),false);
 assert.deepEqual(JSON.parse(stored[0]),{enabled:false});
});

test('shell wiring for spec 0059: one registration call, tray-aware quit, shared model reads',async()=>{
 const main=await read('apps/desktop/electron/main.mjs');
 assert.match(main,/setupChannel\.prepareHostPlugins\(present,/,'registers every plugin in one call');
 assert.doesNotMatch(main,/for \(const spec of HOST_PLUGINS\) \{\s*\n\s*if \(shuttingDown/,'no per-plugin restart loop');
 assert.match(main,/shouldHideOnClose\(\{ enabled: backgroundEnabled\(\), quitting \}\)/);
 assert.match(main,/app\.on\("window-all-closed"[\s\S]{0,400}?backgroundEnabled\(\) && !quitting\) return;/,'a hidden window must not quit the app');
 assert.match(main,/app\.on\("before-quit"[\s\S]{0,200}?quitting = true;/,'a real quit still runs the full cleanup');
 assert.match(main,/\(\) => \{ tray\?\.destroy\(\); tray = null; \}/);
 const setup=await read('apps/desktop/electron/setup-channel.mjs');
 assert.match(setup,/if \(method !== 'models\.list'\) return client\.request/,'only the pure read is shared');
 assert.match(setup,/this\.#reads\.clear\(\);/,'a reconnect drops shared reads');
});
