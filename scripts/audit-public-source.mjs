/** Local-only privacy inventory. Reports categories and paths, never matched values. */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root}`, ...args], { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['provider-token', /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,})\b/u],
  ['personal-email', /[A-Z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo)\.[A-Z]{2,}/iu],
  ['local-user-path', /(?:[A-Z]:[\\/]+Users[\\/]+(?:FixtureUser|[^\\/\s"'<>]{3,})|\/Users\/[a-z][a-z0-9_-]+)\b/iu],
  ['private-profile', /(?:auth-profiles\.json|oauth_creds\.json|device-token)[\s\S]{0,100}(?:access_token|refresh_token|"token"\s*:)/u]
];
const objects = git('rev-list', '--objects', '--all').toString().trim().split('\n');
const input = objects.map(line => line.split(' ')[0]).join('\n') + '\n';
const metadata = execFileSync('git', ['-c', `safe.directory=${root}`, 'cat-file', '--batch-check'], { input, maxBuffer: 16 * 1024 * 1024 }).toString().trim().split('\n');
const descriptions = new Map(metadata.map(line => { const [oid, type, size] = line.split(' '); return [oid, { type, size: Number(size) }]; }));
const contents = new Map();
const textObjects = objects.filter(line => { const item = descriptions.get(line.split(' ')[0]); return item?.type === 'blob' && item.size <= 4 * 1024 * 1024 && !/\.(?:png|jpg|jpeg|webp|mp4|wav|zip|exe|sqlite|db)$/iu.test(line); }).map(line => line.split(' ')[0]);
for (let start = 0; start < textObjects.length; start += 30) {
  const batch = execFileSync('git', ['-c', `safe.directory=${root}`, 'cat-file', '--batch'], { input: textObjects.slice(start, start + 30).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 });
  let offset = 0;
  while (offset < batch.length) {
    const end = batch.indexOf(10, offset), [oid, type, rawSize] = batch.subarray(offset, end).toString().split(' '), size = Number(rawSize);
    if (end < 0 || type !== 'blob' || !Number.isSafeInteger(size)) throw new Error('Invalid Git batch response');
    contents.set(oid, batch.subarray(end + 1, end + 1 + size)); offset = end + 2 + size;
  }
}
const findings = [], counts = {}; let blobs = 0;
for (const line of objects) {
  const split = line.indexOf(' '); if (split < 0) continue;
  const oid = line.slice(0, split), name = line.slice(split + 1);
  if (descriptions.get(oid)?.type !== 'blob') continue;
  blobs++;
  const categories = [];
  if (/\.(?:png|jpg|jpeg|webp|mp4|wav|zip|exe|sqlite|db)$/iu.test(name)) categories.push('binary-needs-review');
  if (descriptions.get(oid).size > 4 * 1024 * 1024) categories.push('large-file-needs-review');
  else if (!categories.includes('binary-needs-review')) {
    const data = contents.get(oid); if (!data) throw new Error('Missing Git content');
    if (!data.includes(0)) for (const [category, pattern] of rules) if (pattern.test(data.toString('utf8'))) categories.push(category);
  }
  if (categories.length) { findings.push({ oid, path: name, categories }); for (const category of categories) counts[category] = (counts[category] ?? 0) + 1; }
}
const output = process.argv[2]; if (!output) throw new Error('Expected local audit output path');
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ scope: 'all reachable Git history; heuristic inventory, manual review required', blobs, counts, findings }, null, 2));
console.log(JSON.stringify({ blobs, counts, report: output }));
