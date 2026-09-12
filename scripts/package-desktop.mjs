import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listPackage } from "@electron/asar";
import { packager } from "@electron/packager";
import { verifyChannelInstaller } from './stage-channel-installer.mjs';
import { packagedChannelBundlePath } from '../apps/desktop/electron/channel-bundle-path.mjs';
import { packageIconForPlatform, verifyBrandAssets } from "./lib/brand-assets.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const appDirectory = path.join(repoRoot, "apps", "desktop");
const outputRoot = path.join(repoRoot, "out", "desktop");
const brandRoot = path.join(repoRoot, "docs", "brand");
const brand = verifyBrandAssets(brandRoot);
const packageIcon = packageIconForPlatform(brandRoot, process.platform);
const desktopPackage = JSON.parse(fsSync.readFileSync(path.join(appDirectory, "package.json"), "utf8"));
if (!fsSync.readFileSync(path.join(appDirectory, "electron/assets/icon-256.png"))
  .equals(fsSync.readFileSync(path.join(brandRoot, "assets/app-icons/icon-256.png")))) {
  throw new Error("Window icon differs from the approved brand asset");
}

function assertSafeOutput(target) {
  const relative = path.relative(repoRoot, target);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative !== path.join("out", "desktop")) {
    throw new Error(`Refusing unsafe package output path: ${target}`);
  }
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function hashFile(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * The packaged app carries the Node runtime the Gateway child is spawned with
 * and the OpenClaw install it executes, staged by scripts/stage-runtime.mjs.
 * Packaging without them still works for a shell-only build, and the inventory
 * says plainly which of the two happened.
 */
const stagedRoot = path.join(appDirectory, "resources");
const stagedSummaryPath = path.join(stagedRoot, "staged-runtime.json");
const extraResources = ['document-tools','harness-plugin','agent-templates'].map(name=>path.join(appDirectory,'resources',name));
let stagedRuntime = null;
let channelSource = null;

if (fsSync.existsSync(stagedSummaryPath)) {
  stagedRuntime = JSON.parse(fsSync.readFileSync(stagedSummaryPath, "utf8"));
  // `runtime` carries the Node binary; `bundle/node_modules` is copied in as
  // `resources/node_modules` so the main process inside app.asar can resolve
  // the Gateway client by walking up one directory, exactly as Node does in
  // development.
  for (const relative of ["runtime", path.join("bundle", "node_modules"), path.join('bundle', 'channel-installer')]) {
    const candidate = path.join(stagedRoot, relative);
    if (!fsSync.existsSync(candidate)) {
      throw new Error(`staged-runtime.json exists but resources/${relative} does not`);
    }
    if (process.platform !== 'win32' || relative !== path.join('bundle', 'channel-installer')) extraResources.push(candidate);
  }
  if (stagedRuntime.platform !== process.platform || stagedRuntime.architecture !== process.arch) {
    throw new Error(
      `staged runtime is for ${stagedRuntime.platform}/${stagedRuntime.architecture}, packaging ${process.platform}/${process.arch}`
    );
  }
  channelSource = await verifyChannelInstaller(path.join(stagedRoot, 'bundle/channel-installer'));
  if (channelSource.coreVersion !== stagedRuntime.openclaw.openclaw || channelSource.nodeVersion !== stagedRuntime.node.version) throw new Error('Installer runtime pins differ from the staged engine');
}

assertSafeOutput(outputRoot);
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const packagePaths = await packager({
  dir: appDirectory,
  out: outputRoot,
  name: "AI for Boss",
  executableName: "AI-for-Boss",
  icon: packageIcon,
  electronVersion: "43.3.0",
  electronZipDir: process.env.AIFB_ELECTRON_ZIP_DIR,
  platform: process.platform,
  arch: process.arch,
  appVersion: desktopPackage.version,
  asar: true,
  overwrite: false,
  prune: true,
  extraResource: extraResources,
  ignore: [
    /^\/src($|\/)/,
    /^\/node_modules($|\/)/,
    /^\/resources($|\/)/,
    /^\/index\.html$/,
    /^\/tsconfig\.json$/,
    /^\/vite\.config\.ts$/,
    /^\/README\.md$/
  ]
});

if (packagePaths.length !== 1) {
  throw new Error(`Expected one package path, received ${packagePaths.length}`);
}

const packagePath = packagePaths[0];
let channelInstaller = null;
if (stagedRuntime) {
  const channelTarget = process.platform === 'win32'
    ? packagedChannelBundlePath(path.join(packagePath, 'resources')) : path.join(packagePath, 'resources/channel-installer');
  if (process.platform === 'win32') await fs.cp(channelSource.root, channelTarget, { recursive: true });
  const after = await verifyChannelInstaller(channelTarget);
  const sourceAfter = await verifyChannelInstaller(channelSource.root);
  if (channelSource.markerSha256 !== after.markerSha256 || channelSource.markerSha256 !== sourceAfter.markerSha256) throw new Error('Installer source changed during packaging');
  if (fsSync.existsSync(path.join(packagePath, 'resources/channel-plugins'))) throw new Error('Obsolete raw channel plugins must not ship beside the installer');
  channelInstaller = { pinSha256: after.pinSha256, pluginLockSha256: after.pluginLockSha256, markerSha256: after.markerSha256,
    npmVersion: after.npm.version, plugins: after.plugins, files: after.files, bytes: after.bytes, separateFromCore: true, readbackVerified: true };
}
const files = await listFiles(packagePath);
const stats = await Promise.all(files.map((filePath) => fs.stat(filePath)));
const asarPath = files.find((filePath) => filePath.endsWith(`${path.sep}app.asar`));

if (!asarPath) {
  throw new Error("Packaged Electron app is missing app.asar");
}

const asarEntries = listPackage(asarPath, { isPack: false })
  .map((entry) => entry.replaceAll("\\", "/").replace(/^\/+/, ""))
  .filter(Boolean)
  .sort();
const unexpectedAsarEntries = asarEntries.filter(
  (entry) =>
    entry !== "package.json" &&
    !entry.startsWith("dist/") &&
    entry !== "dist" &&
    !entry.startsWith("electron/") &&
    entry !== "electron" &&
    !entry.startsWith("generated/") &&
    entry !== "generated"
);

if (unexpectedAsarEntries.length > 0) {
  throw new Error(`Unexpected files in app.asar: ${unexpectedAsarEntries.join(", ")}`);
}

const inventory = {
  schemaVersion: "0.4.0",
  classification: "experimental-internal",
  product: "AI for Boss",
  releaseTrainId: stagedRuntime ? "oc-2026.9.1-candidate.1" : "oc-2026.7.1-2-locked.1",
  appVersion: desktopPackage.version,
  electronVersion: "43.3.0",
  platform: process.platform,
  architecture: process.arch,
  packageDirectory: path.relative(outputRoot, packagePath).split(path.sep).join("/"),
  fileCount: files.length,
  totalBytes: stats.reduce((sum, stat) => sum + stat.size, 0),
  appAsar: {
    relativePath: path.relative(packagePath, asarPath).split(path.sep).join("/"),
    bytes: (await fs.stat(asarPath)).size,
    sha256: await hashFile(asarPath),
    entryCount: asarEntries.length,
    entries: asarEntries
  },
  bundledRuntime: stagedRuntime
    ? {
        nodeVersion: stagedRuntime.node.version,
        nodeBinarySha256: stagedRuntime.node.binarySha256,
        openclawVersion: stagedRuntime.openclaw.openclaw,
        gatewayClientVersion: stagedRuntime.openclaw["@openclaw/gateway-client"],
        gatewayProtocolVersion: stagedRuntime.openclaw["@openclaw/gateway-protocol"]
      }
    : null,
  selfContained: Boolean(stagedRuntime),
  channelInstaller,
  brand: { sourceCommit: brand.sourceCommit, icon: path.relative(brandRoot, packageIcon).split(path.sep).join("/"),
    iconSha256: await hashFile(packageIcon) },
  signed: false,
  distributable: false
};

await fs.writeFile(
  path.join(outputRoot, "artifact-inventory.json"),
  `${JSON.stringify(inventory, null, 2)}\n`,
  "utf8"
);

console.log(
  `Desktop package created: ${inventory.packageDirectory}; ` +
    `files=${inventory.fileCount}; bytes=${inventory.totalBytes}; ` +
    `runtime=${inventory.selfContained ? `node ${inventory.bundledRuntime.nodeVersion} + openclaw ${inventory.bundledRuntime.openclawVersion}` : "not staged"}`
);
