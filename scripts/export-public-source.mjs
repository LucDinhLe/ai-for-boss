/** Build a new source snapshot without importing private Git history or test recordings. */
import { execFileSync } from 'node:child_process';
import { mkdir, lstat, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd(), target = path.resolve(process.argv[2] ?? 'out/public-source');
if (!target.startsWith(path.join(root, 'out') + path.sep)) throw new Error('Export must be a new directory under out');
if (process.argv.includes('--refresh')) {
  if (JSON.parse(await readFile(path.join(target, 'package.json'), 'utf8')).name !== 'ai-for-boss') throw new Error('Unexpected export target');
} else await mkdir(target, { recursive: false });
const paths = execFileSync('git', ['-c', `safe.directory=${root}`, 'ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
const roots = new Set(['apps', 'packages', 'scripts', 'tests', 'installer', 'manifests']);
const files = new Set(['.editorconfig', '.gitattributes', '.gitignore', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'eslint.config.mjs']);
let copied = 0;
for (const name of paths) {
  if (!files.has(name) && !roots.has(name.split('/')[0]) && !name.startsWith('docs/brand/')) continue;
  if (/(?:^|\/)(?:node_modules|dist|generated|resources|out|tmp|\.git)(?:\/|$)/u.test(name) || name.startsWith('scripts/lab/')) continue;
  const from = path.join(root, name), to = path.join(target, name), entry = await lstat(from);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Non-file source entry: ' + name);
  await mkdir(path.dirname(to), { recursive: true }); await copyFile(from, to); copied++;
}
const pkgPath = path.join(target, 'package.json'), pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
pkg.scripts.test = 'node --test tests/unit/*.test.mjs tests/contract/openclaw-boundary.test.mjs tests/contract/beta-0-runtime-contract.test.mjs';
pkg.scripts.verify = 'corepack pnpm run lint && corepack pnpm run typecheck && corepack pnpm run test && corepack pnpm run build';
delete pkg.scripts['validate:desktop']; delete pkg.scripts['validate:sandbox'];
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
await writeFile(path.join(target, '.gitignore'), (await readFile(path.join(target, '.gitignore'), 'utf8')) + '\n# Local QA recordings and release signing material never belong in public source\nartifacts/\n');
await mkdir(path.join(target, '.github/workflows'), { recursive: true });
await writeFile(path.join(target, '.github/workflows/ci.yml'), `name: Source checks
on: [push, pull_request, workflow_dispatch]
permissions:
  contents: read
jobs:
  check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24.19.0'
      - run: npm install --global corepack --force
      - run: corepack pnpm install --frozen-lockfile
      - run: corepack pnpm run documents:install
      - run: corepack pnpm run verify
`);
console.log(JSON.stringify({ target, copied, historyIncluded: false, recordingsIncluded: false }));
