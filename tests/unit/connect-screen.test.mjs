import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import * as providerOrder from '../../apps/desktop/src/provider-order.ts';

const sdkRequire = createRequire(new URL("../../apps/desktop/package.json", import.meta.url));
const protocol = await import(pathToFileURL(sdkRequire.resolve("@openclaw/gateway-protocol")));
const validators = {
  "openclaw.setup.detect": protocol.validateSystemAgentSetupDetectParams,
  "openclaw.setup.activate.start": protocol.validateSystemAgentSetupActivateStartParams,
  "openclaw.setup.auth.start": protocol.validateSystemAgentSetupAuthStartParams,
  "openclaw.setup.verify": protocol.validateSystemAgentSetupVerifyParams,
  "models.authStatus": protocol.validateModelsAuthStatusParams,
  "wizard.next": protocol.validateWizardNextParams,
  "wizard.status": protocol.validateWizardStatusParams,
  "wizard.cancel": protocol.validateWizardCancelParams
};

const read = (name) => fs.readFileSync(new URL("../../apps/desktop/src/connect/" + name, import.meta.url), "utf8");
function compile(name, require, extras = {}) {
  const code = ts.transpileModule(read(name), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require, ...extras });
  return exports;
}
const copy = (value) => JSON.parse(JSON.stringify(value));
test('brand filters prioritize requested providers and dispatch only the live native OAuth choice', async () => {
  const ids = ['xai', 'google', 'anthropic', 'openai', 'new-provider'];
  const authOptions = ids.map(id => ({ id: `${id}-native-auth`, brandId: id, label: `${id} login`, kind: 'oauth', featured: false }));
  const h = harness(async method => method === 'openclaw.setup.auth.start' ? { step: { id: 'next', type: 'confirm' } }
    : { candidates: [], manualProviders: [], authOptions }, {}, async () => ({
      providers: ids.map(id => ({ id, label: id })), authMethods: []
    }));
  await h.flush();
  const labels = h.nodes().filter(n => n.type === 'button' && n.props['aria-label']?.endsWith(' login')).map(n => n.props['aria-label']);
  assert.deepEqual(labels, ['openai login', 'anthropic login', 'google login', 'xai login', 'new-provider login']);
  h.button('ChatGPT / OpenAI').props.onClick(); await h.flush();
  assert.ok(h.button('openai login')); assert.equal(h.button('xai login'), undefined);
  assert.equal(h.requests.length, 1, 'filtering does not authenticate');
  h.button('openai login').props.onClick(); await h.flush();
  assert.equal(h.requests.find(r => r.method === 'openclaw.setup.auth.start').params.authChoice, 'openai-native-auth');
  h.dispose();
});
const catalogue = { candidates: [], manualProviders: [], authOptions: [
  { id: "synthetic-browser", label: "Native browser", kind: "oauth", featured: true },
  { id: "synthetic-device", label: "Native device", kind: "device-code", featured: false }
], workspace: "synthetic", setupComplete: false };

function harness(request = async () => catalogue, initialProps = {}, readCatalogue = async () => ({ providers: [] })) {
  const slots = [], effects = [], requests = [], catalogueRequests = [], openedPages = [], timers = new Map();
  let cursor = 0, tree, id = 0, timerId = 0, done = 0;
  let props = { ready: true, onDone: () => { done++; }, ...initialProps };
  const changed = (before, next) => !before || before.length !== next.length || next.some((v, i) => v !== before[i]);
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (value) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (changed(slots[index]?.deps, deps)) {
        const previous = slots[index];
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
      }
    }
  };
  const jsx = (type, properties) => ({ type, props: properties ?? {} });
  const localised = compile("wizard-vi.ts", () => { throw new Error("Unexpected import"); });
  const Component = compile("ConnectScreen.tsx", (name) => {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (name === "./wizard-vi") return localised;
    if (name === '../BrandIcon') return { default: 'brand-icon' };
    if (name === '../provider-order') return providerOrder;
    if (name === '../WorkspaceSidebar') return { WorkbenchIcon: 'workbench-icon' };
    if (name === '../workbench-api') return { manage: (params) => { catalogueRequests.push(copy(params)); return readCatalogue(); } };
    throw new Error("Unexpected import: " + name);
  }, { window: { aiForBoss: { setup: { request: (method, params) => {
    const call = { method, params: copy(params ?? {}) };
    assert.equal(validators[method]?.(call.params), true, "public protocol rejects " + method);
    requests.push(call);
    return request(method, call.params);
  }, openPage: async (...args) => { openedPages.push(copy(args)); return true; } } } }, crypto: { randomUUID: () => "synthetic-session-" + ++id },
  setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
  clearTimeout: (timer) => timers.delete(timer), Date }).default;
  const render = () => { cursor = 0; tree = Component(props); while (effects.length) effects.shift()(); return tree; };
  const nodes = () => {
    const result = [];
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === "object") { result.push(node); walk(node.props?.children); }
    };
    walk(tree);
    return result;
  };
  const text = (node) => Array.isArray(node) ? node.map(text).join("") : node && typeof node === "object"
    ? text(node.props?.children) : node == null || typeof node === "boolean" ? "" : String(node);
  render();
  return { requests, catalogueRequests, openedPages, render, nodes, text: () => text(tree), done: () => done,
    button: (label) => nodes().find((node) => node.type === "button" && (node.props['aria-label'] === label || text(node.props.children) === label)),
    update: (next) => { props = { ...props, ...next }; render(); },
    flush: async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    tick: async () => { for (const callback of [...timers.values()]) callback(); timers.clear(); for (let i = 0; i < 8; i++) await Promise.resolve(); render(); },
    dispose: () => slots.forEach((slot) => slot.cleanup?.()) };
}

test("native auth options remain distinct from API-key choices, sensitive text preserves native defaults", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start"
    ? { sessionId: "synthetic-session-1", step: { id: "secret-step", type: "text", sensitive: true, initialValue: "synthetic-default" } }
    : method === "wizard.next" ? { done: true } : catalogue);
  await h.flush();
  assert.ok(h.button("Native browser"));
  assert.ok(h.button("Native device"));
  h.button("Native browser").props.onClick();
  await h.flush();
  const input = h.nodes().find((node) => node.type === "input");
  assert.equal(input.props.type, "password");
  assert.equal(input.props.value, "synthetic-default");
  h.nodes().find((node) => node.type === "form").props.onSubmit({ preventDefault() {} });
  await h.flush();
  assert.deepEqual(h.requests.find((item) => item.method === "openclaw.setup.auth.start").params,
    { sessionId: "synthetic-session-1", authChoice: "synthetic-browser" });
  assert.deepEqual(h.requests.find((item) => item.method === "wizard.next").params.answer,
    { stepId: "secret-step", value: "synthetic-default" });
  assert.equal(h.requests.some((item) => item.method === "openclaw.setup.verify"), false);
});

test("device URLs and codes are visible, and a multiselect submits an array only on Continue", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start" ? { step: {
    id: "pick", type: "multiselect", externalUrl: "https://synthetic.example/authorize", deviceCode: { code: "TEST-CODE" },
    initialValue: ["b"], options: [{ label: "First", value: "a" }, { label: "Second", value: "b" }]
  } } : method === "wizard.next" ? { done: true } : catalogue);
  await h.flush(); h.button("Native device").props.onClick(); await h.flush();
  assert.match(h.text(), /https:\/\/synthetic\.example\/authorize/);
  assert.match(h.text(), /TEST-CODE/);
  assert.equal(h.openedPages.length, 0, "receiving a native URL does not open a browser");
  h.button("Mở trang đăng nhập").props.onClick(); await h.flush();
  assert.deepEqual(h.openedPages, [["synthetic-session-1"]], "only the session id crosses the narrow browser handoff");
  const boxes = h.nodes().filter((node) => node.type === "input" && node.props.type === "checkbox");
  assert.equal(boxes.length, 2);
  assert.equal(boxes[1].props.checked, true);
  boxes[0].props.onChange(); h.render();
  assert.equal(h.requests.some((item) => item.method === "wizard.next"), false);
  h.button("Tiếp tục").props.onClick(); await h.flush();
  assert.deepEqual(h.requests.find((item) => item.method === "wizard.next").params.answer.value, ["a", "b"]);
});

test("cancelling a pending start prevents late steps and extra polling", async () => {
  let finish;
  const h = harness((method) => method === "openclaw.setup.auth.start"
    ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(catalogue));
  await h.flush(); h.button("Native browser").props.onClick(); h.render();
  assert.ok(h.button("Huỷ"), "a pending request has an enabled cancellation action");
  assert.equal(Boolean(h.button("Huỷ").props.disabled), false);
  h.button("Huỷ").props.onClick(); await h.flush();
  finish({ step: { id: "late", type: "text", title: "Must not return" } });
  await h.flush(); await h.tick();
  assert.doesNotMatch(h.text(), /Must not return/);
  assert.equal(h.requests.filter((item) => item.method === "wizard.cancel").length, 2,
    "cancel immediately, then close the exact wizard if its start resolves late");
  for (const call of h.requests.filter((item) => item.method === "wizard.cancel")) {
    assert.deepEqual(call.params, { sessionId: "synthetic-session-1" });
  }
  assert.equal(h.requests.filter((item) => item.method === "wizard.status").length, 0);
});

test("a start without a step retrieves wizard.next without fabricating an answer", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start" ? { sessionId: "synthetic-session-1" }
    : method === "wizard.next" ? { done: false, step: { id: "next", type: "text", title: "Native pending step" } } : catalogue);
  await h.flush(); h.button("Native browser").props.onClick(); await h.flush(); await h.tick();
  assert.match(h.text(), /Native pending step/);
  assert.deepEqual(h.requests.find((call) => call.method === "wizard.next").params, { sessionId: "synthetic-session-1" });
  assert.equal(h.requests.some((call) => call.method === "wizard.status"), false);
  h.dispose();
});

test("setup readiness and explicit detect retry never trigger inference", async () => {
  let detects = 0;
  const h = harness(async (method) => {
    assert.equal(method, "openclaw.setup.detect");
    if (++detects === 1) throw new Error("Synthetic detection failure");
    return catalogue;
  }, { ready: false });
  await h.flush(); assert.equal(h.requests.length, 0);
  h.update({ ready: true }); await h.flush();
  assert.match(h.text(), /Synthetic detection failure/);
  h.button("Tải lại danh sách").props.onClick(); await h.flush();
  assert.ok(h.button("Native browser"));
  assert.equal(h.requests.length, 2);
});

test("a pending wizard is single-flight and unmount clears its poll before another native call", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start" ? { sessionId: "synthetic-session-1" } : catalogue);
  await h.flush();
  const start = h.button("Native browser").props.onClick;
  start(); start(); await h.flush();
  assert.equal(h.requests.filter((call) => call.method === "openclaw.setup.auth.start").length, 1);
  h.dispose(); await h.tick();
  assert.equal(h.requests.filter((call) => call.method === "wizard.next").length, 0);
  assert.equal(h.requests.filter((call) => call.method === "wizard.cancel").length, 1);
});

test("done plus native error never looks successful and does not start verification", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start"
    ? { done: true, status: "error", error: "Synthetic native failure" } : catalogue);
  await h.flush(); h.button("Native browser").props.onClick(); await h.flush();
  assert.match(h.text(), /Synthetic native failure/);
  assert.equal(h.done(), 0);
  assert.equal(h.requests.filter((call) => call.method === "openclaw.setup.detect").length, 1);
  assert.equal(h.requests.some((call) => call.method === "openclaw.setup.verify"), false);
});

test("readiness loss makes an old detection response stale, then re-detects when the channel returns", async () => {
  const pending = [];
  const h = harness(() => new Promise((resolve) => pending.push(resolve)));
  await h.flush(); h.update({ ready: false });
  pending[0](catalogue); await h.flush();
  assert.equal(h.button("Native browser"), undefined);
  h.update({ ready: true }); await h.flush();
  pending[1](catalogue); await h.flush();
  assert.ok(h.button("Native browser"));
  assert.equal(h.requests.length, 2);
});

test("a failed start closes its native wizard before another connection can begin", async () => {
  const h = harness(async (method) => {
    if (method === "openclaw.setup.auth.start") throw new Error("Synthetic start failure");
    return catalogue;
  });
  await h.flush(); h.button("Native browser").props.onClick(); await h.flush();
  assert.match(h.text(), /Synthetic start failure/);
  assert.deepEqual(h.requests.find((call) => call.method === "wizard.cancel").params, { sessionId: "synthetic-session-1" });
  assert.equal(h.button("Native device").props.disabled, false);
  h.button("Native device").props.onClick(); await h.flush();
  assert.deepEqual(h.requests.filter((call) => call.method === "wizard.cancel").map((call) => call.params.sessionId),
    ["synthetic-session-1", "synthetic-session-2"]);
  h.dispose();
  assert.equal(h.requests.filter((call) => call.method === "wizard.cancel").length, 2);
});

test("gateway progress advances without Continue or answers and only a terminal activation receipt completes", async () => {
  let next = 0;
  const h = harness(async (method) => {
    if (method === 'openclaw.setup.auth.start') return { done: false, status: 'running', step: { id: 'testing', type: 'progress', executor: 'gateway', message: 'Testing connection' } };
    if (method === 'wizard.next') return ++next === 1
      ? { done: false, status: 'done', step: { id: 'finishing', type: 'progress', executor: 'gateway', message: 'Finishing AI setup…' } }
      : { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } };
    if (method === 'models.authStatus') return { providers: [{ provider: 'synthetic', status: 'static' }] };
    return catalogue;
  });
  await h.flush(); h.button('Native browser').props.onClick(); await h.flush();
  assert.equal(h.button('Tiếp tục'), undefined);
  await h.tick();
  assert.match(h.text(), /Finishing AI setup/);
  assert.equal(h.requests.filter(call => call.method === 'openclaw.setup.detect').length, 1);
  await h.tick(); await h.flush();
  assert.match(h.text(), /Đã lưu thiết lập synthetic\/model/);
  assert.deepEqual(h.requests.filter(call => call.method === 'wizard.next').map(call => call.params),
    [{ sessionId: 'synthetic-session-1' }, { sessionId: 'synthetic-session-1' }]);
  assert.deepEqual(h.requests.find(call => call.method === 'models.authStatus').params, { refresh: false });
  assert.equal(h.requests.some(call => call.method === 'openclaw.setup.verify'), false);
});

test("informational notes acknowledge once while login notes and client actions require the user", async () => {
  let next = 0;
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: false, status: 'running', step: { id: 'info', type: 'note', executor: 'client', message: 'Preparing sign-in' } };
    if (method === 'wizard.next') return ++next === 1
      ? { done: false, status: 'running', step: { id: 'info', type: 'note', executor: 'client', message: 'Preparing sign-in' } }
      : { done: false, status: 'running', step: { id: 'login', type: 'note', executor: 'client', externalUrl: 'https://synthetic.example/login', deviceCode: { code: 'TEST' } } };
    return catalogue;
  });
  await h.flush(); h.button('Native browser').props.onClick(); await h.flush();
  assert.equal(h.requests.filter(call => call.params.answer).length, 1);
  await h.tick(); await h.flush();
  assert.ok(h.button('Tiếp tục'));
  assert.ok(h.button('Mở trang đăng nhập'));
  assert.equal(h.openedPages.length, 0);
  assert.equal(h.requests.filter(call => call.params.answer).length, 1);
  h.dispose();
});

test("failed progress and incomplete terminal receipts never become connected", async () => {
  for (const terminal of [{ done: true, status: 'error', error: 'Native commit failed' }, { done: true, status: 'done' }]) {
    const h = harness(async method => method === 'openclaw.setup.auth.start'
      ? { done: false, status: 'running', step: { id: 'finish', type: 'progress', executor: 'gateway' } }
      : method === 'wizard.next' ? terminal : catalogue);
    await h.flush(); h.button('Native browser').props.onClick(); await h.flush(); await h.tick();
    assert.doesNotMatch(h.text(), /Đã kết nối/);
    assert.equal(h.requests.some(call => call.method === 'models.authStatus'), false);
    assert.equal(h.button('Native browser').props.disabled, false);
    h.dispose();
  }
});

test("queued progress with error status is drained to read the actual native failure", async () => {
  const h = harness(async method => method === 'openclaw.setup.auth.start'
    ? { done: false, status: 'error', step: { id: 'queued', type: 'progress', executor: 'gateway' } }
    : method === 'wizard.next' ? { done: true, status: 'error', error: 'Native credential persistence failed' } : catalogue);
  await h.flush(); h.button('Native browser').props.onClick(); await h.flush(); await h.tick();
  assert.match(h.text(), /Native credential persistence failed/);
  assert.equal(h.requests.filter(call => call.method === 'wizard.next').length, 1);
  assert.equal(h.requests.some(call => call.params.answer), false);
  assert.equal(h.requests.some(call => call.method === 'models.authStatus'), false);
});

test("reconnecting clears stale wizard controls and ignores a late pre-reconnect step", async () => {
  let finish;
  const h = harness(method => method === 'openclaw.setup.auth.start'
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(catalogue));
  await h.flush(); h.button('Native browser').props.onClick(); await h.flush();
  h.update({ ready: false }); await h.flush(); h.update({ ready: true }); await h.flush();
  finish({ done: false, status: 'running', step: { id: 'stale', type: 'text', title: 'Stale reconnect prompt' } });
  await h.flush(); await h.tick();
  assert.doesNotMatch(h.text(), /Stale reconnect prompt/);
  assert.equal(h.button('Native browser').props.disabled, false);
  assert.equal(h.requests.some(call => call.method === 'wizard.next'), false);
  h.dispose();
});

test("credential readback failure does not repeat activation or claim a verified connection", async () => {
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } };
    if (method === 'models.authStatus') throw new Error('Synthetic metadata unavailable');
    return catalogue;
  });
  await h.flush(); h.button('Native browser').props.onClick(); await h.flush();
  await h.flush();
  assert.match(h.text(), /Chưa đọc được trạng thái tài khoản/);
  assert.doesNotMatch(h.text(), /Đã kết nối synthetic/);
  assert.equal(h.requests.filter(call => call.method === 'openclaw.setup.auth.start').length, 1);
  assert.equal(h.done(), 0);
});

test('a slow catalogue refresh cannot hold the completed connection screen busy', async () => {
  let detects = 0, release;
  const h = harness(async method => {
    if (method === 'openclaw.setup.detect' && ++detects > 1) return new Promise(resolve => { release = resolve; });
    if (method === 'openclaw.setup.auth.start') return { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } };
    if (method === 'models.authStatus') return { providers: [{ provider: 'synthetic', status: 'static' }] };
    return catalogue;
  });
  await h.flush(); h.button('Native browser').props.onClick(); await h.flush(); await h.flush();
  assert.match(h.text(), /Đã lưu thiết lập synthetic\/model/);
  assert.equal(h.button('Native browser').props.disabled, false);
  assert.ok(h.button('Để sau'));
  release(catalogue); await h.flush(); h.dispose();
});

test('package provider names render before a slow account scan without authorizing a setup choice', async () => {
  let resolveDetection;
  const h = harness(() => new Promise(resolve => { resolveDetection = resolve; }), {}, async () => ({
    providers: [{ id: 'synthetic', label: 'Synthetic AI', description: 'Public package provider' }]
  }));
  await h.flush();
  assert.match(h.text(), /Đang tìm cách kết nối/);
  assert.ok(h.button('Synthetic AI'));
  assert.match(h.text(), /chưa phải tài khoản đã đăng nhập/);
  assert.deepEqual(h.catalogueRequests, [{ action: 'catalog' }]);
  h.button('Synthetic AI').props.onClick(); await h.flush();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].method, 'openclaw.setup.detect');
  assert.equal(h.nodes().find(node => node.type === 'input' && node.props.type === 'search').props.value, 'synthetic');
  resolveDetection({ ...catalogue, authOptions: [{ id: 'synthetic-oauth', label: 'Synthetic account', kind: 'oauth', featured: true }] });
  await h.flush();
  assert.ok(h.button('Synthetic account'));
  assert.equal(h.button('Synthetic AI'), undefined, 'live choices replace the package-only index');
  assert.doesNotMatch(h.text(), /Không tìm thấy|Đang tìm cách kết nối/);
  h.dispose();
});

test('official prerequisite-only methods remain searchable and open only a known documentation id', async () => {
  const methods = [{ id: 'native-cli', provider: 'synthetic', method: 'cli', label: 'Native official CLI', hint: 'Existing account',
    pluginId: 'synthetic', docsPath: '/providers/synthetic', guidedSecret: false, guidedAuth: null, discovery: false,
    manualOnly: false, scopes: ['text-inference'] }];
  const h = harness(async () => ({ ...catalogue, authOptions: [] }), {}, async () => ({ version: 'fixture', providers: [], authMethods: methods }));
  await h.flush();
  h.nodes().find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'native-cli' } }); h.render();
  assert.match(h.text(), /Native official CLI/); assert.match(h.text(), /Đăng nhập ứng dụng dòng lệnh chính thức/);
  assert.doesNotMatch(h.text(), /Không tìm thấy/);
  h.button('Tài liệu OpenClaw: synthetic').props.onClick(); await h.flush();
  assert.deepEqual(h.catalogueRequests.at(-1), { action: 'provider-doc', methodId: 'native-cli' });
  assert.ok(h.requests.every(call => call.method === 'openclaw.setup.detect'), 'Reading docs cannot start auth or inference'); h.dispose();
});

test('native model references, provider groups and preparation-only results are searchable', async () => {
  const h = harness(async () => ({ ...catalogue, candidates: [{ kind: 'existing-model', label: 'Current connection',
    detail: 'Configured route', modelRef: 'synthetic/exact-model-64', recommended: false }],
    manualProviders: [{ id: 'synthetic-api-key', label: 'Key route', groupLabel: 'Provider group' }],
    prepareOptions: [{ id: 'prep', label: 'Local setup', hint: 'Install companion first' }] }));
  await h.flush();
  const search = value => { h.nodes().find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } }); h.render(); };
  search('exact-model-64'); assert.ok(h.button('Current connection')); assert.match(h.text(), /Mô hình: synthetic\/exact-model-64/);
  search('Provider group'); assert.ok(h.button('Key route'));
  search('Local setup'); assert.match(h.text(), /Install companion first/); assert.doesNotMatch(h.text(), /Không tìm thấy/);
  search('not-listed'); assert.match(h.text(), /Không tìm thấy/);
  h.button('Xóa tìm kiếm').props.onClick(); await h.flush(); assert.ok(h.button('Current connection'));
  h.dispose();
});

test('empty and failed native catalogues provide visible retry states without fabricated choices', async () => {
  const empty = harness(async () => ({ ...catalogue, authOptions: [] }));
  await empty.flush(); assert.match(empty.text(), /chưa trả về cách kết nối AI nào/);
  assert.ok(empty.button('Tải lại danh sách')); assert.equal(empty.button('Native browser'), undefined); empty.dispose();
  const failed = harness(async () => { throw new Error('Synthetic catalogue unavailable'); });
  await failed.flush(); assert.match(failed.text(), /Synthetic catalogue unavailable/);
  assert.ok(failed.nodes().some(node => node.props.role === 'alert'));
  assert.equal(failed.button('Tải lại danh sách').props.disabled, false); failed.dispose();
});

test('static method guidance does not hide an empty native catalogue and reload restores live choices', async () => {
  const methods = [{ id: 'native-cli', provider: 'synthetic', method: 'cli', label: 'Native official CLI', hint: 'Existing account',
    pluginId: 'synthetic', docsPath: '/providers/synthetic', guidedSecret: false, guidedAuth: null, discovery: false,
    manualOnly: false, scopes: ['text-inference'] }];
  let liveChoices = false;
  const h = harness(async () => liveChoices ? catalogue : { ...catalogue, authOptions: [] }, {},
    async () => ({ version: 'fixture', providers: [], authMethods: methods }));
  await h.flush();
  assert.match(h.text(), /chưa trả về cách kết nối AI nào/);
  assert.ok(h.button('Tải lại danh sách'));
  assert.equal(h.nodes().find(node => node.type === 'details' && node.props.className === 'connect__method-catalogue').props.open, true);
  assert.ok(h.button('Tài liệu OpenClaw: synthetic'));
  assert.equal(h.button('Native browser'), undefined);
  const search = value => { h.nodes().find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } }); h.render(); };
  search('native-cli'); assert.match(h.text(), /Native official CLI/); assert.doesNotMatch(h.text(), /Không tìm thấy/);
  search('missing-provider'); assert.match(h.text(), /Không tìm thấy/);
  search(''); liveChoices = true;
  h.button('Tải lại danh sách').props.onClick(); await h.flush();
  assert.ok(h.button('Native browser')); assert.doesNotMatch(h.text(), /chưa trả về cách kết nối AI nào/);
  assert.ok(h.requests.every(call => call.method === 'openclaw.setup.detect'), 'Guidance and reload cannot start authentication');
  h.dispose();
});

test('reconnect hides prior actionable choices until fresh native detection completes', async () => {
  let count = 0, resolveDetection;
  const h = harness(() => ++count === 1 ? Promise.resolve(catalogue) : new Promise(resolve => { resolveDetection = resolve; }));
  await h.flush(); assert.ok(h.button('Native browser'));
  h.update({ ready: false }); await h.flush(); assert.equal(h.button('Native browser'), undefined);
  h.update({ ready: true }); await h.flush(); assert.equal(h.button('Native browser'), undefined);
  assert.match(h.text(), /Đang tìm cách kết nối/);
  resolveDetection({ ...catalogue, authOptions: [] }); await h.flush(); assert.equal(h.button('Native browser'), undefined);
  h.dispose();
});

test('native secret choices distinguish API keys from tokens and never submit on selection', async () => {
  for (const [id, label, expected] of [['synthetic-api-key', 'Synthetic API key', 'API key'], ['synthetic-token', 'Synthetic setup-token', 'Token xác thực']]) {
    const h = harness(async method => method === 'openclaw.setup.activate.start'
      ? { step: { id: 'continue', type: 'confirm' } }
      : { ...catalogue, manualProviders: [{ id, label }] });
    await h.flush(); h.button(label).props.onClick(); await h.flush();
    const input = h.nodes().find(node => node.type === 'input');
    assert.equal(input.props.type, 'password'); assert.equal(input.props['aria-label'], expected);
    assert.equal(input.props.autoComplete, 'off'); assert.match(h.text(), /không nhập mật khẩu tài khoản/);
    assert.equal(h.requests.filter(item => item.method === 'openclaw.setup.activate.start').length, 0);
    input.props.onChange({ target: { value: 'synthetic-only' } }); h.render();
    h.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await h.flush();
    assert.deepEqual(h.requests.find(item => item.method === 'openclaw.setup.activate.start').params,
      { sessionId: 'synthetic-session-1', kind: 'api-key', authChoice: id, apiKey: 'synthetic-only' });
    h.dispose();
  }
});
