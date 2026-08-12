import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, "..");
const distIndexPath = path.join(repoRoot, "apps", "desktop", "dist", "index.html");
const qaIndexPath = path.join(repoRoot, "artifacts", "feature-0.5", "qa.html");

const distIndex = await fs.readFile(distIndexPath, "utf8");
const assetRoot = "/apps/desktop/dist/assets/";
const bridgeTag = '    <script src="/artifacts/feature-0.5/qa-bridge.js"></script>\n';

const qaIndex = distIndex
  .replaceAll('./assets/', assetRoot)
  .replace('    <script type="module"', `${bridgeTag}    <script type="module"`)
  .replace("<title>AI for Boss</title>", "<title>AI for Boss QA</title>");

if (!qaIndex.includes(bridgeTag.trim()) || !qaIndex.includes(assetRoot)) {
  throw new Error("Feature 0.5 QA harness injection failed closed");
}

await fs.writeFile(qaIndexPath, qaIndex, "utf8");
console.log(`Feature 0.5 QA harness generated: ${path.relative(repoRoot, qaIndexPath)}`);
