/** Exercise the production updater against locally built, signed release archives. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { stageComponentUpdate, verifyUpdateEnvelope } from '../apps/desktop/electron/component-update.mjs';
const [release, currentRoot, updateRoot, evidence] = process.argv.slice(2);
if (!release || !currentRoot || !updateRoot || !evidence) throw new Error('Expected release directory, current package, new update directory, evidence');
const envelope = JSON.parse(await readFile(path.join(release, 'preview.json'), 'utf8'));
const { publicKey } = JSON.parse(await readFile(new URL('../apps/desktop/electron/update-public-key.json', import.meta.url), 'utf8'));
const manifest = verifyUpdateEnvelope(envelope, publicKey);
const downloads = [];
const result = await stageComponentUpdate({ envelope, publicKey, minimumSequence: 0, currentRoot, updateRoot,
  download: async url => { const name = path.basename(new URL(url).pathname); downloads.push(name); return readFile(path.join(release, name)); } });
if (downloads.some(name => name.startsWith('core-'))) throw new Error('Unchanged core was unexpectedly downloaded');
await mkdir(path.dirname(evidence), { recursive: true });
await writeFile(evidence, JSON.stringify({ status: 'pass', version: manifest.version, signatureVerified: true,
  filesVerified: Object.values(manifest.components).reduce((sum, component) => sum + component.files.length, 0),
  downloads, reusedCore: true, directory: result.directory, recordedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ ...result, downloads, reusedCore: true }));
