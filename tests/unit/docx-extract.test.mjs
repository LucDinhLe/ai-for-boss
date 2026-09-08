import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fixtureDocx, fixtureZip } from '../../scripts/fixture-documents.mjs';
import { DOCX_MIME, DOCX_LIMITS, extractDocxAttachment } from '../../apps/desktop/electron/docx-extract.mjs';
const require = createRequire(new URL('../../apps/desktop/package.json', import.meta.url));
const JSZip = require('jszip');
const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
const xml = body => `<w:document xmlns:w="${ns}"><w:body>${body}</w:body></w:document>`;
const paragraph = value => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`;
const attachment = bytes => ({ type: 'file', fileName: 'Báo cáo.docx', mimeType: DOCX_MIME, content: bytes.toString('base64'), sizeBytes: bytes.length });
const document = (body, extra = {}) => fixtureZip({ '[Content_Types].xml': types, 'word/document.xml': xml(body), ...extra });

test('DOCX extracts Vietnamese paragraphs, real row/column boundaries and auxiliary text without changing original bytes', async () => {
  const bytes = document(paragraph('Chào anh &amp; đội ngũ &#x1F600;')
    + '<w:tbl><w:tr><w:tc>' + paragraph('Tên') + '</w:tc><w:tc>' + paragraph('Doanh thu') + '</w:tc></w:tr><w:tr><w:tc>'
    + paragraph('Hà Nội') + '</w:tc><w:tc>' + paragraph('120 triệu') + '</w:tc></w:tr></w:tbl>', {
    'word/header1.xml': `<w:hdr xmlns:w="${ns}">${paragraph('BẢO MẬT')}</w:hdr>`,
    'word/footer1.xml': `<w:ftr xmlns:w="${ns}">${paragraph('Cuối trang')}</w:ftr>`,
    'word/footnotes.xml': `<w:footnotes xmlns:w="${ns}"><w:footnote w:id="1">${paragraph('Nguồn khảo sát')}</w:footnote></w:footnotes>`,
    'word/endnotes.xml': `<w:endnotes xmlns:w="${ns}"><w:endnote w:id="1">${paragraph('Ghi chú cuối')}</w:endnote></w:endnotes>`,
    'word/_rels/document.xml.rels': '<Relationships><Relationship TargetMode="External" Target="https://must-not-load.invalid/private"/></Relationships>',
    'word/media/image.png': 'not-an-image-never-opened'
  });
  const input = attachment(bytes), before = structuredClone(input), result = await extractDocxAttachment(input);
  assert.deepEqual(input, before); assert.equal(result.characters, result.text.length);
  assert.match(result.text, /Chào anh & đội ngũ 😀/u); assert.match(result.text, /Tên\tDoanh thu\nHà Nội\t120 triệu/u);
  for (const value of ['BẢO MẬT', 'Cuối trang', 'Nguồn khảo sát', 'Ghi chú cuối']) assert.ok(result.text.includes(value));
  assert.equal(result.tables, 1); assert.equal(result.parts.length, 5); assert.equal(result.includesImages, true);
  assert.match(result.text, /không đọc hình ảnh/u); assert.equal(result.text.includes('must-not-load'), false);
  assert.equal(result.text.includes('not-an-image'), false); assert.equal(result.warnings.length, 2);
});

test('alternate prefixes and strict namespace are supported, deleted text and field instructions are omitted', async () => {
  const body = xml(paragraph('Còn lại') + '<w:del>' + paragraph('Đã xóa') + '</w:del>'
    + '<w:r><w:instrText>INCLUDETEXT https://must-not-load.invalid</w:instrText></w:r>').replaceAll('w:', 'a:').replace('xmlns:w', 'xmlns:a')
    .replace(ns, 'http://purl.oclc.org/ooxml/wordprocessingml/main');
  const result = await extractDocxAttachment(attachment(fixtureZip({ '[Content_Types].xml': types, 'word/document.xml': body })));
  assert.ok(result.text.includes('Còn lại')); assert.equal(result.text.includes('Đã xóa'), false); assert.equal(result.text.includes('INCLUDETEXT'), false);
});

test('malformed XML, DTD/entities, wrong namespace, deep structure, missing parts and macro files fail before sending', async () => {
  const bad = [
    xml(paragraph('text')).replace('</w:r>', '</w:p>'), xml(paragraph('text')).replace('</w:document>', ''),
    xml(paragraph('text')) + '</orphan>', xml(paragraph('text')) + '<other/>', xml(paragraph('text')).replace('</w:r>', '</w:r garbage>'),
    '<!DOCTYPE x [<!ENTITY evil SYSTEM "file:///C:/must-not-read">]>' + xml(paragraph('&evil;')),
    xml(paragraph('&unknown;')), xml(paragraph('&#0;')), xml(paragraph('&#xD800;')), xml(paragraph('&#9999999999999;')),
    xml('<w:r bad=unquoted><w:t>test</w:t></w:r>'), xml('<w:r same="1" same="2"><w:t>test</w:t></w:r>'),
    xml('<w:r><w:t>test</w:t></w:r>').replace(ns, 'https://not-word.invalid'),
    xml('<x>'.repeat(101) + paragraph('nested') + '</x>'.repeat(101)), xml(paragraph('text')) + '<!--broken',
    xml('<w:r><w:t><![CDATA[broken</w:t></w:r>'), xml(paragraph('text')).replace('<w:body>', '<z:body>')
  ];
  for (const body of bad) await assert.rejects(extractDocxAttachment(attachment(fixtureZip({ '[Content_Types].xml': types, 'word/document.xml': body }))), /Word|DOCX/u);
  for (const entries of [{ 'word/document.xml': xml(paragraph('missing types')) }, { '[Content_Types].xml': types },
    { '[Content_Types].xml': types, 'word/document.xml': xml(paragraph('macro')), 'word/vbaProject.bin': 'macro' }]) {
    await assert.rejects(extractDocxAttachment(attachment(fixtureZip(entries))), /Word|DOCX|macro/u);
  }
});

test('empty or image-only documents do not claim success from section labels', async () => {
  for (const bytes of [document(''), document('<w:p><w:r><w:drawing/></w:r></w:p>', {
    'word/header1.xml': `<w:hdr xmlns:w="${ns}"><w:p/></w:hdr>`, 'word/media/image.png': 'ignored' })]) {
    await assert.rejects(extractDocxAttachment(attachment(bytes)), /không có văn bản/u);
  }
});

test('input names, encoding, size, signatures and extra fields are bounded without filesystem reads', async () => {
  const valid = attachment(fixtureDocx('Valid'));
  for (const input of [null, {}, { ...valid, path: 'C:/private.docx' }, { ...valid, fileName: '../bad.docx' },
    { ...valid, fileName: 'bad.docm' }, { ...valid, fileName: 'C:bad.docx' }, { ...valid, mimeType: 'application/zip' },
    { ...valid, sizeBytes: DOCX_LIMITS.compressedBytes + 1 }, { ...valid, content: '!!!!' },
    attachment(Buffer.from('P')), attachment(Buffer.from('MZfake')), { ...valid, sizeBytes: valid.sizeBytes - 1 }]) {
    await assert.rejects(extractDocxAttachment(input), /Word|DOCX/u);
  }
});

test('ZIP preflight rejects traversal, duplicate entries, lying counts and encrypted/multi-disk metadata', async () => {
  const valid = document(paragraph('Archive'));
  const bad = [document(paragraph('bad'), { '../outside': 'never-written' })];
  for (const modify of [bytes => bytes.writeUInt16LE(1, bytes.length - 14), bytes => bytes.writeUInt16LE(1, bytes.length - 12),
    bytes => bytes.writeUInt16LE(1, bytes.length - 18), bytes => bytes.writeUInt16LE(1, 6)]) {
    const bytes = Buffer.from(valid); modify(bytes); bad.push(bytes);
  }
  // Identical entry names would otherwise be silently overwritten by JSZip.
  const duplicate = fixtureZip({ 'same.xml': 'first', 'name.xml': 'second' });
  const duplicateBytes = Buffer.from(duplicate.toString('binary').replaceAll('name.xml', 'same.xml'), 'binary'); bad.push(duplicateBytes);
  for (const bytes of bad) await assert.rejects(extractDocxAttachment(attachment(bytes)), /Word|DOCX/u);
});

test('selected XML checks CRC, UTF-8, inflated bytes and output limits; irrelevant media is never inflated', async () => {
  const corrupted = document(paragraph('CRC_SENTINEL'));
  corrupted[corrupted.indexOf(Buffer.from('CRC_SENTINEL'))] = 65;
  await assert.rejects(extractDocxAttachment(attachment(corrupted)), /hỏng/u);
  const invalidUtf8 = document(paragraph('UTF8_SENTINEL'));
  invalidUtf8[invalidUtf8.indexOf(Buffer.from('UTF8_SENTINEL'))] = 255;
  await assert.rejects(extractDocxAttachment(attachment(invalidUtf8)), /hỏng|mã chữ/u);
  await assert.rejects(extractDocxAttachment(attachment(document(paragraph('A'.repeat(55000))))), /55.000/u);
  const zip = new JSZip(); zip.file('[Content_Types].xml', types); zip.file('word/document.xml', xml(paragraph('Supported')));
  zip.file('word/media/huge.bin', Buffer.alloc(5 * 1024 * 1024, 65));
  const media = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  assert.match((await extractDocxAttachment(attachment(media))).text, /Supported/u);
  zip.file('word/document.xml', xml(' '.repeat(DOCX_LIMITS.xmlPartBytes)));
  const inflated = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await assert.rejects(extractDocxAttachment(attachment(inflated)), /giải nén/u);
});

test('simultaneous document parsing is limited and slots release after failures', async () => {
  const input = attachment(document(paragraph('Concurrent')));
  const running = Array.from({ length: 4 }, () => extractDocxAttachment(input));
  await assert.rejects(extractDocxAttachment(input), /Đang đọc nhiều/u);
  assert.equal((await Promise.all(running)).length, 4);
  await assert.rejects(extractDocxAttachment({}), /Word/u);
  assert.match((await extractDocxAttachment(input)).text, /Concurrent/u);
});

test('XML element budget rejects structurally excessive small text before blocking through the full document', async () => {
  const bytes = document('<w:r/>'.repeat(DOCX_LIMITS.nodes) + paragraph('Too many empty elements'));
  await assert.rejects(extractDocxAttachment(attachment(bytes)), /quá nhiều thành phần XML/u);
});

test('CDATA and escaped angle brackets are text while malformed trailing XML is rejected', async () => {
  const parsed = await extractDocxAttachment(attachment(document('<w:p><w:r><w:t><![CDATA[Giá < 10 & còn hàng]]></w:t></w:r></w:p>')));
  assert.match(parsed.text, /Giá < 10 & còn hàng/u);
  for (const ending of ['</w:document broken>', '</w:document', '</w:document><w:r bad="unfinished']) {
    const body = xml(paragraph('text')).replace('</w:document>', ending);
    await assert.rejects(extractDocxAttachment(attachment(fixtureZip({ '[Content_Types].xml': types, 'word/document.xml': body }))), /Word|DOCX/u);
  }
});

test('namespace scopes are shared and bounded, including repeated declarations with a small active scope', async () => {
  const namespaces = count => Array.from({ length: count }, (_, index) => ` xmlns:n${index}="urn:test:${index}"`).join('');
  const base = xml('<w:r/>'.repeat(2000) + paragraph('Near namespace limit'));
  const read = body => extractDocxAttachment(attachment(fixtureZip({ '[Content_Types].xml': types, 'word/document.xml': body })));
  assert.match((await read(base.replace('<w:body>', `<w:body${namespaces(126)}>`))).text, /Near namespace limit/u);
  await assert.rejects(read(base.replace('<w:body>', `<w:body${namespaces(127)}>`)), /không gian tên XML/u);
  await assert.rejects(read(xml('<w:r xmlns:repeat="urn:test"/>'.repeat(DOCX_LIMITS.namespaceDeclarations) + paragraph('repeated'))), /khai báo XML/u);
  const shadow = xml('<w:p><w:r><w:t>Before</w:t></w:r><w:r xmlns:w="urn:not-word"><w:t>Ignored</w:t></w:r><w:r><w:t>After</w:t></w:r></w:p>');
  const result = await read(shadow);
  assert.match(result.text, /BeforeAfter/u); assert.equal(result.text.includes('Ignored'), false);
});

test('repeated malformed comment/CDATA starts reject and long accepted whitespace is preserved', async () => {
  for (const marker of ['<!--', '<![CDATA[']) {
    for (const count of [5000, 10000]) {
      await assert.rejects(extractDocxAttachment(attachment(document(marker.repeat(count)))), /Word|DOCX/u);
    }
  }
  const spaces = ' '.repeat(20000);
  const result = await extractDocxAttachment(attachment(document(paragraph(`X${spaces}X`))));
  assert.ok(result.text.includes(`X${spaces}X`));
  const adjacent = await extractDocxAttachment(attachment(document('<w:p><w:r><w:t>A   </w:t><w:tab/><w:t>B   </w:t><w:br/><w:t>C   D</w:t></w:r></w:p>')));
  assert.ok(adjacent.text.includes('A\tB\nC   D'));
  await assert.rejects(extractDocxAttachment(attachment(document(paragraph('A&<!--gap-->amp;B')))), /Word|DOCX/u);
});
