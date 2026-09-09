import type { ModelSummary } from './gateway-client';
import { compareProviders, providerSearchText } from './provider-order.ts';

/** Keep the full inventory searchable while bounding rendered options. */
export function modelChoices(models: ModelSummary[], query: string, provider: string, limit: number, currentProvider: string | null = null) {
  const connected = new Set(models.filter(model => model.available === true).map(model => model.provider));
  if (currentProvider) connected.add(currentProvider);
  const providers = [...new Set(models.map(model => model.provider))].sort(compareProviders);
  const term = query.trim().toLocaleLowerCase('vi');
  const matches = models.filter(model => (provider === '__all' || provider === '__connected' ? provider === '__all' || connected.has(model.provider) : model.provider === provider)
    && `${model.name} ${model.id} ${model.provider} ${model.provider}/${model.id} ${providerSearchText(model.provider)}`.toLocaleLowerCase('vi').includes(term));
  const selectable = (model: ModelSummary) => model.available === true && model.selectable !== false;
  matches.sort((a, b) => compareProviders(a.provider, b.provider) || Number(selectable(b)) - Number(selectable(a))
    || (a.name || a.id).localeCompare(b.name || b.id) || a.id.localeCompare(b.id));
  return { models: matches.slice(0, Math.max(1, Math.min(25000, limit))), total: matches.length, providers };
}
