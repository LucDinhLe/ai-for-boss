import fs from "node:fs";
import path from "node:path";

/**
 * The installer writes every staged file one by one and then hashes each of
 * them, so on Windows the file count, not the byte count, is what the person
 * waits for. TypeScript declarations and source maps are never read by Node at
 * runtime; dropping them removes a large share of the ~36k files without
 * touching anything OpenClaw loads. Markdown stays: OpenClaw ships bundled
 * skills, prompts and workspace templates as .md and reads them at runtime.
 */
const PRUNE_FILE = /\.d\.(?:ts|mts|cts)$|\.d\.(?:ts|mts|cts)\.map$|\.(?:js|mjs|cjs)\.map$/u;
export function pruneDevelopmentFiles(nodeModules) {
  const result = { files: 0, directories: 0, bytes: 0, remaining: 0 };
  if (!fs.existsSync(nodeModules)) return result;
  const walk = (directory) => {
    let kept = 0;
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isSymbolicLink()) { kept++; continue; }
      if (item.isDirectory()) {
        // @types packages are declarations only; anything left inside them is unused too.
        const typesPackage = path.basename(directory) === "@types" && path.dirname(directory) === nodeModules;
        const inside = walk(absolute);
        if (inside === 0 || typesPackage) {
          if (typesPackage && inside > 0) {
            const leftovers = fs.readdirSync(absolute, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile());
            result.files += leftovers.length; result.remaining -= leftovers.length;
          }
          fs.rmSync(absolute, { recursive: true, force: true });
          result.directories++;
        } else kept++;
        continue;
      }
      if (item.isFile() && PRUNE_FILE.test(item.name)) {
        result.bytes += fs.statSync(absolute).size;
        fs.rmSync(absolute, { force: true });
        result.files++;
        continue;
      }
      kept++; result.remaining++;
    }
    return kept;
  };
  walk(nodeModules);
  return result;
}
