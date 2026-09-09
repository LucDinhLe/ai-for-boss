/**
 * Stages everything the packaged app needs to run on a machine with nothing
 * installed: the Node runtime the Gateway child is spawned with, and the
 * OpenClaw package tree the child executes.
 *
 * Both are pinned. The Node archive is checked against the digest recorded in
 * manifests/runtime/bundled-runtime.lock.json, copied from the official
 * SHASUMS256.txt, and a mismatch aborts the run rather than shipping an
 * unverified binary. OpenClaw and the two Gateway packages are installed at the
 * exact versions the candidate train pins, so the packaged app and the
 * repository can never drift apart silently.
 *
 * Usage: node scripts/stage-runtime.mjs [--platform win32] [--arch x64] [--force]
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stageChannelInstaller } from './stage-channel-installer.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resourcesRoot = path.join(repoRoot, "apps", "desktop", "resources");
const runtimeRoot = path.join(resourcesRoot, "runtime", "node");
/**
 * The bundled package tree is staged here and lands in the packaged app as
 * `resources/node_modules`. That location matters: Node resolves a bare
 * specifier by walking up from the importing file, and the Electron main
 * process is imported from inside `resources/app.asar`, whose parent is
 * `resources`. Putting the tree anywhere else leaves the main process unable to
 * import the Gateway client at all.
 */
const bundleRoot = path.join(resourcesRoot, "bundle");
const openclawRoot = bundleRoot;

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

function parseArgs(argv) {
  const options = { platform: process.platform, arch: process.arch, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--platform") options.platform = argv[++index];
    else if (flag === "--arch") options.arch = argv[++index];
    else if (flag === "--force") options.force = true;
  }
  return options;
}

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  await fsp.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}

/**
 * Extraction uses the tools every supported platform already ships: tar on
 * macOS and Linux, and PowerShell's Expand-Archive on Windows. A third-party
 * archive library would be one more dependency inside the trust boundary.
 */
function extractBinary({ archivePath, entry, platform, into }) {
  const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aifb-runtime-"));
  try {
    if (platform === "win32") {
      execFileSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", `Expand-Archive -Path "${archivePath}" -DestinationPath "${workDirectory}" -Force`],
        { stdio: "pipe" }
      );
    } else {
      execFileSync("tar", ["-xf", archivePath, "-C", workDirectory, entry], { stdio: "pipe" });
    }
    const extracted = path.join(workDirectory, entry);
    if (!fs.existsSync(extracted)) throw new Error(`archive did not contain ${entry}`);
    fs.mkdirSync(into, { recursive: true });
    const target = path.join(into, path.basename(entry));
    fs.copyFileSync(extracted, target);
    if (platform !== "win32") fs.chmodSync(target, 0o755);
    return target;
  } finally {
    fs.rmSync(workDirectory, { recursive: true, force: true });
  }
}

async function stageNode({ platform, arch, force }) {
  const manifest = readJson("manifests/runtime/bundled-runtime.lock.json");
  const archive = manifest.node.archives.find(
    (entry) => entry.platform === platform && entry.architecture === arch
  );
  if (!archive) throw new Error(`no pinned Node archive for ${platform}/${arch}`);

  const binaryName = platform === "win32" ? "node.exe" : "node";
  const staged = path.join(runtimeRoot, binaryName);
  if (fs.existsSync(staged) && !force) {
    console.log(`[stage-runtime] node already staged at ${path.relative(repoRoot, staged)}`);
    return { manifest, archive, staged };
  }

  const workDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "aifb-node-"));
  try {
    const archivePath = path.join(workDirectory, archive.file);
    console.log(`[stage-runtime] downloading ${archive.file}`);
    await download(`${manifest.node.source}${archive.file}`, archivePath);

    const digest = sha256(archivePath);
    if (digest !== archive.sha256) {
      throw new Error(`${archive.file} digest ${digest} does not match the pinned ${archive.sha256}`);
    }
    console.log("[stage-runtime] digest matches the pinned checksum");

    fs.rmSync(runtimeRoot, { recursive: true, force: true });
    const target = extractBinary({
      archivePath,
      entry: archive.binaryPathInArchive,
      platform,
      into: runtimeRoot
    });
    return { manifest, archive, staged: target };
  } finally {
    fs.rmSync(workDirectory, { recursive: true, force: true });
  }
}

/**
 * OpenClaw ships as an ordinary package, so the packaged app carries a real
 * install of it rather than a flattened copy: the child process resolves its
 * own dependencies exactly as it does in development.
 */
function stageOpenClaw({ force }) {
  const desktopPackage = readJson("apps/desktop/package.json");
  const pinned = Object.fromEntries(
    ["openclaw", "@openclaw/gateway-client", "@openclaw/gateway-protocol"].map((name) => [
      name,
      desktopPackage.dependencies?.[name]
    ])
  );
  for (const [name, version] of Object.entries(pinned)) {
    if (!version) throw new Error(`apps/desktop does not pin ${name}`);
  }

  // The same packages the workspace already allows to run install scripts, read
  // from one source of truth so the staged tree and the development tree can
  // never disagree about what is trusted to execute during install.
  const workspace = fs.readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  const allowBuilds = [...workspace.matchAll(/^\s{2}'?([^':\s]+)'?:\s*true\s*$/gm)].map((match) => match[1]);
  if (allowBuilds.length === 0) throw new Error("pnpm-workspace.yaml declares no allowBuilds entries");

  const marker = path.join(openclawRoot, "node_modules", "openclaw", "package.json");
  if (fs.existsSync(marker) && !force) {
    const installed = JSON.parse(fs.readFileSync(marker, "utf8")).version;
    if (installed === pinned.openclaw) {
      console.log(`[stage-runtime] openclaw ${installed} already staged`);
      return { versions: pinned, root: openclawRoot };
    }
    console.log(`[stage-runtime] staged openclaw ${installed} differs from the pin, restaging`);
  }

  fs.rmSync(openclawRoot, { recursive: true, force: true });
  fs.mkdirSync(openclawRoot, { recursive: true });
  fs.writeFileSync(
    path.join(openclawRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "aifb-bundled-openclaw",
        private: true,
        version: "0.0.0",
        description: "OpenClaw install carried inside the packaged app. Generated by scripts/stage-runtime.mjs.",
        dependencies: pinned,
        allowScripts: Object.fromEntries(allowBuilds.map((name) => [name, true]))
      },
      null,
      2
    )}\n`
  );

  console.log("[stage-runtime] installing the pinned OpenClaw tree");
  // On Windows npm is a .cmd shim. Node refuses to spawn one without a shell,
  // so this one call opts into a shell there. The argument list is a fixed
  // constant with nothing interpolated into it, which is what makes that safe.
  const onWindows = process.platform === "win32";
  execFileSync(onWindows ? "npm.cmd" : "npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: openclawRoot,
    stdio: "inherit",
    shell: onWindows
  });

  const entry = path.join(openclawRoot, "node_modules", "openclaw", "openclaw.mjs");
  if (!fs.existsSync(entry)) throw new Error("staged OpenClaw is missing openclaw.mjs");
  return { versions: pinned, root: openclawRoot, allowScripts: allowBuilds };
}

const options = parseArgs(process.argv.slice(2));
const node = await stageNode(options);
const openclaw = stageOpenClaw(options);
const channelInstaller = await stageChannelInstaller({ force: options.force });

const summary = {
  stagedAt: new Date().toISOString(),
  platform: options.platform,
  architecture: options.arch,
  node: {
    version: node.manifest.node.version,
    archive: node.archive.file,
    archiveSha256: node.archive.sha256,
    binarySha256: sha256(node.staged),
    relativePath: path.relative(repoRoot, node.staged).split(path.sep).join("/")
  },
  openclaw: openclaw.versions,
  channelInstaller: { pinSha256: channelInstaller.pinSha256, pluginLockSha256: channelInstaller.pluginLockSha256,
    npmVersion: channelInstaller.npm.version, plugins: channelInstaller.plugins,
    files: channelInstaller.files, bytes: channelInstaller.bytes },
  allowScripts: openclaw.allowScripts
};

fs.writeFileSync(path.join(resourcesRoot, "staged-runtime.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(
  `[stage-runtime] ready: node ${summary.node.version} (${options.platform}/${options.arch}), ` +
    `openclaw ${summary.openclaw.openclaw}`
);
