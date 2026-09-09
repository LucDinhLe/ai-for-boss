export type AttachmentPolicy = Readonly<{ maxBytes: number; maxImageBytes: number; maxPayload: number }>;
export type ChatAttachment = Readonly<{
  id: string; name: string; sizeBytes: number; mimeType: string;
  status: "reading" | "ready" | "error"; content?: string; extractedText?: string; error?: string;
}>;
export type NativeChatAttachment = {
  type: "image" | "file"; mimeType: string; fileName: string; content: string; sizeBytes: number;
};

export const MAX_CHAT_FILES = 4;
export const MAX_CHAT_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_CHAT_TEXT_FILE_BYTES = 200 * 1024;
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOCX_TEXT_CHARS = 55000;
// The native entrypoint accepts data-file bytes and sniffs MIME itself. An empty
// accept filter exposes all user documents; ZIP is transported intact, never extracted here.
export const CHAT_FILE_ACCEPT = "";
const blockedExtensions = new Set("exe dll com scr msi msix appx bat cmd ps1 psm1 sh bash zsh js mjs cjs vbs vbe jse wsf wsh hta lnk url reg jar rar 7z tar gz bz2 xz iso dmg cab docm xlsm pptm".split(" "));
const officeZip = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp"]);

const formats: Record<string, { mimeType: string; aliases?: readonly string[] }> = {
  zip: { mimeType: "application/zip", aliases: ["application/x-zip-compressed"] },
  png: { mimeType: "image/png" }, jpg: { mimeType: "image/jpeg" }, jpeg: { mimeType: "image/jpeg" },
  webp: { mimeType: "image/webp" }, gif: { mimeType: "image/gif" },
  txt: { mimeType: "text/plain" }, md: { mimeType: "text/markdown", aliases: ["text/plain"] },
  csv: { mimeType: "text/csv", aliases: ["text/plain", "application/vnd.ms-excel"] },
  json: { mimeType: "application/json", aliases: ["text/json", "text/plain"] },
  html: { mimeType: "text/html" }, htm: { mimeType: "text/html" },
  pdf: { mimeType: "application/pdf" },
  doc: { mimeType: "application/msword" }, docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", aliases: ["application/zip"] },
  xls: { mimeType: "application/vnd.ms-excel" }, xlsx: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", aliases: ["application/zip"] },
  ppt: { mimeType: "application/vnd.ms-powerpoint" }, pptx: { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", aliases: ["application/zip"] },
  heic: { mimeType: "image/heic" }, heif: { mimeType: "image/heif" },
  svg: { mimeType: "image/svg+xml" }, bmp: { mimeType: "image/bmp" }, tiff: { mimeType: "image/tiff" }, tif: { mimeType: "image/tiff" },
  mp3: { mimeType: "audio/mpeg" }, wav: { mimeType: "audio/wav", aliases: ["audio/x-wav"] },
  m4a: { mimeType: "audio/mp4", aliases: ["audio/x-m4a"] }, ogg: { mimeType: "audio/ogg", aliases: ["video/ogg"] }, flac: { mimeType: "audio/flac" },
  mp4: { mimeType: "video/mp4" }, webm: { mimeType: "video/webm", aliases: ["audio/webm"] }, mov: { mimeType: "video/quicktime" }
};

export function attachmentReadHint(mime: string): string {
  if (mime === "application/zip") return "Đính kèm ZIP nguyên vẹn; chưa tự giải nén hoặc đọc các tệp bên trong. Để AI đọc ngay, chọn tài liệu đã giải nén.";
  if (mime === DOCX_MIME) return "Đọc chữ và bảng trong Word; không đọc hình ảnh hoặc giữ bố cục trang.";
  if (/word|excel|powerpoint|officedocument|opendocument/u.test(mime)) return "Đính kèm được; lõi hiện chưa tự đọc nội dung Office. Dùng PDF hoặc TXT để đọc ngay.";
  return mime.startsWith("text/") || mime === "application/json" ? "" : mime === "application/pdf"
    ? "PDF do OpenClaw trích xuất; tài liệu quét hoặc dài có thể chỉ đọc được một phần."
    : "Đã chọn tệp; khả năng đọc nội dung phụ thuộc mô hình và công cụ đang bật.";
}

export function validateAttachmentPolicy(value: unknown): AttachmentPolicy {
  const policy = value as Partial<AttachmentPolicy> | null;
  if (!policy || [policy.maxBytes, policy.maxImageBytes, policy.maxPayload]
    .some((limit) => !Number.isSafeInteger(limit) || (limit ?? 0) <= 0)) {
    throw new Error("Chưa nhận được giới hạn tệp từ kết nối AI. Hãy kết nối lại rồi chọn tệp.");
  }
  return { maxBytes: policy.maxBytes!, maxImageBytes: policy.maxImageBytes!, maxPayload: policy.maxPayload! };
}

function metadata(file: Pick<File, "name" | "size" | "type">, policy: AttachmentPolicy) {
  if (!file || typeof file.name !== "string" || !file.name.trim() || file.name.length > 255
    || /[\\/]/u.test(file.name) || [...file.name].some((character) => character.charCodeAt(0) < 32) || typeof file.type !== "string"
    || !Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("Tệp rỗng hoặc thông tin tệp không hợp lệ.");
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const declaredMime = file.type.toLowerCase();
  if (blockedExtensions.has(extension) || ["application/x-msdownload", "application/x-executable", "application/x-sh", "application/x-dosexec"].includes(declaredMime)) {
    throw new Error("Không đính kèm tệp thực thi, mã chạy hoặc loại gói nén này. ZIP được hỗ trợ dưới dạng tệp dữ liệu.");
  }
  if (declaredMime && !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u.test(declaredMime)) throw new Error("Định dạng tệp không hợp lệ.");
  const format = Object.hasOwn(formats, extension) ? formats[extension] : { mimeType: declaredMime || "application/octet-stream" };
  if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== format.mimeType && !format.aliases?.includes(declaredMime)) throw new Error("Loại tệp không khớp phần mở rộng.");
  const image = format.mimeType.startsWith("image/");
  const plain = format.mimeType.startsWith("text/") || format.mimeType === "application/json";
  const limit = Math.min(policy.maxBytes, image ? policy.maxImageBytes : plain ? MAX_CHAT_TEXT_FILE_BYTES : MAX_CHAT_FILE_BYTES, MAX_CHAT_FILE_BYTES);
  if (file.size > limit || 4 * Math.ceil(file.size / 3) > policy.maxPayload) {
    throw new Error(image ? "Ảnh vượt giới hạn dung lượng của kết nối AI."
      : plain ? "Tệp văn bản vượt giới hạn kết nối hoặc 200 KiB." : "Tệp vượt giới hạn dung lượng của kết nối AI.");
  }
  return { name: file.name, sizeBytes: file.size, mimeType: format.mimeType };
}

function checkSelection(entries: readonly Pick<ChatAttachment, "sizeBytes">[]) {
  if (entries.length > MAX_CHAT_FILES) throw new Error("Mỗi tin nhắn chỉ đính kèm tối đa 4 tệp.");
  if (entries.reduce((total, entry) => total + entry.sizeBytes, 0) > MAX_CHAT_FILE_BYTES) {
    throw new Error("Tổng tệp đính kèm không được vượt quá 8 MiB.");
  }
}

/** Synchronous admission reserves the chosen files before any asynchronous read. */
export function prepareAttachments(files: readonly File[], policy: unknown, existing: readonly ChatAttachment[] = [],
  makeId = () => crypto.randomUUID()): ChatAttachment[] {
  const limits = validateAttachmentPolicy(policy);
  const admitted = files.map((file) => metadata(file, limits));
  checkSelection([...existing, ...admitted]);
  const ids = new Set(existing.map((entry) => entry.id));
  return admitted.map((entry) => {
    const id = makeId();
    if (typeof id !== "string" || !id || ids.has(id)) throw new Error("Không tạo được mã tệp. Hãy chọn lại tệp.");
    ids.add(id);
    return Object.freeze({ ...entry, id, status: "reading" });
  });
}

function validImageHeader(bytes: Uint8Array, mimeType: string): boolean {
  const has = (prefix: readonly number[], offset = 0) => prefix.every((value, index) => bytes[offset + index] === value);
  if (mimeType === "image/png") return has([137, 80, 78, 71, 13, 10, 26, 10]);
  if (mimeType === "image/jpeg") return has([255, 216, 255]);
  if (mimeType === "image/gif") return has([71, 73, 70, 56]) && [55, 57].includes(bytes[4]) && bytes[5] === 97;
  return mimeType === "image/webp" && has([82, 73, 70, 70]) && has([87, 69, 66, 80], 8);
}

/** Reads only the browser File selected by the user; no path or URL is accepted. */
export async function readAttachment(file: File, prepared: ChatAttachment, policy: unknown): Promise<string> {
  const selected = metadata(file, validateAttachmentPolicy(policy));
  if (prepared.status !== "reading" || selected.name !== prepared.name || selected.sizeBytes !== prepared.sizeBytes
    || selected.mimeType !== prepared.mimeType || typeof file.arrayBuffer !== "function") {
    throw new Error("Tệp đã thay đổi. Hãy bỏ và chọn lại tệp.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== prepared.sizeBytes) throw new Error("Không đọc đủ nội dung tệp. Hãy chọn lại tệp.");
  const prefix = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (prefix(77, 90) || prefix(127, 69, 76, 70) || prefix(35, 33) || prefix(207, 250, 237, 254) || prefix(254, 237, 250, 207)
    || prefix(82, 97, 114, 33) || prefix(55, 122, 188, 175) || prefix(31, 139)
    || (prefix(80, 75) && !officeZip.has(extension) && extension !== "zip")) throw new Error("Tệp chứa mã thực thi hoặc gói nén không được hỗ trợ.");
  if (["image/png", "image/jpeg", "image/gif", "image/webp"].includes(prepared.mimeType)) {
    if (!validImageHeader(bytes, prepared.mimeType)) throw new Error("Nội dung ảnh không khớp định dạng đã chọn.");
  } else if (prepared.mimeType === "application/pdf") {
    if (!prefix(37, 80, 68, 70, 45)) throw new Error("Nội dung không phải tệp PDF.");
  } else if (extension === "zip") {
    if (!prefix(80, 75, 3, 4) && !prefix(80, 75, 5, 6)) throw new Error("Nội dung không có định dạng ZIP. Hãy chọn lại tệp ZIP gốc.");
  } else if (officeZip.has(extension)) {
    if (!prefix(80, 75, 3, 4)) throw new Error("Nội dung không khớp tài liệu Office đã chọn.");
  } else if (prepared.mimeType.startsWith("text/") || prepared.mimeType === "application/json") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (text.includes("\0")) throw new Error("binary");
    } catch { throw new Error("Tệp văn bản phải dùng UTF-8 và không chứa dữ liệu nhị phân."); }
  }
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

/** Original bytes for project storage and the host's selected-document parser. */
export function toOriginalAttachments(entries: readonly ChatAttachment[], policy: unknown): NativeChatAttachment[] {
  if (entries.length === 0) return [];
  const limits = validateAttachmentPolicy(policy);
  checkSelection(entries);
  return entries.map((entry) => {
    metadata({ name: entry.name, size: entry.sizeBytes, type: entry.mimeType }, limits);
    if (entry.status !== "ready" || typeof entry.content !== "string"
      || !/^[A-Za-z0-9+/]*={0,2}$/u.test(entry.content)
      || entry.content.length !== 4 * Math.ceil(entry.sizeBytes / 3)) {
      throw new Error("Chờ đọc xong tệp hoặc bỏ tệp chưa đọc được trước khi gửi.");
    }
    const padding = entry.content.endsWith("==") ? 2 : entry.content.endsWith("=") ? 1 : 0;
    if (entry.content.length / 4 * 3 - padding !== entry.sizeBytes) throw new Error("Nội dung tệp không hợp lệ. Hãy chọn lại tệp.");
    return { type: entry.mimeType.startsWith("image/") ? "image" : "file", mimeType: entry.mimeType,
      fileName: entry.name, content: entry.content, sizeBytes: entry.sizeBytes };
  });
}

/** Readable derived DOCX text uses the public native plain-text attachment path. */
export function toNativeAttachments(entries: readonly ChatAttachment[], policy: unknown): NativeChatAttachment[] {
  const originals = toOriginalAttachments(entries, policy);
  if (!originals.length) return [];
  const limits = validateAttachmentPolicy(policy);
  const result = originals.map((original, index) => {
    if (original.mimeType !== DOCX_MIME) return original;
    const text = entries[index].extractedText;
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_DOCX_TEXT_CHARS || text.includes('\0')) {
      throw new Error('Chờ đọc xong nội dung Word hoặc chọn lại tệp trước khi gửi.');
    }
    const bytes = new TextEncoder().encode(text);
    const fileName = original.fileName.length <= 251 ? `${original.fileName}.txt`
      : `${original.fileName.slice(0, 246).replace(/[\uD800-\uDBFF]$/u, '')}.docx.txt`;
    metadata({ name: fileName, type: 'text/plain', size: bytes.byteLength }, limits);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return { type: 'file' as const, fileName, mimeType: 'text/plain', content: btoa(binary), sizeBytes: bytes.byteLength };
  });
  checkSelection(result);
  return result;
}
