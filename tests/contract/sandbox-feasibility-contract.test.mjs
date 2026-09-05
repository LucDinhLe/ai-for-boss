import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  evaluateSandboxActivation,
  evaluateSandboxPromotionReadiness,
  validateFixtureOnlyProbeSource,
  validateJsonSchemaSubset,
  validateSandboxDecisionContract,
  validateSandboxProbeEvidence
} from "../../src/sandbox/feasibility-policy.mjs";
import { runSandboxFeasibilityProbe } from "../../src/sandbox/feasibility-probe.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
const readProbeSource = () => [
  "scripts/spike/sandbox-feasibility-probe.mjs",
  "src/sandbox/feasibility-probe.mjs"
].map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")).join("\n");

test("safe default denies every product execution route before independent review", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");

  for (const request of [
    { kind: "backend-activation", backendId: "local-managed-container", platform: "win32" },
    { kind: "backend-activation", backendId: "remote-openshell-ssh", platform: "darwin" },
    { kind: "backend-activation", backendId: "native-os-restrictions", platform: "linux" },
    { kind: "host-exec", platform: "win32" },
    { kind: "elevated-exec", platform: "darwin" },
    { kind: "sensitive-browser", platform: "linux" }
  ]) {
    const result = evaluateSandboxActivation({ manifest, capabilityManifest, request });
    assert.equal(result.allowed, false, `${request.kind}/${request.backendId ?? request.platform} must fail closed`);
    assert.match(result.reason, /blocked|review|capability/);
  }

  const unknownBackend = evaluateSandboxActivation({
    manifest,
    capabilityManifest,
    request: { kind: "backend-activation", backendId: "silent-host-fallback", platform: process.platform }
  });
  assert.deepEqual(unknownBackend, {
    allowed: false,
    reason: "backend-blocked-unknown",
    capabilityId: null
  });
});

test("decision contract cross-checks exact directions and locked capabilities", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
  const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");
  assert.deepEqual(validateSandboxDecisionContract({ manifest, schema, capabilityManifest }), { ok: true });

  const weakened = structuredClone(manifest);
  weakened.safeDefault.productHostExec = true;
  weakened.directions[0].decision = "accepted";
  const result = validateSandboxDecisionContract({ manifest: weakened, schema, capabilityManifest });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /productHostExec|preferred-contingent/);

  const silentFallback = structuredClone(manifest);
  silentFallback.safeDefault.automaticFallback = true;
  const fallbackResult = validateSandboxDecisionContract({ manifest: silentFallback, schema, capabilityManifest });
  assert.equal(fallbackResult.ok, false);
  assert.match(fallbackResult.errors.join("\n"), /automaticFallback/);

  const forgedPromotion = structuredClone(manifest);
  forgedPromotion.directions[0].isolation.testedInFeature = true;
  const promotionResult = validateSandboxDecisionContract({ manifest: forgedPromotion, schema, capabilityManifest });
  assert.equal(promotionResult.ok, false);
  assert.match(promotionResult.errors.join("\n"), /testedInFeature/);
});

test("decision validator applies exact schema and fails cleanly on malformed records", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
  const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");
  const mutations = [
    ["unexpected top-level property", (candidate) => { candidate.unexpected = true; }, /additional property/i],
    ["duplicate fourth direction", (candidate) => { candidate.directions.push(structuredClone(candidate.directions[0])); }, /maxItems|directions\.length|duplicate/i],
    ["missing Windows platform evidence", (candidate) => { delete candidate.directions[0].platforms.windows; }, /windows|required/i],
    ["illegal evidence level", (candidate) => { candidate.directions[0].evidenceLevel = "marketing-claim"; }, /evidenceLevel|const/i],
    ["null direction", (candidate) => { candidate.directions = [null]; }, /type|maxItems|minItems|direction/i],
    ["unknown claim source", (candidate) => { candidate.directions[0].sourceRefs = ["SRC-99"]; }, /unknown source/i],
    ["duplicated reviewer", (candidate) => { candidate.reviewGate.requiredReviewers = ["Senior platform reviewer", "Senior platform reviewer"]; }, /uniqueItems|requiredReviewers/i]
  ];

  for (const [label, mutate, expectedError] of mutations) {
    const candidate = structuredClone(manifest);
    mutate(candidate);
    let result;
    assert.doesNotThrow(() => {
      result = validateSandboxDecisionContract({ manifest: candidate, schema, capabilityManifest });
    }, label);
    assert.equal(result.ok, false, label);
    assert.match(result.errors.join("\n"), expectedError, label);
  }
});

test("schema subset validator returns structured errors for malformed schema definitions", () => {
  for (const [label, schema] of [
    ["required is not an array", { type: "object", required: { value: true }, properties: {} }],
    ["properties is not an object", { type: "object", properties: [] }],
    ["invalid regular expression", { type: "string", pattern: "[" }]
  ]) {
    let result;
    assert.doesNotThrow(() => {
      result = validateJsonSchemaSubset({}, schema);
    }, label);
    assert.equal(result.ok, false, label);
    assert.ok(result.errors.length > 0, label);
  }
});

test("semantic validator rejects joint schema and manifest downgrades", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
  const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");

  for (const [label, mutate, expectedError] of [
    ["premature promotion", (candidateManifest, candidateSchema) => {
      candidateManifest.promotionPolicy.enabled = true;
      candidateSchema.properties.promotionPolicy.properties.enabled.const = true;
    }, /promotionPolicy/],
    ["presence-only promotion", (candidateManifest, candidateSchema) => {
      candidateManifest.promotionPolicy.allowsPresenceOnlyEvidence = true;
      candidateSchema.properties.promotionPolicy.properties.allowsPresenceOnlyEvidence.const = true;
    }, /promotionPolicy/],
    ["evidence taxonomy downgrade", (candidateManifest, candidateSchema) => {
      candidateManifest.evidencePolicy.levels = ["documented-primary-source"];
      candidateSchema.properties.evidencePolicy.properties.levels.const = ["documented-primary-source"];
    }, /evidencePolicy\.levels/],
    ["direction evidence downgrade", (candidateManifest, candidateSchema) => {
      candidateManifest.directions[0].evidenceLevel = "assumption-pending";
      candidateSchema.properties.directions.items.properties.evidenceLevel.const = "assumption-pending";
    }, /direction local-managed-container evidenceLevel/],
    ["source evidence downgrade", (candidateManifest, candidateSchema) => {
      candidateManifest.sources[0].evidenceLevel = "assumption-pending";
      candidateSchema.properties.sources.items.properties.evidenceLevel.const = "assumption-pending";
    }, /source SRC-01 evidenceLevel/],
    ["source access date drift", (candidateManifest, candidateSchema) => {
      candidateManifest.sources[0].accessedAt = "2026-08-13";
      candidateSchema.properties.sources.items.properties.accessedAt.const = "2026-08-13";
    }, /source SRC-01 accessedAt/],
    ["direction source narrowing", (candidateManifest) => {
      candidateManifest.directions[0].sourceRefs = ["SRC-01"];
    }, /direction local-managed-container sourceRefs/],
    ["source URL substitution", (candidateManifest) => {
      candidateManifest.sources[0].url = "https://github.com/openclaw/openclaw";
    }, /source SRC-01 url/],
    ["analyst inference relabeled as upstream fact", (candidateManifest, candidateSchema) => {
      candidateManifest.claims.find((claim) => claim.claimId === "CLM-03").classification = "upstream-fact";
      candidateSchema.properties.claims.items.properties.classification.enum = ["upstream-fact"];
    }, /claim CLM-03 classification/],
    ["documented claim made promotion eligible", (candidateManifest, candidateSchema) => {
      candidateManifest.claims[0].promotionEligible = true;
      candidateSchema.properties.claims.items.properties.promotionEligible.const = true;
    }, /claim CLM-01 promotionEligible/],
    ["claim statement rewritten as unsupported isolation proof", (candidateManifest, candidateSchema) => {
      candidateManifest.claims[0].statement = "CI presence proves production-ready isolation on every user device.";
      candidateSchema.properties.claims.items.properties.statement = {
        enum: candidateManifest.claims.map((claim) => claim.statement)
      };
    }, /claim CLM-01 statement/],
    ["probe source hash relabeled", (candidateManifest, candidateSchema) => {
      candidateManifest.probeSourceLocks[0].sha256 = "f".repeat(64);
      candidateSchema.properties.probeSourceLocks.const[0].sha256 = "f".repeat(64);
    }, /probeSourceLocks/],
    ["direction platform coverage narrowed", (candidateManifest, candidateSchema) => {
      for (const direction of candidateManifest.directions) delete direction.platforms.windows;
      candidateSchema.properties.directions.items.properties.platforms.required = ["macos", "linux"];
      delete candidateSchema.properties.directions.items.properties.platforms.properties.windows;
    }, /platform|direction .* semantic digest/],
    ["direction safety claims rewritten", (candidateManifest) => {
      const direction = candidateManifest.directions[0];
      direction.isolation.rating = "production-proven-absolute-isolation";
      direction.isolation.basis = "Absolute isolation is proven for production.";
      direction.dataAndNetwork.networkDefault = "unrestricted";
      direction.remainingBlockedCapabilities = ["none"];
    }, /isolation|networkDefault|remainingBlockedCapabilities|direction .* semantic digest/]
  ]) {
    const candidateManifest = structuredClone(manifest);
    const candidateSchema = structuredClone(schema);
    mutate(candidateManifest, candidateSchema);
    const result = validateSandboxDecisionContract({
      manifest: candidateManifest,
      schema: candidateSchema,
      capabilityManifest
    });
    assert.equal(result.ok, false, label);
    assert.match(result.errors.join("\n"), expectedError, label);
  }
});

test("machine contract pins D-0018 and reverse coverage for every Feature 0.6 Critical or High risk", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
  const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");
  const threatManifest = readJson("manifests/security/threat-model.manifest.json");
  const expectedTraceability = {
    decisionRefs: ["D-0018"],
    riskThreatRefs: {
      "R-001": ["T-06", "T-08", "T-09", "T-10"],
      "R-020": ["T-02", "T-05", "T-08", "T-12", "T-14"],
      "R-028": ["T-08", "T-10"],
      "R-029": ["T-02", "T-03", "T-14"],
      "R-030": ["T-08", "T-10"]
    }
  };

  assert.deepEqual(manifest.governanceTraceability, expectedTraceability);
  const threatsById = new Map(threatManifest.threats.map((threat) => [threat.id, threat]));
  for (const [riskId, threatIds] of Object.entries(expectedTraceability.riskThreatRefs)) {
    for (const threatId of threatIds) {
      assert.ok(threatsById.get(threatId)?.riskRefs.includes(riskId), `${threatId} must reference ${riskId}`);
    }
  }

  const weakenedManifest = structuredClone(manifest);
  const weakenedSchema = structuredClone(schema);
  weakenedManifest.governanceTraceability.decisionRefs = ["D-9999"];
  weakenedSchema.properties.governanceTraceability.const.decisionRefs = ["D-9999"];
  const result = validateSandboxDecisionContract({
    manifest: weakenedManifest,
    schema: weakenedSchema,
    capabilityManifest
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /governanceTraceability/);
});

test("promotion readiness has pending, rejected, and eligible states without enabling activation", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const nowMs = Date.parse("2026-08-12T12:00:00.000Z");
  const candidateSha = "a".repeat(40);
  const controls = [...manifest.promotionPolicy.requiredControls];
  const acceptedEvidence = {
    status: "accepted",
    backendId: "local-managed-container",
    candidateSha,
    productOwnerDecision: {
      status: "accepted",
      decidedBy: "Lê Đình Lực",
      decidedAt: "2026-08-12T10:00:00.000Z"
    },
    reviewerAttestations: [
      {
        role: "Senior platform reviewer",
        reviewerType: "human",
        reviewerName: "Platform Reviewer",
        status: "accepted",
        reviewedAt: "2026-08-12T10:30:00.000Z"
      },
      {
        role: "Independent security reviewer",
        reviewerType: "human",
        reviewerName: "Security Reviewer",
        status: "accepted",
        reviewedAt: "2026-08-12T10:45:00.000Z"
      }
    ],
    platformReports: ["win32", "darwin", "linux"].map((platform) => ({
      platform,
      status: "passed",
      deviceClass: "representative-user-device",
      evidenceScope: "real-product-isolation",
      candidateSha,
      controls,
      reportId: `REPORT-${platform}`,
      capturedAt: "2026-08-12T11:00:00.000Z"
    })),
    rollbackEvidence: { status: "passed", candidateSha, reportId: "ROLLBACK-01" },
    revocationEvidence: { status: "tested", reportId: "REVOCATION-01" }
  };

  const pending = evaluateSandboxPromotionReadiness({ manifest, evidence: null, nowMs });
  assert.equal(pending.status, "pending");
  assert.equal(pending.activationAllowed, false);

  const rejectedEvidence = structuredClone(acceptedEvidence);
  rejectedEvidence.productOwnerDecision.status = "rejected";
  const rejected = evaluateSandboxPromotionReadiness({ manifest, evidence: rejectedEvidence, nowMs });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.activationAllowed, false);

  const eligible = evaluateSandboxPromotionReadiness({ manifest, evidence: acceptedEvidence, nowMs });
  assert.deepEqual(eligible, {
    status: "eligible",
    activationAllowed: false,
    reason: "promotion-conditions-satisfied-review-only",
    details: []
  });

  const stale = structuredClone(acceptedEvidence);
  stale.platformReports[0].capturedAt = "2025-01-01T00:00:00.000Z";
  const staleResult = evaluateSandboxPromotionReadiness({ manifest, evidence: stale, nowMs, maxAgeMs: 60_000 });
  assert.equal(staleResult.status, "pending");
  assert.match(staleResult.details.join("\n"), /freshness/);
});

test("Always-on stays blocked and non-advertisable with other sandbox-sensitive capabilities", () => {
  const manifest = readJson("manifests/security/sandbox-feasibility.manifest.json");
  const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
  const capabilityManifest = readJson("manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json");
  assert.ok(manifest.lockedCapabilityIds.includes("always-on.private-instance"));

  const weakenedCapabilities = structuredClone(capabilityManifest);
  const alwaysOn = weakenedCapabilities.capabilities.find((entry) => entry.id === "always-on.private-instance");
  alwaysOn.productTreatment = "RESTRICTED";
  alwaysOn.advertisable = true;
  const result = validateSandboxDecisionContract({ manifest, schema, capabilityManifest: weakenedCapabilities });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /always-on\.private-instance/);

  for (const position of ["first", "last"]) {
    const duplicateCapabilities = structuredClone(capabilityManifest);
    const duplicate = structuredClone(alwaysOn);
    if (position === "first") {
      duplicateCapabilities.capabilities.unshift(duplicate);
    } else {
      duplicateCapabilities.capabilities.push(duplicate);
    }
    const duplicateResult = validateSandboxDecisionContract({
      manifest,
      schema,
      capabilityManifest: duplicateCapabilities
    });
    assert.equal(duplicateResult.ok, false, `duplicate ${position}`);
    assert.match(duplicateResult.errors.join("\n"), /duplicate capability id always-on\.private-instance/);
  }
});

test("JSON schema pins fail-closed defaults instead of accepting weaker booleans", () => {
  const schema = readJson("manifests/security/sandbox-feasibility.schema.json");
  const safeDefault = schema.properties.safeDefault.properties;
  const spikeBoundary = schema.properties.spikeBoundary.properties;

  assert.equal(safeDefault.execution.const, "blocked");
  assert.equal(safeDefault.sandboxMode.const, "off");
  assert.equal(safeDefault.workspaceAccess.const, "none");
  assert.equal(safeDefault.networkEgress.const, "none");
  for (const key of ["productHostExec", "elevatedExec", "sensitiveBrowser", "automaticFallback", "advertisable"]) {
    assert.equal(safeDefault[key].const, false, `${key} must be schema-locked false`);
  }
  for (const key of ["mayInstallSoftware", "mayUseCredentials", "mayUseNetwork", "maySpawnProcesses", "mayWriteOutsideOsTemp", "claimsIsolation"]) {
    assert.equal(spikeBoundary[key].const, false, `${key} must be schema-locked false`);
  }
});

test("fixture-only probe proves containment mechanics without claiming sandbox isolation", () => {
  const scriptPath = path.join(repoRoot, "scripts", "spike", "sandbox-feasibility-probe.mjs");
  const source = `${fs.readFileSync(scriptPath, "utf8")}\n${fs.readFileSync(path.join(repoRoot, "src", "sandbox", "feasibility-probe.mjs"), "utf8")}`;
  assert.deepEqual(validateFixtureOnlyProbeSource(source), { ok: true });

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);

  const report = JSON.parse(result.stdout);
  assert.equal(report.evidenceLevel, "spike-tested");
  assert.deepEqual(report.evidenceScopes, ["presence", "temp-containment"]);
  assert.equal(report.promotionEligible, false);
  assert.equal(report.claimsIsolation, false);
  assert.deepEqual(report.protectedCapabilities, {
    productHostExec: false,
    elevatedExec: false,
    sensitiveBrowser: false,
    networkEgress: false,
    credentialUse: false
  });
  assert.deepEqual(report.tempFixture, {
    createdInsideOsTemp: true,
    pathContained: true,
    cleanupReauthorized: true,
    cleanupVerified: true
  });
  assert.equal(typeof report.runtimeHints, "object");
  assert.ok(Object.values(report.runtimeHints).every((value) => typeof value === "boolean"));
  assert.doesNotMatch(result.stdout, /AUS-PRO|OneDrive|\\Users\\|\/Users\//i);
});

test("probe source policy rejects non-node prefixes, network modules, indirect loaders, and dynamic code", () => {
  const baseSource = readProbeSource();
  for (const mutation of [
    'import { spawnSync } from "child_process";',
    'import http from "http";',
    'import {\n  spawnSync\n} from "node:child_process";',
    'const cp = require("node:child_process");',
    'const net = await import("node:net");',
    'const net = await import/* bypass */("node:net");',
    'const cp = process.getBuiltinModule("child_process");',
    'const cp = process["getBuiltinModule"]("child_process");',
    'const cp = Reflect.get(process, "getBuiltinModule")("child_process");',
    'const load = Function("return process.getBuiltinModule");',
    'const load = eval("process.getBuiltinModule");',
    'globalThis["fetch"]("https://example.invalid");',
    'import/* comment */{ spawnSync }from/* comment */"node:child_process";',
    'fetch`https://example.invalid`;',
    'import {'
  ]) {
    const source = `${baseSource}\n${mutation}`;
    const result = validateFixtureOnlyProbeSource(source);
    assert.equal(result.ok, false, mutation);
  }
});

test("probe source policy rejects alias laundering into allowlisted call names", () => {
  const baseSource = readProbeSource();
  for (const mutation of [
    'const { getBuiltinModule: existsSync } = process; const { execSync: present } = existsSync("node:child_process"); present("whoami");',
    'const present = fsApi.writeFileSync; present("outside", "payload");',
    'const existsSync = fsApi.writeFileSync; existsSync("outside", "payload");',
    'present("C:/outside-temp", fsApi.rmSync);',
    'path.resolve = fsApi.rmSync; path.resolve("C:/outside-temp", { recursive: true, force: true });',
    'process.stdout.write`unexpected tagged output`;'
  ]) {
    const source = `${baseSource}\n${mutation}`;
    const result = validateFixtureOnlyProbeSource(source);
    assert.equal(result.ok, false, mutation);
  }
});

test("probe source policy rejects raw filesystem mutation outside contained helpers", () => {
  const baseSource = readProbeSource();
  for (const mutation of [
    'fsApi.writeFileSync("C:/outside-temp/file.txt", "payload");',
    'fsApi.rmSync("C:/outside-temp", { recursive: true, force: true });',
    'fsApi.rmdirSync("C:/outside-temp");',
    'fsApi.mkdtempSync("C:/outside-temp/prefix-");'
  ]) {
    const source = `${baseSource}\n${mutation}`;
    const result = validateFixtureOnlyProbeSource(source);
    assert.equal(result.ok, false, mutation);
  }
});

test("probe source policy rejects canonical-shape data-flow substitutions", () => {
  const baseSource = readProbeSource();
  for (const [label, source] of [
    [
      "outside-temp root hidden behind canonical tempRoot name",
      baseSource.replace(
        'tempRoot = fsApi.mkdtempSync(path.join(resolvedOsTemp, "aifb-sandbox-feasibility-"));',
        'tempRoot = "C:/outside-temp/private";'
      )
    ],
    [
      "outside-temp cleanup hidden behind canonical resolvedRoot name",
      baseSource.replace(
        "resolvedRoot = fsApi.realpathSync(tempRoot);",
        'resolvedRoot = "C:/Users/private";'
      )
    ],
    [
      "environment dump hidden in an existing report field",
      baseSource.replace("    architecture,", "    architecture: process.env,")
    ]
  ]) {
    assert.notEqual(source, baseSource, `${label}: mutation must change canonical source`);
    const result = validateFixtureOnlyProbeSource(source);
    assert.equal(result.ok, false, label);
  }
});

test("Windows probe recognizes per-user Docker layouts without reporting resolved paths", () => {
  for (const dockerSegments of [
    ["Programs", "Docker", "Docker", "Docker Desktop.exe"],
    ["Programs", "DockerDesktop", "Docker Desktop.exe"]
  ]) {
    const localAppData = "C:\\Users\\fixture\\AppData\\Local";
    const expectedDocker = path.join(localAppData, ...dockerSegments);
    const fakeFs = Object.create(fs);
    fakeFs.existsSync = (candidate) => path.resolve(candidate) === path.resolve(expectedDocker);
    const report = runSandboxFeasibilityProbe({
      platform: "win32",
      architecture: "x64",
      nodeVersion: process.versions.node,
      fsApi: fakeFs,
      environment: {
        WINDIR: "D:\\Windows",
        LOCALAPPDATA: localAppData
      },
      osTemp: os.tmpdir()
    });
    assert.equal(report.runtimeHints.dockerDesktopExecutablePresent, true, dockerSegments.join("/"));
    assert.doesNotMatch(JSON.stringify(report), /C:\\\\Users|D:\\\\Windows|Docker Desktop\.exe/i);
  }
});

test("probe rejects an unsupported operating system instead of treating it as Linux", () => {
  const report = runSandboxFeasibilityProbe({ platform: "freebsd" });
  assert.equal(report.ok, false);
  assert.equal(report.code, "unsupported-probe");
  assert.equal(report.platform, "freebsd");
  assert.equal(report.claimsIsolation, false);
  assert.deepEqual(report.runtimeHints, {});
  assert.equal(report.tempFixture, null);
});

test("probe reports cleanup failure without exposing an absolute path or raw error", () => {
  let createdRoot = null;
  const failingFs = Object.create(fs);
  failingFs.mkdtempSync = (prefix) => {
    createdRoot = fs.mkdtempSync(prefix);
    return createdRoot;
  };
  failingFs.rmdirSync = () => {
    throw new Error(`cleanup failed at ${createdRoot}`);
  };

  try {
    const report = runSandboxFeasibilityProbe({ fsApi: failingFs, osTemp: os.tmpdir() });
    assert.equal(report.ok, false);
    assert.equal(report.code, "cleanup-failed");
    assert.equal(report.claimsIsolation, false);
    assert.equal(report.tempFixture.cleanupVerified, false);
    assert.doesNotMatch(JSON.stringify(report), /cleanup failed|AUS-PRO|OneDrive|\\Users\\|\/Users\//i);
  } finally {
    if (createdRoot) fs.rmSync(createdRoot, { recursive: true, force: true });
  }
});

test("probe proves temp-directory containment without child-file I/O or recursive removal", () => {
  const resolvedTemp = path.resolve(os.tmpdir());
  const tempRoot = path.join(resolvedTemp, "aifb-sandbox-feasibility-fake");
  let readAttempted = false;
  let writeAttempted = false;
  let recursiveRemovalAttempted = false;
  let directoryRemovalAttempted = false;
  const fakeFs = {
    existsSync: () => false,
    mkdtempSync: () => tempRoot,
    readFileSync: () => {
      readAttempted = true;
      return "";
    },
    realpathSync: (candidate) => path.resolve(candidate),
    rmdirSync: () => {
      directoryRemovalAttempted = true;
    },
    rmSync: () => {
      recursiveRemovalAttempted = true;
    },
    writeFileSync: () => {
      writeAttempted = true;
    }
  };

  const report = runSandboxFeasibilityProbe({ fsApi: fakeFs, osTemp: resolvedTemp });
  assert.equal(report.ok, true);
  assert.equal(report.code, "probe-complete");
  assert.deepEqual(report.tempFixture, {
    createdInsideOsTemp: true,
    pathContained: true,
    cleanupReauthorized: true,
    cleanupVerified: true
  });
  assert.equal(writeAttempted, false);
  assert.equal(readAttempted, false);
  assert.equal(directoryRemovalAttempted, true);
  assert.equal(recursiveRemovalAttempted, false);
});

test("probe reauthorizes the canonical temp root immediately before non-recursive cleanup", () => {
  const resolvedTemp = path.resolve(os.tmpdir());
  const requestedRoot = path.join(resolvedTemp, "aifb-sandbox-feasibility-fake-root");
  const escapedRoot = path.join(path.dirname(resolvedTemp), "escaped-root");
  let rootRealpathChecks = 0;
  let recursiveRemovalAttempted = false;
  let directoryRemovalAttempted = false;
  const fakeFs = {
    existsSync: () => false,
    mkdtempSync: () => requestedRoot,
    realpathSync: (candidate) => {
      if (path.resolve(candidate) !== path.resolve(requestedRoot)) return path.resolve(candidate);
      rootRealpathChecks += 1;
      return rootRealpathChecks === 1 ? path.resolve(requestedRoot) : escapedRoot;
    },
    rmdirSync: () => {
      directoryRemovalAttempted = true;
    },
    rmSync: () => {
      recursiveRemovalAttempted = true;
    },
    writeFileSync: () => {},
    readFileSync: () => ""
  };

  const report = runSandboxFeasibilityProbe({ fsApi: fakeFs, osTemp: resolvedTemp });
  assert.equal(report.ok, false);
  assert.equal(report.code, "cleanup-boundary-failed");
  assert.equal(report.tempFixture.cleanupVerified, false);
  assert.equal(rootRealpathChecks, 2);
  assert.equal(directoryRemovalAttempted, false);
  assert.equal(recursiveRemovalAttempted, false);
});

test("probe never removes a temp root whose realpath escapes the OS temp directory", () => {
  const resolvedTemp = path.resolve(os.tmpdir());
  const requestedRoot = path.join(resolvedTemp, "aifb-sandbox-feasibility-fake-root");
  const escapedRoot = path.join(path.dirname(resolvedTemp), "escaped-root");
  let cleanupAttempted = false;
  const fakeFs = {
    existsSync: () => false,
    mkdtempSync: () => requestedRoot,
    readFileSync: () => "",
    realpathSync: (candidate) => path.resolve(candidate) === path.resolve(requestedRoot) ? escapedRoot : path.resolve(candidate),
    rmSync: () => {
      cleanupAttempted = true;
    },
    writeFileSync: () => {}
  };

  const report = runSandboxFeasibilityProbe({ fsApi: fakeFs, osTemp: resolvedTemp });
  assert.equal(report.ok, false);
  assert.equal(report.code, "path-boundary-failed");
  assert.equal(report.tempFixture.createdInsideOsTemp, false);
  assert.equal(report.tempFixture.cleanupVerified, false);
  assert.equal(cleanupAttempted, false);
});

test("probe evidence rejects mismatches, stale reports, forged promotion, and extra privacy fields", () => {
  const nowMs = Date.parse("2026-08-12T12:00:00.000Z");
  const expectedNodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  const report = runSandboxFeasibilityProbe({ capturedAt: new Date(nowMs).toISOString() });
  const expected = {
    expectedPlatform: process.platform,
    expectedArchitecture: process.arch,
    expectedNodeMajor,
    nowMs,
    maxAgeMs: 60_000
  };
  assert.deepEqual(validateSandboxProbeEvidence(report, expected), { ok: true });

  const wrongPlatform = validateSandboxProbeEvidence(report, {
    ...expected,
    expectedPlatform: process.platform === "win32" ? "linux" : "win32"
  });
  assert.equal(wrongPlatform.ok, false);
  assert.match(wrongPlatform.errors.join("\n"), /platform/i);

  const stale = validateSandboxProbeEvidence({ ...report, capturedAt: "2026-08-11T12:00:00.000Z" }, expected);
  assert.equal(stale.ok, false);
  assert.match(stale.errors.join("\n"), /stale/i);

  const forged = validateSandboxProbeEvidence({
    ...report,
    claimsIsolation: true,
    evidenceLevel: "spike-tested-isolation"
  }, expected);
  assert.equal(forged.ok, false);
  assert.match(forged.errors.join("\n"), /isolation|evidenceLevel/i);

  for (const [label, mutate, expectedError] of [
    ["wrong architecture", (candidate) => { candidate.architecture = "forged-architecture"; }, /architecture/i],
    ["wrong Node major", (candidate) => { candidate.nodeMajor = expectedNodeMajor + 1; }, /nodeMajor/i],
    ["top-level diagnostics", (candidate) => { candidate.diagnostics = { home: "C:\\Users\\private" }; }, /additional|keys|diagnostics/i],
    ["extra protected capability", (candidate) => { candidate.protectedCapabilities.childProcess = true; }, /protectedCapabilities/i],
    ["outside-temp claim", (candidate) => { candidate.tempFixture.wroteOutsideTemp = true; }, /tempFixture/i],
    ["secret-like limitation", (candidate) => { candidate.limitations = ["API_KEY=not-a-real-secret-but-must-not-pass"]; }, /limitations/i],
    ["forged success failure", (candidate) => { candidate.failure = { component: "x", message: "C:\\Users\\private" }; }, /failure/i],
    ["forged promotion eligibility", (candidate) => { candidate.promotionEligible = true; }, /promotionEligible/i]
  ]) {
    const candidate = structuredClone(report);
    mutate(candidate);
    const result = validateSandboxProbeEvidence(candidate, expected);
    assert.equal(result.ok, false, label);
    assert.match(result.errors.join("\n"), expectedError, label);
  }
});

test("governance CI installs locked dependencies before loading the AST policy", () => {
  const workflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "governance.yml"), "utf8");
  const installOffset = workflow.indexOf("pnpm install --frozen-lockfile");
  const contractTestOffset = workflow.indexOf("node --test ./tests/contract/*.test.mjs");
  assert.notEqual(installOffset, -1, "governance CI must install the locked dependency graph");
  assert.notEqual(contractTestOffset, -1, "governance CI must run contract tests");
  assert.ok(installOffset < contractTestOffset, "dependency install must precede contract tests");
});

test("CI workflows pin official Node 24 action runtimes and reject Node 20 refs", () => {
  const desktopWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "desktop-shell.yml"), "utf8");
  const governanceWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "governance.yml"), "utf8");
  const combined = `${desktopWorkflow}\n${governanceWorkflow}`;
  const requiredPins = [
    "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1, Node 24",
    "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0, Node 24"
  ];
  for (const pin of requiredPins) {
    assert.equal(desktopWorkflow.includes(pin), true, `desktop workflow must contain ${pin}`);
    assert.equal(governanceWorkflow.includes(pin), true, `governance workflow must contain ${pin}`);
  }
  assert.equal(
    desktopWorkflow.includes("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1, Node 24"),
    true
  );
  for (const forbiddenRef of [
    "actions/checkout@v4",
    "actions/setup-node@v4",
    "11d5960a326750d5838078e36cf38b85af677262",
    "49933ea5288caeca8642d1e84afbd3f7d6820020",
    "ea165f8d65b6e75b540449e92b4886f43607fa02"
  ]) assert.equal(combined.includes(forbiddenRef), false, `workflow must reject ${forbiddenRef}`);
});

test("governance scan prunes dependency and build directories before recursion", () => {
  const governanceScript = fs.readFileSync(path.join(repoRoot, "scripts", "validate-governance.ps1"), "utf8");
  assert.match(governanceScript, /function Get-RepositoryFiles/);
  assert.match(governanceScript, /ignoredDirectoryNames/);
  assert.equal(
    governanceScript.includes("Get-ChildItem -LiteralPath $repoRoot -Recurse"),
    false,
    "governance must not traverse ignored dependency trees before filtering them"
  );
});

test("Feature 0.6 validator binds ADR, manifest, capability locks, and package gate", () => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "validate-feature-0.6.mjs")], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Feature 0\.6 validation passed/);
});
