/**
 * Presentation only: never use brand grouping to grant model/auth access.
 *
 * The order is "which account a Vietnamese small-business owner most likely
 * already pays for", not a technical ranking. OpenClaw still owns which of these
 * can actually be connected on this machine; a family listed here without a
 * live route from the core simply does not appear.
 */
const families = [
  { id: 'openai', label: 'ChatGPT / OpenAI', aliases: ['openai', 'openai-codex', 'codex', 'codex-cli', 'chatgpt', 'openai-api-key', 'openai-device-code'] },
  { id: 'anthropic', label: 'Claude / Anthropic', aliases: ['anthropic', 'claude', 'claude-cli', 'anthropic-cli'] },
  { id: 'xai', label: 'Grok / xAI', aliases: ['xai', 'grok', 'xai-oauth', 'xai-api-key', 'xai-device-code'] },
  // Its own brand, not a corner of Google: the Product Owner asks for it by name
  // on the first screen, and it has no browser sign-in of its own (13/09).
  { id: 'antigravity', label: 'Antigravity', aliases: ['antigravity', 'google-antigravity'] },
  { id: 'google', label: 'Gemini / Google', aliases: ['google', 'gemini', 'gemini-cli', 'google-gemini-cli', 'google-vertex', 'gemini-api-key'] },
  { id: 'openrouter', label: 'OpenRouter', aliases: ['openrouter', 'openrouter-oauth', 'openrouter-api-key'] },
  { id: 'github-copilot', label: 'GitHub Copilot', aliases: ['github-copilot', 'copilot', 'copilot-proxy', 'github-copilot-enterprise'] },
  { id: 'deepseek', label: 'DeepSeek', aliases: ['deepseek'] },
  { id: 'minimax', label: 'MiniMax', aliases: ['minimax', 'minimax-portal', 'minimax-global-oauth', 'minimax-cn-oauth', 'minimax-global-api', 'minimax-cn-api'] }
];
/**
 * The four the first screen always shows, in this order. They are shown even when
 * this machine has no route for one yet: the person asked for a list that does not
 * change shape under them. A brand with no route is dimmed and says why; the shell
 * still never invents an auth path the core does not have (D-0022).
 */
export const FEATURED_FAMILIES = Object.freeze(['openai', 'anthropic', 'xai', 'antigravity']);
export const FEATURED_FAMILY_COUNT = FEATURED_FAMILIES.length;
export function providerFamily(value: string) {
  const normalized = value.toLowerCase();
  return families.find(family => family.aliases.includes(normalized))?.id ?? value;
}
export function providerLabel(value: string) {
  return families.find(family => family.id === providerFamily(value))?.label ?? value;
}
export function providerRank(value: string) {
  const index = families.findIndex(family => family.id === providerFamily(value));
  return index < 0 ? families.length : index;
}
export function compareProviders(a: string, b: string) {
  return providerRank(a) - providerRank(b) || providerFamily(a).localeCompare(providerFamily(b)) || a.localeCompare(b);
}
export function providerSearchText(value: string) {
  const family = families.find(item => item.id === providerFamily(value));
  return family ? `${family.label} ${family.aliases.join(' ')}` : value;
}
