import {appendFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

/**
 * Measured startup, not guessed startup. Before this existed the only evidence
 * of a slow launch was the core's own log in the OS temp folder, so "opening
 * takes minutes" could not be attributed to a step. Each run appends ONE JSON
 * line: the ordered marks with elapsed milliseconds.
 *
 * Marks carry no paths, tokens or user content — only the fixed names below and
 * numbers — so the file is safe to send when reporting a slow start.
 */
export const STARTUP_PHASES=Object.freeze({
 'app-start':'Đang mở ứng dụng',
 'runtime-start':'Đang khởi động bộ chạy',
 'runtime-spawned':'Bộ chạy đang nạp bộ mở rộng',
 'chat-connected':'Đang mở cửa sổ trò chuyện',
 'setup-connected':'Đang chuẩn bị kết nối AI',
 'host-plugins-start':'Đang đăng ký bộ mở rộng của ứng dụng',
 'host-plugins-ready':'Bộ mở rộng đã sẵn sàng',
 'ready':'Sẵn sàng'
});
const KNOWN=Object.keys(STARTUP_PHASES);
const MAX_MARKS=40;

export class StartupTimeline {
 #marks=[];
 #flushed=false;
 constructor({file,now=()=>Date.now(),append=appendFile,onPhase=()=>{}}={}) {
  Object.assign(this,{file,now,append,onPhase});
  this.startedAt=now();
  this.mark('app-start');
 }
 /** Records a fixed phase name once; later duplicates and unknown names are ignored. */
 mark(name) {
  if(!KNOWN.includes(name)||this.#marks.some(entry=>entry.name===name)||this.#marks.length>=MAX_MARKS)return;
  this.#marks.push({name,ms:this.now()-this.startedAt});
  this.onPhase(name);
 }
 get phase() { return this.#marks.at(-1)?.name??'app-start'; }
 get label() { return STARTUP_PHASES[this.phase]; }
 get marks() { return this.#marks.map(entry=>({...entry})); }
 /** One line per app run, written when the app first becomes usable. */
 async flush(outcome='ready') {
  if(this.#flushed||!this.file)return null;
  this.#flushed=true;
  const line={at:new Date(this.startedAt).toISOString(),outcome,totalMs:this.now()-this.startedAt,marks:this.marks};
  try {
   await mkdir(path.dirname(this.file),{recursive:true});
   await this.append(this.file,JSON.stringify(line)+'\n');
  } catch { /* Timing evidence is best effort; never block startup on it. */ }
  return line;
 }
}
