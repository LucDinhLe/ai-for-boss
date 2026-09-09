import {useEffect,useState} from 'react';
import {manage} from './workbench-api';
type Model={id:string;provider:string;name?:string;available?:boolean;selectable?:boolean};
type Case={id:string;task:string;requirements:string[];holdout:boolean};
type Config={enabled:boolean;daily:boolean;model:Model;reviewer:Model;maxCalls:number;cases:Case[]};
type State={settings:Config|null;busy:boolean;calls:number;revisions:{id:string;model:Model;variant:number;at?:number}[];results:{id:string;status:string;message:string;calls:number;evidence?:unknown[]}[]};
const example:Case[]=[
 {id:'training',task:'Lập kế hoạch tạo báo cáo doanh thu từ CSV.',requirements:['Kiểm tra các cột và giá trị thiếu','Tính tổng doanh thu','Xuất bảng và kiểm tra kết quả'],holdout:false},
 {id:'holdout',task:'Lập kế hoạch tạo báo cáo tồn kho từ XLSX.',requirements:['Kiểm tra mã hàng trùng','Tính tồn đầu + nhập - xuất','Xuất báo cáo và đối chiếu tổng'],holdout:true}
];
export default function PromptOptimizerSettings({ready,models}:{ready:boolean;models:Model[]}){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const [enabled,setEnabled]=useState(false),[daily,setDaily]=useState(false),[worker,setWorker]=useState(''),[reviewer,setReviewer]=useState(''),[maxCalls,setMaxCalls]=useState(20),[cases,setCases]=useState(example);
 const choices=models.filter(m=>m.available===true&&m.selectable!==false),key=(m:Model)=>JSON.stringify([m.provider,m.id]);
 useEffect(()=>{let alive=true;
  const load=async(initial=false)=>{try{const value=await manage<State>({action:'optimizer-status'});if(!alive)return;setState(value);
   if(initial&&value.settings){const s=value.settings;setEnabled(s.enabled);setDaily(s.daily);setWorker(key(s.model));setReviewer(key(s.reviewer));setMaxCalls(s.maxCalls);setCases(s.cases);}
  }catch(e){if(alive)setError((e as Error).message);}};
  if(ready)void load(true);const timer=setInterval(()=>{if(ready)void load();},3000);
  return()=>{alive=false;clearInterval(timer);};
 },[ready]);
 const action=async(name:string,revision?:string)=>{setPending(true);setError('');try{
  let settings;
  if(name==='optimizer-save'){
   const w=choices.find(m=>key(m)===worker),r=choices.find(m=>key(m)===reviewer);
   if(!w||!r)throw new Error('Chọn model thực thi và model đánh giá đã kết nối.');
   settings={enabled,daily,model:{id:w.id,provider:w.provider},reviewer:{id:r.id,provider:r.provider},maxCalls,cases};
  }
  setState(await manage<State>({action:name,...settings?{settings}:{},...revision?{revision}:{}}));
 }catch(e){setError((e as Error).message);}finally{setPending(false);}};
 return <div className="settings-card"><h2>Tối ưu kế hoạch theo model</h2>
  <p>Thử các cách diễn đạt ngắn hơn trên bài mẫu, kiểm tra đủ yêu cầu và nhờ model khác phản biện. Chỉ áp dụng cho phiên mới khi mọi bài thử đạt chất lượng và dùng ít token hơn.</p>
  <p>Đây là đánh giá kế hoạch; chưa chứng minh tiết kiệm chi phí toàn tác vụ. Không thay đổi quyền công cụ, nội dung yêu cầu hoặc vai trò Advisor. Bài mẫu được gửi đến hai model đã chọn; không tự lấy lịch sử chat.</p>
  <fieldset disabled={!ready||pending||Boolean(state?.busy)} className="model-settings-fields">
   <label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Bật hồ sơ tối ưu cho phiên mới</label>
   <label>Model thực thi <select value={worker} onChange={e=>setWorker(e.target.value)}><option value="">Chọn model</option>{choices.map(m=><option key={key(m)} value={key(m)}>{m.provider} · {m.name||m.id}</option>)}</select></label>
   <label>Model đánh giá độc lập <select value={reviewer} onChange={e=>setReviewer(e.target.value)}><option value="">Chọn model khác</option>{choices.map(m=><option key={key(m)} value={key(m)}>{m.provider} · {m.name||m.id}</option>)}</select></label>
   <label>Giới hạn lượt gọi mỗi lần thử <input type="number" min={9} max={40} value={maxCalls} onChange={e=>setMaxCalls(Number(e.target.value))}/></label>
   <p>Mỗi bài được đo hai lần. Hai bài cần 13 lượt gọi để hoàn tất. Mỗi lượt chờ tối đa 2 phút. Giới hạn số lượt gọi không phải trần tiền; phí phụ thuộc model và nội dung. Hết giới hạn sẽ giữ cấu hình trước.</p>
   <label><input type="checkbox" checked={daily} onChange={e=>setDaily(e.target.checked)}/> Thử lại tối đa mỗi ngày khi ứng dụng đang mở (có dùng lượt gọi model)</label>
   <h3>Bài thử đại diện</h3>
   <p>Thay các ví dụ bằng công việc anh thường làm. Giữ ít nhất một bài đề xuất và một bài kiểm tra độc lập.</p>
   {cases.map((item,index)=><div key={item.id} style={{borderTop:'1px solid var(--hairline)',paddingTop:12,marginTop:12}}>
     <label>Công việc {index+1}<textarea rows={2} value={item.task} onChange={e=>setCases(cases.map((c,i)=>i===index?{...c,task:e.target.value}:c))}/></label>
     <label>Yêu cầu phải đạt — mỗi dòng một yêu cầu<textarea rows={3} value={item.requirements.join('\n')} onChange={e=>setCases(cases.map((c,i)=>i===index?{...c,requirements:e.target.value.split('\n')}:c))}/></label>
     <label><input type="checkbox" checked={item.holdout} onChange={e=>setCases(cases.map((c,i)=>i===index?{...c,holdout:e.target.checked}:c))}/> Dành riêng để kiểm tra, không đưa vào bước đề xuất</label>
     <button disabled={cases.length<=2} onClick={()=>setCases(cases.filter((_,i)=>i!==index))}>Bỏ bài này</button>
   </div>)}
   <button disabled={cases.length>=6} onClick={()=>setCases([...cases,{id:crypto.randomUUID(),task:'',requirements:[''],holdout:true}])}>Thêm bài thử</button>
   <button onClick={()=>void action('optimizer-save')}>Lưu cấu hình</button>
   <button disabled={!state?.settings?.enabled} onClick={()=>void action('optimizer-start')}>Chạy thử đã lưu</button>
  </fieldset>
  {state?.busy&&<p role="status">Đang đánh giá · {state.calls} lượt gọi <button disabled={pending} onClick={()=>void action('optimizer-cancel')}>Dừng tối ưu</button></p>}
  {error&&<p role="alert">{error}</p>}
  {state?.results.slice(0,5).map(r=><details key={r.id}><summary>{r.message} · {r.calls} lượt gọi</summary><pre style={{whiteSpace:'pre-wrap',maxHeight:300,overflow:'auto'}}>{JSON.stringify(r.evidence??[],null,2)}</pre></details>)}
  {!!state?.revisions.length&&<details><summary>Kho phiên bản / khôi phục</summary>{state.revisions.map(r=><p key={`${r.id}-${key(r.model)}`}>{r.model.id} · mẫu {r.variant} <button disabled={pending||state.busy} onClick={()=>void action('optimizer-rollback',r.id)}>Dùng lại</button></p>)}</details>}
 </div>;
}
