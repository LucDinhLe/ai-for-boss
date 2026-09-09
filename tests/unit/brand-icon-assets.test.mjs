import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../apps/desktop/src/assets/brands/', import.meta.url);
const provenance = JSON.parse(readFileSync(new URL('provenance.json', root), 'utf8'));
test('shipped provider and channel marks match pinned provenance and contain no active/external content', () => {
  assert.equal(provenance.openclaw, '2026.9.1');
  assert.equal(provenance.simpleIcons, '16.21.0');
  const svgs = readdirSync(root).filter(name => name.endsWith('.svg')).sort();
  assert.equal(svgs.length, 95);
  assert.deepEqual(provenance.records.map(r => r.file).sort(), svgs);
  for (const record of provenance.records) {
    const bytes = readFileSync(new URL(record.file, root)), svg = bytes.toString();
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, record.file);
    assert.doesNotMatch(svg, /<script|<foreignObject|<!ENTITY|<!DOCTYPE|\son\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i, record.file);
  }
  for (const provider of ['codex', 'claude', 'gemini']) assert.ok(svgs.includes(`provider-${provider}.svg`));
  for (const channel of ['telegram', 'zalo', 'slack', 'discord', 'whatsapp', 'signal', 'wechat']) assert.ok(svgs.includes(`channel-${channel}.svg`));
});
test('redistribution notices are available to the application build', () => {
  for (const notice of ['OPENCLAW-ICON-ATTRIBUTION.md', 'SIMPLE-ICONS-LICENSE.md', 'SIMPLE-ICONS-DISCLAIMER.md', 'FONT-AWESOME-LICENSE.txt']) {
    assert.ok(readFileSync(new URL(notice, root), 'utf8').length > 100, notice);
  }
});
