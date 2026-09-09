export function browserDestination(input: string): string {
  const value = input.trim();
  if (!value || value.length > 4096) throw new Error('Nhập địa chỉ website hoặc từ khóa tìm kiếm.');
  if (/^[a-z][a-z0-9+.-]*:/iu.test(value) && !/^https?:\/\//iu.test(value)) throw new Error('Chỉ mở địa chỉ http hoặc https.');
  if (!/^https?:\/\//iu.test(value) && (/\s/u.test(value) || !value.includes('.'))) return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  return new URL(/^https?:\/\//iu.test(value) ? value : `https://${value}`).href;
}
