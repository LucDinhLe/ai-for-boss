import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../packages/harness-plugin/skills');
const EXPECTED=['bien-ban-hop','de-xuat-bao-gia','ho-so-khach-tiem-nang','ke-hoach-chien-dich','ke-hoach-du-an','lich-noi-dung-tuan','muc-tieu-quy',
 'quy-tac-dieu-hanh','ra-soat-tuan','theo-doi-tien-do','theo-duoi-sau-gap','viet-bai-giu-giong'];
const SECTIONS=['## Khi nào dùng','## Hỏi trước khi làm','## Quy trình','## Tiêu chuẩn đầu ra','## Ba ca mẫu','## Nguồn'];

test('business skill pack: twelve ASCII-named skills with valid OpenClaw frontmatter',async()=>{
 const dirs=(await readdir(root,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
 assert.deepEqual(dirs,EXPECTED);
 for(const name of dirs){
  assert.match(name,/^[a-z0-9-]+$/,`${name} must stay ASCII for path safety`);
  const text=await readFile(path.join(root,name,'SKILL.md'),'utf8');
  const front=/^---\n([\s\S]*?)\n---\n/u.exec(text);
  assert.ok(front,`${name}: frontmatter`);
  assert.match(front[1],new RegExp(`^name: ${name}$`,'m'),`${name}: name matches folder`);
  const description=/^description: "(.+)"$/mu.exec(front[1]);
  assert.ok(description&&description[1].length<=200,`${name}: quoted description under 200 chars`);
  const metadata=/^metadata: (\{.*\})$/mu.exec(front[1]);
  assert.ok(metadata,`${name}: one-line metadata`);
  assert.equal(typeof JSON.parse(metadata[1]).openclaw.emoji,'string');
  assert.ok(text.length>=3000&&text.length<=12000,`${name}: ${text.length} chars`);
  // Every skill teaches the model to write the decision log; the meta skill is always eligible.
  assert.match(text,/aifb_record_decision/,`${name}: decision log`);
  // Luc's Vietnamese style rules, enforced mechanically.
  assert.doesNotMatch(text,/—/,`${name}: no em dash`);
  assert.doesNotMatch(text,/[Kk]hông phải[^.\n]{0,80} mà là/,`${name}: no "không phải... mà là"`);
 }
});

test('domain skills share the fixed three-part structure and three graded cases',async()=>{
 for(const name of EXPECTED.filter(n=>n!=='quy-tac-dieu-hanh')){
  const text=await readFile(path.join(root,name,'SKILL.md'),'utf8');
  for(const section of SECTIONS)assert.ok(text.includes(section),`${name}: ${section}`);
  assert.equal((text.match(/^### Ca [123]:/gmu)??[]).length,3,`${name}: three cases`);
  assert.equal((text.match(/^Tiêu chí chấm:/gmu)??[]).length,3,`${name}: rubric per case`);
  assert.match(text,/chưa có số/,`${name}: missing-number convention`);
  assert.match(text,/knowledge-work-plugins \(Apache 2\.0\)/,`${name}: source attribution`);
 }
});

test('operating rules skill is the static system context the plugin injects',async()=>{
 const text=await readFile(path.join(root,'quy-tac-dieu-hanh','SKILL.md'),'utf8');
 assert.match(text,/"always": true/);
 for(const rule of ['Hỏi trước khi làm việc tốn tiền','Không bịa số liệu','Làm trong trần đã chọn','Ghi sổ quyết định','Báo cáo tiếng Việt, một trang'])assert.ok(text.includes(rule),rule);
 const source=await readFile(path.resolve(root,'../index.mjs'),'utf8');
 assert.match(source,/skills','quy-tac-dieu-hanh','SKILL\.md'/);
 assert.match(source,/appendSystemContext/);
});
