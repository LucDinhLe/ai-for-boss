import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const iconFiles = Object.freeze({ win32: "icon.ico", darwin: "icon.icns", linux: "icon-512.png" });

export function packageIconForPlatform(brandRoot, platform) {
  if (!Object.hasOwn(iconFiles, platform)) throw new Error("UNSUPPORTED_ICON_PLATFORM");
  return path.join(brandRoot, "assets", "app-icons", iconFiles[platform]);
}

export function verifyBrandAssets(brandRoot, readFile = fs.readFileSync) {
  const manifest = JSON.parse(readFile(path.join(brandRoot, "asset-provenance.json")).toString());
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length !== 16
    || manifest.sourceCommit !== "f5b065c69e1c7e7ee869270178be8b03bc06bc21") throw new Error("BRAND_PROVENANCE_INVALID");
  const seen = new Set();
  for (const binding of manifest.files) {
    if (!/^assets\/(?:app-icons\/)?[a-z0-9-]+\.(?:svg|png|ico|icns)$/u.test(binding.path)
      || seen.has(binding.path) || !/^[a-f0-9]{64}$/u.test(binding.sha256)) throw new Error("BRAND_PROVENANCE_INVALID");
    seen.add(binding.path);
    const actual = crypto.createHash("sha256").update(readFile(path.join(brandRoot, binding.path))).digest("hex");
    if (actual !== binding.sha256) throw new Error("BRAND_ASSET_MISMATCH: " + binding.path);
  }
  for (const file of Object.values(iconFiles)) {
    if (!seen.has("assets/app-icons/" + file)) throw new Error("BRAND_PROVENANCE_INVALID");
  }
  return manifest;
}
