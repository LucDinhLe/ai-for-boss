import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDeliveredFile } from '../../apps/desktop/electron/delivered-files.mjs';
import { toTranscriptMessage } from '../../apps/desktop/src/gateway-client.ts';
const key = 'agent:main:fixture', id = '11111111-1111-4111-8111-111111111111';
const attachment = { artifactId: `artifact_managed_media_${id}`, label: 'report.docx', sizeBytes: 3,
  url: `/api/chat/media/outgoing/${encodeURIComponent(key)}/${id}/full` };
const row = { role: 'assistant', content: 'Done', openclawDisplayContent: [{ type: 'attachment', attachment }] };
const input = { action: 'artifact-save', key, artifactId: attachment.artifactId };
test('native delivery metadata survives transcript projection, including attachment-only messages', () => {
  assert.equal(toTranscriptMessage(row, 'one').artifacts[0].label, 'report.docx');
  assert.equal(toTranscriptMessage({role:'assistant',content:row.openclawDisplayContent},'canonical').artifacts[0].label,'report.docx');
  assert.equal(toTranscriptMessage({...row,content:row.openclawDisplayContent},'both').artifacts.length,1);
  assert.equal(toTranscriptMessage({ ...row, content: '' }, 'two').artifacts.length, 1);
  assert.equal(toTranscriptMessage({ ...row, openclawDisplayContent: [{ type:'attachment', attachment:{ artifactId:'forged',label:'bad'} }] }, 'three').artifacts, undefined);
});
test('save resolves native identity and local route, then saves only on user choice', async () => {
  let written, fetched;
  const options = { request: async () => ({ messages: [row] }), endpoint: () => ({ url:'ws://127.0.0.1:1234',token:'synthetic' }),
    choose: async () => 'chosen.docx', fetchFile: async (url, options) => { fetched={url:String(url),options}; return new globalThis.Response('abc'); },
    write: async (file, bytes) => { written={file,bytes}; } };
  assert.equal((await saveDeliveredFile(input, options)).saved, true);
  assert.equal(written.bytes.toString(),'abc'); assert.equal(fetched.options.redirect,'error');
  assert.equal(fetched.url, 'http://127.0.0.1:1234'+attachment.url);
  written=null; assert.equal((await saveDeliveredFile(input,{...options,choose:async()=>null})).saved,false); assert.equal(written,null);
  for (const change of [{url:'https://external.test/file'}, {url:attachment.url.replace('main','other')}, {label:'bad.exe'}, {sizeBytes:4}]) {
    await assert.rejects(saveDeliveredFile(input,{...options,request:async()=>({messages:[{...row,openclawDisplayContent:[{type:'attachment',attachment:{...attachment,...change}}]}]})}));
  }
  await assert.rejects(saveDeliveredFile({...input,path:'C:/arbitrary'},options));
});
