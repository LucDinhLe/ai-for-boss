import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Read distributed metadata only; never import private engine modules or user state.
const index = process.argv.indexOf('--openclaw-directory');
if (index < 0 || !process.argv[index + 1]) throw new Error('Provide the pinned OpenClaw package directory.');
const root = path.resolve(process.argv[index + 1]);
const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '2026.9.1') throw new Error('Review the runtime train before regenerating this catalogue.');
const extensionRoot = path.join(root, 'dist/extensions');
const files = [path.join(root, 'dist/channel-catalog.json'), ...readdirSync(extensionRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => path.join(extensionRoot, entry.name, 'package.json')).filter(existsSync).sort()];
const entries = new Map(), sources = [];
for (const file of files) {
  const bytes = readFileSync(file), data = JSON.parse(bytes.toString('utf8'));
  let count = 0;
  for (const item of data.entries ?? [data]) {
    const channel = item.openclaw?.channel;
    if (!channel?.id) continue;
    entries.set(channel.id, { id: channel.id, label: channel.label ?? channel.id, description: channel.blurb ?? '',
      docsPath: channel.docsPath ?? '', bundled: path.basename(file) === 'package.json', packageName: item.name ?? '' });
    count++;
  }
  if (count) sources.push({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: createHash('sha256').update(bytes).digest('hex') });
}
const channels = [...entries.values()].sort((a, b) => Number(!a.bundled) - Number(!b.bundled)
  || (a.label.toLowerCase() < b.label.toLowerCase() ? -1 : a.label.toLowerCase() > b.label.toLowerCase() ? 1 : 0));
function source(relative) {
  const bytes = readFileSync(path.join(root, relative));
  if (!sources.some(item => item.path === relative)) sources.push({ path: relative, sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes.toString('utf8');
}
const plugins = [], providers = new Map(), authMethods = [];
let distribution = '';
for (const line of source('docs/plugins/plugin-inventory.md').split('\n')) {
  if (line.startsWith('## ')) distribution = line.slice(3).trim();
  const match = /^- \*\*\[([^\]]+)\]\(([^)]+)\)\*\* \(`([^`]+)`\) - (.+)\s*$/u.exec(line);
  if (!match || distribution === 'Source checkout only') continue;
  const [, id, docsPath, packageName, details] = match;
  const bundled = existsSync(path.join(extensionRoot, id, 'openclaw.plugin.json'));
  const description = details.replace(/^(?:included in OpenClaw|npm; ClawHub(?:: `[^`]+`)?|npm)\. /u, '');
  plugins.push({ id, label: id, description, docsPath, packageName, bundled });
}
for (const entry of readdirSync(extensionRoot, { withFileTypes: true }).filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const relative = `dist/extensions/${entry.name}/openclaw.plugin.json`;
  if (!existsSync(path.join(root, relative))) continue;
  const manifest = JSON.parse(source(relative));
  const plugin = plugins.find(item => item.id === manifest.id);
  if (!plugin) throw new Error(`Inventory missing distributed plugin ${manifest.id}`);
  plugin.kinds = manifest.kind ? [manifest.kind] : [];
  plugin.providers = manifest.providers ?? [];
  for (const choice of manifest.providerAuthChoices ?? []) {
    if (!choice.choiceId || !choice.provider || !choice.method || !choice.choiceLabel) throw new Error(`Invalid public auth method in ${relative}`);
    authMethods.push({ id: choice.choiceId, provider: choice.provider, method: choice.method, label: choice.choiceLabel,
      hint: choice.choiceHint ?? '', pluginId: manifest.id, docsPath: plugin.docsPath,
      guidedSecret: choice.appGuidedSecret === true,
      guidedAuth: ['oauth', 'device-code'].includes(choice.appGuidedAuth) ? choice.appGuidedAuth : null,
      discovery: choice.appGuidedDiscovery === true, manualOnly: choice.assistantVisibility === 'manual-only',
      scopes: choice.onboardingScopes ?? ['text-inference'] });
  }
  for (const id of manifest.providers ?? []) providers.set(id, { id, label: id, description: plugin.description, bundled: true, pluginId: manifest.id, docsPath: plugin.docsPath });
}
// Public directory includes separately installable providers, speech and local backends.
for (const line of source('docs/providers/index.md').split('## Shared overview pages')[0].split('\n')) {
  const match = /^- \[([^\]]+)\]\((\/(?:providers|plugins|concepts)\/[^)]+)\)/u.exec(line);
  if (!match) continue;
  const [, label, docsPath] = match, id = docsPath.split('/').at(-1).split('#').at(-1);
  const relative = `docs${docsPath.split('#')[0]}.md`;
  const description = existsSync(path.join(root, relative)) ? /^summary: "([^"]+)"/mu.exec(source(relative))?.[1] ?? label : label;
  const existing = providers.get(id);
  providers.set(id, { id, label, description, bundled: existing?.bundled ?? false, pluginId: existing?.pluginId ?? id, docsPath });
}
const content = JSON.stringify({ version, channels, plugins, providers: [...providers.values()].sort((a, b) => a.label.localeCompare(b.label)),
  authMethods: authMethods.sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id)), sources }, null, 2) + '\n';
const target = fileURLToPath(new URL('../apps/desktop/electron/native-catalog.json', import.meta.url));
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(content)) !== JSON.stringify(JSON.parse(readFileSync(target, 'utf8')))) throw new Error('Native catalogue differs from the pinned package metadata.');
} else writeFileSync(target, content);
console.log(`Native catalogue ${version}: ${channels.length} channels, ${sources.length} sources verified.`);
