import {readFileSync,writeFileSync} from 'node:fs';

/**
 * Keeping the Gateway alive between window sessions (spec 0059).
 *
 * A cold start measured 84 seconds on Windows, almost all of it the core
 * loading its bundled plugins past Defender; a warm restart of the same core
 * took 4. So the fix for "opening takes minutes" is to stop killing the core
 * when the window closes: closing hides the window, the tray keeps the app
 * alive, and reopening reuses the running Gateway.
 *
 * Quitting for real still runs the full shutdown in main.mjs — this only
 * decides WHETHER a close is a quit, and never skips cleanup on the quit path.
 */
export const BACKGROUND_TOOLTIP='AI for Boss đang chạy nền';

/** A close hides the window only while background mode is on and no quit is under way. */
export function shouldHideOnClose({enabled,quitting}) {
 return enabled===true&&quitting!==true;
}

/** Tray menu as data so the wiring stays testable without Electron. */
export function trayMenuTemplate({backgroundEnabled,paused,windowVisible}) {
 return [
  {id:'show',label:windowVisible?'Hiện cửa sổ AI for Boss':'Mở AI for Boss',enabled:true},
  {type:'separator'},
  {id:'background',label:'Giữ chạy nền khi đóng cửa sổ',type:'checkbox',checked:backgroundEnabled===true,enabled:true},
  {id:'status',label:paused?'Bộ chạy đang tạm dừng':'Bộ chạy đang sẵn sàng',enabled:false},
  {type:'separator'},
  {id:'quit',label:'Thoát hẳn AI for Boss',enabled:true}
 ];
}

/** Remembered across runs; a corrupt or missing file means the default, on. */
export class BackgroundPreference {
 constructor({file,read=readFileSync,write=writeFileSync}={}) {
  Object.assign(this,{file,read,write});
  this.enabled=true;
  try {
   const stored=JSON.parse(this.read(this.file,'utf8'));
   if(typeof stored?.enabled==='boolean')this.enabled=stored.enabled;
  } catch { /* First run, or a file we will simply overwrite on the next change. */ }
 }
 set(enabled) {
  this.enabled=enabled===true;
  try { this.write(this.file,JSON.stringify({enabled:this.enabled})+'\n'); } catch { /* Preference only. */ }
  return this.enabled;
 }
}
