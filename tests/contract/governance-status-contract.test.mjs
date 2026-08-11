import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..", "..");
const powershell = process.platform === "win32" ? "powershell" : "pwsh";

function runInCopy(mutator = () => {}) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aifb-governance-status-"));

  try {
    fs.cpSync(repoRoot, fixtureRoot, {
      recursive: true,
      filter: (source) => path.basename(source) !== ".git"
    });
    mutator(fixtureRoot);
    return spawnSync(
      powershell,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/validate-governance.ps1"],
      { cwd: fixtureRoot, encoding: "utf8" }
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

test("accepts the current locked release and Feature 0.3 status", () => {
  const result = runInCopy();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("rejects a Master Plan that marks the locked release train unresolved", () => {
  const result = runInCopy((fixtureRoot) => {
    const filePath = path.join(
      fixtureRoot,
      "docs",
      "governance",
      "AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md"
    );
    const current = fs.readFileSync(filePath, "utf8");
    const stale = current.replace(
      /\| Phiên bản OpenClaw stable được khóa \| Feature 0\.2 \| Đã khóa trong release train `oc-2026\.7\.1-2-locked\.1`:[^\r\n]+\|/,
      "| Phiên bản OpenClaw stable được khóa | Feature 0.2 | Chưa khóa |"
    );
    assert.notEqual(stale, current, "fixture mutation did not find the locked release status");
    fs.writeFileSync(filePath, stale);
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /still marks the locked Feature 0\.2 release train as unresolved/);
});

test("rejects a readiness audit that lists Feature 0.3 as pending", () => {
  const result = runInCopy((fixtureRoot) => {
    const filePath = path.join(
      fixtureRoot,
      "docs",
      "release",
      "PRODUCT-READINESS-AUDIT-2026-08-11.md"
    );
    const current = fs.readFileSync(filePath, "utf8");
    const stale = current.replace(
      "Feature 0.3 đã hoàn thành ở mức contract.",
      "Hoàn thành Feature 0.3 đến 0.6"
    );
    assert.notEqual(stale, current, "fixture mutation did not find the Feature 0.3 status");
    fs.writeFileSync(filePath, stale);
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /still lists completed Feature 0\.3 as pending/);
});
