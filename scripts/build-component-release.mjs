import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, copyFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createHash, sign, createPublicKey } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { installerManifest } from './build-internal-installer.mjs';
import { verifyUpdateEnvelope } from '../apps/desktop/electron/component-update.mjs';
const require = createRequire(new URL('../apps/desktop/package.json', import.meta.url)), JSZip = require('jszip');
const [source, output, keyFile, reuseRelease] = process.argv.slice(2);
if (!source || !output || !keyFile) throw new Error('Expected packaged source, new output directory, and private signing key path');
const pkg = JSON.parse(await readFile(new URL('../apps/desktop/package.json', import.meta.url), 'utf8'));
const manifest = await installerManifest(path.resolve(source), pkg.version);
const privateKey = await readFile(keyFile), publicKey = JSON.parse(await readFile(new URL('../apps/desktop/electron/update-public-key.json', import.meta.url), 'utf8')).publicKey;
if (createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }) !== publicKey) throw new Error('Release signing key differs from the key embedded in the application');
await mkdir(output, { recursive: false });
const hash = value => createHash('sha256').update(value).digest('hex');
const components = {};
for (const kind of ['ui', 'core']) {
  const files = manifest.files.filter(file => /^resources\/(?:node_modules|runtime|bundle)\//u.test(file.path) === (kind === 'core'));
  const id = hash(JSON.stringify(files)), name = `${kind}-${kind === 'ui' ? pkg.version : id.slice(0, 20)}.zip`;
  if (kind === 'core' && reuseRelease) {
    const previous = verifyUpdateEnvelope(JSON.parse(await readFile(path.join(reuseRelease, 'preview.json'), 'utf8')), publicKey).components.core;
    if (previous.id !== id) throw new Error('Cannot reuse a changed core archive');
    const target = path.join(output, name); await copyFile(path.join(reuseRelease, path.basename(new URL(previous.url).pathname)), target);
    const digest = createHash('sha256'); for await (const chunk of createReadStream(target)) digest.update(chunk);
    if ((await stat(target)).size !== previous.bytes || digest.digest('hex') !== previous.sha256) throw new Error('Reused core archive failed verification');
    components[kind] = { ...previous, url: `https://github.com/LucDinhLe/ai-for-boss-preview/releases/download/${pkg.version}/${name}` }; continue;
  }
  const zip = new JSZip(); for (const file of files) {
    const stream = Readable.from((async function* () { yield* createReadStream(path.join(source, ...file.path.split('/'))); })());
    zip.file(file.path, stream, { date: new Date('2026-01-01T00:00:00Z') });
  }
  const target = path.join(output, name);
  await pipeline(zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE', compressionOptions: { level: 6 } }), createWriteStream(target, { flags: 'wx' }));
  const digest = createHash('sha256'); for await (const chunk of createReadStream(target)) digest.update(chunk);
  components[kind] = { id, files, bytes: (await stat(target)).size, sha256: digest.digest('hex'),
    url: `https://github.com/LucDinhLe/ai-for-boss-preview/releases/download/${pkg.version}/${name}` };
}
const payload = JSON.stringify({ schema: 1, product: 'AI for Boss', version: pkg.version, sequence: Number(pkg.version.split('.').at(-1)), platform: 'win32', arch: 'x64', protocol: 4, components });
const envelope = { payload, signature: sign(null, Buffer.from(payload), privateKey).toString('base64') };
verifyUpdateEnvelope(envelope, publicKey);
await writeFile(path.join(output, 'preview.json'), JSON.stringify(envelope));
await writeFile(path.join(output, 'SHA256SUMS.txt'), Object.values(components).map(component => `${component.sha256}  ${path.basename(new URL(component.url).pathname)}`).join('\n') + '\n');
console.log(JSON.stringify({ version: pkg.version, files: manifest.files.length, uiBytes: components.ui.bytes, coreBytes: components.core.bytes, signed: true }));
