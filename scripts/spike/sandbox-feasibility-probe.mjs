import { runSandboxFeasibilityProbe } from "../../src/sandbox/feasibility-probe.mjs";

const report = runSandboxFeasibilityProbe();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exitCode = 1;
