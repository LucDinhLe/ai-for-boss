import path from 'node:path';
import { writeFile } from 'node:fs/promises';

const maximum = 100 * 1024 * 1024;
const extensions = new Set('.docx .xlsx .pptx .pdf .txt .md .csv .json .html .odt .ods .odp .png .jpg .jpeg .webp .gif .svg .mp3 .wav .m4a .mp4 .webm .zip'.split(' '));
export async function saveDeliveredFile(input, { request, endpoint, choose, fetchFile = fetch, write = writeFile }) {
  if (!input || input.action !== 'artifact-save' || Object.keys(input).some(k => !['action', 'key', 'artifactId'].includes(k))
    || typeof input.key !== 'string' || !/^agent:[a-z0-9_-]+:[^\s\0]{1,4000}$/u.test(input.key)
    || typeof input.artifactId !== 'string' || !/^artifact_managed_media_[0-9a-f-]{36}$/u.test(input.artifactId)) throw new Error('Tệp kết quả không hợp lệ.');
  // Renderer supplies an identity only. Resolve it from fresh native session history.
  const history = await request('chat.history', { sessionKey: input.key, limit: 200 });
  const attachment = (history.messages ?? []).flatMap(m => [...(Array.isArray(m.openclawDisplayContent) ? m.openclawDisplayContent : []), ...(Array.isArray(m.content) ? m.content : [])])
    .find(part => part?.type === 'attachment' && part.attachment?.artifactId === input.artifactId)?.attachment;
  const id = input.artifactId.slice('artifact_managed_media_'.length);
  const route = `/api/chat/media/outgoing/${encodeURIComponent(input.key)}/${id}/full`;
  if (!attachment || attachment.url !== route || typeof attachment.label !== 'string'
    || attachment.sizeBytes > maximum) throw new Error('OpenClaw chưa xác nhận tệp này trong phiên.');
  const name = [...path.basename(attachment.label.replaceAll('\\', '/'))].map(c => c.charCodeAt(0) < 32 ? '_' : c).join('').replace(/[<>:"|?*]/gu, '_');
  if (!name || !extensions.has(path.extname(name).toLowerCase())) throw new Error('Định dạng tệp này chưa hỗ trợ lưu từ hội thoại.');
  const connection = endpoint();
  const origin = new URL(connection.url);
  if (origin.protocol !== 'ws:' || origin.hostname !== '127.0.0.1' || !connection.token) throw new Error('Gateway cục bộ chưa sẵn sàng.');
  origin.protocol = 'http:';
  const response = await fetchFile(new URL(route, origin), { headers: { Authorization: `Bearer ${connection.token}` }, redirect: 'error', signal: globalThis.AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error('Chưa đọc được tệp kết quả từ OpenClaw.');
  const reader = response.body.getReader(), chunks = []; let total = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength;
    if (total > maximum) throw new Error('Tệp vượt giới hạn tải 100 MB.'); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); }
  if (!total || (Number.isSafeInteger(attachment.sizeBytes) && total !== attachment.sizeBytes)) throw new Error('Tệp chưa đầy đủ; chưa lưu ra máy.');
  const destination = await choose(name);
  if (!destination) return { saved: false };
  await write(destination, Buffer.concat(chunks));
  return { saved: true, name, bytes: total };
}
