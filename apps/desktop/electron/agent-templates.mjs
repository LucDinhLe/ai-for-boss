import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';

/**
 * Role templates (spec 0058) are data shipped with the app, never a renderer
 * input. Each template names skills from the bundled business pack, a default
 * task-contract mode and a permission level in business language. The six
 * levels below are the words the UI uses; the last two stay off in wave one and
 * no template can request them.
 */
export const PERMISSION_LEVELS=Object.freeze([
 Object.freeze({id:'doc',label:'Được đọc',detail:'Chỉ đọc tệp và trả lời, không sửa gì.'}),
 Object.freeze({id:'de-xuat',label:'Được đề xuất',detail:'Soạn bản nháp để anh chị duyệt, không tự ghi vào dự án.'}),
 Object.freeze({id:'sua-sau-duyet',label:'Được sửa sau khi duyệt',detail:'Mỗi lần ghi hay chạy lệnh đều hỏi trước.'}),
 Object.freeze({id:'tu-sua-trong-du-an',label:'Được tự sửa trong dự án',detail:'Tự ghi trong thư mục dự án; lệnh ngoài thư mục vẫn hỏi.'}),
 Object.freeze({id:'gui-ra-ngoai',label:'Được gửi ra ngoài',detail:'Tắt ở bản này.',disabled:true}),
 Object.freeze({id:'giao-dich',label:'Được giao dịch',detail:'Tắt ở bản này.',disabled:true})
]);
export const ENABLED_PERMISSIONS=Object.freeze(PERMISSION_LEVELS.filter(level=>!level.disabled).map(level=>level.id));
export const TEMPLATE_MODES=Object.freeze(['nhanh','ky','quyet-dinh']);
const FILES=Object.freeze(['SOUL.md','IDENTITY.md','USER.md']);
const idPattern=/^[a-z0-9][a-z0-9-]{0,63}$/u;
const skillPattern=/^[a-z0-9-]{1,64}$/u;

function validate(id,raw,files,knownSkills){
 const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max?value.trim():null;
 const fail=why=>{throw new Error(`Mẫu agent "${id}" chưa hợp lệ: ${why}.`);};
 if(raw.id!==id)fail('id khác tên thư mục');
 const label=text(raw.label,80)??fail('thiếu nhãn'),forWhom=text(raw.forWhom,300)??fail('thiếu dành cho ai');
 const role=text(raw.role,2000)??fail('thiếu vai trò'),goal=text(raw.goal,2000)??fail('thiếu mục tiêu'),emoji=text(raw.emoji,8)??fail('thiếu biểu tượng');
 if(!Array.isArray(raw.skills)||!raw.skills.length||raw.skills.length>40||raw.skills.some(s=>!skillPattern.test(s)))fail('danh sách kỹ năng');
 if(knownSkills&&raw.skills.some(s=>!knownSkills.includes(s)))fail('kỹ năng không có trong gói');
 if(!raw.skills.includes('quy-tac-dieu-hanh'))fail('thiếu quy tắc điều hành');
 if(!TEMPLATE_MODES.includes(raw.defaultMode))fail('chế độ mặc định');
 if(!ENABLED_PERMISSIONS.includes(raw.permission))fail('mức quyền không được bật');
 const keywords=Array.isArray(raw.keywords)?raw.keywords.filter(k=>typeof k==='string'&&k.length<=40).slice(0,20):[];
 for(const name of FILES)if(typeof files[name]!=='string'||!files[name].trim()||files[name].length>20000)fail(`tệp ${name}`);
 return Object.freeze({id,label,forWhom,role,goal,emoji,skills:Object.freeze([...new Set(raw.skills)]),defaultMode:raw.defaultMode,permission:raw.permission,keywords:Object.freeze(keywords),files:Object.freeze({...files})});
}

/** Load every template folder; a malformed template fails loudly instead of shipping half a role. */
export async function loadAgentTemplates(directory,{knownSkills=null}={}){
 const entries=(await readdir(directory,{withFileTypes:true})).filter(e=>e.isDirectory()&&idPattern.test(e.name)).map(e=>e.name).sort();
 if(!entries.length)throw new Error('Chưa có mẫu agent nào.');
 const templates=[];
 for(const id of entries){
  const root=path.join(directory,id);
  const raw=JSON.parse(await readFile(path.join(root,'template.json'),'utf8'));
  const files={};for(const name of FILES)files[name]=await readFile(path.join(root,name),'utf8');
  templates.push(validate(id,raw,files,knownSkills));
 }
 return Object.freeze(templates);
}

/** Public projection for the renderer: no file bodies, nothing executable. */
export function describeTemplates(templates){
 return templates.map(({id,label,forWhom,role,goal,emoji,skills,defaultMode,permission})=>({id,label,forWhom,role,goal,emoji,skills:[...skills],defaultMode,
  permission,permissionLabel:PERMISSION_LEVELS.find(level=>level.id===permission)?.label??permission}));
}

/**
 * Two-question intake ("anh chị làm gì", "muốn trợ lý lo việc gì") scored by
 * keyword overlap. Ties and empty answers fall back to the executive assistant,
 * the one role every audience can start with. Rules only, no model call.
 */
export function suggestTemplate(templates,answers){
 const haystack=[answers?.work,answers?.need].filter(v=>typeof v==='string').join(' ').toLowerCase();
 let best=null,bestScore=0;
 for(const template of templates){
  const score=template.keywords.reduce((sum,keyword)=>sum+(haystack.includes(keyword.toLowerCase())?1:0),0);
  if(score>bestScore){best=template;bestScore=score;}
 }
 return (best??templates.find(t=>t.id==='dieu-hanh')??templates[0]).id;
}
