import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = process.argv.includes('--backup-storage') ? 'backup-storage-smoke.cjs' : process.argv.includes('--window-controls') ? 'window-controls-ui-smoke.cjs' : process.argv.includes('--web-tabs') ? 'web-tabs-ui-smoke.cjs' : 'first-session-ui-smoke.cjs';
const interactive = process.argv.includes('--interactive');
const temporaryParent = realpathSync.native(os.tmpdir());
const home = realpathSync.native(mkdtempSync(path.join(temporaryParent, "aifb-ui-fixture-")));
const env = {};
for (const name of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "DISPLAY", "XAUTHORITY"]) if (process.env[name]) env[name] = process.env[name];
Object.assign(env, { HOME: home, USERPROFILE: home, APPDATA: path.join(home, "appdata"), LOCALAPPDATA: path.join(home, "localappdata"),
  TMP: path.join(home, "tmp"), TEMP: path.join(home, "tmp"), PATH: process.platform === "win32" ? "" : "/usr/bin:/bin" });
for (const name of [env.APPDATA, env.LOCALAPPDATA, env.TEMP]) mkdirSync(name, { recursive: true });
const electron = process.platform === "win32" ? "electron.exe" : process.platform === "darwin" ? "Electron.app/Contents/MacOS/Electron" : "electron";
const child = spawn(path.join(root, "node_modules/electron/dist", electron), [path.join(root, "scripts", fixture), ...(interactive ? ['--interactive'] : []), ...(process.argv.includes('--data-agents') ? ['--data-agents'] : []), ...(process.argv.includes('--trial-release') ? ['--trial-release'] : []), ...(process.argv.includes('--browser-workbench') ? ['--browser-workbench'] : []), `--user-data-dir=${home}`],
  { env, windowsHide: !interactive && fixture !== 'web-tabs-ui-smoke.cjs' && !process.argv.includes('--browser-workbench'), stdio: ["ignore", "pipe", "pipe"] });
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
const timeout = setTimeout(() => child.kill(), interactive ? 900000 : process.argv.includes('--data-agents') ? 240000 : 150000);
let code, cleanupError;
try { code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", resolve); }); }
finally {
  clearTimeout(timeout);
  // Exactly the absolute mkdtemp directory above, not an input path or profile.
  if (path.dirname(home) !== temporaryParent || !path.basename(home).startsWith('aifb-ui-fixture-')) cleanupError = new Error('Unsafe fixture cleanup path');
  else rmSync(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}
if (cleanupError) throw cleanupError;
process.exitCode = code ?? 1;
