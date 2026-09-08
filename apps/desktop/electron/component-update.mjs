import { createHash, verify } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, lstat, readFile, writeFile, link, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const hash = data => createHash('sha256').update(data).digest('hex');
const fail = () => new Error('Gói cập nhật không hợp lệ hoặc không tương thích. Bản hiện tại được giữ nguyên.');
const versionPattern = /^0\.0\.5-beta\.[1-9][0-9]{0,5}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
export function updatePath(value) {
  if (typeof value !== 'string' || value.length > 230 || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..'
    || [...part].some(char => char.charCodeAt(0) < 32) || /[<>:"|?*]/u.test(part) || /[. ]$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))) throw fail();
  return value;
}
const corePath = name => /^resources\/(?:node_modules|runtime|bundle)\//u.test(name);
export function verifyUpdateEnvelope(envelope, publicKey, minimumSequence = 0) {
  if (!envelope || typeof envelope.payload !== 'string' || envelope.payload.length > 12 * 1024 * 1024 || typeof envelope.signature !== 'string') throw fail();
  if (!verify(null, Buffer.from(envelope.payload), publicKey, Buffer.from(envelope.signature, 'base64'))) throw fail();
  const manifest = JSON.parse(envelope.payload);
  if (manifest.schema !== 1 || manifest.product !== 'AI for Boss' || !versionPattern.test(manifest.version)
    || !Number.isSafeInteger(manifest.sequence) || manifest.sequence < minimumSequence
    || manifest.platform !== 'win32' || manifest.arch !== 'x64' || manifest.protocol !== 4
    || !manifest.components || Object.keys(manifest.components).sort().join(',') !== 'core,ui') throw fail();
  const names = new Set(); let expanded = 0, count = 0;
  for (const [kind, component] of Object.entries(manifest.components)) {
    if (!component || !digestPattern.test(component.id) || !digestPattern.test(component.sha256)
      || !Number.isSafeInteger(component.bytes) || component.bytes < 1 || component.bytes > 700 * 1024 * 1024
      || !Array.isArray(component.files) || !component.files.length) throw fail();
    const url = new URL(component.url);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash
      || !url.pathname.startsWith('/LucDinhLe/ai-for-boss-preview/releases/download/')) throw fail();
    for (const file of component.files) {
      updatePath(file.path);
      if (corePath(file.path) !== (kind === 'core') || names.has(file.path.toLowerCase()) || !digestPattern.test(file.sha256)
        || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > 300 * 1024 * 1024) throw fail();
      names.add(file.path.toLowerCase()); expanded += file.bytes; count++;
    }
    if (hash(Buffer.from(JSON.stringify(component.files))) !== component.id) throw fail();
  }
  if (expanded > 4 * 1024 ** 3 || count > 60000 || !names.has('ai-for-boss.exe') || !names.has('resources/app.asar')
    || !names.has('resources/runtime/node/node.exe') || !names.has('resources/node_modules/openclaw/package.json')) throw fail();
  return manifest;
}
async function plainDirectory(directory, create = true) {
  const full = path.resolve(directory); let cursor = full;
  while (true) {
    try { const stat = await lstat(cursor); if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  if (create) await mkdir(full, { recursive: true }); return full;
}
async function fileMatches(root, file) {
  const target = path.join(root, ...file.path.split('/'));
  try {
    await plainDirectory(path.dirname(target), false);
    const stat = await lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes) return false;
    const digest = createHash('sha256'); for await (const chunk of createReadStream(target)) digest.update(chunk);
    return digest.digest('hex') === file.sha256;
  } catch { return false; }
}
export async function verifyUpdateDirectory(root, manifest) {
  for (const component of Object.values(manifest.components)) for (const file of component.files) if (!await fileMatches(root, file)) throw fail();
}
/** Download and assemble in a new directory. Activation is a separate startup action. */
export async function stageComponentUpdate({ envelope, publicKey, minimumSequence, currentRoot, updateRoot, download }) {
  const manifest = verifyUpdateEnvelope(envelope, publicKey, minimumSequence);
  const base = await plainDirectory(updateRoot), final = path.join(base, manifest.version);
  try {
    const existing = JSON.parse(await readFile(path.join(final, '.aifb-update.json'), 'utf8'));
    if (existing.payload !== envelope.payload || existing.signature !== envelope.signature) throw fail();
    await verifyUpdateDirectory(final, manifest);
    return { version: manifest.version, sequence: manifest.sequence, directory: final };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await lstat(final); throw fail(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stage = await mkdtemp(path.join(base, manifest.version + '.staging-'));
  for (const component of Object.values(manifest.components)) {
    let reuse = true;
    for (const file of component.files) if (!await fileMatches(currentRoot, file)) { reuse = false; break; }
    if (reuse) {
      for (const file of component.files) {
        const from = path.join(currentRoot, ...file.path.split('/')), to = path.join(stage, ...file.path.split('/'));
        await plainDirectory(path.dirname(to));
        try { await link(from, to); } catch (error) { if (error.code !== 'EXDEV') throw error; await copyFile(from, to); }
      }
      continue;
    }
    const bytes = await download(component.url, component.bytes);
    if (bytes.length !== component.bytes || hash(bytes) !== component.sha256) throw fail();
    const zip = await JSZip.loadAsync(bytes, { createFolders: false });
    const expected = new Map(component.files.map(file => [file.path, file]));
    for (const entry of Object.values(zip.files)) {
      const original = entry.unsafeOriginalName ?? entry.name;
      updatePath(entry.dir ? original.replace(/\/$/u, '') : original);
      if (original !== entry.name || ((Number(entry.unixPermissions) & 0xf000) === 0xa000)) throw fail();
      if (entry.dir) continue;
      const file = expected.get(entry.name); if (!file) throw fail();
      // Bound inflation using the ZIP directory's uncompressed size before allocating.
      // JSZip represents a zero-byte entry as an empty Promise instead of CompressedObject.
      const expandedSize = entry._data?.uncompressedSize ?? (file.bytes === 0 ? 0 : -1);
      if (expandedSize !== file.bytes) throw fail();
      const content = await entry.async('nodebuffer');
      if (content.length !== file.bytes || hash(content) !== file.sha256) throw fail();
      const target = path.join(stage, ...file.path.split('/')); await plainDirectory(path.dirname(target));
      await writeFile(target, content, { flag: 'wx' }); expected.delete(entry.name);
    }
    if (expected.size) throw fail();
  }
  await verifyUpdateDirectory(stage, manifest);
  await writeFile(path.join(stage, '.aifb-update.json'), JSON.stringify(envelope), { flag: 'wx' });
  await rename(stage, final);
  return { version: manifest.version, sequence: manifest.sequence, directory: final };
}
