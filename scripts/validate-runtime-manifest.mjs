import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const schemaPath = path.join(repoRoot, "manifests", "runtime", "runtime-manifest.schema.json");
const manifestPath = path.join(repoRoot, "manifests", "runtime", "runtime-manifest.candidate.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function resolveRef(ref) {
  if (!ref.startsWith("#/")) {
    throw new Error(`Only local schema references are supported: ${ref}`);
  }

  return ref
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((current, part) => current?.[part], schema);
}

function validate(nodeSchema, value, location) {
  if (nodeSchema.$ref) {
    const resolved = resolveRef(nodeSchema.$ref);
    if (!resolved) {
      errors.push(`${location}: unresolved schema reference ${nodeSchema.$ref}`);
      return;
    }
    validate(resolved, value, location);
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
      value.forEach((item, index) => validate(nodeSchema.items, item, `${location}[${index}]`));
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
        validate(properties[key], child, `${location}.${key}`);
      } else if (nodeSchema.additionalProperties === false) {
        errors.push(`${location}: unexpected property ${key}`);
      }
    }
  }
}

validate(schema, manifest, "$manifest");

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

const dynamicSource = manifest.components.find((component) => /@(latest|beta|next)|\/latest\b/.test(component.source));
if (dynamicSource) {
  errors.push(`$manifest.components: dynamic source is forbidden for ${dynamicSource.name}`);
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
}

const falselySupported = manifest.platforms.filter(
  (platform) => platform.status === "supported" && platform.artifact === null
);
if (falselySupported.length > 0) {
  errors.push("$manifest.platforms: a supported platform must have a release artifact");
}

if (errors.length > 0) {
  console.error("Runtime manifest validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Runtime manifest validation passed: ${manifest.releaseTrainId}`);
console.log(
  `Components: ${manifest.components.length}; platforms: ${manifest.platforms.length}; status: ${manifest.status}`
);
