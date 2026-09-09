const modes = ['none', 'short', 'long'];
function project(snapshot) {
  if (!snapshot?.config || typeof snapshot.hash !== 'string' || !snapshot.hash) throw new Error('Chưa đọc được cài đặt mô hình.');
  const retention = snapshot.config.agents?.defaults?.params?.cacheRetention;
  return { revision: snapshot.hash, cacheRetention: modes.includes(retention) ? retention : null,
    catalogRefresh: snapshot.config.models?.catalogRefresh?.enabled !== false };
}

/** Only two public scalar settings; never expose config or credentials to the renderer. */
export async function modelSettings(request, input) {
  const saving = input.action === 'model-settings-save';
  const allowed = saving ? ['action', 'revision', 'cacheRetention', 'catalogRefresh'] : ['action'];
  if (!['model-settings', 'model-settings-save'].includes(input.action) || Object.keys(input).some(key => !allowed.includes(key))
    || saving && (typeof input.revision !== 'string' || input.revision.length > 256
      || input.cacheRetention !== null && !modes.includes(input.cacheRetention) || typeof input.catalogRefresh !== 'boolean')) throw new Error('Cài đặt chưa hợp lệ.');
  const before = await request('config.get', {}), current = project(before);
  if (!saving) return current;
  if (current.revision !== input.revision) throw new Error('Cài đặt đã thay đổi. Hãy tải lại trước khi lưu.');
  if (input.cacheRetention === null && current.cacheRetention !== null) throw new Error('Hãy tải lại cài đặt cache.');
  const patch = { ...(input.cacheRetention === null ? {} : { agents: { defaults: { params: { cacheRetention: input.cacheRetention } } } }),
    models: { catalogRefresh: { enabled: input.catalogRefresh } } };
  const ack = await request('config.patch', { baseHash: before.hash, raw: JSON.stringify(patch) });
  if (ack?.ok !== true || typeof ack.hash !== 'string' && ack.noop !== true) throw new Error('Chưa xác nhận lưu cài đặt. Hãy tải lại.');
  const after = await request('config.get', {}), result = project(after);
  if (result.revision !== (ack.hash ?? before.hash) || result.cacheRetention !== input.cacheRetention || result.catalogRefresh !== input.catalogRefresh)
    throw new Error('Cài đặt đã gửi nhưng chưa xác nhận được kết quả. Hãy tải lại.');
  return { ...result, applied: Boolean(after.configRevisionHash && after.appliedConfigHash === after.configRevisionHash) };
}
