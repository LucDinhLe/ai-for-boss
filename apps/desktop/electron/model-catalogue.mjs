const identity = model => JSON.stringify([model.provider, model.id]);

function rows(result) {
  if (!Array.isArray(result?.models) || result.models.length > 25000) throw new Error('Danh mục mô hình chưa hợp lệ. Hãy tải lại.');
  const seen = new Set();
  return result.models.map(model => {
    if (!model || typeof model.id !== 'string' || !model.id.trim() || typeof model.provider !== 'string' || !model.provider.trim()) {
      throw new Error('Danh mục mô hình chưa hợp lệ. Hãy tải lại.');
    }
    const key = identity(model);
    if (seen.has(key)) throw new Error('Danh mục có mô hình trùng định danh. Hãy tải lại.');
    seen.add(key);
    return model;
  });
}

function options(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['agentId', 'refresh'].includes(key))
    || (input.agentId !== undefined && (typeof input.agentId !== 'string' || !/^[a-z0-9_-]{1,160}$/u.test(input.agentId)))
    || (input.refresh !== undefined && typeof input.refresh !== 'boolean')) throw new Error('Yêu cầu danh mục chưa hợp lệ.');
  return input.agentId === undefined ? {} : { agentId: input.agentId };
}

/** Full browse is not permission: native default view remains the selection gate. */
export async function loadModelCatalogue(request, input = {}) {
  const scope = options(input);
  const discovery = await request('models.list', { ...scope, view: 'all', ...(input.refresh === true ? { refresh: true } : {}) });
  const full = rows(discovery);
  // Read after discovery, so the initial short prepared snapshot cannot hide newly published rows.
  const allowed = rows(await request('models.list', scope));
  const offered = new Map(allowed.map(model => [identity(model), model]));
  const all = new Map(full.map(model => [identity(model), model]));
  // Preserve explicit configured models even when they are absent from the browse inventory.
  for (const model of allowed) if (!all.has(identity(model))) all.set(identity(model), model);
  const models = [...all.values()].map(model => {
    const selected = offered.get(identity(model));
    const current = selected ?? model;
    return { ...current, selectable: selected?.available === true,
      ...!selected ? { selectionReason: 'not-offered' } : {} };
  });
  const connectedProviders = new Set(models.filter(model => model.available === true).map(model => model.provider));
  const providerOutcomes = Array.isArray(discovery.providerOutcomes) ? discovery.providerOutcomes.map(outcome => {
    if (!outcome || typeof outcome.provider !== 'string' || !['ready', 'auth-rejected', 'unavailable'].includes(outcome.status)) {
      throw new Error('Chưa xác nhận được trạng thái làm mới nhà cung cấp. Hãy tải lại.');
    }
    return { provider: outcome.provider, status: outcome.status };
  }) : [];
  return { models, connectedProviders: [...connectedProviders].sort(), providerOutcomes, source: 'openclaw',
    refreshed: input.refresh === true && providerOutcomes.every(outcome => outcome.status === 'ready') };
}

/** Lazy full discovery fixes prepared-only omissions without admitting a policy-excluded model. */
export async function findSelectableModel(request, model, input = {}) {
  const scope = options(input);
  const initial = rows(await request('models.list', scope));
  const exact = initial.find(item => identity(item) === identity(model));
  if (exact) return exact.available === true ? exact : null;
  const catalog = await loadModelCatalogue(request, input);
  return catalog.models.find(item => identity(item) === identity(model) && item.selectable === true) ?? null;
}
