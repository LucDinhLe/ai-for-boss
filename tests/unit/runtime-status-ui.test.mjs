import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../../apps/desktop/src/App.tsx", import.meta.url), "utf8");
const parsed = ts.createSourceFile("App.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const hook = parsed.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "useRuntime").getText(parsed);
const javascript = ts.transpileModule(hook, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function harness() {
  const updates = [], ordering = [];
  const root = { dataset: {} }, effects = [];
  let listener, resolveInitial, unsubscribeCount = 0, effectIndex = 0;
  let state = { supervisor: "idle", connected: false, setupReady: false };
  const context = vm.createContext({
    IDLE_STATUS: state,
    document: { getElementById: (id) => id === "root" ? root : null },
    useState: () => [state, (status) => { updates.push(status); state = status; }],
    useEffect: (effect, deps) => {
      const index = effectIndex++, previous = effects[index];
      if (previous && deps.length === previous.deps.length && deps.every((value, i) => value === previous.deps[i])) return;
      previous?.cleanup?.();
      effects[index] = { deps, cleanup: effect() };
    },
    onRuntimeStatus: (callback) => {
      ordering.push("subscribe"); listener = callback;
      return () => { unsubscribeCount++; };
    },
    getRuntimeStatus: () => {
      ordering.push("read");
      return new Promise((resolve) => { resolveInitial = resolve; });
    }
  });
  vm.runInContext(javascript, context);
  const render = () => { effectIndex = 0; context.useRuntime(); };
  render();
  return { updates, ordering, push: (value) => listener(value), initial: (value) => resolveInitial(value),
    render, dataset: root.dataset, dispose: () => effects.forEach((effect) => effect.cleanup?.()), unsubscribed: () => unsubscribeCount };
}

test("runtime subscribes before reading and never lets an older initial snapshot overwrite a pushed state", async () => {
  const h = harness();
  assert.deepEqual(h.ordering, ["subscribe", "read"]);
  const ready = { supervisor: "ready", connected: true, setupReady: true };
  h.push(ready);
  h.initial({ supervisor: "starting", connected: false, setupReady: false });
  await Promise.resolve();
  assert.deepEqual(h.updates, [ready]);
});

test("initial snapshot is shown without pushes and later pushes remain authoritative", async () => {
  const h = harness();
  const initial = { supervisor: "starting", connected: false };
  h.initial(initial);
  await Promise.resolve();
  const next = { supervisor: "ready", connected: true };
  h.push(next);
  assert.deepEqual(h.updates, [initial, next]);
});

test("effect cleanup blocks late initial replies and already queued push callbacks", async () => {
  const h = harness();
  h.dispose();
  h.initial({ supervisor: "starting" });
  h.push({ supervisor: "ready" });
  await Promise.resolve();
  assert.deepEqual(h.updates, []);
  assert.equal(h.unsubscribed(), 1);
});

test("root status attributes describe the committed UI and are removed on unmount", () => {
  const h = harness();
  assert.deepEqual(h.dataset, { gatewayState: "idle", gatewayConnected: "false", setupReady: "false" });
  h.push({ supervisor: "ready", connected: true, setupReady: true });
  assert.equal(h.dataset.gatewayState, "idle", "push alone is not a rendered-state receipt");
  h.render();
  assert.deepEqual(h.dataset, { gatewayState: "ready", gatewayConnected: "true", setupReady: "true" });
  assert.deepEqual(h.ordering, ["subscribe", "read"], "render does not restart the subscription");
  h.dispose();
  assert.deepEqual(h.dataset, {});
});
