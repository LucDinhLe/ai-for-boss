import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listPackage } from "@electron/asar";
import { packager } from "@electron/packager";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const appDirectory = path.join(repoRoot, "apps", "desktop");
const outputRoot = path.join(repoRoot, "out", "desktop");

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

assertSafeOutput(outputRoot);
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const packagePaths = await packager({
  dir: appDirectory,
  out: outputRoot,
  name: "AI for Boss",
  executableName: "AI-for-Boss",
  electronVersion: "43.3.0",
  platform: process.platform,
  arch: process.arch,
  appVersion: "0.0.0-dev",
  asar: true,
  overwrite: false,
  prune: true,
  ignore: [
    /^\/src($|\/)/,
    /^\/node_modules($|\/)/,
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
  releaseTrainId: "oc-2026.7.1-2-locked.1",
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
    `files=${inventory.fileCount}; bytes=${inventory.totalBytes}`
);
