import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
const magic = Buffer.from('AIFB001\n');
const limit = 768 * 1024 * 1024;
function passwordKey(password, salt) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) throw new Error('Mật khẩu sao lưu cần từ 12 đến 1024 ký tự.');
  return scryptSync(password, salt, 32, { N: 32768, maxmem: 64 * 1024 * 1024 });
}
export function encryptBackup(content, { password, protect, version }) {
  if (content.length > limit) throw new Error('Bản sao lưu vượt giới hạn 768 MB của bản thử.');
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = password === undefined ? randomBytes(32) : passwordKey(password, salt);
  const header = Buffer.from(JSON.stringify({ schema: 1, version, mode: password === undefined ? 'device' : 'password',
    salt: salt.toString('base64'), iv: iv.toString('base64'), ...(password === undefined ? { wrappedKey: protect(key.toString('base64')) } : {}) }));
  const size = Buffer.alloc(4); size.writeUInt32BE(header.length);
  const prefix = Buffer.concat([magic, size, header]);
  const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(prefix);
  try { return Buffer.concat([prefix, cipher.update(content), cipher.final(), cipher.getAuthTag()]); }
  finally { key.fill(0); }
}
export function decryptBackup(bytes, { password, unprotect }) {
  if (bytes.length < 32 || bytes.length > limit + 32768 || !bytes.subarray(0, 8).equals(magic)) throw new Error('Không phải bản sao lưu AI for Boss hợp lệ.');
  const size = bytes.readUInt32BE(8), offset = 12 + size;
  if (size > 16384 || offset + 16 >= bytes.length) throw new Error('Thông tin sao lưu không hợp lệ.');
  const header = JSON.parse(bytes.subarray(12, offset));
  if (header.schema !== 1 || !['device', 'password'].includes(header.mode)) throw new Error('Phiên bản sao lưu chưa được hỗ trợ.');
  const salt = Buffer.from(header.salt, 'base64'), iv = Buffer.from(header.iv, 'base64');
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Thông tin mã hóa không hợp lệ.');
  let key;
  try {
    key = header.mode === 'password' ? passwordKey(password, salt) : Buffer.from(unprotect(header.wrappedKey), 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAAD(bytes.subarray(0, offset));
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(offset, -16)), decipher.final()]);
  } catch { throw new Error('Không mở được bản sao lưu: sai mật khẩu, khác tài khoản máy hoặc tệp bị thay đổi.'); }
  finally { key?.fill(0); }
}
