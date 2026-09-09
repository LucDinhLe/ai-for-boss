import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../../apps/desktop/src/RuntimeRecovery.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const safe = { supervisor: "safe-mode", connected: false, setupReady: false };
function harness(retryRuntimeStartup = async () => true) {
  const slots = [];
  let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; }
  };
  const output = {};
  vm.runInNewContext(compiled, { exports: output, require: name => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === "./gateway-client") return { retryRuntimeStartup };
    throw new Error(`Unexpected module ${name}`);
  } });
  return runtime => { cursor = 0; return output.default({ runtime }); };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...[tree.props?.children].flat().flatMap(nodes)];
}
const button = tree => nodes(tree).find(node => node.type === "button");
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

test("runtime recovery is hidden while healthy and only offers a retry for owned-runtime failures", () => {
  let calls = 0;
  const render = harness(async () => { calls++; return true; });
  for (const supervisor of ["idle", "starting", "ready", "restarting"])
    assert.equal(render({ ...safe, supervisor }), null);
  for (const detail of ["node-runtime-missing", "openclaw-package-missing"])
    assert.equal(button(render({ ...safe, detail })), undefined);
  assert.ok(button(render(safe)));
  assert.equal(button(render({ ...safe, connected: true })).props.disabled, true);
  assert.equal(button(render({ ...safe, setupReady: true })).props.disabled, true);
  assert.equal(calls, 0, "rendering and status updates never retry automatically");
});

test("explicit recovery click shows busy state and ignores rapid duplicate clicks", async () => {
  let calls = 0;
  let release;
  const render = harness(() => { calls++; return new Promise(resolve => { release = resolve; }); });
  const action = button(render(safe)).props.onClick;
  action(); action();
  assert.equal(calls, 1);
  assert.equal(button(render(safe)).props.disabled, true);
  assert.match(button(render(safe)).props.children, /Đang thử/u);
  release(true);
  await flush();
  assert.equal(button(render(safe)).props.disabled, false);
  assert.equal(calls, 1);
});

test("failed recovery presents fixed guidance and allows a later user retry without leaking errors", async () => {
  for (const failure of [async () => false, async () => { throw new Error("PRIVATE_NATIVE_TOKEN"); }]) {
    let calls = 0;
    const render = harness(() => { calls++; return failure(); });
    button(render(safe)).props.onClick();
    await flush();
    const result = render(safe);
    assert.equal(button(result).props.disabled, false);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_NATIVE_TOKEN/u);
    assert.match(JSON.stringify(result), /Chưa khởi động lại được|Hiện chưa thể thử lại/u);
    await flush();
    assert.equal(calls, 1);
    button(result).props.onClick();
    await flush();
    assert.equal(calls, 2);
  }
});
