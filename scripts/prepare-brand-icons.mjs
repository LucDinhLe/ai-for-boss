import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = process.argv[2];
if (!core) throw new Error('Pass the pinned OpenClaw package directory.');
const version = JSON.parse(await fs.readFile(path.join(core, 'package.json'), 'utf8')).version;
if (version !== '2026.9.1') throw new Error('Icon source must match the pinned core.');
const target = path.join(root, 'apps/desktop/src/assets/brands');
await fs.mkdir(target, { recursive: true });
const records = [];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function save(name, bytes, source) {
  const svg = bytes.toString('utf8');
  if (!svg.includes('<svg') || /<script|<foreignObject|<!DOCTYPE|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(svg)) throw new Error(`Unsafe SVG ${name}`);
  await fs.writeFile(path.join(target, name), bytes);
  records.push({ file: name, sha256: digest(bytes), source });
}
const upstream = path.join(core, 'dist/control-ui/provider-icons');
for (const name of (await fs.readdir(upstream)).filter(name => /^ProviderIcon-[a-z0-9-]+\.svg$/.test(name)).sort()) {
  await save(name.replace('ProviderIcon-', 'provider-'), await fs.readFile(path.join(upstream, name)), `openclaw@${version}/dist/control-ui/provider-icons/${name}`);
}
await fs.copyFile(path.join(upstream, 'ATTRIBUTION.md'), path.join(target, 'OPENCLAW-ICON-ATTRIBUTION.md'));
const tag = '16.21.0';
const channels = ['telegram', 'discord', 'googlechat', 'line', 'matrix', 'mattermost', 'nextcloud', 'signal', 'twitch', 'wechat', 'whatsapp', 'zalo', 'qq', 'synology'];
for (const slug of channels) {
  const url = `https://raw.githubusercontent.com/simple-icons/simple-icons/${tag}/icons/${slug}.svg`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Cannot fetch pinned icon ${slug}: ${response.status}`);
  await save(`channel-${slug}.svg`, Buffer.from(await response.arrayBuffer()), url);
}
for (const file of ['LICENSE.md', 'DISCLAIMER.md']) {
  const response = await fetch(`https://raw.githubusercontent.com/simple-icons/simple-icons/${tag}/${file}`);
  if (!response.ok) throw new Error(`Cannot fetch icon notice ${file}`);
  await fs.writeFile(path.join(target, `SIMPLE-ICONS-${file}`), await response.text());
}
const slackUrl = 'https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.7.2/svgs/brands/slack.svg';
const slack = await fetch(slackUrl);
if (!slack.ok) throw new Error('Missing pinned Slack mark');
await save('channel-slack.svg', Buffer.from(await slack.arrayBuffer()), slackUrl);
const faLicense = await fetch('https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.7.2/LICENSE.txt');
if (!faLicense.ok) throw new Error('Missing Font Awesome notice');
await fs.writeFile(path.join(target, 'FONT-AWESOME-LICENSE.txt'), await faLicense.text());
await fs.writeFile(path.join(target, 'provenance.json'), JSON.stringify({ openclaw: version, simpleIcons: tag, records }, null, 2) + '\n');
console.log(`${records.length} pinned brand assets prepared; no runtime fetches.`);
