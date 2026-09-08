/**
 * Producing the evidence is the invariant; storing it somewhere is a separate,
 * billable concern. This check fails the build when a run did not write the
 * record for the platform it ran on, or wrote one that records failures.
 *
 * The filenames carry platform and architecture on purpose, so a run cannot
 * pass by finding a record another platform committed to the repository.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const suffix = `${process.platform}-${process.arch}`;
const expected = [`gateway-smoke-${suffix}.json`, `packaged-runtime-${suffix}.json`, `packaged-app-${suffix}.json`];
const problems = [];

for (const name of expected) {
  const relativePath = path.join("artifacts", "beta-0", name);
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    problems.push(`missing ${relativePath}`);
    continue;
  }
  let record;
  try {
    record = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    problems.push(`${relativePath} is not readable JSON: ${error?.message ?? error}`);
    continue;
  }
  const failures = record.failures ?? [];
  if (failures.length > 0) {
    problems.push(`${relativePath} records ${failures.length} failure(s): ${failures.join("; ")}`);
    continue;
  }
  console.log(`[evidence] ${name} ok`);
}

if (problems.length > 0) {
  console.error("Runtime evidence check failed:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
