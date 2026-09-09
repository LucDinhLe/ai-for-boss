import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFile } from '@electron/asar';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
const output = path.resolve(value('--out') ?? path.join(root, 'artifacts/web-shutdown/current.json'));
assert.ok(!(value('--module') && value('--asar')), 'Choose source module or packaged ASAR, not both');
const archive = value('--asar') ? realpathSync.native(path.resolve(value('--asar'))) : null;
const entry = 'electron/web-tabs.mjs';
const packagedModule = archive ? extractFile(archive, entry) : null;
const packageVersion = archive ? JSON.parse(extractFile(archive, 'package.json').toString()).version : null;
if (archive) assert.equal(packageVersion, '0.0.5-beta.23', 'This packaged regression targets beta23 only');
const sourcePath = archive ? null : realpathSync.native(path.resolve(value('--module') ?? path.join(root, 'apps/desktop/electron/web-tabs.mjs')));
assert.equal(existsSync(output), false, 'Preserve prior receipts; choose a new output path');
const parent = realpathSync.native(os.tmpdir()), home = realpathSync.native(mkdtempSync(path.join(parent, 'aifb-web-shutdown-')));
const modulePath = archive ? path.join(home, 'packaged-web-tabs.mjs') : sourcePath;
if (packagedModule) writeFileSync(modulePath, packagedModule, { flag: 'wx' });
const env = {};
for (const name of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'DISPLAY', 'XAUTHORITY']) if (process.env[name]) env[name] = process.env[name];
Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'appdata'), LOCALAPPDATA: path.join(home, 'localappdata'),
  TMP: path.join(home, 'tmp'), TEMP: path.join(home, 'tmp'), PATH: process.platform === 'win32' ? '' : '/usr/bin:/bin' });
for (const folder of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) mkdirSync(folder, { recursive: true });
const binary = process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
const child = spawn(path.join(root, 'node_modules/electron/dist', binary), [path.join(root, 'scripts/web-tabs-shutdown-fixture.cjs'),
  `--user-data-dir=${home}`, `--module=${modulePath}`, `--out=${output}`, ...(process.argv.includes('--owner-closed-callback') ? ['--owner-closed-callback'] : [])],
{ cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
let timedOut = false, result;
const deadline = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
try { result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); }); }
finally { clearTimeout(deadline); }
assert.equal(path.dirname(home), parent); assert.ok(path.basename(home).startsWith('aifb-web-shutdown-'));
const record = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { pass: false, failures: ['Fixture produced no receipt'], cleanup: {} };
record.launcher = { isolatedHome: home, exitCode: result.code, signal: result.signal, timedOut, profileRemoved: false };
record.moduleOrigin = archive ? {
  kind: 'packaged-asar-entry', archive, archiveSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), entry, packageVersion,
  entrySha256: createHash('sha256').update(packagedModule).digest('hex'),
  scope: 'Exact module extracted from packaged app.asar, exercised with real workspace Electron; full product/Gateway is not launched by this fixture.',
} : { kind: 'source-module', path: sourcePath };
if (archive && record.sourceSha256 !== record.moduleOrigin.entrySha256) {
  record.pass = false; record.failures.push('Executed module does not match packaged entry hash');
}
if (!timedOut && record.cleanup.ownedContentsDestroyed && record.cleanup.ownedWindowsDestroyed && record.cleanup.remainingAppWebContents === 0) {
  try { rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); record.launcher.profileRemoved = true; }
  catch (error) { record.failures.push(`Generated profile cleanup: ${error.code ?? error.message}`); }
}
record.pass = Boolean(record.pass && result.code === 0 && !timedOut && record.launcher.profileRemoved);
mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(record, null, 2) + '\n');
process.exitCode = record.pass ? 0 : 1;
