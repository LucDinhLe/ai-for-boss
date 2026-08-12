import { createHash } from "node:crypto";
import { URL } from "node:url";
import ts from "typescript";

const LOCKED_CAPABILITY_BY_REQUEST = Object.freeze({
  "host-exec": "tools.exec-approvals",
  "elevated-exec": "tools.exec-approvals",
  "sensitive-browser": "browser.web-automation"
});

const REQUIRED_DIRECTIONS = Object.freeze({
  "local-managed-container": "preferred-contingent",
  "remote-openshell-ssh": "optional-research-only",
  "native-os-restrictions": "rejected-as-primary-backend"
});

const REQUIRED_DIRECTION_SHA256 = Object.freeze({
  "local-managed-container": "a1b2621167b104413e3006cc2914c45a98bdb9eef98492ef1c60434394689d3c",
  "remote-openshell-ssh": "9a51f0df4e8e4ddbb463a20f66498ad8c0557b158dc29aa65678b6117dbf7ef0",
  "native-os-restrictions": "491b62da420fc566cb6dc5a4703e5c9e412fcdbc8d460aaec5812a78e86544f1"
});

const PLATFORM_FIELD_BY_RUNTIME = Object.freeze({
  win32: "windows",
  darwin: "macos",
  linux: "linux"
});

const REQUIRED_EVIDENCE_LEVELS = Object.freeze([
  "spike-tested",
  "documented-primary-source",
  "assumption-pending",
  "blocked-or-not-feasible"
]);

const REQUIRED_DIRECTION_SOURCE_REFS = Object.freeze({
  "local-managed-container": Object.freeze(["SRC-01", "SRC-03", "SRC-04", "SRC-05", "SRC-06", "SRC-07"]),
  "remote-openshell-ssh": Object.freeze(["SRC-01", "SRC-02", "SRC-08", "SRC-09", "SRC-10"]),
  "native-os-restrictions": Object.freeze(["SRC-11", "SRC-12", "SRC-13", "SRC-14", "SRC-15", "SRC-16", "SRC-17", "SRC-18"])
});

function requiredSource(url, scope) {
  return Object.freeze({
    url,
    accessedAt: "2026-08-12",
    scope,
    evidenceLevel: "documented-primary-source"
  });
}

const REQUIRED_SOURCES = Object.freeze({
  "SRC-01": requiredSource(
    "https://github.com/openclaw/openclaw/blob/v2026.7.1-2/docs/gateway/sandboxing.md",
    "locked OpenClaw Docker SSH and OpenShell contract"
  ),
  "SRC-02": requiredSource(
    "https://github.com/openclaw/openclaw/blob/v2026.7.1-2/docs/gateway/openshell.md",
    "locked OpenShell modes lifecycle and limits"
  ),
  "SRC-03": requiredSource(
    "https://docs.docker.com/engine/security/",
    "container isolation daemon attack surface and cgroups"
  ),
  "SRC-04": requiredSource(
    "https://docs.docker.com/engine/security/rootless/",
    "rootless prerequisites and user namespaces"
  ),
  "SRC-05": requiredSource(
    "https://docs.docker.com/desktop/setup/install/windows-install/",
    "Windows prerequisites privilege and subscription threshold"
  ),
  "SRC-06": requiredSource(
    "https://docs.docker.com/desktop/setup/install/mac-permission-requirements/",
    "macOS privilege model"
  ),
  "SRC-07": requiredSource(
    "https://docs.docker.com/subscription/desktop-license/",
    "Docker Desktop license terms"
  ),
  "SRC-08": requiredSource(
    "https://github.com/NVIDIA/OpenShell/blob/dd2b4e3bc0688bdd59f90030f7c1d52511d6e354/README.md",
    "OpenShell controls and upstream alpha maturity label"
  ),
  "SRC-09": requiredSource(
    "https://docs.nvidia.com/openshell/reference/support-matrix",
    "OpenShell platform and driver support"
  ),
  "SRC-10": requiredSource(
    "https://docs.nvidia.com/openshell/resources/license",
    "OpenShell Apache-2.0 license"
  ),
  "SRC-11": requiredSource(
    "https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation",
    "Windows AppContainer isolation"
  ),
  "SRC-12": requiredSource(
    "https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/",
    "Windows Sandbox isolation editions network and persistence"
  ),
  "SRC-13": requiredSource(
    "https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects",
    "Windows Job Object resource and process-tree controls"
  ),
  "SRC-14": requiredSource(
    "https://developer.apple.com/documentation/security/app-sandbox",
    "macOS App Sandbox entitlements"
  ),
  "SRC-15": requiredSource(
    "https://developer.apple.com/documentation/xcode/embedding-a-helper-tool-in-a-sandboxed-app",
    "signed sandboxed helper requirements"
  ),
  "SRC-16": requiredSource(
    "https://docs.kernel.org/userspace-api/seccomp_filter.html",
    "Linux seccomp scope and limitation"
  ),
  "SRC-17": requiredSource(
    "https://docs.kernel.org/userspace-api/landlock.html",
    "Linux Landlock feature detection and access control"
  ),
  "SRC-18": requiredSource(
    "https://docs.kernel.org/admin-guide/cgroup-v2.html",
    "Linux cgroup resource control"
  )
});

const REQUIRED_PROBE_SOURCE_LOCKS = Object.freeze([
  Object.freeze({
    path: "src/sandbox/feasibility-probe.mjs",
    sha256: "69b8b7927a1900b72b8d577ed0827c98ef0b016a18470407e4ac90f226602a82"
  }),
  Object.freeze({
    path: "scripts/spike/sandbox-feasibility-probe.mjs",
    sha256: "30e6884e567b36917287b2b59f838c191c383f0e3deb2337a0610b9ebacad5a9"
  })
]);

const REQUIRED_COMBINED_PROBE_SOURCE_SHA256 = "344ebdc287a3382652271621f7764523905dca28ecf6ccc8195064b5c6957f60";

const REQUIRED_CLAIM_METADATA = Object.freeze({
  "CLM-01": Object.freeze({
    directionId: "local-managed-container",
    classification: "upstream-fact",
    statement: "Locked OpenClaw Docker defaults are no network, read-only root, and all capabilities dropped.",
    sourceRefs: Object.freeze(["SRC-01"]),
    sectionLocators: Object.freeze(["Docker backend; Defaults"])
  }),
  "CLM-02": Object.freeze({
    directionId: "local-managed-container",
    classification: "upstream-fact",
    statement: "Docker rootless mode runs daemon and containers without root privileges when prerequisites are met.",
    sourceRefs: Object.freeze(["SRC-04"]),
    sectionLocators: Object.freeze(["Rootless mode; Prerequisites"])
  }),
  "CLM-03": Object.freeze({
    directionId: "local-managed-container",
    classification: "analyst-inference",
    statement: "A hardened managed local container is the preferred contingent implementation direction.",
    sourceRefs: Object.freeze(["SRC-01", "SRC-03", "SRC-04", "SRC-05", "SRC-06", "SRC-07"]),
    sectionLocators: Object.freeze(["ADR Recommendation; local managed container analysis"])
  }),
  "CLM-04": Object.freeze({
    directionId: "remote-openshell-ssh",
    classification: "upstream-fact",
    statement: "OpenShell uses remote managed sandboxes and NVIDIA labels the reviewed software alpha.",
    sourceRefs: Object.freeze(["SRC-01", "SRC-02", "SRC-08", "SRC-09"]),
    sectionLocators: Object.freeze(["OpenClaw OpenShell backend; NVIDIA README alpha notice; Support Matrix"])
  }),
  "CLM-05": Object.freeze({
    directionId: "remote-openshell-ssh",
    classification: "product-policy",
    statement: "OpenShell and SSH remain explicit opt-in research only and cannot become the production default in Feature 0.6.",
    sourceRefs: Object.freeze(["SRC-01", "SRC-02", "SRC-08", "SRC-09", "SRC-10"]),
    sectionLocators: Object.freeze(["ADR Decision; D-0018"])
  }),
  "CLM-06": Object.freeze({
    directionId: "native-os-restrictions",
    classification: "upstream-fact",
    statement: "Windows, macOS, and Linux expose different isolation primitives, and seccomp filtering alone is not a sandbox.",
    sourceRefs: Object.freeze(["SRC-11", "SRC-12", "SRC-13", "SRC-14", "SRC-15", "SRC-16", "SRC-17", "SRC-18"]),
    sectionLocators: Object.freeze(["Platform API overviews; seccomp Caveats"])
  }),
  "CLM-07": Object.freeze({
    directionId: "native-os-restrictions",
    classification: "analyst-inference",
    statement: "Native OS restrictions are defense-in-depth and not one primary cross-platform agent backend.",
    sourceRefs: Object.freeze(["SRC-11", "SRC-12", "SRC-13", "SRC-14", "SRC-15", "SRC-16", "SRC-17", "SRC-18"]),
    sectionLocators: Object.freeze(["ADR Recommendation; native restrictions analysis"])
  }),
  "CLM-08": Object.freeze({
    directionId: "local-managed-container",
    classification: "assumption",
    statement: "A dedicated installer and recovery flow may make a managed local container usable for ordinary nontechnical users.",
    sourceRefs: Object.freeze(["SRC-05", "SRC-06"]),
    sectionLocators: Object.freeze(["Windows install prerequisites; Mac permission requirements"])
  })
});

const REQUIRED_LOCKED_CAPABILITIES = Object.freeze([
  "workspace.files-grants",
  "tools.exec-approvals",
  "browser.web-automation",
  "always-on.private-instance"
]);

const REQUIRED_REVIEWERS = Object.freeze([
  "Senior platform reviewer",
  "Independent security reviewer"
]);

const REQUIRED_GOVERNANCE_TRACEABILITY = Object.freeze({
  decisionRefs: Object.freeze(["D-0018"]),
  riskThreatRefs: Object.freeze({
    "R-001": Object.freeze(["T-06", "T-08", "T-09", "T-10"]),
    "R-020": Object.freeze(["T-02", "T-05", "T-08", "T-12", "T-14"]),
    "R-028": Object.freeze(["T-08", "T-10"]),
    "R-029": Object.freeze(["T-02", "T-03", "T-14"]),
    "R-030": Object.freeze(["T-08", "T-10"])
  })
});

const REQUIRED_PROMOTION_POLICY = Object.freeze({
  enabled: false,
  requiresProductOwnerAcceptance: true,
  requiresIndependentReview: true,
  requiresRealProductIsolationEvidence: true,
  requiredPlatforms: Object.freeze(["win32", "darwin", "linux"]),
  requiredControls: Object.freeze([
    "filesystem-containment",
    "network-deny-by-default",
    "process-boundary",
    "credential-isolation",
    "backend-health",
    "failure-recovery",
    "update-rollback"
  ]),
  allowsPresenceOnlyEvidence: false,
  allowsCiRunnerAsUserDeviceEvidence: false
});

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  "$schema",
  "$id",
  "title",
  "type",
  "additionalProperties",
  "required",
  "properties",
  "const",
  "enum",
  "minItems",
  "maxItems",
  "uniqueItems",
  "items",
  "minLength",
  "format",
  "pattern"
]);

const REQUIRED_RUNTIME_HINTS = Object.freeze({
  win32: Object.freeze(["dockerDesktopExecutablePresent", "opensshClientAtStandardPath", "windowsSandboxExecutablePresent", "wslExecutablePresent"]),
  darwin: Object.freeze(["codesignPresent", "dockerDesktopAppPresent", "opensshClientAtStandardPath", "sandboxExecPresent"]),
  linux: Object.freeze(["cgroupV2Present", "dockerCliAtStandardPath", "opensshClientAtStandardPath", "unsharePresent", "userNamespaceMetadataPresent"])
});

const REQUIRED_PROBE_TOP_LEVEL_KEYS = Object.freeze([
  "architecture",
  "capturedAt",
  "claimsIsolation",
  "code",
  "evidenceLevel",
  "evidenceScopes",
  "failure",
  "limitations",
  "nodeMajor",
  "ok",
  "platform",
  "promotionEligible",
  "protectedCapabilities",
  "releaseTrainId",
  "runtimeHints",
  "schemaVersion",
  "tempFixture",
  "testId"
]);

const REQUIRED_PROTECTED_CAPABILITIES = Object.freeze({
  productHostExec: false,
  elevatedExec: false,
  sensitiveBrowser: false,
  networkEgress: false,
  credentialUse: false
});

const REQUIRED_TEMP_FIXTURE = Object.freeze({
  createdInsideOsTemp: true,
  pathContained: true,
  cleanupReauthorized: true,
  cleanupVerified: true
});

const REQUIRED_PROBE_LIMITATIONS = Object.freeze([
  "Executable or OS primitive presence does not prove installation health, isolation, policy enforcement or user readiness.",
  "This probe does not start a process, container, VM, SSH session, browser or network request.",
  "This probe creates and removes one empty directory solely under the OS temporary directory."
]);

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function schemaTypeMatches(value, expected) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "null") return value === null;
  return typeof value === expected;
}

function validateSchemaDefinition(schema, location, errors, activeSchemas = new WeakSet()) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    errors.push(`${location} must be a schema object`);
    return;
  }
  if (activeSchemas.has(schema)) {
    errors.push(`${location} must not contain a cyclic schema definition`);
    return;
  }
  activeSchemas.add(schema);

  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(keyword)) {
      errors.push(`${location} uses unsupported schema keyword ${keyword}`);
    }
  }

  if (Object.hasOwn(schema, "type") && (
    typeof schema.type !== "string"
    || !["array", "boolean", "integer", "null", "number", "object", "string"].includes(schema.type)
  )) {
    errors.push(`${location}.type must be one supported type string`);
  }
  if (Object.hasOwn(schema, "required") && (
    !Array.isArray(schema.required)
    || !schema.required.every((entry) => typeof entry === "string")
    || new Set(schema.required).size !== schema.required.length
  )) {
    errors.push(`${location}.required must be an array of unique property names`);
  }
  if (Object.hasOwn(schema, "properties") && (
    schema.properties === null
    || typeof schema.properties !== "object"
    || Array.isArray(schema.properties)
  )) {
    errors.push(`${location}.properties must be an object`);
  }
  if (Object.hasOwn(schema, "additionalProperties") && typeof schema.additionalProperties !== "boolean") {
    errors.push(`${location}.additionalProperties must be boolean`);
  }
  if (Object.hasOwn(schema, "enum") && !Array.isArray(schema.enum)) {
    errors.push(`${location}.enum must be an array`);
  }
  for (const keyword of ["minItems", "maxItems", "minLength"]) {
    if (Object.hasOwn(schema, keyword) && (!Number.isInteger(schema[keyword]) || schema[keyword] < 0)) {
      errors.push(`${location}.${keyword} must be a non-negative integer`);
    }
  }
  if (Object.hasOwn(schema, "uniqueItems") && typeof schema.uniqueItems !== "boolean") {
    errors.push(`${location}.uniqueItems must be boolean`);
  }
  if (Object.hasOwn(schema, "format") && !["date-time", "uri"].includes(schema.format)) {
    errors.push(`${location}.format must be date-time or uri`);
  }
  if (Object.hasOwn(schema, "pattern")) {
    if (typeof schema.pattern !== "string") {
      errors.push(`${location}.pattern must be a string`);
    } else {
      try {
        new RegExp(schema.pattern);
      } catch {
        errors.push(`${location}.pattern must be a valid regular expression`);
      }
    }
  }
  for (const keyword of ["$schema", "$id", "title"]) {
    if (Object.hasOwn(schema, keyword) && typeof schema[keyword] !== "string") {
      errors.push(`${location}.${keyword} must be a string`);
    }
  }

  if (schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)) {
    for (const [key, child] of Object.entries(schema.properties)) {
      validateSchemaDefinition(child, `${location}.properties.${key}`, errors, activeSchemas);
    }
  }
  if (Object.hasOwn(schema, "items")) {
    if (!schema.items || typeof schema.items !== "object" || Array.isArray(schema.items)) {
      errors.push(`${location}.items must be a schema object`);
    } else {
      validateSchemaDefinition(schema.items, `${location}.items`, errors, activeSchemas);
    }
  }
  activeSchemas.delete(schema);
}

function validateSchemaValue(value, schema, location, errors) {
  if (schema.type && !schemaTypeMatches(value, schema.type)) {
    errors.push(`${location} must have type ${schema.type}`);
    return;
  }
  if (Object.hasOwn(schema, "const") && !jsonEqual(value, schema.const)) {
    errors.push(`${location} must equal schema const ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.some((candidate) => jsonEqual(value, candidate))) {
    errors.push(`${location} must match one schema enum value`);
  }

  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${location} must have minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${location} must match pattern ${schema.pattern}`);
    }
    if (schema.format === "date-time") {
      const looksLikeDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
      if (!looksLikeDateTime || !Number.isFinite(Date.parse(value))) {
        errors.push(`${location} must use date-time format`);
      }
    }
    if (schema.format === "uri") {
      try {
        new URL(value);
      } catch {
        errors.push(`${location} must use URI format`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${location} must contain at least minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${location} exceeds maxItems ${schema.maxItems}`);
    }
    if (schema.uniqueItems) {
      const serialized = value.map((entry) => JSON.stringify(entry));
      if (new Set(serialized).size !== serialized.length) errors.push(`${location} must contain uniqueItems`);
    }
    if (schema.items) {
      value.forEach((entry, index) => validateSchemaValue(entry, schema.items, `${location}[${index}]`, errors));
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) errors.push(`${location} is missing required property ${required}`);
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${location} has additional property ${key}`);
      }
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) validateSchemaValue(value[key], child, `${location}.${key}`, errors);
    }
  }
}

export function validateJsonSchemaSubset(value, schema) {
  const errors = [];
  try {
    validateSchemaDefinition(schema, "$schema", errors);
    if (errors.length === 0) validateSchemaValue(value, schema, "$", errors);
  } catch {
    errors.push("schema validation failed closed on malformed input");
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

const ALLOWED_PROBE_IMPORTS = Object.freeze({
  "node:fs": Object.freeze({ defaultImport: "fs", namedImports: Object.freeze([]) }),
  "node:os": Object.freeze({ defaultImport: "os", namedImports: Object.freeze([]) }),
  "node:path": Object.freeze({ defaultImport: "path", namedImports: Object.freeze([]) }),
  "../../src/sandbox/feasibility-probe.mjs": Object.freeze({
    defaultImport: null,
    namedImports: Object.freeze(["runSandboxFeasibilityProbe"])
  })
});

const ALLOWED_PROBE_FUNCTION_SIGNATURES = Object.freeze({
  isPathInside: Object.freeze(["root", "candidate"]),
  present: Object.freeze(["candidate", "existsSync"]),
  collectRuntimeHints: Object.freeze(["platform", "existsSync", "environment"]),
  exerciseTempFixture: Object.freeze(["fsApi", "osTemp"]),
  runSandboxFeasibilityProbe: Object.freeze(["<probe-options>"])
});

const RESERVED_PROBE_BINDING_NAMES = new Set([
  "Date",
  "JSON",
  "Number",
  "Object",
  "environment",
  "existsSync",
  "fs",
  "fsApi",
  "os",
  "path",
  "present",
  "process",
  "isPathInside",
  "collectRuntimeHints",
  "exerciseTempFixture",
  "runSandboxFeasibilityProbe"
]);

const ALLOWED_PROBE_CALLS = new Set([
  "Object.freeze",
  "Object.values",
  "Object.values().every",
  "path.relative",
  "path.resolve",
  "path.isAbsolute",
  "path.join",
  "relative.startsWith",
  "existsSync",
  "present",
  "isPathInside",
  "collectRuntimeHints",
  "exerciseTempFixture",
  "runSandboxFeasibilityProbe",
  "fsApi.realpathSync",
  "fsApi.mkdtempSync",
  "fsApi.rmdirSync",
  "fsApi.existsSync",
  "fsApi.existsSync.bind",
  "JSON.stringify",
  "Number.parseInt",
  "nodeVersion.split",
  "new Date().toISOString",
  "os.tmpdir",
  "process.stdout.write"
]);

const ALLOWED_PROCESS_PATHS = new Set([
  "process.platform",
  "process.arch",
  "process.versions",
  "process.versions.node",
  "process.env",
  "process.stdout",
  "process.stdout.write",
  "process.exitCode"
]);

const ALLOWED_ENVIRONMENT_PATHS = new Set([
  "environment.WINDIR",
  "environment.SystemRoot",
  "environment.LOCALAPPDATA"
]);

const FORBIDDEN_GLOBAL_IDENTIFIERS = new Set([
  "require",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "eval",
  "Function",
  "globalThis",
  "global",
  "Bun",
  "Deno",
  "Reflect"
]);

function astAccessPath(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const parent = astAccessPath(node.expression);
    return parent ? `${parent}.${node.name.text}` : null;
  }
  if (ts.isCallExpression(node)) {
    const callee = astAccessPath(node.expression);
    return callee ? `${callee}()` : null;
  }
  if (ts.isNewExpression(node)) {
    const constructor = astAccessPath(node.expression);
    return constructor ? `new ${constructor}()` : null;
  }
  return null;
}

function validateProbeImport(node, importCounts, errors) {
  const specifier = ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
  const contract = specifier ? ALLOWED_PROBE_IMPORTS[specifier] : null;
  if (!contract) {
    errors.push(`probe imports non-allowlisted module ${specifier ?? "<non-literal>"}`);
    return;
  }
  importCounts.set(specifier, (importCounts.get(specifier) ?? 0) + 1);
  const clause = node.importClause;
  if (!clause || clause.isTypeOnly) {
    errors.push(`probe import ${specifier} must use its exact runtime binding`);
    return;
  }

  const actualDefault = clause.name?.text ?? null;
  if (actualDefault !== contract.defaultImport) {
    errors.push(`probe import ${specifier} default binding must equal ${contract.defaultImport ?? "<none>"}`);
  }
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    errors.push(`probe import ${specifier} must not use a namespace binding`);
    return;
  }
  const actualNamed = clause.namedBindings && ts.isNamedImports(clause.namedBindings)
    ? clause.namedBindings.elements.map((element) => ({
      imported: element.propertyName?.text ?? element.name.text,
      local: element.name.text,
      typeOnly: element.isTypeOnly
    }))
    : [];
  const expectedNamed = contract.namedImports.map((name) => ({ imported: name, local: name, typeOnly: false }));
  if (!jsonEqual(actualNamed, expectedNamed)) {
    errors.push(`probe import ${specifier} named bindings must equal ${JSON.stringify(expectedNamed)}`);
  }
}

function functionParameterSignature(node) {
  return node.parameters.map((parameter) => {
    if (ts.isIdentifier(parameter.name)) return parameter.name.text;
    if (ts.isObjectBindingPattern(parameter.name)) return "<probe-options>";
    return "<non-identifier>";
  });
}

function enclosingFunctionName(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current)) return current.name?.text ?? "<anonymous>";
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current) || ts.isMethodDeclaration(current)) {
      return "<anonymous>";
    }
    current = current.parent;
  }
  return "<top-level>";
}

function identifierName(node) {
  return ts.isIdentifier(node) ? node.text : null;
}

function validateFsApiCall(node, callPath, errors) {
  const owner = enclosingFunctionName(node);
  if (callPath === "fsApi.existsSync.bind") {
    if (owner !== "runSandboxFeasibilityProbe" || node.arguments.length !== 1 || identifierName(node.arguments[0]) !== "fsApi") {
      errors.push("probe may bind fsApi.existsSync only to fsApi in runSandboxFeasibilityProbe");
    }
    return;
  }
  if (owner !== "exerciseTempFixture") {
    errors.push(`probe calls ${callPath} outside exerciseTempFixture`);
    return;
  }

  if (callPath === "fsApi.realpathSync") {
    const first = identifierName(node.arguments[0]);
    if (node.arguments.length !== 1 || !["osTemp", "tempRoot"].includes(first)) {
      errors.push("probe realpathSync argument is outside the contained fixture contract");
    }
    return;
  }
  if (callPath === "fsApi.mkdtempSync") {
    const first = node.arguments[0];
    const validPrefix = ts.isCallExpression(first)
      && astAccessPath(first.expression) === "path.join"
      && first.arguments.length === 2
      && identifierName(first.arguments[0]) === "resolvedOsTemp"
      && ts.isStringLiteral(first.arguments[1])
      && first.arguments[1].text === "aifb-sandbox-feasibility-";
    if (node.arguments.length !== 1 || !validPrefix) {
      errors.push("probe mkdtempSync prefix must derive from canonical OS temp");
    }
    return;
  }
  if (callPath === "fsApi.rmdirSync") {
    if (node.arguments.length !== 1 || identifierName(node.arguments[0]) !== "cleanupRoot") {
      errors.push("probe rmdirSync must remove only the immediately reauthorized empty temp root");
    }
    return;
  }
  if (callPath === "fsApi.existsSync") {
    if (node.arguments.length !== 1 || identifierName(node.arguments[0]) !== "tempRoot") {
      errors.push("probe existsSync cleanup check must target tempRoot");
    }
  }
}

function validateProbeHelperCall(node, callPath, errors) {
  const owner = enclosingFunctionName(node);
  if (callPath === "existsSync") {
    if (owner !== "present" || node.arguments.length !== 1 || identifierName(node.arguments[0]) !== "candidate") {
      errors.push("probe existsSync helper call must check only the present() candidate");
    }
    return;
  }
  if (callPath === "present") {
    if (owner !== "collectRuntimeHints" || node.arguments.length !== 2 || identifierName(node.arguments[1]) !== "existsSync") {
      errors.push("probe present() calls must use the scoped existsSync callback inside collectRuntimeHints");
    }
    return;
  }
  if (callPath === "isPathInside") {
    const pair = node.arguments.map(identifierName);
    const validPairs = [
      ["resolvedOsTemp", "tempRoot"],
      ["resolvedOsTemp", "resolvedRoot"],
      ["resolvedOsTemp", "cleanupRoot"]
    ];
    if (owner !== "exerciseTempFixture" || !validPairs.some((candidate) => jsonEqual(pair, candidate))) {
      errors.push("probe isPathInside() call is outside the canonical temp-fixture contract");
    }
    return;
  }
  if (callPath === "collectRuntimeHints") {
    const bindCall = node.arguments[1];
    const validBind = ts.isCallExpression(bindCall)
      && astAccessPath(bindCall.expression) === "fsApi.existsSync.bind"
      && bindCall.arguments.length === 1
      && identifierName(bindCall.arguments[0]) === "fsApi";
    if (
      owner !== "runSandboxFeasibilityProbe"
      || node.arguments.length !== 3
      || identifierName(node.arguments[0]) !== "platform"
      || !validBind
      || identifierName(node.arguments[2]) !== "environment"
    ) {
      errors.push("probe collectRuntimeHints() arguments must use the scoped platform, filesystem facade and environment");
    }
    return;
  }
  if (callPath === "exerciseTempFixture") {
    if (
      owner !== "runSandboxFeasibilityProbe"
      || node.arguments.length !== 2
      || identifierName(node.arguments[0]) !== "fsApi"
      || identifierName(node.arguments[1]) !== "osTemp"
    ) {
      errors.push("probe exerciseTempFixture() arguments must use the scoped filesystem facade and OS temp");
    }
    return;
  }
  if (callPath === "runSandboxFeasibilityProbe" && (owner !== "<top-level>" || node.arguments.length !== 0)) {
    errors.push("probe wrapper must call runSandboxFeasibilityProbe() once without arguments");
  }
}

export function validateFixtureOnlyProbeSource(source) {
  const errors = [];
  const text = String(source);
  if (sha256Text(text) !== REQUIRED_COMBINED_PROBE_SOURCE_SHA256) {
    errors.push("probe source differs from the reviewed fixture-only source units");
  }
  const sourceFile = ts.createSourceFile(
    "sandbox-feasibility-probe.mjs",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  for (const diagnostic of sourceFile.parseDiagnostics ?? []) {
    errors.push(`probe source parse error ${diagnostic.code}`);
  }

  const importCounts = new Map();
  const functionCounts = new Map();

  const bindingNames = (name, names = []) => {
    if (ts.isIdentifier(name)) names.push(name.text);
    else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
      for (const element of name.elements) {
        if (ts.isBindingElement(element)) bindingNames(element.name, names);
      }
    }
    return names;
  };

  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      validateProbeImport(node, importCounts, errors);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      errors.push("probe must not re-export another module");
    }

    if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.text ?? "<anonymous>";
      const expectedSignature = ALLOWED_PROBE_FUNCTION_SIGNATURES[name];
      functionCounts.set(name, (functionCounts.get(name) ?? 0) + 1);
      if (!expectedSignature) {
        errors.push(`probe declares non-allowlisted function ${name}`);
      } else if (!jsonEqual(functionParameterSignature(node), expectedSignature)) {
        errors.push(`probe function ${name} parameters must equal ${JSON.stringify(expectedSignature)}`);
      }
    } else if (
      ts.isFunctionExpression(node)
      || ts.isArrowFunction(node)
      || ts.isMethodDeclaration(node)
      || ts.isClassDeclaration(node)
      || ts.isClassExpression(node)
    ) {
      errors.push(`probe contains non-allowlisted executable declaration ${ts.SyntaxKind[node.kind]}`);
    }

    if (ts.isVariableDeclaration(node)) {
      for (const name of bindingNames(node.name)) {
        if (RESERVED_PROBE_BINDING_NAMES.has(name)) {
          errors.push(`probe variable binding must not shadow allowlisted call target ${name}`);
        }
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      && ts.isIdentifier(node.left)
      && RESERVED_PROBE_BINDING_NAMES.has(node.left.text)
    ) {
      errors.push(`probe must not assign allowlisted call target ${node.left.text}`);
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        errors.push("probe must not use dynamic import()");
      } else {
        const callPath = astAccessPath(node.expression);
        if (!callPath || !ALLOWED_PROBE_CALLS.has(callPath)) {
          errors.push(`probe calls non-allowlisted target ${callPath ?? "<dynamic>"}`);
        } else if (callPath.startsWith("fsApi.")) {
          validateFsApiCall(node, callPath, errors);
        } else if ([
          "existsSync",
          "present",
          "isPathInside",
          "collectRuntimeHints",
          "exerciseTempFixture",
          "runSandboxFeasibilityProbe"
        ].includes(callPath)) {
          validateProbeHelperCall(node, callPath, errors);
        }
      }
    }

    if (ts.isTaggedTemplateExpression(node)) {
      errors.push("probe must not use tagged templates");
    }

    if (ts.isNewExpression(node)) {
      const constructor = astAccessPath(node.expression);
      if (constructor !== "Date") errors.push(`probe constructs non-allowlisted target ${constructor ?? "<dynamic>"}`);
    }

    if (ts.isElementAccessExpression(node)) {
      errors.push("probe must not use computed property access");
    }

    if (ts.isIdentifier(node) && FORBIDDEN_GLOBAL_IDENTIFIERS.has(node.text)) {
      errors.push(`probe references forbidden global ${node.text}`);
    }

    if (ts.isPropertyAccessExpression(node)) {
      const accessPath = astAccessPath(node);
      const isDirectCallTarget = ts.isCallExpression(node.parent) && node.parent.expression === node;
      const isNestedBindTarget = ts.isPropertyAccessExpression(node.parent)
        && ts.isCallExpression(node.parent.parent)
        && node.parent.parent.expression === node.parent;
      if (accessPath?.startsWith("fsApi.") && !isDirectCallTarget && !isNestedBindTarget) {
        errors.push(`probe must not pass or alias filesystem member ${accessPath}`);
      }
      if (accessPath?.startsWith("process.") && !ALLOWED_PROCESS_PATHS.has(accessPath)) {
        errors.push(`probe accesses non-allowlisted process member ${accessPath}`);
      }
      if (accessPath?.startsWith("environment.") && !ALLOWED_ENVIRONMENT_PATHS.has(accessPath)) {
        errors.push(`probe accesses non-allowlisted environment member ${accessPath}`);
      }
    }

    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      && (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left))
    ) {
      const assignedPath = astAccessPath(node.left);
      const isExpectedExitCodeAssignment = assignedPath === "process.exitCode"
        && enclosingFunctionName(node) === "<top-level>"
        && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
        && ts.isNumericLiteral(node.right)
        && node.right.text === "1";
      if (
        !isExpectedExitCodeAssignment
        && ["fs.", "os.", "path.", "process.", "fsApi.", "environment."].some((prefix) => assignedPath?.startsWith(prefix))
      ) {
        errors.push(`probe must not assign through protected member ${assignedPath}`);
      }
    }

    if (ts.isWithStatement(node) || ts.isDebuggerStatement(node)) {
      errors.push(`probe contains forbidden syntax ${ts.SyntaxKind[node.kind]}`);
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  for (const specifier of Object.keys(ALLOWED_PROBE_IMPORTS)) {
    if ((importCounts.get(specifier) ?? 0) !== 1) {
      errors.push(`probe must import ${specifier} exactly once`);
    }
  }
  for (const functionName of Object.keys(ALLOWED_PROBE_FUNCTION_SIGNATURES)) {
    if ((functionCounts.get(functionName) ?? 0) !== 1) {
      errors.push(`probe must declare function ${functionName} exactly once`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors: [...new Set(errors)] };
}

function promotionResult(status, reason, details = []) {
  return Object.freeze({
    status,
    activationAllowed: false,
    reason,
    details: Object.freeze([...details])
  });
}

export function evaluateSandboxPromotionReadiness({
  manifest,
  evidence,
  nowMs = Date.now(),
  maxAgeMs = 30 * 24 * 60 * 60 * 1000
} = {}) {
  if (!manifest || !jsonEqual(manifest.promotionPolicy, REQUIRED_PROMOTION_POLICY)) {
    return promotionResult("rejected", "promotion-contract-invalid");
  }
  if (manifest.safeDefault?.execution !== "blocked" || manifest.safeDefault?.automaticFallback !== false) {
    return promotionResult("rejected", "safe-default-weakened");
  }
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return promotionResult("pending", "promotion-evidence-missing", ["evidence"]);
  }
  if (evidence.status === "rejected") return promotionResult("rejected", "explicit-promotion-rejection");
  if (evidence.backendId !== "local-managed-container") {
    return promotionResult("rejected", "backend-not-eligible-for-promotion");
  }

  const candidateSha = typeof evidence.candidateSha === "string" ? evidence.candidateSha : "";
  const missing = [];
  if (!/^[0-9a-f]{40}$/.test(candidateSha)) missing.push("candidateSha");

  const productOwner = evidence.productOwnerDecision;
  if (productOwner?.status === "rejected") return promotionResult("rejected", "product-owner-rejected");
  if (productOwner?.status !== "accepted") missing.push("productOwnerDecision.status");
  if (productOwner?.decidedBy !== "Lê Đình Lực") missing.push("productOwnerDecision.decidedBy");
  if (!Number.isFinite(Date.parse(productOwner?.decidedAt ?? ""))) missing.push("productOwnerDecision.decidedAt");

  const attestations = Array.isArray(evidence.reviewerAttestations) ? evidence.reviewerAttestations : [];
  const attestationsByRole = new Map(attestations.map((entry) => [entry?.role, entry]));
  if (attestations.some((entry) => entry?.status === "rejected")) {
    return promotionResult("rejected", "reviewer-rejected");
  }
  const reviewerNames = new Set();
  for (const role of REQUIRED_REVIEWERS) {
    const attestation = attestationsByRole.get(role);
    if (attestation?.status !== "accepted") missing.push(`reviewerAttestations.${role}.status`);
    if (attestation?.reviewerType !== "human") missing.push(`reviewerAttestations.${role}.reviewerType`);
    if (typeof attestation?.reviewerName !== "string" || attestation.reviewerName.trim().length === 0) {
      missing.push(`reviewerAttestations.${role}.reviewerName`);
    } else {
      reviewerNames.add(attestation.reviewerName.trim());
    }
    if (!Number.isFinite(Date.parse(attestation?.reviewedAt ?? ""))) missing.push(`reviewerAttestations.${role}.reviewedAt`);
  }
  if (reviewerNames.size !== REQUIRED_REVIEWERS.length) missing.push("reviewerAttestations.uniqueHumanReviewers");

  const reports = Array.isArray(evidence.platformReports) ? evidence.platformReports : [];
  const reportsByPlatform = new Map(reports.map((entry) => [entry?.platform, entry]));
  if (reports.some((entry) => entry?.status === "failed" || entry?.status === "rejected")) {
    return promotionResult("rejected", "platform-evidence-failed");
  }
  for (const platform of REQUIRED_PROMOTION_POLICY.requiredPlatforms) {
    const report = reportsByPlatform.get(platform);
    if (report?.status !== "passed") missing.push(`platformReports.${platform}.status`);
    if (report?.deviceClass !== "representative-user-device") missing.push(`platformReports.${platform}.deviceClass`);
    if (report?.evidenceScope !== "real-product-isolation") missing.push(`platformReports.${platform}.evidenceScope`);
    if (report?.candidateSha !== candidateSha) missing.push(`platformReports.${platform}.candidateSha`);
    if (!jsonEqual(report?.controls, REQUIRED_PROMOTION_POLICY.requiredControls)) missing.push(`platformReports.${platform}.controls`);
    if (typeof report?.reportId !== "string" || report.reportId.length === 0) missing.push(`platformReports.${platform}.reportId`);
    const capturedAtMs = Date.parse(report?.capturedAt ?? "");
    if (!Number.isFinite(capturedAtMs) || capturedAtMs > nowMs || nowMs - capturedAtMs > maxAgeMs) {
      missing.push(`platformReports.${platform}.freshness`);
    }
  }
  if (reportsByPlatform.size !== REQUIRED_PROMOTION_POLICY.requiredPlatforms.length) missing.push("platformReports.exactPlatforms");

  if (evidence.rollbackEvidence?.status !== "passed") missing.push("rollbackEvidence.status");
  if (evidence.rollbackEvidence?.candidateSha !== candidateSha) missing.push("rollbackEvidence.candidateSha");
  if (typeof evidence.rollbackEvidence?.reportId !== "string" || evidence.rollbackEvidence.reportId.length === 0) {
    missing.push("rollbackEvidence.reportId");
  }
  if (evidence.revocationEvidence?.status !== "tested") missing.push("revocationEvidence.status");
  if (typeof evidence.revocationEvidence?.reportId !== "string" || evidence.revocationEvidence.reportId.length === 0) {
    missing.push("revocationEvidence.reportId");
  }
  if (evidence.status !== "accepted") missing.push("status");

  if (missing.length > 0) return promotionResult("pending", "promotion-evidence-incomplete", missing);
  return promotionResult("eligible", "promotion-conditions-satisfied-review-only");
}

function deny(reason, capabilityId = null) {
  return Object.freeze({ allowed: false, reason, capabilityId });
}

export function evaluateSandboxActivation({ manifest, capabilityManifest, request } = {}) {
  if (!manifest || manifest.safeDefault?.execution !== "blocked") {
    return deny("sandbox-contract-invalid-or-weakened");
  }

  const capabilityId = LOCKED_CAPABILITY_BY_REQUEST[request?.kind];
  if (capabilityId) {
    const capabilities = Array.isArray(capabilityManifest?.capabilities) ? capabilityManifest.capabilities : [];
    const capability = capabilities.find((entry) => entry?.id === capabilityId);
    if (!capability || capability.productTreatment !== "BLOCKED" || capability.advertisable !== false) {
      return deny("capability-contract-invalid-or-weakened", capabilityId);
    }
    return deny("capability-blocked", capabilityId);
  }

  if (request?.kind === "backend-activation") {
    const directions = Array.isArray(manifest?.directions) ? manifest.directions : [];
    const direction = directions.find((entry) => entry?.id === request.backendId);
    if (!direction) return deny("backend-blocked-unknown");
    if (manifest.reviewGate?.status !== "accepted") return deny("independent-review-pending");
    if (direction.decision !== "accepted") return deny("backend-blocked-not-accepted");
    return deny("product-safe-default-blocked");
  }

  return deny("request-blocked-unknown");
}

export function validateSandboxDecisionContract({ manifest, schema, capabilityManifest } = {}) {
  const errors = [];
  const requireEqual = (actual, expected, label) => {
    if (!jsonEqual(actual, expected)) errors.push(`${label} must equal ${JSON.stringify(expected)}`);
  };

  const schemaResult = validateJsonSchemaSubset(manifest, schema);
  if (!schemaResult.ok) errors.push(...schemaResult.errors.map((error) => `schema: ${error}`));

  requireEqual(manifest?.schemaVersion, "1.0.0", "schemaVersion");
  requireEqual(manifest?.releaseTrainId, "oc-2026.7.1-2-locked.1", "releaseTrainId");
  requireEqual(manifest?.evidencePolicy?.levels, REQUIRED_EVIDENCE_LEVELS, "evidencePolicy.levels");
  requireEqual(manifest?.evidencePolicy?.presenceIsIsolationProof, false, "presenceIsIsolationProof");
  requireEqual(manifest?.evidencePolicy?.ciRunnerIsUserDeviceProof, false, "ciRunnerIsUserDeviceProof");
  requireEqual(manifest?.evidencePolicy?.advertisingRequiresRealProductEvidence, true, "advertisingRequiresRealProductEvidence");
  requireEqual(manifest?.reviewGate?.status, "pending", "reviewGate.status");
  requireEqual(manifest?.reviewGate?.productOwnerDecision, "pending", "productOwnerDecision");
  requireEqual(manifest?.reviewGate?.requiredReviewers, REQUIRED_REVIEWERS, "reviewGate.requiredReviewers");
  requireEqual(manifest?.promotionPolicy, REQUIRED_PROMOTION_POLICY, "promotionPolicy");
  requireEqual(manifest?.governanceTraceability, REQUIRED_GOVERNANCE_TRACEABILITY, "governanceTraceability");
  requireEqual(manifest?.safeDefault?.execution, "blocked", "safeDefault.execution");
  requireEqual(manifest?.safeDefault?.sandboxMode, "off", "safeDefault.sandboxMode");
  requireEqual(manifest?.safeDefault?.workspaceAccess, "none", "safeDefault.workspaceAccess");
  requireEqual(manifest?.safeDefault?.networkEgress, "none", "safeDefault.networkEgress");
  requireEqual(manifest?.safeDefault?.productHostExec, false, "safeDefault.productHostExec");
  requireEqual(manifest?.safeDefault?.elevatedExec, false, "safeDefault.elevatedExec");
  requireEqual(manifest?.safeDefault?.sensitiveBrowser, false, "safeDefault.sensitiveBrowser");
  requireEqual(manifest?.safeDefault?.automaticFallback, false, "safeDefault.automaticFallback");
  requireEqual(manifest?.safeDefault?.advertisable, false, "safeDefault.advertisable");

  for (const key of [
    "mayInstallSoftware",
    "mayUseCredentials",
    "mayUseNetwork",
    "maySpawnProcesses",
    "mayWriteOutsideOsTemp",
    "claimsIsolation"
  ]) {
    requireEqual(manifest?.spikeBoundary?.[key], false, `spikeBoundary.${key}`);
  }
  requireEqual(manifest?.spikeBoundary?.fixtureOnly, true, "spikeBoundary.fixtureOnly");
  requireEqual(manifest?.probeSourceLocks, REQUIRED_PROBE_SOURCE_LOCKS, "probeSourceLocks");

  const directionEntries = Array.isArray(manifest?.directions) ? manifest.directions : [];
  requireEqual(directionEntries.length, Object.keys(REQUIRED_DIRECTIONS).length, "directions.length");
  const directions = new Map();
  for (const entry of directionEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("direction records must be objects");
      continue;
    }
    if (directions.has(entry.id)) errors.push(`duplicate direction id ${entry.id}`);
    directions.set(entry.id, entry);
  }
  requireEqual(directions.size, Object.keys(REQUIRED_DIRECTIONS).length, "directions.uniqueIds");
  for (const [id, decision] of Object.entries(REQUIRED_DIRECTIONS)) {
    const direction = directions.get(id);
    if (!direction) {
      errors.push(`direction ${id} is required`);
      continue;
    }
    requireEqual(direction.decision, decision, `direction ${id} decision`);
    requireEqual(direction.evidenceLevel, "documented-primary-source", `direction ${id} evidenceLevel`);
    requireEqual(direction.sourceRefs, REQUIRED_DIRECTION_SOURCE_REFS[id], `direction ${id} sourceRefs`);
    requireEqual(direction.isolation?.testedInFeature, false, `direction ${id} testedInFeature`);
    for (const platformField of Object.values(PLATFORM_FIELD_BY_RUNTIME)) {
      if (typeof direction.platforms?.[platformField] !== "string" || direction.platforms[platformField].length === 0) {
        errors.push(`direction ${id} platform ${platformField} evidence is required`);
      }
    }
    requireEqual(
      sha256Text(JSON.stringify(direction)),
      REQUIRED_DIRECTION_SHA256[id],
      `direction ${id} semantic digest`
    );
  }

  requireEqual(manifest?.recommendation?.primaryDirection, "local-managed-container", "recommendation.primaryDirection");
  requireEqual(manifest?.recommendation?.status, "preferred-contingent", "recommendation.status");
  requireEqual(manifest?.recommendation?.safeProductDefault, "blocked", "recommendation.safeProductDefault");

  const lockedIds = Array.isArray(manifest?.lockedCapabilityIds) ? manifest.lockedCapabilityIds : [];
  requireEqual(lockedIds, REQUIRED_LOCKED_CAPABILITIES, "lockedCapabilityIds");
  const capabilityEntries = Array.isArray(capabilityManifest?.capabilities) ? capabilityManifest.capabilities : [];
  const capabilities = new Map();
  for (const entry of capabilityEntries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("capability records must be objects");
      continue;
    }
    if (typeof entry.id !== "string" || entry.id.length === 0) {
      errors.push("capability records must have a non-empty id");
      continue;
    }
    if (capabilities.has(entry.id)) errors.push(`duplicate capability id ${entry.id}`);
    capabilities.set(entry.id, entry);
  }
  for (const id of REQUIRED_LOCKED_CAPABILITIES) {
    const capability = capabilities.get(id);
    if (!capability) {
      errors.push(`capability ${id} is missing`);
      continue;
    }
    requireEqual(capability.productTreatment, "BLOCKED", `capability ${id} productTreatment`);
    requireEqual(capability.advertisable, false, `capability ${id} advertisable`);
  }

  const sourceEntries = Array.isArray(manifest?.sources) ? manifest.sources : [];
  requireEqual(sourceEntries.length, Object.keys(REQUIRED_SOURCES).length, "sources.length");
  const sources = new Map();
  const sourceUrls = new Set();
  for (const source of sourceEntries) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      errors.push("source records must be objects");
      continue;
    }
    if (sources.has(source.id)) errors.push(`duplicate source id ${source.id}`);
    if (sourceUrls.has(source.url)) errors.push(`duplicate source URL ${source.url}`);
    sources.set(source.id, source);
    sourceUrls.add(source.url);
  }
  requireEqual(sources.size, Object.keys(REQUIRED_SOURCES).length, "sources.uniqueIds");
  for (const [id, required] of Object.entries(REQUIRED_SOURCES)) {
    const source = sources.get(id);
    if (!source) {
      errors.push(`source ${id} is required`);
      continue;
    }
    requireEqual(source.url, required.url, `source ${id} url`);
    requireEqual(source.accessedAt, required.accessedAt, `source ${id} accessedAt`);
    requireEqual(source.scope, required.scope, `source ${id} scope`);
    requireEqual(source.evidenceLevel, required.evidenceLevel, `source ${id} evidenceLevel`);
  }
  for (const direction of directionEntries) {
    if (!direction || typeof direction !== "object" || Array.isArray(direction)) continue;
    for (const sourceRef of Array.isArray(direction.sourceRefs) ? direction.sourceRefs : []) {
      if (!sources.has(sourceRef)) errors.push(`direction ${direction.id} references unknown source ${sourceRef}`);
    }
  }

  const claimEntries = Array.isArray(manifest?.claims) ? manifest.claims : [];
  requireEqual(claimEntries.length, Object.keys(REQUIRED_CLAIM_METADATA).length, "claims.length");
  const claims = new Map();
  for (const claim of claimEntries) {
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
      errors.push("claim records must be objects");
      continue;
    }
    if (claims.has(claim.claimId)) errors.push(`duplicate claim id ${claim.claimId}`);
    claims.set(claim.claimId, claim);
  }
  requireEqual(claims.size, Object.keys(REQUIRED_CLAIM_METADATA).length, "claims.uniqueIds");
  for (const [claimId, required] of Object.entries(REQUIRED_CLAIM_METADATA)) {
    const claim = claims.get(claimId);
    if (!claim) {
      errors.push(`claim ${claimId} is required`);
      continue;
    }
    requireEqual(claim.directionId, required.directionId, `claim ${claimId} directionId`);
    requireEqual(claim.classification, required.classification, `claim ${claimId} classification`);
    requireEqual(claim.statement, required.statement, `claim ${claimId} statement`);
    requireEqual(claim.sourceRefs, required.sourceRefs, `claim ${claimId} sourceRefs`);
    requireEqual(claim.sectionLocators, required.sectionLocators, `claim ${claimId} sectionLocators`);
    requireEqual(claim.promotionEligible, false, `claim ${claimId} promotionEligible`);
    for (const sourceRef of Array.isArray(claim.sourceRefs) ? claim.sourceRefs : []) {
      if (!sources.has(sourceRef)) errors.push(`claim ${claimId} references unknown source ${sourceRef}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateSandboxProbeEvidence(report, {
  expectedPlatform,
  expectedArchitecture = process.arch,
  expectedNodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10),
  nowMs = Date.now(),
  maxAgeMs = 24 * 60 * 60 * 1000
} = {}) {
  const errors = [];
  const requireEqual = (actual, expected, label) => {
    if (!jsonEqual(actual, expected)) errors.push(`${label} must equal ${JSON.stringify(expected)}`);
  };

  const reportIsObject = report !== null && typeof report === "object" && !Array.isArray(report);
  if (!reportIsObject) errors.push("probe report must be an object");
  requireEqual(Object.keys(reportIsObject ? report : {}).sort(), [...REQUIRED_PROBE_TOP_LEVEL_KEYS].sort(), "probe top-level keys");
  requireEqual(report?.schemaVersion, "1.0.0", "probe schemaVersion");
  requireEqual(report?.testId, "TEST-SANDBOX-FEASIBILITY-PRESENCE", "probe testId");
  requireEqual(report?.ok, true, "probe ok");
  requireEqual(report?.code, "probe-complete", "probe code");
  requireEqual(report?.evidenceLevel, "spike-tested", "probe evidenceLevel");
  requireEqual(report?.evidenceScopes, ["presence", "temp-containment"], "probe evidenceScopes");
  requireEqual(report?.releaseTrainId, "oc-2026.7.1-2-locked.1", "probe releaseTrainId");
  requireEqual(report?.promotionEligible, false, "probe promotionEligible");
  requireEqual(report?.platform, expectedPlatform, "probe platform");
  requireEqual(report?.architecture, expectedArchitecture, "probe architecture");
  requireEqual(report?.nodeMajor, expectedNodeMajor, "probe nodeMajor");
  requireEqual(report?.claimsIsolation, false, "probe isolation claim");
  requireEqual(report?.failure, null, "probe failure");
  requireEqual(report?.limitations, REQUIRED_PROBE_LIMITATIONS, "probe limitations");

  const capturedAtMs = Date.parse(report?.capturedAt ?? "");
  if (!Number.isFinite(capturedAtMs)) {
    errors.push("probe capturedAt must be a valid timestamp");
  } else {
    if (capturedAtMs > nowMs + 5 * 60 * 1000) errors.push("probe capturedAt is unacceptably in the future");
    if (nowMs - capturedAtMs > maxAgeMs) errors.push("probe report is stale");
  }

  requireEqual(report?.protectedCapabilities, REQUIRED_PROTECTED_CAPABILITIES, "probe protectedCapabilities");
  requireEqual(report?.tempFixture, REQUIRED_TEMP_FIXTURE, "probe tempFixture");

  const expectedHintKeys = REQUIRED_RUNTIME_HINTS[expectedPlatform] ?? [];
  const runtimeHints = report?.runtimeHints && typeof report.runtimeHints === "object" && !Array.isArray(report.runtimeHints)
    ? report.runtimeHints
    : {};
  requireEqual(Object.keys(runtimeHints).sort(), [...expectedHintKeys].sort(), "probe runtimeHints keys");
  if (Object.values(runtimeHints).some((value) => typeof value !== "boolean")) {
    errors.push("probe runtimeHints must contain booleans only");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
