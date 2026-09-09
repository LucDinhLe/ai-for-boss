import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packageIconForPlatform, verifyBrandAssets } from './lib/brand-assets.mjs';

export function safeInstallerVersion(value) {
  if (typeof value !== 'string' || !/^[0-9A-Za-z](?:[0-9A-Za-z.-]{0,69}[0-9A-Za-z])?$/.test(value)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) throw new Error('Invalid installer version');
  return value;
}
export function nsisString(value) {
  if (/[\r\n\0]/.test(value)) throw new Error('Invalid NSIS path');
  return value.replaceAll('$', () => '$$').replaceAll('"', () => '$\\"');
}
export async function installerManifest(source, version) {
  safeInstallerVersion(version);
  const files = [], names = new Set(), pending = [];
  async function walk(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Installer payload must contain real files: ${entry.name}`);
      if (entry.isDirectory()) { await walk(absolute); continue; }
      if (!entry.isFile()) throw new Error('Non-file payload entry');
      const relative = path.relative(source, absolute).split(path.sep).join('/');
      if (relative.split('/').some(part => !part || part === '.' || part === '..' || /[\\:\r\n\0]/.test(part)) || names.has(relative.toLowerCase())) throw new Error('Unsafe/duplicate payload path');
      names.add(relative.toLowerCase());
      pending.push({ absolute, relative });
    }
  }
  await walk(source);
  let cursor = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (cursor < pending.length) {
      const { absolute, relative } = pending[cursor++];
      const hash = crypto.createHash('sha256');
      for await (const chunk of fsSync.createReadStream(absolute)) hash.update(chunk);
      files.push({ path: relative, bytes: (await fs.stat(absolute)).size, sha256: hash.digest('hex') });
    }
  }));
  files.sort((a, b) => a.path.localeCompare(b.path));
  for (const required of ['AI-for-Boss.exe', 'resources/app.asar', 'resources/runtime/node/node.exe', 'resources/node_modules/openclaw/package.json']) {
    if (!names.has(required.toLowerCase())) throw new Error(`Installer missing ${required}`);
  }
  return { schemaVersion: 1, product: 'AI for Boss', version, files, totalBytes: files.reduce((sum, item) => sum + item.bytes, 0), signed: false, classification: 'experimental-internal' };
}
export function payloadInclude(source, manifest) {
  let current = '', content = '; Generated: exact payload, no recursive delete.\n';
  for (const file of manifest.files) {
    const directory = path.posix.dirname(file.path);
    if (directory !== current) { content += `SetOutPath "$Stage${directory === '.' ? '' : '\\' + nsisString(directory.replaceAll('/', '\\'))}"\n`; current = directory; }
    if (/^resources\/(node_modules\/|runtime\/node\/)/u.test(file.path)) content += `IfFileExists "$Stage\\${nsisString(file.path.replaceAll('/', '\\'))}" +2\n`;
    content += `File "${nsisString(path.join(source, ...file.path.split('/')))}"\n`;
  }
  return content;
}
async function main() {
  const args = process.argv.slice(2), option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
  const source = path.resolve(option('--source') ?? ''), version = safeInstallerVersion(option('--version'));
  const output = path.resolve(option('--output') ?? ''), makensis = option('--makensis');
  if (!option('--source') || !option('--output') || !makensis || process.platform !== 'win32') throw new Error('Provide --source --version --output --makensis on Windows');
  if (fsSync.existsSync(output)) throw new Error('Refusing to overwrite an existing installer');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const brandRoot = path.join(repo, 'docs/brand');
  const brand = verifyBrandAssets(brandRoot), brandIcon = packageIconForPlatform(brandRoot, 'win32');
  const work = await fs.mkdtemp(path.join(path.dirname(output), '.installer-build-'));
  const manifest = await installerManifest(source, version);
  const manifestPath = path.join(work, 'payload-manifest.json'), includePath = path.join(work, 'payload.nsh');
  const supportPath = path.join(work, 'install-support.ps1');
  const installerScript = path.join(work, 'installer.nsi');
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await fs.writeFile(includePath, '\ufeff' + payloadInclude(source, manifest));
  await fs.writeFile(supportPath, '\ufeff' + (await fs.readFile(path.join(repo, 'installer/install-support.ps1'), 'utf8')).replace(/^\ufeff/, ''));
  await fs.writeFile(installerScript, '\ufeff' + (await fs.readFile(path.join(repo, 'installer/ai-for-boss.nsi'), 'utf8')).replace(/^\ufeff/, ''));
  const parameters = ['/V2', `/DVERSION=${version}`, `/DOUT_FILE=${output}`, `/DPAYLOAD_INCLUDE=${includePath}`, `/DPAYLOAD_MANIFEST=${manifestPath}`,
    `/DSUPPORT_SCRIPT=${supportPath}`, `/DBRAND_ICON=${brandIcon}`,
    ...(args.includes('--fast') ? ['/DFAST_BUILD'] : []), installerScript];
  const code = await new Promise((resolve, reject) => { const child = spawn(makensis, parameters, { cwd: repo, windowsHide: true, stdio: 'inherit' }); child.on('error', reject); child.on('exit', resolve); });
  if (code !== 0) throw new Error(`NSIS failed (${code}); build inputs retained at ${work}`);
  const hash = crypto.createHash('sha256'); for await (const chunk of fsSync.createReadStream(output)) hash.update(chunk);
  await fs.writeFile(output + '.json', JSON.stringify({ ...manifest, installer: path.basename(output), installerBytes: (await fs.stat(output)).size, installerSha256: hash.digest('hex'), sourceDirectory: source, generatedDirectory: work,
    brand: { sourceCommit: brand.sourceCommit, iconSha256: brand.files.find(file => file.path === 'assets/app-icons/icon.ico').sha256 } }, null, 2) + '\n');
  console.log(`Internal installer verified inputs: ${output}; ${manifest.files.length} files; ${manifest.totalBytes} bytes`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
