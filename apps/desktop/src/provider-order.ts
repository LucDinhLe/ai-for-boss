/** Presentation only: never use brand grouping to grant model/auth access. */
const families = [
  { id: 'openai', label: 'ChatGPT / OpenAI', aliases: ['openai', 'openai-codex', 'codex', 'codex-cli', 'chatgpt'] },
  { id: 'anthropic', label: 'Claude / Anthropic', aliases: ['anthropic', 'claude', 'claude-cli'] },
  { id: 'google', label: 'Gemini / Google', aliases: ['google', 'gemini', 'google-gemini-cli', 'google-vertex', 'google-antigravity'] },
  { id: 'xai', label: 'Grok / xAI', aliases: ['xai', 'grok'] }
];
export function providerFamily(value: string) {
  const normalized = value.toLowerCase();
  return families.find(family => family.aliases.includes(normalized))?.id ?? value;
}
export function providerLabel(value: string) {
  return families.find(family => family.id === providerFamily(value))?.label ?? value;
}
export function compareProviders(a: string, b: string) {
  const rank = (value: string) => { const index = families.findIndex(family => family.id === providerFamily(value)); return index < 0 ? families.length : index; };
  return rank(a) - rank(b) || providerFamily(a).localeCompare(providerFamily(b)) || a.localeCompare(b);
}
export function providerSearchText(value: string) {
  const family = families.find(item => item.id === providerFamily(value));
  return family ? `${family.label} ${family.aliases.join(' ')}` : value;
}
