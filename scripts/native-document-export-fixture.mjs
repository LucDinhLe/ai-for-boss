/** Real isolated Gateway and host exec; generated loopback model, no account. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID } from './native-chat-fixture.mjs';
const self = fileURLToPath(import.meta.url), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function worker(root, resources, prepare) {
  assert.equal(process.env.OPENCLAW_HOME, root);
  const native = fixtureRuntime(resources), { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor } = await import('../apps/desktop/electron/supervisor.mjs');
  const { SetupChannel } = await import('../apps/desktop/electron/setup-channel.mjs');
  const { waitForGatewayListener } = await import('../apps/desktop/electron/startup-listener.mjs');
  let client, requests = 0, child, token = ''; const toolResults = [], advertised = new Set();
  const logs = [], remember = value => { logs.push(String(value)); if (logs.length > 12) logs.shift(); };
  const key = 'agent:fixture:aifb-document-export'; let format='docx';
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw); requests++;
    if (requests > 30) { response.writeHead(429); response.end(); return; }
    for (const tool of body.tools ?? []) advertised.add(tool.function?.name);
    const lastUser = body.messages.findLastIndex(item => item.role === 'user');
    const peerTask = JSON.stringify(body.messages[lastUser]?.content).includes('PEER_FIXTURE_TASK');
    const done = peerTask || body.messages.slice(lastUser + 1).some(item => item.role === 'tool');
    if (done && body.messages.slice(lastUser + 1).some(item => item.role === 'tool')) toolResults.push(body.messages.slice(lastUser + 1).filter(item => item.role === 'tool'));
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const delta = done ? { content: 'Fixture completed.\n'+(body.messages.slice(lastUser+1).find(m=>m.role==='tool')?.content?.match(/MEDIA:[^\n]+/)?.[0]??'') } : { tool_calls: [{ index: 0, id: 'call-' + randomUUID(), type: 'function',
      function: { name:'aifb_export_document', arguments:JSON.stringify({format,title:'Báo cáo doanh thu',paragraphs:['Doanh thu mẫu: 100, 120, 150 triệu đồng.'],headers:['Tháng','Doanh thu'],rows:[['Một',100],['Hai',120],['Ba',150]],sumLastColumn:true,slides:[{title:'Doanh thu',bullets:['Tháng 1: 100']},{title:'Tăng trưởng',bullets:['Tháng 2: 120']},{title:'Kết quả',bullets:['Tháng 3: 150']}]}) } }] };
    const identity = { id: 'chatcmpl-' + requests, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: MODEL_ID };
    response.end('data: ' + JSON.stringify({ ...identity, choices: [{ index: 0, delta, finish_reason: null }] }) + '\n\n'
      + 'data: ' + JSON.stringify({ ...identity, choices: [{ index: 0, delta: {}, finish_reason: done ? 'stop' : 'tool_calls' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = fixtureConfig(root, server.address().port, 'fixture-only-' + randomUUID());
  config.agents.defaults.timeoutSeconds = 120;
  config.models.providers['aifb-fixture'].models[0].compat.supportsTools = true;
  config.models.providers['aifb-fixture'].models[0].maxTokens = 2048;
  config.plugins={enabled:true,allow:['aifb-documents'],load:{paths:[path.resolve('apps/desktop/resources/document-tools')]},entries:{'aifb-documents':{enabled:true}}};
  if(prepare)config.plugins={enabled:true,allow:['aifb-documents']};
  config.tools={allow:['aifb_export_document']};
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (child = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const capture = value => { client = value; };
  class ObservedClient extends GatewayClient { constructor(options) { super(options); capture(this); } }
  const setup = new SetupChannel({ stateDirectory: process.env.OPENCLAW_STATE_DIR, configPath: process.env.OPENCLAW_CONFIG_PATH,
    Client: ObservedClient, hostApproval: true, logger: { warn: remember } });
  const receipt = { realAI: false, runtime: '2026.9.1', checks: [], failures: [] };
  try {
    const endpoint = await supervisor.start(); token = endpoint.token;
    assert.equal(await waitForGatewayListener({ port: endpoint.port, supervisor, timeoutMs: 240000 }), 'ready');
    setup.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token });
    const deadline = Date.now() + 60000; while (!setup.connected && Date.now() < deadline) await sleep(100);
    assert.equal(setup.connected, true); supervisor.markReady();
    let restarts=0;
    await setup.prepareDocuments(path.resolve('apps/desktop/resources/document-tools'),async()=>{
      assert.ok(prepare);restarts++;
      await setup.disconnect();await supervisor.stop();
      const next=await supervisor.start();token=next.token;
      assert.equal(await waitForGatewayListener({port:next.port,supervisor,timeoutMs:240000}),'ready');
      setup.connect({url:'ws://127.0.0.1:'+next.port,token});
      const until=Date.now()+60000;while(!setup.connected&&Date.now()<until)await sleep(100);
      assert.ok(setup.connected);supervisor.markReady();endpoint.port=next.port;
    });
    assert.equal(restarts,prepare?1:0);receipt.pluginPreparationRestarts=restarts;
    await setup.prepareDocuments(path.resolve('apps/desktop/resources/document-tools'),async()=>{throw new Error('Second preparation must not restart');});
    receipt.plugins=(await client.request('plugins.list',{})).plugins.filter(p=>p.id==='aifb-documents');
    await client.request('sessions.create',{key,permissionMode:'workspace'});
    for(format of ['docx','xlsx','pptx','pdf']) {
      const sent=await client.request('sessions.send',{key,message:'Export '+format,idempotencyKey:randomUUID()});
      const done=await client.request('agent.wait',{runId:sent.runId,timeoutMs:90000},{timeoutMs:95000});
      assert.notEqual(done.status,'timeout');
      assert.ok(advertised.has('aifb_export_document'),'Tool advertised');
      const result=toolResults.at(-1)?.[0]?.content;
      const text=typeof result==='string'?result:JSON.stringify(result);
      const match=text?.match(/MEDIA:([^\n]+)/);
      assert.ok(match,text??'No result');
      const file=match[1].trim(); const bytes=readFileSync(file);
      assert.ok(file.startsWith(path.join(root,'workspace')+path.sep));
      assert.equal(bytes.subarray(0,format==='pdf'?4:2).toString(),format==='pdf'?'%PDF':'PK');
      assert.equal((await client.request('exec.approval.list',{})).length,0);
      const history=await client.request('chat.history',{sessionKey:key,limit:30});
      const attached=(history.messages??[]).flatMap(m=>[...(Array.isArray(m.content)?m.content:[]),...(m.openclawDisplayContent??[])]).filter(p=>p.type==='attachment');
      assert.ok(attached.length,'Final reply has native attachments');
      const {saveDeliveredFile}=await import('../apps/desktop/electron/delivered-files.mjs');let saved;
      const savedResult=await saveDeliveredFile({action:'artifact-save',key,artifactId:attached.at(-1).attachment.artifactId},{request:(m,p)=>client.request(m,p),endpoint:()=>({url:'ws://127.0.0.1:'+endpoint.port,token}),choose:async()=>path.join(root,'download.'+format),write:async(_file,data)=>{saved=data;}});
      assert.equal(savedResult.saved,true);assert.ok(saved.equals(bytes),'Saved bytes match native output');
      receipt.checks.push({format,bytes:bytes.length,nativeTool:true,approvalRequired:false,nativeAttachmentDownload:true});
    }
  } catch (error) { receipt.failures.push(error.message); receipt.toolResults = toolResults; receipt.logs = logs.map(line => token ? line.replaceAll(token, '[REDACTED]') : line); }
  finally { await setup.disconnect(); await supervisor.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    receipt.gatewayExited = !child || child.exitCode !== null || child.signalCode !== null; receipt.providerRequests = requests; }
  receipt.pass = receipt.failures.length === 0 && receipt.gatewayExited;
  process.send(receipt);
}
async function main() {
  if (process.argv[2] === '--worker') return worker(process.argv[3], process.argv[4],process.argv[5]==='prepare');
  const resources = process.argv[2], output = process.argv[3]; if (!resources || !output) throw new Error('Expected resources and output');
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'aifb-documents-')));
  for (const name of ['state', 'workspace', 'tmp', 'appdata', 'localappdata']) mkdirSync(path.join(root, name));
  const native = fixtureRuntime(resources);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(native.node, [self, '--worker', root, resources, ...(process.argv.includes('--prepare')?['prepare']:[])], { env: isolatedEnvironment(root), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let receipt, errors = ''; child.stderr.on('data', chunk => { errors += chunk; }); child.stdout.resume();
    child.on('message', value => { receipt = value; }); child.on('error', reject);
    child.on('exit', code => receipt ? resolve(receipt) : reject(new Error('Fixture exit ' + code + ': ' + errors.slice(-2000))));
  });
  assert.ok(root.startsWith(realpathSync(os.tmpdir()) + path.sep));
  if (result.gatewayExited) rmSync(root, { recursive: true });
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); process.exitCode = result.pass ? 0 : 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
