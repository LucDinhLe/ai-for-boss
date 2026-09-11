import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pruneDevelopmentFiles } from "../../scripts/lib/prune-runtime.mjs";

function tree(root, files) {
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(root, ...relative.split("/"));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
}
const list = root => fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => path.relative(root, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join("/")).sort();

test("pruning removes only declarations, source maps and @types, keeping everything Node or OpenClaw reads", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aifb-prune-"));
  const nodeModules = path.join(root, "node_modules");
  tree(nodeModules, {
    "openclaw/package.json": "{}", "openclaw/openclaw.mjs": "", "openclaw/dist/index.js": "", "openclaw/dist/index.js.map": "{}",
    "openclaw/dist/index.d.ts": "", "openclaw/dist/index.d.ts.map": "{}", "openclaw/skills/weather/SKILL.md": "# skill",
    "openclaw/docs/AGENTS.md": "# template", "openclaw/LICENSE": "", "openclaw/README.md": "",
    "some-lib/index.cjs": "", "some-lib/index.cjs.map": "{}", "some-lib/types/index.d.mts": "", "some-lib/types/only-types.d.cts": "",
    "some-lib/native.node": "", "some-lib/data.json": "{}", "some-lib/typed.ts": "export {}",
    "@types/node/index.d.ts": "", "@types/node/package.json": "{}", "@types/node/README.md": "",
    "@scope/pkg/lib.mjs": "", "@scope/pkg/lib.d.mts": ""
  });
  const result = pruneDevelopmentFiles(nodeModules);
  assert.deepEqual(list(nodeModules), [
    "@scope/pkg/lib.mjs", "openclaw/LICENSE", "openclaw/README.md", "openclaw/dist/index.js", "openclaw/docs/AGENTS.md",
    "openclaw/openclaw.mjs", "openclaw/package.json", "openclaw/skills/weather/SKILL.md",
    "some-lib/data.json", "some-lib/index.cjs", "some-lib/native.node", "some-lib/typed.ts"
  ]);
  assert.equal(fs.existsSync(path.join(nodeModules, "@types")), false, "declaration-only packages disappear with their emptied parent");
  assert.equal(fs.existsSync(path.join(nodeModules, "some-lib", "types")), false, "emptied directories are removed");
  assert.equal(result.files, 10);
  assert.equal(result.remaining, 12);
  assert.ok(result.directories >= 3);
  fs.rmSync(root, { recursive: true, force: true });
});

test("pruning a missing tree is a no-op", () => {
  assert.deepEqual(pruneDevelopmentFiles(path.join(os.tmpdir(), "aifb-prune-does-not-exist")), { files: 0, directories: 0, bytes: 0, remaining: 0 });
});
