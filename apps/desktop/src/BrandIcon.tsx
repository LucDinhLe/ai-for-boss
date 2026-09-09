import type { CSSProperties } from 'react';

// Build-time assets only. No provider-controlled URL, SVG markup or runtime fetch.
const assets = import.meta.glob<string>('./assets/brands/*.svg', { eager: true, query: '?url', import: 'default' });
const aliases: Record<string, string> = {
  openai: 'codex', 'openai-codex': 'codex', chatgpt: 'codex', anthropic: 'claude', google: 'gemini',
  'google-gemini-cli': 'gemini', 'google-vertex': 'vertexai', xai: 'grok', 'github-copilot': 'copilot',
  'amazon-bedrock': 'bedrock', moonshot: 'kimi', 'moonshot-cn': 'kimi', 'minimax-cn': 'minimax',
  'z-ai': 'zai', 'zai-coding-plan': 'zai', qwen: 'alibaba', 'qwen-portal': 'alibaba',
  'openrouter-ai': 'openrouter', 'vercel-ai-gateway': 'vercel', 'cloudflare-ai-gateway': 'cloudflare',
  'azure-openai': 'microsoft', 'openclaw-zaloclawbot': 'zalo', zalouser: 'zalo',
  'amazon-bedrock-mantle': 'bedrock', 'azure-speech': 'microsoft', 'alibaba-model-studio': 'alibaba',
  'nextcloud-talk': 'nextcloud', 'synology-chat': 'synology', qqbot: 'qq', 'openclaw-weixin': 'wechat'
};
const initials: Record<string, string> = { a2a: 'A2A', reef: 'RF', buzz: 'BZ', clickclack: 'CC', feishu: '飞',
  imessage: 'iM', irc: 'IRC', msteams: 'T', nostr: 'N', raft: 'RT', sms: 'SMS', tlon: 'TL', wecom: '企', yuanbao: '元' };

export default function BrandIcon({ id, label = id, kind = 'provider' }: { id: string; label?: string; kind?: 'provider' | 'channel' }) {
  const key = id.toLowerCase().replace(/^@openclaw\//, '');
  const slug = aliases[key] ?? key;
  const asset = assets[`./assets/brands/${kind}-${slug}.svg`] ?? assets[`./assets/brands/provider-${slug}.svg`];
  return asset
    ? <span className="brand-icon" data-brand={key} aria-hidden="true" style={{ '--brand-mask': `url("${asset}")` } as CSSProperties} />
    : <span className="brand-icon brand-icon--initials" data-brand={key} aria-hidden="true" title={label}>{initials[key] ?? label.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 2).toUpperCase()}</span>;
}
