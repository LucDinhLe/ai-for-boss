import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
const archive = realpathSync.native(path.resolve(value('--asar')));
const expectedHash = value('--sha256');
assert.match(expectedHash, /^[a-f0-9]{64}$/u);
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'), expectedHash);
const output = path.resolve(value('--out') ?? path.join(repo, 'artifacts/word-chat/packaged-word.json'));
assert.equal(existsSync(output), false, 'Preserve prior receipts');
const parent = realpathSync.native(os.tmpdir()), home = realpathSync.native(mkdtempSync(path.join(parent, 'aifb-packaged-word-')));
const workerReceipt = path.join(home, 'worker-receipt.json');
const env = {};
for (const name of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT']) if (process.env[name]) env[name] = process.env[name];
Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'appdata'), LOCALAPPDATA: path.join(home, 'localappdata'),
  TMP: path.join(home, 'tmp'), TEMP: path.join(home, 'tmp'), PATH: '' });
for (const directory of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) mkdirSync(directory, { recursive: true });
const child = spawn(path.join(repo, 'node_modules/electron/dist/electron.exe'), [path.join(repo, 'scripts/packaged-word-fixture.cjs'),
  `--user-data-dir=${home}`, `--archive=${archive}`, `--archive-sha256=${expectedHash}`, `--receipt=${workerReceipt}`],
{ cwd: home, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
let timedOut = false;
const timer = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
let exit;
try { exit = await new Promise(resolve => { child.once('error', error => resolve({ code: -1, error: error.message })); child.once('close', (code, signal) => resolve({ code, signal })); }); }
finally { clearTimeout(timer); }
const receipt = existsSync(workerReceipt) ? JSON.parse(readFileSync(workerReceipt, 'utf8'))
  : { pass: false, failures: ['Electron reader fixture produced no receipt'], cleanup: {} };
receipt.launcher = { exitCode: exit.code, signal: exit.signal ?? null, timedOut, profileRemoved: false };
if (exit.error) receipt.failures.push(exit.error);
assert.equal(path.dirname(home), parent); assert.ok(path.basename(home).startsWith('aifb-packaged-word-'));
if (!timedOut && receipt.cleanup.remainingWindows === 0 && receipt.cleanup.remainingWebContents === 0) {
  try { rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); receipt.launcher.profileRemoved = true; }
  catch (error) { receipt.failures.push(`Generated profile cleanup: ${error.code ?? error.message}`); }
}
if (!receipt.launcher.profileRemoved) receipt.isolatedHomeRetained = home;
receipt.pass = Boolean(receipt.pass && exit.code === 0 && !timedOut && receipt.launcher.profileRemoved);
mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(`[packaged Word reader] ${receipt.pass ? 'PASS' : 'FAIL'}; evidence=${output}`);
process.exitCode = receipt.pass ? 0 : 1;
