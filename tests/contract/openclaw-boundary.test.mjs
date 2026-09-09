import assert from "node:assert/strict";
import fs from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const desktop = fileURLToPath(new URL("../../apps/desktop/", import.meta.url));
const sdkPackages = new Set(["@openclaw/gateway-client", "@openclaw/gateway-protocol"]);
const adapterPublicSubpaths = new Set(["@openclaw/gateway-protocol/client-info"]);
const sdkOwners = new Set(["electron/main.mjs", "electron/gateway-adapter.mjs", "electron/setup-channel.mjs", "electron/approval-service.mjs"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    assert.equal(entry.isSymbolicLink(), false, `Production source must not escape through a link: ${full}`);
    return entry.isDirectory() ? sourceFiles(full) : extensions.has(path.extname(entry.name)) ? [full] : [];
  });
}

// A source-maintenance guard for literal dependencies, not a sandbox, module
// resolver or proof of the packaged runtime's bytes. It never imports source.
function literalDependencies(filename, source) {
  const extension = path.extname(filename);
  const kind = extension === ".tsx" ? ts.ScriptKind.TSX : extension === ".jsx" ? ts.ScriptKind.JSX
    : [".js", ".mjs", ".cjs"].includes(extension) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind);
  assert.equal(parsed.parseDiagnostics.length, 0, `Cannot inspect invalid source: ${filename}`);
  const dependencies = [];
  const add = node => {
    if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      dependencies.push({ specifier: node.text, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 });
    }
  };
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) add(node.moduleReference.expression);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node.argument.literal);
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) add(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return dependencies;
}

function boundaryViolations(filename, source) {
  const relative = filename.replaceAll("\\", "/");
  return literalDependencies(relative, source).flatMap(({ specifier, line }) => {
    const segments = specifier.replaceAll("\\", "/").split("/");
    const nativePackage = segments.includes("openclaw") || segments.includes("@openclaw");
    const approvedSdk = sdkOwners.has(relative) && sdkPackages.has(specifier)
      || ["electron/gateway-adapter.mjs", "electron/setup-channel.mjs"].includes(relative) && adapterPublicSubpaths.has(specifier);
    if (nativePackage && !approvedSdk) {
      return [`${relative}:${line}: OpenClaw dependency ${specifier} must use the public SDK in its main-process adapter`];
    }
    if (relative.startsWith("src/") && (specifier.startsWith("node:") || isBuiltin(specifier))) {
      return [`${relative}:${line}: renderer cannot import Node builtin ${specifier}`];
    }
    return [];
  });
}

test("production keeps OpenClaw behind public main-process SDK adapters and Node out of the renderer", () => {
  const files = ["src", "electron"].flatMap(directory => sourceFiles(path.join(desktop, directory)));
  assert.ok(files.length > 0, "Production source scan cannot be empty");
  const violations = files.flatMap(file => boundaryViolations(path.relative(desktop, file), fs.readFileSync(file, "utf8")));
  assert.deepEqual(violations, []);
});

test("AST guard rejects static, re-export, dynamic and CommonJS native dependencies in the wrong layer", () => {
  for (const statement of [
    'import { GatewayClient } from "@openclaw/gateway-client";',
    'export * from "@openclaw/gateway-protocol";',
    'const native = import("openclaw/dist/private-chunk.js");',
    'const native = require("openclaw");',
    'import native = require("@openclaw/private-internal");',
    'type Native = import("@openclaw/gateway-protocol").Request;',
    'const native = import(`../node_modules/openclaw/dist/private.js`);',
    'import fs from "node:fs";',
    'export { readFile } from "fs/promises";',
    'const child = require("child_process");'
  ]) assert.equal(boundaryViolations("src/example.ts", statement).length, 1, statement);
  for (const specifier of ["openclaw", "@openclaw/gateway-client/dist/index.mjs", "@openclaw/private-internal",
    "@openclaw/gateway-protocol/dist/client-info.mjs", "@openclaw/gateway-protocol/unlisted",
    "../node_modules/openclaw/dist/private.js"]) {
    assert.equal(boundaryViolations("electron/gateway-adapter.mjs", `import ${JSON.stringify(specifier)};`).length, 1, specifier);
  }
  assert.equal(boundaryViolations("electron/other.mjs", 'import "@openclaw/gateway-client";').length, 1);
  assert.equal(boundaryViolations("electron/setup-channel.mjs", 'import "@openclaw/gateway-protocol/client-info";').length, 0);
  assert.equal(boundaryViolations("src/example.ts", 'import "@openclaw/gateway-protocol/client-info";').length, 1);
});

test("guard permits public SDK owners and ordinary renderer imports without mistaking comments or text for code", () => {
  for (const owner of sdkOwners) for (const sdk of sdkPackages) {
    assert.deepEqual(boundaryViolations(owner, `import ${JSON.stringify(sdk)};`), []);
  }
  for (const sdk of adapterPublicSubpaths) assert.deepEqual(boundaryViolations("electron/gateway-adapter.mjs", `import ${JSON.stringify(sdk)};`), []);
  assert.deepEqual(boundaryViolations("electron/supervisor.mjs", 'import { spawn } from "node:child_process";'), []);
  assert.deepEqual(boundaryViolations("src/Example.tsx", `
    import { useState } from "react";
    export { call } from "./gateway-client";
    // import "openclaw/dist/private.js";
    const explanation = 'require("node:fs")';
    const view = <p>import("@openclaw/gateway-client")</p>;
  `), []);
});
