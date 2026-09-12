/**
 * Task contract: the three buttons a business owner presses instead of filling
 * four fields (task type, risk, autonomy, budget). Each button maps to a
 * thinking preference, a per-turn step cap and a per-turn token cap.
 *
 * Decision 12/09/2026: the button never switches the model or the account.
 * Learners keep using the subscription they already pay for, so budgets are
 * counted in steps and tokens, not dollars. Dollar figures only make sense on
 * API-key routes and are left to the usage page to derive later.
 */
export const MODES = Object.freeze({
 nhanh: Object.freeze({id:'nhanh',label:'Nhanh',hint:'Trả lời ngắn, ít bước, không tra cứu dài.',thinking:['low','minimal','off'],steps:8,tokens:60_000,
  guidance:'Chế độ Nhanh. Trả lời gọn trong một màn hình, tối đa vài bước công cụ, không mở rộng phạm vi. Nếu việc cần nhiều hơn thế, nói rõ và đề nghị chuyển sang chế độ Kỹ.'}),
 ky: Object.freeze({id:'ky',label:'Kỹ',hint:'Làm cẩn thận, được dùng nhiều bước và tra cứu.',thinking:['medium','low'],steps:30,tokens:300_000,
  guidance:'Chế độ Kỹ. Làm trọn vẹn, kiểm tra lại số liệu, trình bày một trang có cấu trúc. Hỏi trước khi làm việc tốn tiền hoặc gửi ra ngoài.'}),
 'quyet-dinh': Object.freeze({id:'quyet-dinh',label:'Quyết định quan trọng',hint:'Cân nhắc nhiều phương án, nêu rủi ro, ghi sổ quyết định.',thinking:['high','xhigh','medium'],steps:60,tokens:800_000,
  guidance:'Chế độ Quyết định quan trọng. Trình bày ít nhất hai phương án với điểm mạnh, điểm yếu và rủi ro của từng phương án, nêu phương án anh chị nên loại và vì sao, kết thúc bằng một câu hỏi chốt. Không tự chốt thay người dùng. Khi người dùng chốt, gọi aifb_record_decision.'})
});
/** Safety net when no button is pressed; generous, only stops runaway loops. */
export const DEFAULT_CAPS = Object.freeze({steps:100,tokens:1_500_000});
export const MODE_IDS = Object.freeze(Object.keys(MODES));
export function modeFor(id){return typeof id==='string'&&Object.hasOwn(MODES,id)?MODES[id]:null;}
export function capsFor(id){const mode=modeFor(id);return mode?{steps:mode.steps,tokens:mode.tokens}:{...DEFAULT_CAPS};}
/** Pick the thinking level a mode prefers from the levels the model actually offers. */
export function thinkingFor(id,levels){
 const mode=modeFor(id);if(!mode||!Array.isArray(levels))return null;
 const ids=levels.map(level=>typeof level==='string'?level:level?.id).filter(level=>typeof level==='string');
 return mode.thinking.find(level=>ids.includes(level))??null;
}
/** One Vietnamese sentence the model and the usage page both use. */
export function describeUsage(used,caps,mode){
 const name=modeFor(mode)?.label??'Mặc định';
 return `Chế độ ${name}: đã dùng ${used.steps}/${caps.steps} bước công cụ và ${Math.round(used.tokens/1000)}k/${Math.round(caps.tokens/1000)}k token trong lượt này.`;
}
export function overCap(used,caps){return used.steps>caps.steps||used.tokens>caps.tokens;}
