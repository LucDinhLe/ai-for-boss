import assert from "node:assert/strict";
import test from "node:test";
import { fixtureZip } from "../../scripts/fixture-documents.mjs";
import { CHAT_FILE_ACCEPT, MAX_CHAT_FILES, MAX_CHAT_FILE_BYTES, MAX_CHAT_TEXT_FILE_BYTES,
  validateAttachmentPolicy, prepareAttachments, readAttachment, toNativeAttachments, toOriginalAttachments, DOCX_MIME }
  from "../../apps/desktop/src/chat-attachments.ts";

const policy = { maxBytes: 10 * 1024 * 1024, maxImageBytes: 5 * 1024 * 1024, maxPayload: 12 * 1024 * 1024 };
let sequence = 0;
const prepare = (files, limits = policy, existing = []) => prepareAttachments(files, limits, existing, () => `file-${++sequence}`);
const file = (name = "ghi-chu.txt", content = "Mục tiêu tuần", type = "") => new globalThis.File([content], name, { type });
const imageHeaders = [
  ["image.png", "image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
  ["image.jpg", "image/jpeg", [255, 216, 255, 224]],
  ["image.jpeg", "image/jpeg", [255, 216, 255, 224]],
  ["image.webp", "image/webp", [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ["image.gif", "image/gif", [71, 73, 70, 56, 57, 97]]
];

test("missing or malformed native policy blocks files without preventing text-only sends", () => {
  assert.deepEqual(toNativeAttachments([], null), []);
  for (const limits of [null, undefined, {}, { ...policy, maxBytes: 0 }, { ...policy, maxImageBytes: NaN },
    { ...policy, maxPayload: Infinity }, { ...policy, maxBytes: "100" }, { ...policy, maxPayload: 1.5 }]) {
    assert.throws(() => prepareAttachments([file()], limits), /giới hạn tệp/);
  }
  assert.deepEqual(validateAttachmentPolicy(policy), policy);
  assert.notEqual(validateAttachmentPolicy(policy), policy);
});

test("supported image and UTF-8 text formats preserve bytes and produce only native attachment fields", async () => {
  assert.equal(MAX_CHAT_FILES, 4); assert.equal(MAX_CHAT_FILE_BYTES, 8 * 1024 * 1024);
  assert.equal(MAX_CHAT_TEXT_FILE_BYTES, 200 * 1024); assert.equal(CHAT_FILE_ACCEPT, "");
  for (const [name, mimeType, bytes] of imageHeaders) {
    const selected = file(name, Uint8Array.from(bytes), mimeType);
    const [entry] = prepare([selected]);
    const content = await readAttachment(selected, entry, policy);
    assert.deepEqual([...Buffer.from(content, "base64")], bytes);
    const [payload] = toNativeAttachments([{ ...entry, status: "ready", content }], policy);
    assert.deepEqual(payload, { type: "image", mimeType, fileName: name, content, sizeBytes: bytes.length });
  }
  for (const [name, mimeType] of [["ghi-chu.TXT", "text/plain"], ["ke-hoach.md", "text/markdown"],
    ["so-lieu.csv", "text/csv"], ["du-lieu.json", "application/json"]]) {
    const selected = file(name), [entry] = prepare([selected]);
    const content = await readAttachment(selected, entry, policy);
    assert.equal(Buffer.from(content, "base64").toString("utf8"), "Mục tiêu tuần");
    assert.deepEqual(toNativeAttachments([{ ...entry, status: "ready", content }], policy),
      [{ type: "file", mimeType, fileName: name, content, sizeBytes: selected.size }]);
  }
});

test("metadata rejects unsupported kinds, spoofed MIME, invalid paths and size before reading", () => {
  let reads = 0;
  const arrayBuffer = () => { reads++; throw new Error("must not read"); };
  for (const metadata of [{ name: "archive.7z", size: 20, type: "application/x-7z-compressed" },
    { name: "macro.docm", size: 20, type: "" }, { name: "code.exe", size: 20, type: "image/png" },
    { name: "photo.png", size: 20, type: "text/plain" }, { name: "../notes.txt", size: 20, type: "" },
    { name: "C:\\notes.txt", size: 20, type: "" }, { name: "notes.txt", size: NaN, type: "" },
    { name: "empty.txt", size: 0, type: "" }, { name: "payload.data", size: 20, type: "bad mime" }]) {
    assert.throws(() => prepare([{ ...metadata, arrayBuffer }]));
  }
  assert.equal(reads, 0);
});

test("data attachments preserve PDF, Office and media bytes without executing or extracting them", async () => {
  for (const [name, bytes, type] of [["report.pdf", "%PDF-1.7\nfixture", "application/pdf"],
    ["document.docx", "PK\u0003\u0004fixture", ""], ["sheet.xlsx", "PK\u0003\u0004fixture", ""],
    ["slides.pptx", "PK\u0003\u0004fixture", ""], ["sound.mp3", "ID3fixture", "audio/mpeg"],
    ["clip.mp4", "fixture-video", "video/mp4"], ["data.custom", "data", ""]]) {
    const selected = file(name, bytes, type), [entry] = prepare([selected]);
    const content = await readAttachment(selected, entry, policy);
    assert.equal(Buffer.from(content, "base64").toString(), bytes);
    assert.equal(toOriginalAttachments([{ ...entry, status: "ready", content }], policy)[0].fileName, name);
    if (name.endsWith('.docx')) assert.throws(() => toNativeAttachments([{ ...entry, status: 'ready', content }], policy), /Word/u);
    else assert.equal(toNativeAttachments([{ ...entry, status: 'ready', content }], policy)[0].fileName, name);
  }
  for (const [name, bytes] of [["fake.pdf", "plain text"], ["fake.docx", "not zip"],
    ["renamed.pdf", "MZexe"], ["renamed.dat", "PK\u0003\u0004archive"], ["renamed.txt", "#!/bin/sh"]]) {
    const selected = file(name, bytes), [entry] = prepare([selected]);
    await assert.rejects(readAttachment(selected, entry, policy));
  }
});

test('DOCX readable copy preserves original project bytes and fails before send without complete extracted text', async () => {
  const bytes = fixtureZip({ 'word/document.xml': 'synthetic-original' });
  const selected = file('Hợp đồng.docx', bytes, DOCX_MIME), [entry] = prepare([selected]);
  const content = await readAttachment(selected, entry, policy);
  const ready = { ...entry, status: 'ready', content, extractedText: 'Nội dung tiếng Việt\nCột 1\tCột 2' };
  const [original] = toOriginalAttachments([ready], policy), [native] = toNativeAttachments([ready], policy);
  assert.deepEqual(Buffer.from(original.content, 'base64'), bytes); assert.equal(original.fileName, 'Hợp đồng.docx');
  assert.equal(native.mimeType, 'text/plain'); assert.equal(native.fileName, 'Hợp đồng.docx.txt');
  assert.equal(Buffer.from(native.content, 'base64').toString(), ready.extractedText);
  assert.equal(native.sizeBytes, Buffer.byteLength(ready.extractedText)); assert.equal(original.mimeType, DOCX_MIME);
  for (const extractedText of [undefined, '', '   ', 'a\0b', 'x'.repeat(55001)]) {
    assert.throws(() => toNativeAttachments([{ ...ready, extractedText }], policy), /Word/u);
  }
  assert.throws(() => toNativeAttachments([{ ...ready, status: 'reading' }], policy), /đọc/u);
  assert.throws(() => toNativeAttachments([ready], { ...policy, maxBytes: 10 }));
});

test("selection enforces four files, total bytes, text cap and both native per-file limits", () => {
  const textAtLimit = { name: "notes.txt", type: "text/plain", size: MAX_CHAT_TEXT_FILE_BYTES };
  assert.equal(prepare([textAtLimit])[0].sizeBytes, MAX_CHAT_TEXT_FILE_BYTES);
  assert.throws(() => prepare([{ ...textAtLimit, size: MAX_CHAT_TEXT_FILE_BYTES + 1 }]), /200 KiB/);
  assert.throws(() => prepare([textAtLimit], { ...policy, maxBytes: MAX_CHAT_TEXT_FILE_BYTES - 1 }));
  assert.throws(() => prepare([file()], { ...policy, maxPayload: 4 }));
  assert.throws(() => prepare([{ name: "x.png", type: "image/png", size: 100 }], { ...policy, maxImageBytes: 99 }));
  assert.throws(() => prepare([{ name: "x.png", type: "image/png", size: 100 }], { ...policy, maxBytes: 99 }));
  const entries = prepare([file("a.txt"), file("b.txt"), file("c.txt"), file("d.txt")]);
  assert.deepEqual(entries.map((entry) => entry.name), ["a.txt", "b.txt", "c.txt", "d.txt"]);
  assert.throws(() => prepare([file()], policy, entries), /4 tệp/);
  const large = { name: "x.png", type: "image/png", size: 4 * 1024 * 1024 };
  assert.equal(prepare([large, large]).length, 2);
  assert.throws(() => prepare([large, { ...large, size: large.size + 1 }]), /8 MiB/);
  assert.throws(() => prepareAttachments([file(), file()], policy, [], () => "same-id"), /mã tệp/);
});

test("read validates the captured selection and rejects changed, unreadable or disguised bytes", async () => {
  const selected = file(), [entry] = prepare([selected]);
  await assert.rejects(readAttachment(file("other.txt"), entry, policy), /thay đổi/);
  await assert.rejects(readAttachment(selected, { ...entry, status: "ready" }, policy), /thay đổi/);
  const broken = { name: selected.name, size: selected.size, type: selected.type,
    arrayBuffer: async () => new ArrayBuffer(1) };
  await assert.rejects(readAttachment(broken, entry, policy), /Không đọc đủ/);
  broken.arrayBuffer = async () => { throw new Error("file read unavailable"); };
  await assert.rejects(readAttachment(broken, entry, policy), /file read unavailable/);
  for (const selected of [file("fake.png", "Not an image", "image/png"),
    file("binary.txt", Uint8Array.from([65, 0, 66])), file("invalid.txt", Uint8Array.from([255, 254]))]) {
    await assert.rejects(readAttachment(selected, prepare([selected])[0], policy));
  }
});

test("send rechecks current policy and refuses pending, failed or malformed encoded content", async () => {
  const selected = file(), [entry] = prepare([selected]);
  const content = await readAttachment(selected, entry, policy), ready = { ...entry, status: "ready", content };
  assert.throws(() => toNativeAttachments([ready], null), /giới hạn tệp/);
  assert.throws(() => toNativeAttachments([ready], { ...policy, maxBytes: 1 }));
  for (const attachment of [entry, { ...entry, status: "error", error: "failed" }, { ...ready, content: "!" },
    { ...ready, content: "AAAA" }, { ...ready, sizeBytes: entry.sizeBytes + 1 }]) {
    assert.throws(() => toNativeAttachments([attachment], policy));
  }
  const padded = file("small.txt", "ab"), pending = prepare([padded])[0];
  assert.throws(() => toNativeAttachments([{ ...pending, status: "ready", content: "YQ==" }], policy), /không hợp lệ/);
});

test('ZIP keeps original bytes with Windows MIME aliases and never treats it as extracted text', async () => {
  const bytes = fixtureZip({ 'notes.txt': 'Archive content', 'folder/second.txt': 'Second document' });
  for (const mime of ['', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']) {
    const selected = file('documents.ZIP', bytes, mime), [entry] = prepare([selected]);
    const content = await readAttachment(selected, entry, policy);
    const [native] = toNativeAttachments([{ ...entry, status: 'ready', content }], policy);
    assert.equal(native.type, 'file'); assert.equal(native.mimeType, 'application/zip');
    assert.deepEqual(Buffer.from(native.content, 'base64'), bytes);
    assert.equal(native.fileName, 'documents.ZIP');
  }
  const empty = file('empty.zip', fixtureZip({}));
  await readAttachment(empty, prepare([empty])[0], policy);
  for (const content of ['not zip', 'MZexecutable', 'PKwrong']) {
    const selected = file('fake.zip', content);
    await assert.rejects(readAttachment(selected, prepare([selected])[0], policy));
  }
  assert.throws(() => prepare([file('spoof.zip', bytes, 'image/png')]));
  assert.throws(() => prepare([file('too-large.zip', bytes)], { ...policy, maxBytes: bytes.length - 1 }));
});
