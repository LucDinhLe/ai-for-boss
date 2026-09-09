/** Open only the known documentation for a distributed official auth method. */
export function resolveProviderDoc(input, catalogue) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2
    || input.action !== 'provider-doc' || typeof input.methodId !== 'string' || !input.methodId || input.methodId.length > 200) throw new Error('Yêu cầu tài liệu chưa hợp lệ.');
  const methods = catalogue?.authMethods?.filter(method => method.id === input.methodId);
  if (!methods || methods.length !== 1) throw new Error('Không tìm thấy phương thức kết nối trong bộ chạy.');
  const target = methods[0].docsPath;
  if (typeof target !== 'string' || !/^\/(?:providers|plugins|concepts)\/[a-z0-9][a-z0-9/-]*(?:#[a-z0-9-]+)?$/u.test(target)
    || target.includes('//') || target.includes('..')) throw new Error('Đường dẫn tài liệu chưa hợp lệ.');
  const url = new URL(target, 'https://docs.openclaw.ai');
  if (url.origin !== 'https://docs.openclaw.ai' || url.username || url.password) throw new Error('Đường dẫn tài liệu chưa hợp lệ.');
  return url.href;
}
