const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, realpathSync } = require('node:fs');
const originalFs = require('original-fs');
const { createRequire } = require('node:module');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, webContents } = require('electron');

const value = name => process.argv.find(argument => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const archive = value('archive'), home = value('user-data-dir'), out = value('receipt');
const expectedArchiveSha256 = value('archive-sha256');
const modulePath = path.join(archive, 'electron/docx-extract.mjs');
const marker = 'AIFB_PACKAGED_WORD_204817: Dự toán 34.567.890 đồng, ngày 18/11/2033.';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
app.setPath('userData', home);

async function main() {
  const receipt = { kind: 'AIFB_PACKAGED_WORD_READER_FIXTURE', pass: false, failures: [],
    scope: 'Direct dynamic import of the frozen app.asar DOCX reader, including packaged dependency resolution, in a workspace Electron host. No product main, Gateway, account, model, browser window, or real document.',
    electronVersion: process.versions.electron, nodeVersion: process.versions.node,
    moduleOrigin: { archive, modulePath },
    dependencies: [], cleanup: {} };
  try {
    receipt.moduleOrigin.archiveSha256 = hash(originalFs.readFileSync(archive));
    receipt.moduleOrigin.sourceSha256 = hash(readFileSync(modulePath));
    assert.equal(receipt.moduleOrigin.archiveSha256, expectedArchiveSha256, 'Frozen archive changed');
    const packageData = JSON.parse(readFileSync(path.join(archive, 'package.json'), 'utf8'));
    receipt.packageVersion = packageData.version;
    const packagedRequire = createRequire(pathToFileURL(modulePath));
    const dependencyRoot = realpathSync.native(path.join(path.dirname(archive), 'node_modules')).toLowerCase() + path.sep;
    for (const dependency of ['jszip', 'htmlparser2']) {
      const resolved = realpathSync.native(packagedRequire.resolve(dependency));
      assert.ok(resolved.toLowerCase().startsWith(dependencyRoot), `${dependency} resolved outside packaged resources`);
      receipt.dependencies.push({ name: dependency, resolved, insidePackagedResources: true });
    }
    const { fixtureDocx } = await import(pathToFileURL(require.resolve('./fixture-documents.mjs')).href);
    const bytes = fixtureDocx(marker);
    const reader = await import(pathToFileURL(modulePath).href);
    const result = await reader.extractDocxAttachment({ type: 'file', mimeType: reader.DOCX_MIME, fileName: 'Kiem-tra-bo-cai.docx',
      content: bytes.toString('base64'), sizeBytes: bytes.length });
    assert.ok(result.text.includes(marker), 'Packaged reader must return the exact Vietnamese marker, amount, and date');
    assert.equal(result.paragraphs, 1);
    assert.ok(result.parts.includes('word/document.xml'));
    receipt.extraction = { marker, markerPresent: true, characters: result.characters, paragraphs: result.paragraphs,
      parts: result.parts, originalBytes: bytes.length, originalSha256: hash(bytes), extractedTextSha256: hash(result.text) };
    receipt.pass = true;
  } catch (error) { receipt.failures.push(String(error.message).slice(0, 2000)); }
  finally {
    receipt.cleanup.remainingWindows = BrowserWindow.getAllWindows().length;
    receipt.cleanup.remainingWebContents = webContents.getAllWebContents().length;
    receipt.pass &&= receipt.cleanup.remainingWindows === 0 && receipt.cleanup.remainingWebContents === 0;
    writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    app.exit(receipt.pass ? 0 : 1);
  }
}
app.whenReady().then(main).catch(error => { console.error(error.message); app.exit(1); });
