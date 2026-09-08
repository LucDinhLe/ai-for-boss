import JSZip from 'jszip';
import { Tokenizer, QuoteType } from 'htmlparser2';
import { crc32 } from 'node:zlib';
import { TextDecoder } from 'node:util';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const DOCX_LIMITS = Object.freeze({ compressedBytes: 8 * 1024 * 1024, entries: 1024,
  xmlPartBytes: 4 * 1024 * 1024, xmlTotalBytes: 8 * 1024 * 1024, characters: 55000, depth: 100, nodes: 100000,
  namespaces: 128, namespaceDeclarations: 4096, concurrent: 4 });
const WORD_NAMESPACES = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main']);
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const AUXILIARY = /^word\/(?:header\d+|footer\d+|footnotes|endnotes)\.xml$/u;
const invalid = () => new Error('Tài liệu Word bị hỏng hoặc có cấu trúc XML không được hỗ trợ. Hãy lưu lại dưới dạng DOCX.');
let active = 0;
function hasControl(value, xml = false) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if ((code < 32 && !(xml && [9, 10, 13].includes(code))) || (!xml && code === 127)) return true;
  }
  return false;
}

function selectedBytes(file) {
  if (!file || Object.keys(file).some(key => !['type', 'mimeType', 'fileName', 'content', 'sizeBytes'].includes(key))
    || file.type !== 'file' || file.mimeType !== DOCX_MIME || typeof file.fileName !== 'string'
    || !/\.docx$/iu.test(file.fileName) || file.fileName.length > 255 || /[\\/:]/u.test(file.fileName) || hasControl(file.fileName)
    || !Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0 || file.sizeBytes > DOCX_LIMITS.compressedBytes
    || typeof file.content !== 'string' || file.content.length !== 4 * Math.ceil(file.sizeBytes / 3)
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(file.content)) throw new Error('Tệp Word không hợp lệ hoặc vượt giới hạn 8 MiB.');
  const bytes = Buffer.from(file.content, 'base64');
  if (bytes.length < 4 || bytes.length !== file.sizeBytes || bytes.toString('base64') !== file.content || bytes.readUInt32LE(0) !== 0x04034b50) throw invalid();
  return bytes;
}

/** Reject oversized directories before JSZip allocates entry objects. No archive is written to disk. */
function archiveIndex(bytes) {
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (bytes.readUInt32LE(index) !== 0x06054b50 || index + 22 + bytes.readUInt16LE(index + 20) !== bytes.length) continue;
    const count = bytes.readUInt16LE(index + 10);
    if (bytes.readUInt16LE(index + 4) || bytes.readUInt16LE(index + 6) || bytes.readUInt16LE(index + 8) !== count
      || !count || count > DOCX_LIMITS.entries || bytes.readUInt32LE(index + 12) === 0xffffffff
      || bytes.readUInt32LE(index + 16) === 0xffffffff) throw new Error('Tài liệu Word có quá nhiều thành phần hoặc dùng kiểu ZIP không được hỗ trợ.');
    const directorySize = bytes.readUInt32LE(index + 12), directoryStart = bytes.readUInt32LE(index + 16);
    if (directoryStart + directorySize !== index) throw invalid();
    const entries = new Map(); let position = directoryStart;
    while (position < index) {
      if (entries.size >= DOCX_LIMITS.entries || position + 46 > index || bytes.readUInt32LE(position) !== 0x02014b50) throw invalid();
      const flags = bytes.readUInt16LE(position + 8), method = bytes.readUInt16LE(position + 10);
      const compressed = bytes.readUInt32LE(position + 20), size = bytes.readUInt32LE(position + 24);
      const nameLength = bytes.readUInt16LE(position + 28), extraLength = bytes.readUInt16LE(position + 30), commentLength = bytes.readUInt16LE(position + 32);
      const next = position + 46 + nameLength + extraLength + commentLength, offset = bytes.readUInt32LE(position + 42);
      if (flags & 0x41 || ![0, 8].includes(method) || !nameLength || next > index || bytes.readUInt16LE(position + 34)
        || compressed === 0xffffffff || size === 0xffffffff || offset + 30 > directoryStart || bytes.readUInt32LE(offset) !== 0x04034b50) throw invalid();
      let name;
      try { name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(position + 46, position + 46 + nameLength)); }
      catch { throw invalid(); }
      if (entries.has(name) || name.length > 255 || /[\\:]/u.test(name) || hasControl(name) || name.startsWith('/')
        || name.split('/').some(part => part === '..' || part === '.')) throw invalid();
      const localNameLength = bytes.readUInt16LE(offset + 26), dataStart = offset + 30 + localNameLength + bytes.readUInt16LE(offset + 28);
      if (bytes.readUInt16LE(offset + 6) !== flags || bytes.readUInt16LE(offset + 8) !== method || localNameLength !== nameLength
        || dataStart + compressed > directoryStart || !bytes.subarray(offset + 30, offset + 30 + localNameLength)
          .equals(bytes.subarray(position + 46, position + 46 + nameLength))) throw invalid();
      entries.set(name, { size, crc: bytes.readUInt32LE(position + 16) });
      position = next;
    }
    if (entries.size !== count) throw invalid();
    return entries;
  }
  throw invalid();
}

function readXml(entry, budget, expected) {
  return new Promise((resolve, reject) => {
    if (!expected || expected.size > DOCX_LIMITS.xmlPartBytes || expected.size + budget.bytes > DOCX_LIMITS.xmlTotalBytes) {
      reject(new Error('Nội dung giải nén của Word vượt giới hạn an toàn. Hãy chia nhỏ tài liệu.')); return;
    }
    const stream = entry.internalStream('uint8array');
    const chunks = []; let size = 0, crc = 0, settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); stream.pause();
      if (!error && (size !== expected.size || crc !== expected.crc)) error = invalid();
      if (error) { chunks.length = 0; reject(error); return; }
      try { resolve(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))); }
      catch { reject(new Error('Tài liệu Word dùng mã chữ không được hỗ trợ. Hãy lưu lại dưới dạng DOCX.')); }
    };
    const timer = setTimeout(() => finish(new Error('Đọc tài liệu Word quá lâu. Hãy chia nhỏ tài liệu.')), 10000);
    stream.on('data', chunk => {
      if (settled) return;
      size += chunk.byteLength; budget.bytes += chunk.byteLength;
      if (size > DOCX_LIMITS.xmlPartBytes || budget.bytes > DOCX_LIMITS.xmlTotalBytes) {
        finish(new Error('Nội dung giải nén của Word vượt giới hạn an toàn. Hãy chia nhỏ tài liệu.')); return;
      }
      crc = crc32(chunk, crc); chunks.push(Buffer.from(chunk));
    }).on('error', () => finish(invalid())).on('end', () => finish()).resume();
  });
}

/** XML token callbacks validate the stack themselves: the forgiving HTML tree builder is not used. */
function withoutCommentText(xml) {
  const sections = []; let start = 0;
  while (start < xml.length) {
    const declaration = xml.indexOf('<!', start);
    if (declaration < 0) { sections.push(xml.slice(start)); break; }
    sections.push(xml.slice(start, declaration));
    const comment = xml.startsWith('<!--', declaration), cdata = xml.startsWith('<![CDATA[', declaration);
    if (!comment && !cdata) throw invalid();
    const contentStart = declaration + (comment ? 4 : 9);
    const end = xml.indexOf(comment ? '-->' : ']]>', contentStart);
    if (end < 0 || (comment && xml.indexOf('--', contentStart) !== end)) throw invalid();
    start = end + 3;
  }
  // Keep neighboring entity fragments separate; comments cannot turn '&' + 'amp;' into a valid entity.
  return sections.join(' ');
}

function normalizeText(chunks) {
  const source = chunks.join('');
  return source.replace(/[ \t]+/gu, (run, offset) => source[offset + run.length] === '\n' ? ''
    : run.replace(/ +/gu, (spaces, index) => run[index + spaces.length] === '\t' ? '' : spaces))
    .replace(/\n{3,}/gu, '\n\n').trim();
}

function parseXml(xml, handlers, budget) {
  if (!xml || hasControl(xml, true) || /<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(xml)) throw invalid();
  const entityText = withoutCommentText(xml);
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/iu.test(entityText)) throw invalid();
  for (const match of entityText.matchAll(/&#(x[0-9a-f]+|\d+);/giu)) {
    const point = /^x/iu.test(match[1]) ? parseInt(match[1].slice(1), 16) : Number(match[1]);
    if (!Number.isSafeInteger(point) || !(point === 9 || point === 10 || point === 13
      || point >= 32 && point <= 0xd7ff || point >= 0xe000 && point <= 0xfffd || point >= 0x10000 && point <= 0x10ffff)) throw invalid();
  }
  const stack = []; let pending = null, attribute = null, attributeValue = '', roots = 0;
  const qname = /^[A-Za-z_][A-Za-z0-9_.-]*(?::[A-Za-z_][A-Za-z0-9_.-]*)?$/u;
  const text = value => {
    if (!stack.length && value.trim()) throw invalid();
    handlers.text?.(value, stack);
  };
  const open = () => {
    if (!pending || attribute) throw invalid();
    if (++budget.nodes > DOCX_LIMITS.nodes) throw new Error('Tài liệu Word có quá nhiều thành phần XML. Hãy lưu lại hoặc chia nhỏ tài liệu.');
    if (!stack.length && ++roots !== 1) throw invalid();
    if (stack.length >= DOCX_LIMITS.depth) throw new Error('Tài liệu Word có cấu trúc quá sâu. Hãy lưu lại hoặc chia nhỏ tài liệu.');
    const parent = stack.at(-1);
    const inherited = parent?.namespaces ?? Object.assign(Object.create(null), { xml: 'http://www.w3.org/XML/1998/namespace' });
    const declarations = Object.entries(pending.attributes).filter(([name]) => name === 'xmlns' || name.startsWith('xmlns:'));
    budget.namespaceDeclarations += declarations.length;
    if (budget.namespaceDeclarations > DOCX_LIMITS.namespaceDeclarations) throw new Error('Tài liệu Word có quá nhiều khai báo XML. Hãy lưu lại hoặc chia nhỏ tài liệu.');
    // Immutable scopes share their parent instead of copying every inherited binding at each element.
    const namespaces = declarations.length ? Object.create(inherited) : inherited;
    let namespaceCount = parent?.namespaceCount ?? 1;
    for (const [name, value] of declarations) {
      const prefix = name === 'xmlns' ? '' : name.slice(6);
      if (!(prefix in inherited)) namespaceCount++;
      if (namespaceCount > DOCX_LIMITS.namespaces) throw new Error('Tài liệu Word có quá nhiều không gian tên XML. Hãy lưu lại hoặc chia nhỏ tài liệu.');
      namespaces[prefix] = value;
    }
    const segments = pending.name.split(':');
    const prefix = segments.length === 2 ? segments[0] : '';
    if (prefix && !(prefix in namespaces)) throw invalid();
    const node = { ...pending, local: segments.at(-1), namespace: namespaces[prefix] ?? '', namespaces, namespaceCount };
    pending = null; stack.push(node); handlers.open?.(node, stack);
  };
  const close = name => {
    if (pending || stack.at(-1)?.name !== name) throw invalid();
    const node = stack.pop(); handlers.close?.(node, stack);
  };
  const tokenizer = new Tokenizer({ xmlMode: true, decodeEntities: true }, {
    onopentagname(start, end) {
      const name = xml.slice(start, end);
      if (pending || !qname.test(name)) throw invalid();
      pending = { name, attributes: Object.create(null), attributeCount: 0 };
    },
    onattribname(start, end) {
      attribute = xml.slice(start, end); attributeValue = '';
      if (!pending || !qname.test(attribute) || Object.hasOwn(pending.attributes, attribute)
        || ++pending.attributeCount > 256) throw invalid();
    },
    onattribdata(start, end) { attributeValue += xml.slice(start, end); },
    onattribentity(codepoint) { attributeValue += String.fromCodePoint(codepoint); },
    onattribend(quote) {
      if (!pending || !attribute || ![QuoteType.Single, QuoteType.Double].includes(quote)) throw invalid();
      pending.attributes[attribute] = attributeValue; attribute = null;
    },
    onopentagend: open,
    onselfclosingtag() { const name = pending?.name; open(); close(name); },
    onclosetag(start, end) {
      const stop = xml.indexOf('>', end);
      if (stop < 0 || !/^\s*$/u.test(xml.slice(end, stop))) throw invalid();
      close(xml.slice(start, end));
    },
    ontext(start, end) { text(xml.slice(start, end)); },
    ontextentity(codepoint) { text(String.fromCodePoint(codepoint)); },
    oncdata(start, end, offset) { if (offset !== 2) throw invalid(); text(xml.slice(start, end - offset)); },
    oncomment(_start, _end, offset) { if (offset !== 2) throw invalid(); },
    ondeclaration() { throw invalid(); },
    onprocessinginstruction(start, end) {
      const instruction = xml.slice(start, end);
      if (roots || !/^xml\s/u.test(instruction) || /encoding\s*=\s*['"](?!utf-8['"])/iu.test(instruction)) throw invalid();
    },
    onend() { if (pending || attribute || stack.length || roots !== 1) throw invalid(); }
  });
  tokenizer.write(xml); tokenizer.end();
}

function extractWordXml(xml, part, output, budget) {
  let rootChecked = false, body = false;
  const expectedRoot = part === 'word/document.xml' ? 'document' : part.includes('/header') ? 'hdr'
    : part.includes('/footer') ? 'ftr' : part.endsWith('footnotes.xml') ? 'footnotes' : 'endnotes';
  const isWord = node => WORD_NAMESPACES.has(node.namespace);
  const append = value => {
    output.characters += value.length;
    if (output.characters > DOCX_LIMITS.characters) throw new Error('Word vượt 55.000 ký tự đọc được. Hãy chia nhỏ tài liệu để AI nhận đủ nội dung.');
    output.chunks.push(value);
  };
  parseXml(xml, {
    open(node, stack) {
      if (!rootChecked) { rootChecked = true; if (!isWord(node) || node.local !== expectedRoot) throw invalid(); }
      if (isWord(node)) {
        if (node.local === 'body') body = true;
        if (node.local === 'tbl') output.tables++;
        if (['drawing', 'pict', 'object', 'altChunk'].includes(node.local)) output.omitted = true;
        const deleted = stack.some(item => isWord(item) && item.local === 'del');
        if (!deleted && node.local === 'tab') append('\t');
        if (!deleted && ['br', 'cr'].includes(node.local)) append('\n');
      }
    },
    text(value, stack) {
      const node = stack.at(-1);
      if (node && isWord(node) && node.local === 't' && !stack.some(item => isWord(item) && item.local === 'del')) {
        output.textCharacters += value.trim().length; append(value);
      }
    },
    close(node, stack) {
      if (!isWord(node)) return;
      if (node.local === 'p') { output.paragraphs++; append(stack.some(item => isWord(item) && item.local === 'tc') ? ' ' : '\n'); }
      if (node.local === 'tc') append('\t');
      if (node.local === 'tr') append('\n');
    }
  }, budget);
  if (part === 'word/document.xml' && !body) throw invalid();
}

/** Only caller-supplied bytes are parsed. No file paths, relationships, scripts, model calls or core imports. */
export async function extractDocxAttachment(file) {
  if (active >= DOCX_LIMITS.concurrent) throw new Error('Đang đọc nhiều tài liệu Word. Hãy chờ rồi chọn lại tệp.');
  active++;
  try {
    const bytes = selectedBytes(file), index = archiveIndex(bytes);
    let zip;
    try { zip = await JSZip.loadAsync(bytes, { createFolders: false, checkCRC32: false }); }
    catch { throw invalid(); }
    const entries = Object.values(zip.files);
    if (entries.length !== index.size || entries.some(entry => !index.has(entry.name) || entry.name.length > 255 || entry.name !== (entry.unsafeOriginalName ?? entry.name)
      || /[\\:]/u.test(entry.name) || hasControl(entry.name) || entry.name.startsWith('/') || entry.name.split('/').some(part => part === '..' || part === '.'))) throw invalid();
    if (entries.some(entry => /(?:^|\/)vbaProject\.bin$/iu.test(entry.name))) throw new Error('Không đọc macro trong Word. Hãy lưu bản DOCX không có macro.');
    const required = ['[Content_Types].xml', 'word/document.xml'];
    if (required.some(name => !zip.file(name))) throw invalid();
    const budget = { bytes: 0, nodes: 0, namespaceDeclarations: 0 };
    let mainType = false;
    parseXml(await readXml(zip.file('[Content_Types].xml'), budget, index.get('[Content_Types].xml')), { open(node, stack) {
      if (stack.length === 1 && (node.local !== 'Types' || node.namespace !== CONTENT_TYPES_NS)) throw invalid();
      if (node.namespace === CONTENT_TYPES_NS && node.local === 'Override' && node.attributes.PartName === '/word/document.xml') {
        if (node.attributes.ContentType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml') throw invalid();
        mainType = true;
      }
    } }, budget);
    if (!mainType) throw invalid();
    const parts = ['word/document.xml', ...entries.filter(entry => !entry.dir && AUXILIARY.test(entry.name)).map(entry => entry.name).sort()];
    const prefix = `Văn bản trích từ ${file.fileName}. Chỉ gồm chữ và bảng; không đọc hình ảnh, nội dung nhúng hoặc giữ bố cục trang.\n\n`;
    const output = { chunks: [prefix], characters: prefix.length, textCharacters: 0, paragraphs: 0, tables: 0, omitted: false };
    for (const part of parts) {
      if (part !== 'word/document.xml') {
        const label = `\n[${part.includes('/header') ? 'Đầu trang' : part.includes('/footer') ? 'Chân trang' : part.endsWith('footnotes.xml') ? 'Chú thích chân trang' : 'Chú thích cuối'}: ${part.split('/').at(-1)}]\n`;
        output.characters += label.length; output.chunks.push(label);
      }
      extractWordXml(await readXml(zip.file(part), budget, index.get(part)), part, output, budget);
    }
    const text = normalizeText(output.chunks);
    if (!output.textCharacters) throw new Error('Word không có văn bản đọc được. Ảnh và tài liệu quét cần gửi riêng hoặc chuyển sang PDF.');
    if (text.length > DOCX_LIMITS.characters) throw new Error('Word vượt 55.000 ký tự đọc được. Hãy chia nhỏ tài liệu.');
    const includesImages = entries.some(entry => entry.name.startsWith('word/media/'));
    return { text, characters: text.length, paragraphs: output.paragraphs, tables: output.tables, parts,
      includesImages, warnings: ['Chỉ đọc chữ và bảng; không giữ bố cục trang, hình ảnh, công thức hoặc định dạng Word.',
        ...(includesImages || output.omitted ? ['Có hình ảnh hoặc nội dung nhúng chưa được đọc.'] : [])] };
  } finally { active--; }
}
