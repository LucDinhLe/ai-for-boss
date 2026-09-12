import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadAgentTemplates,describeTemplates,suggestTemplate,PERMISSION_LEVELS,ENABLED_PERMISSIONS} from '../../apps/desktop/electron/agent-templates.mjs';
import {ProjectService} from '../../apps/desktop/electron/project-service.mjs';

const root=path.resolve('packages/agent-templates'), skillsRoot=path.resolve('packages/harness-plugin/skills');

test('four role templates load, name only bundled skills, never ask for a disabled permission',async()=>{
 const knownSkills=await readdir(skillsRoot);
 const templates=await loadAgentTemplates(root,{knownSkills});
 assert.deepEqual(templates.map(t=>t.id),['ban-hang','dieu-hanh','marketing-noi-dung','quan-ly-du-an']);
 for(const t of templates){
  assert.ok(t.skills.includes('quy-tac-dieu-hanh'),`${t.id} keeps the operating rules`);
  assert.ok(ENABLED_PERMISSIONS.includes(t.permission));
  for(const name of ['SOUL.md','IDENTITY.md','USER.md'])assert.match(t.files[name],/anh chị/,`${t.id}/${name} speaks to the user`);
  assert.doesNotMatch(t.files['SOUL.md'],/—/);
 }
 assert.deepEqual(PERMISSION_LEVELS.filter(l=>l.disabled).map(l=>l.id),['gui-ra-ngoai','giao-dich']);
 const shown=describeTemplates(templates);
 assert.equal(shown[0].permissionLabel,'Được đề xuất');
 assert.ok(shown.every(t=>!('files' in t)));
});

test('a template that names an unknown skill or a disabled permission is rejected',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'aifb-tpl-'));
 await cp(path.join(root,'dieu-hanh'),path.join(dir,'dieu-hanh'),{recursive:true});
 const manifest=JSON.parse(await readFile(path.join(dir,'dieu-hanh','template.json'),'utf8'));
 await writeFile(path.join(dir,'dieu-hanh','template.json'),JSON.stringify({...manifest,skills:[...manifest.skills,'khong-co']}));
 await assert.rejects(loadAgentTemplates(dir,{knownSkills:await readdir(skillsRoot)}),/không có trong gói/);
 await writeFile(path.join(dir,'dieu-hanh','template.json'),JSON.stringify({...manifest,permission:'giao-dich'}));
 await assert.rejects(loadAgentTemplates(dir),/mức quyền/);
 await mkdir(path.join(dir,'empty'));
 await writeFile(path.join(dir,'dieu-hanh','template.json'),JSON.stringify(manifest));
 await assert.rejects(loadAgentTemplates(dir),/ENOENT|no such file/);
});

test('two-question intake suggests by keywords and falls back to the executive assistant',async()=>{
 const templates=await loadAgentTemplates(root);
 assert.equal(suggestTemplate(templates,{work:'chủ tiệm spa',need:'theo khách sau khi báo giá, đừng quên ai'}),'ban-hang');
 assert.equal(suggestTemplate(templates,{work:'nhân viên marketing',need:'lịch bài viết facebook mỗi tuần'}),'marketing-noi-dung');
 assert.equal(suggestTemplate(templates,{work:'',need:'đưa dự án về đích đúng deadline, phân công rõ'}),'quan-ly-du-an');
 assert.equal(suggestTemplate(templates,{}),'dieu-hanh');
});

test('agent-create with a template writes three files, assigns the skill allowlist and reads everything back',async()=>{
 const templates=await loadAgentTemplates(root);
 const dir=await mkdtemp(path.join(os.tmpdir(),'aifb-projects-'));
 const files={};let assigned=null;
 const service=new ProjectService({directory:dir,templates:()=>templates,assignSkills:async(agentId,skills)=>{assigned={agentId,skills};return {skills:[...skills].sort()};},
  request:async(method,params)=>{
   if(method==='models.list')return {models:[{provider:'openai',id:'gpt-5',available:true}]};
   if(method==='agents.create')return {ok:true,agentId:'a1'};
   if(method==='agents.list')return {agents:[{id:'a1',identity:{emoji:'💼'}}]};
   if(method==='agents.files.set'){files[params.name]=params.content;return {ok:true};}
   if(method==='agents.files.get')return {file:{content:files[params.name]??''}};
   throw new Error(method);
  }});
 const result=await service.run({action:'agent-create',name:'Sales',role:'Bán khoá học',goal:'Không quên khách',model:'openai/gpt-5',template:'ban-hang'});
 assert.deepEqual(Object.keys(files).sort(),['IDENTITY.md','SOUL.md','USER.md']);
 assert.match(files['SOUL.md'],/^# Trợ lý bán hàng/);
 assert.match(files['SOUL.md'],/## Vai trò do người dùng cấu hình\nBán khoá học/);
 assert.equal(assigned.agentId,'a1');
 assert.deepEqual(assigned.skills,[...templates.find(t=>t.id==='ban-hang').skills]);
 assert.deepEqual(result,{id:'a1',name:'Sales',identity:{emoji:'💼'},template:'ban-hang',skills:assigned.skills,defaultMode:'ky'});
 await assert.rejects(service.run({action:'agent-create',name:'X',role:'r',goal:'g',model:'openai/gpt-5',template:'khong-co'}),/Mẫu agent/);
 const listed=await service.run({action:'agent-templates',work:'',need:'viết bài'});
 assert.equal(listed.suggested,'marketing-noi-dung');assert.equal(listed.templates.length,4);
 // Without a template the free-form path is unchanged: one SOUL.md append, no skill assignment.
 const before=JSON.stringify(assigned);
 await service.run({action:'agent-create',name:'Free',role:'r',goal:'g',model:'openai/gpt-5',emoji:'💼'});
 assert.equal(JSON.stringify(assigned),before);
});
