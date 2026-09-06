import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveNodeExecutable, resolveOpenClawEntry } from "../../apps/desktop/electron/supervisor.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const manifest = JSON.parse(read("manifests/runtime/bundled-runtime.lock.json"));

test("every pinned Node archive carries a digest and a path inside the archive", () => {
  assert.ok(manifest.node.archives.length >= 3);
  const seen = new Set();
  for (const archive of manifest.node.archives) {
    const label = `${archive.platform}/${archive.architecture}`;
    assert.equal(seen.has(label), false, `${label} is pinned twice`);
    seen.add(label);
    assert.match(archive.sha256, /^[0-9a-f]{64}$/, `${label} has no usable digest`);
    assert.ok(archive.file.includes(manifest.node.version), `${label} pins a file from another version`);
    assert.ok(archive.binaryPathInArchive.endsWith(archive.platform === "win32" ? "node.exe" : "node"));
  }
  assert.ok(seen.has("win32/x64") && seen.has("darwin/arm64") && seen.has("linux/x64"));
});

test("the bundled Node version matches what the repository runs on", () => {
  const rootPackage = JSON.parse(read("package.json"));
  assert.equal(manifest.node.version, rootPackage.engines.node);
});

test("the staging script refuses an archive whose digest does not match", () => {
  const staging = read("scripts/stage-runtime.mjs");
  assert.ok(staging.includes("does not match the pinned"), "no digest check before extraction");
  assert.ok(
    staging.indexOf("digest !== archive.sha256") < staging.indexOf("const target = extractBinary({"),
    "the digest must be checked before anything is extracted"
  );
  assert.ok(staging.includes("pnpm-workspace.yaml"), "the install-script allowlist has a second source of truth");
});

test("the staging script starts the tools each platform actually ships", () => {
  const staging = read("scripts/stage-runtime.mjs");
  assert.ok(staging.includes('"npm.cmd"'), "npm is a .cmd shim on Windows and cannot be started directly");
  assert.ok(staging.includes("shell: onWindows"), "Node refuses to spawn a .cmd shim without a shell");
  assert.equal(
    /shell:\s*true/.test(staging),
    false,
    "the shell is opted into per platform, never unconditionally"
  );
  assert.ok(staging.includes("Expand-Archive"), "Windows has no tar for the zip distribution");
  assert.ok(staging.includes('execFileSync("tar"'), "macOS and Linux extract with tar");
});

test("a packaged app resolves its own runtime before anything on the host", () => {
  const packaged = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP ?? "/tmp", "aifb-resources-"));
  try {
    const binary = process.platform === "win32" ? "node.exe" : "node";
    fs.mkdirSync(path.join(packaged, "runtime", "node"), { recursive: true });
    fs.writeFileSync(path.join(packaged, "runtime", "node", binary), "");
    fs.mkdirSync(path.join(packaged, "node_modules", "openclaw"), { recursive: true });
    fs.writeFileSync(path.join(packaged, "node_modules", "openclaw", "openclaw.mjs"), "");

    const resolved = resolveNodeExecutable({ env: { PATH: "" }, resourcesPath: packaged });
    assert.equal(resolved, path.join(packaged, "runtime", "node", binary));

    const entry = resolveOpenClawEntry(
      () => {
        throw new Error("must not fall back to the workspace");
      },
      { resourcesPath: packaged }
    );
    assert.equal(entry, path.join(packaged, "node_modules", "openclaw", "openclaw.mjs"));
  } finally {
    fs.rmSync(packaged, { recursive: true, force: true });
  }
});

test("an explicit runtime override still wins, and a missing package still falls back", () => {
  const empty = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP ?? "/tmp", "aifb-empty-"));
  try {
    assert.equal(resolveNodeExecutable({ env: { AIFB_NODE_PATH: process.execPath }, resourcesPath: empty }), process.execPath);
    // Built from a real path so the URL is valid on Windows too, where a file
    // URL without a drive letter is not a path at all.
    const elsewhere = path.join(empty, "elsewhere", "node_modules", "openclaw", "dist", "index.mjs");
    const entry = resolveOpenClawEntry(() => pathToFileURL(elsewhere), { resourcesPath: empty });
    assert.ok(entry.endsWith(path.join("openclaw", "openclaw.mjs")));
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test("the staged runtime never enters git or app.asar", () => {
  assert.ok(read(".gitignore").includes("apps/desktop/resources/"));
  const packaging = read("scripts/package-desktop.mjs");
  assert.ok(/\/\^\\\/resources\(\$\|\\\/\)\//.test(packaging), "resources are not excluded from the asar");
  assert.ok(packaging.includes("extraResource"), "the runtime is not carried beside the app");
});
