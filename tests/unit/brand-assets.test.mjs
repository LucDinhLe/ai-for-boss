import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { packageIconForPlatform, verifyBrandAssets } from "../../scripts/lib/brand-assets.mjs";
import { createWindowOptions } from "../../apps/desktop/electron/security-policy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const brandRoot = path.join(root, "docs/brand");
const read = (name) => fs.readFileSync(path.join(root, name));
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

test("approved Vành Đơn source and all platform assets match their recorded provenance", () => {
  const manifest = verifyBrandAssets(brandRoot);
  assert.equal(manifest.sourceCommit, "f5b065c69e1c7e7ee869270178be8b03bc06bc21");
  assert.equal(sha(read("docs/brand/assets/ai-for-boss-app-icon.svg")), "be4767fbabe2d6d13effa4c535910e044f9b4d18021d8c8cfb77cbb548f43dba");
  assert.equal(manifest.files.length, 16);
  assert.throws(() => verifyBrandAssets(brandRoot, (file) => file.endsWith("icon.ico")
    ? Buffer.from("changed") : fs.readFileSync(file)), /BRAND_ASSET_MISMATCH/);
  assert.throws(() => verifyBrandAssets(brandRoot, (file) => {
    if (file.endsWith("icon.icns")) throw new Error("missing");
    return fs.readFileSync(file);
  }), /missing/);
});

test("PNG files declare every expected size, ICO covers small and high-DPI icons, and ICNS framing is valid", () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    const png = read(`docs/brand/assets/app-icons/icon-${size}.png`);
    assert.deepEqual(png.subarray(0, 8), signature);
    assert.equal(png.toString("ascii", 12, 16), "IHDR");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const ico = read("docs/brand/assets/app-icons/icon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const sizes = [];
  for (let i = 0; i < ico.readUInt16LE(4); i++) {
    const entry = 6 + i * 16;
    const size = ico[entry] || 256;
    assert.equal(ico[entry + 1] || 256, size);
    const length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset >= 6 + 16 * ico.readUInt16LE(4) && offset + length <= ico.length);
    assert.ok(length > 0);
    sizes.push(size);
  }
  assert.deepEqual(sizes, [16, 32, 48, 256]);
  const icns = read("docs/brand/assets/app-icons/icon.icns");
  assert.equal(icns.toString("ascii", 0, 4), "icns");
  assert.equal(icns.readUInt32BE(4), icns.length);
  let offset = 8;
  const types = [];
  while (offset < icns.length) {
    const length = icns.readUInt32BE(offset + 4);
    assert.ok(length > 8 && offset + length <= icns.length);
    types.push(icns.toString("ascii", offset, offset + 4));
    offset += length;
  }
  assert.equal(offset, icns.length);
  assert.ok(types.includes("ic10"), "1024 px retina representation");
});

test("package selects each native icon format and rejects unsupported platforms", () => {
  for (const [platform, filename] of [["win32", "icon.ico"], ["darwin", "icon.icns"], ["linux", "icon-512.png"]]) {
    assert.equal(packageIconForPlatform(brandRoot, platform), path.join(brandRoot, "assets/app-icons", filename));
  }
  assert.throws(() => packageIconForPlatform(brandRoot, "unknown"), /UNSUPPORTED_ICON_PLATFORM/);
  const script = read("scripts/package-desktop.mjs").toString();
  assert.match(script, /verifyBrandAssets\(brandRoot\)/);
  assert.match(script, /icon: packageIcon/);
});

test("window icon uses approved packaged PNG without changing secure defaults", () => {
  for (const isPackaged of [false, true]) {
    const options = createWindowOptions({ preloadPath: "preload.cjs", isPackaged });
    assert.equal(sha(fs.readFileSync(options.icon)), sha(read("docs/brand/assets/app-icons/icon-256.png")));
    assert.match(options.icon.replaceAll("\\", "/"), /electron\/assets\/icon-256\.png$/);
    assert.equal(options.webPreferences.sandbox, true);
    assert.equal(options.webPreferences.contextIsolation, true);
    assert.equal(options.webPreferences.nodeIntegration, false);
  }
});

test("static sidebar marks import approved SVGs and active layers remain decorative beside the wordmark", () => {
  const component = read("apps/desktop/src/BrandMark.tsx").toString();
  for (const variant of ["ai-for-boss-mark.svg", "ai-for-boss-mark-dark.svg"]) {
    assert.ok(component.includes("../../../docs/brand/assets/" + variant));
  }
  assert.equal([...component.matchAll(/alt=""/g)].length, 2);
  assert.doesNotMatch(component, /dangerouslySetInnerHTML|<script|https?:/);
  assert.match(component, /aria-hidden="true"/);
  assert.match(component, /<svg viewBox="0 0 100 100" fill="none" focusable="false">/);
  const approved = read('docs/brand/assets/ai-for-boss-mark.svg').toString();
  for (const attribute of ['d="M50,15 A35,35 0 1 1 16,59"', 'cx="50" cy="50" r="17"']) {
    assert.ok(approved.includes(attribute)); assert.ok(component.includes(attribute));
  }
  assert.match(read("apps/desktop/src/App.tsx").toString(), /<WorkspaceSidebar /);
  for (const name of ["apps/desktop/src/WorkspaceSidebar.tsx", "apps/desktop/src/first-run/first-run-journey.tsx"]) {
    const source = read(name).toString();
    assert.match(source, /<BrandMark(?: active=\{props\.modelActive\})? \/>/);
    assert.match(source, /<strong(?: className="sidebar-brand")?>AI for Boss<\/strong>/);
    assert.doesNotMatch(source, /brand-glyph/);
  }
  const styles = read("apps/desktop/src/styles.css").toString();
  assert.match(styles, /:root\[data-theme="dark"\] \.brand-mark__dark \{ display: block; \}/);
  assert.doesNotMatch(styles, /brand-glyph/);
});

test("installer, uninstaller and Windows app listing share the branded executable icon", () => {
  const source = read("installer/ai-for-boss.nsi").toString();
  assert.match(source, /!define MUI_ICON "\$\{BRAND_ICON\}"/);
  assert.match(source, /!define MUI_UNICON "\$\{BRAND_ICON\}"/);
  const builder = read('scripts/build-internal-installer.mjs').toString();
  assert.match(builder, /verifyBrandAssets\(brandRoot\)/);
  assert.match(builder, /packageIconForPlatform\(brandRoot, 'win32'\)/);
  assert.match(builder, /\/DBRAND_ICON=\$\{brandIcon\}/);
  assert.match(source, /File \/oname=install-support\.ps1 "\$\{SUPPORT_SCRIPT\}"/);
  const support = read('installer/install-support.ps1').toString();
  assert.match(support, /\$target = Join-Path \$versionPath 'AI-for-Boss\.exe'/);
  assert.match(support, /DisplayIcon=\(\$target \+ ',0'\)/);
  assert.match(support, /\$link\.IconLocation = \$target \+ ',0'/);
});
