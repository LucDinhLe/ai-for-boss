import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('governance detects standalone credential forms without treating public task filenames as keys', () => {
  const source = readFileSync(new URL('../../scripts/validate-governance.ps1', import.meta.url), 'utf8');
  const pattern = /Name = 'OpenAI-style key'; Pattern = '([^']+)'/.exec(source)?.[1];
  assert.ok(pattern);
  const matcher = new RegExp(pattern);
  const fake = 'sk-' + 'synthetic'.repeat(4);
  for (const value of [fake, `"apiKey":"${fake}"`, `Bearer ${fake}`, `token=${fake}`, `(${fake})`]) assert.match(value, matcher);
  for (const value of ['dist/task-' + 'source'.repeat(5) + '.js', 'dist/windows-task-' + 'module'.repeat(4) + '.js', 'a short identifier sk-demo']) assert.doesNotMatch(value, matcher);
});
