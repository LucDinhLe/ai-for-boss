import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

function inputPath(environmentName, fallback) {
  const override = process.env[environmentName];
  if (!override) return path.join(repoRoot, fallback);
  return path.isAbsolute(override) ? override : path.resolve(repoRoot, override);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const runtimeSchema = readJson(
  inputPath("AIFB_RUNTIME_SCHEMA", "manifests/runtime/runtime-manifest.schema.json")
);
const manifest = readJson(
  inputPath("AIFB_RUNTIME_MANIFEST", "manifests/runtime/runtime-manifest.lock.json")
);
const gatewaySchema = readJson(
  inputPath("AIFB_GATEWAY_CONTRACT_SCHEMA", "manifests/runtime/gateway-contract.schema.json")
);
const gatewayContract = readJson(
  inputPath("AIFB_GATEWAY_CONTRACT", "manifests/runtime/gateway-contract.lock.json")
);
const errors = [];

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local schema references are supported: ${ref}`);
  }

  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, part) => current?.[part], rootSchema);
}

function validate(rootSchema, nodeSchema, value, location) {
  if (nodeSchema.$ref) {
    const resolved = resolveRef(rootSchema, nodeSchema.$ref);
    if (!resolved) {
      errors.push(`${location}: unresolved schema reference ${nodeSchema.$ref}`);
      return;
    }
    validate(rootSchema, resolved, value, location);
    return;
  }

  if (Object.hasOwn(nodeSchema, "const") && value !== nodeSchema.const) {
    errors.push(`${location}: expected constant ${JSON.stringify(nodeSchema.const)}`);
  }

  if (nodeSchema.enum && !nodeSchema.enum.some((item) => Object.is(item, value))) {
    errors.push(`${location}: expected one of ${nodeSchema.enum.join(", ")}`);
  }

  if (nodeSchema.type) {
    const accepted = Array.isArray(nodeSchema.type) ? nodeSchema.type : [nodeSchema.type];
    const actual = valueType(value);
    if (!accepted.includes(actual)) {
      errors.push(`${location}: expected ${accepted.join(" or ")}, got ${actual}`);
      return;
    }
  }

  if (typeof value === "string") {
    if (nodeSchema.minLength !== undefined && value.length < nodeSchema.minLength) {
      errors.push(`${location}: string is shorter than ${nodeSchema.minLength}`);
    }
    if (nodeSchema.pattern && !new RegExp(nodeSchema.pattern).test(value)) {
      errors.push(`${location}: does not match ${nodeSchema.pattern}`);
    }
    if (nodeSchema.format === "date-time" && Number.isNaN(Date.parse(value))) {
      errors.push(`${location}: invalid date-time`);
    }
  }

  if (Array.isArray(value)) {
    if (nodeSchema.minItems !== undefined && value.length < nodeSchema.minItems) {
      errors.push(`${location}: expected at least ${nodeSchema.minItems} items`);
    }
    if (nodeSchema.items) {
      value.forEach((item, index) =>
        validate(rootSchema, nodeSchema.items, item, `${location}[${index}]`)
      );
    }
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const required of nodeSchema.required ?? []) {
      if (!Object.hasOwn(value, required)) {
        errors.push(`${location}: missing required property ${required}`);
      }
    }

    const properties = nodeSchema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) {
        validate(rootSchema, properties[key], child, `${location}.${key}`);
      } else if (nodeSchema.additionalProperties === false) {
        errors.push(`${location}: unexpected property ${key}`);
      }
    }
  }
}

validate(runtimeSchema, runtimeSchema, manifest, "$manifest");
validate(gatewaySchema, gatewaySchema, gatewayContract, "$gatewayContract");

const requiredRoles = new Set([
  "runtime",
  "desktop-shell",
  "package-manager",
  "gateway-client",
  "gateway-protocol"
]);
const roles = new Set(manifest.components.map((component) => component.role));
for (const role of requiredRoles) {
  if (!roles.has(role)) errors.push(`$manifest.components: missing role ${role}`);
}

const dynamicSource = manifest.components.find((component) =>
  /@(latest|beta|next)|\/latest\b/.test(component.source)
);
if (dynamicSource) {
  errors.push(`$manifest.components: dynamic source is forbidden for ${dynamicSource.name}`);
}

const betaComponent = manifest.components.find(
  (component) => /(?:^|[-/.])beta(?:[.-]|$)/i.test(component.version ?? "") || /(?:^|[-/.])beta(?:[.-]|$)/i.test(component.source)
);
if (betaComponent) {
  errors.push(`$manifest.components: beta component is forbidden in the stable release train: ${betaComponent.name}`);
}

if (manifest.status === "locked") {
  const unresolved = manifest.components.filter(
    (component) => component.status !== "locked" && component.status !== "not-bundled"
  );
  if (unresolved.length > 0) {
    errors.push(
      `$manifest.status: cannot be locked while components remain unresolved: ${unresolved.map((item) => item.name).join(", ")}`
    );
  }
  if (gatewayContract.integrationSurface.status !== "supported") {
    errors.push("$manifest.status: a locked train requires a supported Gateway integration surface");
  }
}

const openclawComponent = manifest.components.find((component) => component.name === "openclaw");
if (!openclawComponent) {
  errors.push("$manifest.components: openclaw component is missing");
} else {
  if (openclawComponent.version !== gatewayContract.upstream.packageVersion) {
    errors.push("$gatewayContract.upstream.packageVersion: must match the OpenClaw runtime version");
  }
  if (openclawComponent.integrity !== gatewayContract.upstream.npmIntegrity) {
    errors.push("$gatewayContract.upstream.npmIntegrity: must match the OpenClaw runtime integrity");
  }
  if (gatewayContract.upstream.gitTag !== `v${openclawComponent.version}`) {
    errors.push("$gatewayContract.upstream.gitTag: must match the locked OpenClaw runtime version");
  }
}

if (
  gatewayContract.integrationSurface.protocolVersion <
  gatewayContract.integrationSurface.minimumClientProtocolVersion
) {
  errors.push("$gatewayContract.integrationSurface: protocolVersion is below the minimum client protocol");
}

const workspacePackages = new Map();
for (const workspacePackage of gatewayContract.workspacePackages) {
  if (workspacePackages.has(workspacePackage.name)) {
    errors.push(`$gatewayContract.workspacePackages: duplicate package ${workspacePackage.name}`);
  }
  workspacePackages.set(workspacePackage.name, workspacePackage);
}

for (const packageName of ["@openclaw/gateway-client", "@openclaw/gateway-protocol"]) {
  const reference = workspacePackages.get(packageName);
  const component = manifest.components.find((item) => item.name === packageName);
  if (!reference) {
    errors.push(`$gatewayContract.workspacePackages: missing ${packageName}`);
    continue;
  }
  if (!component) {
    errors.push(`$manifest.components: missing ${packageName}`);
    continue;
  }
  if (component.status !== "not-bundled") {
    errors.push(`$manifest.components: ${packageName} must be reference-only and not bundled`);
  }
  if (component.version !== reference.version) {
    errors.push(`$manifest.components: ${packageName} version does not match the source reference`);
  }
  if (component.integrity !== `git-tree-sha1-${reference.gitTree}`) {
    errors.push(`$manifest.components: ${packageName} tree fingerprint does not match the contract lock`);
  }
  if (reference.bundledSeparately !== false) {
    errors.push(`$gatewayContract.workspacePackages: ${packageName} must not be bundled separately`);
  }
}

if (gatewayContract.policy.publicGatewayPackagesRequired !== false) {
  errors.push("$gatewayContract.policy: public Gateway packages are not a stable upstream requirement");
}
if (gatewayContract.policy.vendorPrivateWorkspacePackages !== false) {
  errors.push("$gatewayContract.policy: vendoring private OpenClaw workspace packages is forbidden");
}
if (gatewayContract.policy.importHashedDistChunks !== false) {
  errors.push("$gatewayContract.policy: importing private hashed dist chunks is forbidden");
}

const falselySupported = manifest.platforms.filter(
  (platform) => platform.status === "supported" && platform.artifact === null
);
if (falselySupported.length > 0) {
  errors.push("$manifest.platforms: a supported platform must have a release artifact");
}

if (errors.length > 0) {
  console.error("Runtime and Gateway contract validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Runtime manifest validation passed: ${manifest.releaseTrainId}`);
console.log(
  `Components: ${manifest.components.length}; platforms: ${manifest.platforms.length}; status: ${manifest.status}; Gateway protocol: v${gatewayContract.integrationSurface.protocolVersion}`
);
