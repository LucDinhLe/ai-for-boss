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
/**
 * Spec 0063: the dialog asks which brand first, then offers at most two ways in,
 * so every flow that used to start on one click now takes two. `enter` keeps the
 * tests reading as intent ("start the browser sign-in for this brand") instead of
 * spelling the picker out each time.
 */
async function enter(h, brand, path = 'Đăng nhập OAuth') {
  h.button(brand).props.onClick(); await h.flush();
  const target = h.button(path);
  assert.ok(target, `no "${path}" under ${brand}`);
  target.props.onClick(); await h.flush();
}
test('sign-in choices follow account popularity, keep the long tail behind "more", and dispatch only the live native choice', async () => {
  const ids = ['xai', 'google', 'anthropic', 'openai', 'new-provider', 'openrouter'];
  const authOptions = ids.map(id => ({ id: `${id}-native-auth`, brandId: id, label: `${id} login`, kind: 'oauth', featured: id === 'xai' }));
  const h = harness(async method => method === 'openclaw.setup.auth.start' ? { step: { id: 'next', type: 'confirm' } }
    : { candidates: [], manualProviders: [], authOptions });
  await h.flush();
  // The first screen always offers the same four, in the same order, whatever a
  // given machine happens to have routes for.
  const featured = h.nodes().filter(n => n.type === 'button' && n.props['aria-label'] && n.props.onClick
    && !h.nodes().some(d => d.type === 'details' && h.text(d).includes(n.props['aria-label'])))
    .map(n => n.props['aria-label']).slice(0, 4);
  assert.deepEqual(featured, ['ChatGPT / OpenAI', 'Claude / Anthropic', 'Grok / xAI', 'Antigravity'],
    'the four the Product Owner asked for, in that order');
  const more = h.nodes().find(n => n.type === 'details' && n.props.className === 'connect__more');
  assert.match(h.text(more), /Xem toàn bộ danh mục lõi \(3\)/);
  assert.ok(h.text(more).includes('Gemini / Google') && h.text(more).includes('new-provider login'),
    'everything outside the fixed four is folded, unknown brands last under the core name');
  assert.ok(!h.text(more).includes('Grok / xAI'), 'a featured brand is never buried in the fold');
  assert.equal(h.requests.length, 1, 'rendering does not authenticate');
  await enter(h, 'ChatGPT / OpenAI');
  assert.equal(h.requests.find(r => r.method === 'openclaw.setup.auth.start').params.authChoice, 'openai-native-auth');
  h.dispose();
});
const catalogue = { candidates: [], manualProviders: [], authOptions: [
  { id: "synthetic-browser", label: "Native browser", kind: "oauth", featured: true },
  { id: "synthetic-device", label: "Native device", kind: "device-code", featured: false }
], workspace: "synthetic", setupComplete: false };

function harness(request = async () => catalogue, initialProps = {}, readCatalogue = async () => ({ providers: [] }), { pageOpens = true } = {}) {
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
  }, openPage: async (...args) => { openedPages.push(copy(args)); return pageOpens; } } } }, crypto: { randomUUID: () => "synthetic-session-" + ++id },
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
  return { requests, catalogueRequests, openedPages, render, nodes, text: (node = tree) => text(node), done: () => done,
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
  await enter(h, 'Native browser');
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

test("the sign-in page opens by itself once chosen, its code stays visible, and a multiselect still waits for Continue", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start" ? { step: {
    id: "pick", type: "multiselect", externalUrl: "https://synthetic.example/authorize", deviceCode: { code: "TEST-CODE" },
    initialValue: ["b"], options: [{ label: "First", value: "a" }, { label: "Second", value: "b" }]
  } } : method === "wizard.next" ? { done: true } : catalogue);
  await h.flush();
  assert.equal(h.openedPages.length, 0, "rendering the dialog opens nothing");
  await enter(h, 'Native device');
  // Spec 0067: the person already chose "sign in" with a click; a second click
  // on "open the page" was the friction. Only the session id crosses to the host.
  assert.deepEqual(h.openedPages, [["synthetic-session-1"]], "the page opens once, through the narrow handoff");
  assert.match(h.text(), /Trang đăng nhập đã mở trong trình duyệt/);
  assert.match(h.text(), /TEST-CODE/, "the code stays on screen while the core waits");
  assert.match(h.text(), /https:\/\/synthetic\.example\/authorize/, "and the address is there if the browser did not open");
  const boxes = h.nodes().filter((node) => node.type === "input" && node.props.type === "checkbox");
  assert.equal(boxes.length, 2);
  assert.equal(boxes[1].props.checked, true);
  boxes[0].props.onChange(); h.render();
  assert.equal(h.requests.some((item) => item.method === "wizard.next"), false, "a real question is never answered for the person");
  h.button("Tiếp tục").props.onClick(); await h.flush();
  assert.deepEqual(h.requests.find((item) => item.method === "wizard.next").params.answer.value, ["a", "b"]);
});

test("cancelling a pending start prevents late steps and extra polling", async () => {
  let finish;
  const h = harness((method) => method === "openclaw.setup.auth.start"
    ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(catalogue));
  await h.flush();
  h.button("Native browser").props.onClick(); h.render();          // pick the brand
  h.button("Đăng nhập OAuth").props.onClick(); h.render(); // then the way in
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
  await h.flush(); await enter(h, 'Native browser'); await h.tick();
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
  h.button("Native browser").props.onClick(); await h.flush();
  const start = h.button("Đăng nhập OAuth").props.onClick;
  start(); start(); await h.flush();
  assert.equal(h.requests.filter((call) => call.method === "openclaw.setup.auth.start").length, 1);
  h.dispose(); await h.tick();
  assert.equal(h.requests.filter((call) => call.method === "wizard.next").length, 0);
  assert.equal(h.requests.filter((call) => call.method === "wizard.cancel").length, 1);
});

test("done plus native error never looks successful and does not start verification", async () => {
  const h = harness(async (method) => method === "openclaw.setup.auth.start"
    ? { done: true, status: "error", error: "Synthetic native failure" } : catalogue);
  await h.flush(); await enter(h, 'Native browser');
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
  await h.flush(); await enter(h, 'Native browser');
  assert.match(h.text(), /Synthetic start failure/);
  assert.deepEqual(h.requests.find((call) => call.method === "wizard.cancel").params, { sessionId: "synthetic-session-1" });
  h.button('← Chọn dịch vụ khác').props.onClick(); await h.flush();
  assert.equal(h.button("Native device").props.disabled, false);
  await enter(h, 'Native device');
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
  await h.flush(); await enter(h, 'Native browser');
  assert.equal(h.button('Tiếp tục'), undefined);
  await h.tick();
  assert.match(h.text(), /Finishing AI setup/);
  assert.equal(h.requests.filter(call => call.method === 'openclaw.setup.detect').length, 1);
  await h.tick(); await h.flush();
  assert.match(h.text(), /Đã kết nối synthetic\/model/);
  assert.deepEqual(h.requests.filter(call => call.method === 'wizard.next').map(call => call.params),
    [{ sessionId: 'synthetic-session-1' }, { sessionId: 'synthetic-session-1' }]);
  assert.deepEqual(h.requests.find(call => call.method === 'models.authStatus').params, { refresh: false });
  assert.equal(h.requests.some(call => call.method === 'openclaw.setup.verify'), false);
});

test("informational notes acknowledge once, and a login note is acknowledged once its page is open", async () => {
  let next = 0;
  const login = { id: 'login', type: 'note', executor: 'client', externalUrl: 'https://synthetic.example/login', deviceCode: { code: 'TEST' } };
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: false, status: 'running', step: { id: 'info', type: 'note', executor: 'client', message: 'Preparing sign-in' } };
    if (method === 'wizard.next') return ++next === 1
      ? { done: false, status: 'running', step: { id: 'info', type: 'note', executor: 'client', message: 'Preparing sign-in' } }
      : next === 2 ? { done: false, status: 'running', step: login }
      : { done: false, status: 'running', step: { id: 'wait', type: 'progress', executor: 'gateway', message: 'Waiting for callback' } };
    return catalogue;
  });
  await h.flush(); await enter(h, 'Native browser');
  assert.equal(h.requests.filter(call => call.params.answer).length, 1, 'the information note is acknowledged once');
  await h.tick(); await h.flush();
  assert.deepEqual(h.openedPages, [['synthetic-session-1']], 'the login page opened by itself');
  assert.deepEqual(h.requests.filter(call => call.params.answer).map(call => call.params.answer), [
    { stepId: 'info', value: true }, { stepId: 'login', value: true }], 'and only then was the login note acknowledged, once');
  assert.match(h.text(), /cửa sổ này tự hoàn tất/, 'the person is told there is nothing left to click');
  assert.match(h.text(), /TEST/, 'the device code outlives its note');
  assert.equal(h.button('Đã đăng nhập xong, tiếp tục'), undefined, 'no second click is asked for');
  h.dispose();
});

test("when the page cannot open, the login note keeps the manual path and is not acknowledged", async () => {
  const h = harness(async method => method === 'openclaw.setup.auth.start'
    ? { done: false, status: 'running', step: { id: 'login', type: 'note', executor: 'client', externalUrl: 'https://synthetic.example/login' } }
    : catalogue, {}, undefined, { pageOpens: false });
  await h.flush(); await enter(h, 'Native browser');
  assert.equal(h.requests.some(call => call.params.answer), false, 'nothing is acknowledged behind a page that never opened');
  assert.ok(h.button('Mở trang đăng nhập'), 'the manual button is still there');
  assert.ok(h.button('Đã đăng nhập xong, tiếp tục'));
  assert.match(h.text(), /Trình duyệt chưa tự mở/);
  h.dispose();
});

test("the redirect-paste prompt the core raises beside a browser sign-in is a fallback, not the main road", async () => {
  const h = harness(async method => method === 'openclaw.setup.auth.start'
    ? { done: false, status: 'running', step: { id: 'login', type: 'note', executor: 'client', externalUrl: 'https://synthetic.example/login' } }
    : method === 'wizard.next' ? { done: false, status: 'running', step: { id: 'paste', type: 'text', executor: 'client', message: 'Paste the authorization code (or full redirect URL):' } }
    : catalogue);
  await h.flush(); await enter(h, 'Native browser'); await h.flush();
  const input = h.nodes().find(node => node.type === 'input');
  assert.equal(input.props['aria-label'], 'Địa chỉ trên thanh trình duyệt');
  assert.equal(input.props.autoFocus, false, 'the box does not grab focus as if it were required');
  assert.match(h.text(), /Chỉ khi trình duyệt báo lỗi/);
  assert.match(h.text(), /cửa sổ này tự hoàn tất/);
  h.dispose();
});

test("failed progress and incomplete terminal receipts never become connected", async () => {
  for (const terminal of [{ done: true, status: 'error', error: 'Native commit failed' }, { done: true, status: 'done' }]) {
    const h = harness(async method => method === 'openclaw.setup.auth.start'
      ? { done: false, status: 'running', step: { id: 'finish', type: 'progress', executor: 'gateway' } }
      : method === 'wizard.next' ? terminal : catalogue);
    await h.flush(); await enter(h, 'Native browser'); await h.tick();
    assert.doesNotMatch(h.text(), /Đã kết nối/);
    assert.equal(h.requests.some(call => call.method === 'models.authStatus'), false);
    assert.equal(h.button('Đăng nhập OAuth').props.disabled, false);
    h.dispose();
  }
});

test("queued progress with error status is drained to read the actual native failure", async () => {
  const h = harness(async method => method === 'openclaw.setup.auth.start'
    ? { done: false, status: 'error', step: { id: 'queued', type: 'progress', executor: 'gateway' } }
    : method === 'wizard.next' ? { done: true, status: 'error', error: 'Native credential persistence failed' } : catalogue);
  await h.flush(); await enter(h, 'Native browser'); await h.tick();
  assert.match(h.text(), /Native credential persistence failed/);
  assert.equal(h.requests.filter(call => call.method === 'wizard.next').length, 1);
  assert.equal(h.requests.some(call => call.params.answer), false);
  assert.equal(h.requests.some(call => call.method === 'models.authStatus'), false);
});

test("reconnecting clears stale wizard controls and ignores a late pre-reconnect step", async () => {
  let finish;
  const h = harness(method => method === 'openclaw.setup.auth.start'
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(catalogue));
  await h.flush(); await enter(h, 'Native browser');
  h.update({ ready: false }); await h.flush(); h.update({ ready: true }); await h.flush();
  finish({ done: false, status: 'running', step: { id: 'stale', type: 'text', title: 'Stale reconnect prompt' } });
  await h.flush(); await h.tick();
  assert.doesNotMatch(h.text(), /Stale reconnect prompt/);
  assert.equal(h.button('Đăng nhập OAuth').props.disabled, false);
  assert.equal(h.requests.some(call => call.method === 'wizard.next'), false);
  h.dispose();
});

test('the Gateway restart gets a name and a bar, instead of a blank pause (0063)', async () => {
  let release;
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model', gatewayRestartRequired: true } };
    // Hold the readback open: that gap is exactly the restart the user sees.
    if (method === 'models.authStatus') return new Promise(resolve => { release = () => resolve({ providers: [{ provider: 'synthetic', status: 'ok' }] }); });
    return catalogue;
  });
  await h.flush(); await enter(h, 'Native browser');
  assert.match(h.text(), /Đang khởi động lại bộ chạy/, 'the pause is named while it lasts');
  assert.match(h.text(), /đừng bấm lại/, 'and says what not to do, because clicking again is what breaks it');
  assert.equal(h.nodes().some(node => node.type === 'progress'), true, 'with something that moves');
  release(); await h.flush(); await h.flush();
  assert.doesNotMatch(h.text(), /Đang khởi động lại bộ chạy/, 'and it goes away once the receipt lands');
  assert.match(h.text(), /Đã kết nối synthetic\/model/);
  h.dispose();
});

test("credential readback failure does not repeat activation or claim a verified connection", async () => {
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } };
    if (method === 'models.authStatus') throw new Error('Synthetic metadata unavailable');
    return catalogue;
  });
  await h.flush(); await enter(h, 'Native browser');
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
  await h.flush(); await enter(h, 'Native browser'); await h.flush();
  assert.match(h.text(), /Đã kết nối synthetic\/model/);
  assert.equal(h.button('Đăng nhập OAuth').props.disabled, false);
  assert.ok(h.button('Để sau'));
  release(catalogue); await h.flush(); h.dispose();
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

test('reconnect hides prior actionable choices until fresh native detection completes', async () => {
  let count = 0, resolveDetection;
  const h = harness(() => ++count === 1 ? Promise.resolve(catalogue) : new Promise(resolve => { resolveDetection = resolve; }));
  await h.flush(); assert.ok(h.button('Native browser'));
  h.update({ ready: false }); await h.flush(); assert.equal(h.button('Native browser'), undefined);
  h.update({ ready: true }); await h.flush(); assert.equal(h.button('Native browser'), undefined);
  assert.match(h.text(), /Đang dò tài khoản trên máy/);
  resolveDetection({ ...catalogue, authOptions: [] }); await h.flush(); assert.equal(h.button('Native browser'), undefined);
  h.dispose();
});

test('native secret choices distinguish API keys from tokens and never submit on selection', async () => {
  for (const [id, label, expected] of [['synthetic-api-key', 'Synthetic API key', 'API key'], ['synthetic-token', 'Synthetic setup-token', 'Token xác thực']]) {
    const h = harness(async method => method === 'openclaw.setup.activate.start'
      ? { step: { id: 'continue', type: 'confirm' } }
      : { ...catalogue, manualProviders: [{ id: 'other-key', label: 'Other key' }, { id, label }] });
    await h.flush();
    // 0063: no global provider select any more. Each brand carries its own keys,
    // so the choice is made by entering that brand.
    h.button(label).props.onClick(); await h.flush();
    const input = h.nodes().find(node => node.type === 'input' && node.props.type === 'password');
    assert.equal(input.props['aria-label'], expected);
    assert.equal(input.props.autoComplete, 'off'); assert.match(h.text(), /không nhập mật khẩu tài khoản/);
    assert.equal(h.requests.filter(item => item.method === 'openclaw.setup.activate.start').length, 0);
    input.props.onChange({ target: { value: 'synthetic-only' } }); h.render();
    h.nodes().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await h.flush();
    assert.deepEqual(h.requests.find(item => item.method === 'openclaw.setup.activate.start').params,
      { sessionId: 'synthetic-session-1', kind: 'api-key', authChoice: id, apiKey: 'synthetic-only' });
    h.dispose();
  }
});

test('a brand this build ships can be picked before the slow scan answers, and the flow waits for the scan', async () => {
  let resolveDetection;
  const methods = [
    { id: 'gemini-api-key', provider: 'google', method: 'api-key', label: 'Gemini API key', hint: '', pluginId: 'google', docsPath: '', guidedSecret: true, guidedAuth: null, discovery: false, manualOnly: false, scopes: ['text-inference'] },
    { id: 'openai', provider: 'openai', method: 'oauth', label: 'ChatGPT sign-in', hint: '', pluginId: 'openai', docsPath: '', guidedSecret: false, guidedAuth: 'oauth', discovery: false, manualOnly: false, scopes: ['text-inference'] },
    { id: 'fal-api-key', provider: 'fal', method: 'api-key', label: 'fal image key', hint: '', pluginId: 'fal', docsPath: '', guidedSecret: true, guidedAuth: null, discovery: false, manualOnly: false, scopes: ['image-generation'] }
  ];
  const h = harness(() => new Promise(resolve => { resolveDetection = resolve; }), {}, async () => ({ version: 'fixture', providers: [], authMethods: methods }));
  await h.flush();
  assert.match(h.text(), /Đang dò tài khoản trên máy/);
  assert.equal(h.button('ChatGPT / OpenAI').props.disabled, false, 'a shipped brand does not wait for the scan to be picked');
  assert.equal(h.button('Claude / Anthropic').props.disabled, true, 'a brand this build never ships stays dim');
  assert.deepEqual(h.catalogueRequests, [{ action: 'catalog' }]);
  h.button('ChatGPT / OpenAI').props.onClick(); await h.flush();
  assert.match(h.text(), /Cách kết nối hiện ra ngay khi dò xong/, 'the picked brand says it is waiting');
  assert.deepEqual(h.requests.map(call => call.method), ['openclaw.setup.detect'], 'and nothing starts before the core answers');
  resolveDetection({ ...catalogue, authOptions: [{ id: 'openai-oauth', brandId: 'openai', label: 'ChatGPT', kind: 'oauth', featured: true }] });
  await h.flush();
  assert.ok(h.button('Đăng nhập OAuth'), 'the live route appears in place, no second pick');
  h.dispose();
});

test('the provider page can open the dialog straight at a brand', async () => {
  const h = harness(async () => ({ ...catalogue, authOptions: [{ id: 'xai-oauth', brandId: 'xai', label: 'Grok', kind: 'device-code', featured: true }] }),
    { initialQuery: 'xai' });
  await h.flush();
  assert.ok(h.button('Đăng nhập OAuth'), 'the pencil on a card lands on that card\'s two ways in');
  assert.match(h.text(), /Grok \/ xAI/);
  h.dispose();
});

test('a clean connection closes the dialog by itself once the runner is back', async () => {
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } };
    if (method === 'models.authStatus') return { providers: [{ provider: 'synthetic', status: 'ok' }] };
    return catalogue;
  });
  await h.flush(); await enter(h, 'Native browser'); await h.flush();
  assert.match(h.text(), /Đã kết nối synthetic\/model/);
  assert.equal(h.done(), 0, 'the receipt is shown first');
  await h.tick();
  assert.equal(h.done(), 1, 'then the dialog closes without another click');
  h.dispose();
});

test('the API-key picker lists providers by popularity and explains the Google limitation', async () => {
  const h = harness(async () => ({ ...catalogue, authOptions: [], manualProviders: [
    { id: 'xai-api-key', brandId: 'xai', label: 'xAI API key', groupLabel: 'xAI' },
    { id: 'gemini-api-key', brandId: 'google', label: 'Gemini API key', groupLabel: 'Google', hint: 'AI Studio key' },
    { id: 'apiKey', brandId: 'anthropic', label: 'Anthropic API key', groupLabel: 'Anthropic' },
    { id: 'zzz-key', label: 'Zzz key' }
  ] }));
  await h.flush();
  // Brands come in popularity order, and each one owns its own keys (0063).
  const cards = h.nodes().filter(node => node.type === 'button' && node.props['aria-label'] && node.props.onClick
    && /dán API key/i.test(h.text(node))).map(node => node.props['aria-label']);
  assert.deepEqual(cards, ['Claude / Anthropic', 'Grok / xAI', 'Gemini / Google', 'Zzz key'],
    'featured brands first in their fixed order, then the rest, unknown last under the core name');
  h.button('Gemini / Google').props.onClick(); await h.flush();
  assert.match(h.text(), /AI Studio key/); assert.match(h.text(), /không cho gói Gemini cá nhân/);
  h.button('Mở trang tạo API key').props.onClick(); await h.flush();
  assert.deepEqual(h.catalogueRequests.at(-1), { action: 'help-page', page: 'ai-studio-key' },
    'the page is named by id; the host owns the address');
  assert.equal(h.nodes().some(node => node.type === 'select'), false, 'one key for this brand needs no picker');
  assert.ok(h.requests.every(call => call.method === 'openclaw.setup.detect'), 'choosing a provider never starts a flow');
  h.dispose();
});

test('each kind of detected result gets its own named lid, and an empty kind gets none (0063)', async () => {
  const h = harness(async () => ({ ...catalogue, candidates: [{ kind: 'claude-cli', label: 'Claude Code', detail: 'Logged in', modelRef: 'anthropic/exact-model-64', recommended: false }],
    unavailableCandidates: [{ id: 'pi-cli', label: 'Pi CLI', detail: 'installed', reason: 'separate setup' }],
    prepareOptions: [{ id: 'prep', label: 'Local setup', hint: 'Install companion first' }],
    recommendedInstalls: [{ id: 'extra', label: 'Một phần mềm khác', hint: 'nên cài thêm', website: 'https://example.invalid' }] }));
  await h.flush();
  // The lids belong to the brand the person picked, not to the picker.
  h.button('Claude / Anthropic').props.onClick(); await h.flush();
  assert.ok(h.button('Đăng nhập bằng gói Claude (qua Claude Code)'), 'no OAuth for this brand, so the CLI leads and is named that way');
  assert.match(h.text(), /anthropic\/exact-model-64/);
  const lids = h.nodes().filter(node => node.type === 'details');
  assert.equal(lids.length, 2, 'two kinds present, two lids; the old single lid counted three kinds into one number');
  const unusable = lids.find(node => h.text(node).includes('chưa dùng được'));
  assert.match(h.text(unusable), /Ứng dụng tìm thấy nhưng chưa dùng được \(1\)/);
  assert.match(h.text(unusable), /Pi CLI/);
  const prepare = lids.find(node => h.text(node).includes('Cần chuẩn bị thêm'));
  assert.match(h.text(prepare), /Cần chuẩn bị thêm trước khi nối \(1\)/);
  assert.match(h.text(prepare), /Install companion first/);
  assert.doesNotMatch(h.text(), /Một phần mềm khác/,
    'suggesting other software to install is not the job of an account dialog');
  h.dispose();
});

test('the real shapes: Claude has no OAuth and leads with its CLI, Grok has OAuth', async () => {
  // Exactly what the core catalogue reports for these two brands: Anthropic has
  // no browser sign-in at all, only the logged-in CLI plus keys; xAI does have one.
  const h = harness(async () => ({
    candidates: [{ kind: 'claude-cli', brandId: 'anthropic', label: 'Claude Code', detail: 'Đã đăng nhập trên máy', modelRef: 'anthropic/claude-sonnet-5', recommended: true }],
    authOptions: [{ id: 'xai-oauth', brandId: 'xai', label: 'Grok sign-in', kind: 'device-code', featured: false }],
    manualProviders: [
      { id: 'apiKey', brandId: 'anthropic', label: 'Anthropic API key', groupLabel: 'Anthropic' },
      { id: 'setup-token', brandId: 'anthropic', label: 'Setup token' },
      { id: 'xai-api-key', brandId: 'xai', label: 'xAI API key' }
    ], setupComplete: false }));
  await h.flush();

  // Claude: the CLI is the way in, and the screen says so instead of leaving a gap.
  h.button('Claude / Anthropic').props.onClick(); await h.flush();
  assert.match(h.text(), /không có đăng nhập OAuth/, 'it says plainly that this brand has none');
  assert.ok(h.button('Đăng nhập bằng gói Claude (qua Claude Code)'), 'the logged-in CLI takes the first slot');
  assert.equal(h.nodes().some(n => n.type === 'input' && n.props.type === 'password'), true, 'and a key is still offered');
  assert.equal(h.nodes().filter(n => n.type === 'button' && /Đăng nhập OAuth/.test(n.props['aria-label'] ?? '')).length, 0,
    'no OAuth button is drawn for a brand that has no OAuth route');

  // Grok: a real browser sign-in, so that leads and the CLI wording never appears.
  h.button('← Chọn dịch vụ khác').props.onClick(); await h.flush();
  h.button('Grok / xAI').props.onClick(); await h.flush();
  assert.match(h.text(), /Hai cách: đăng nhập OAuth, hoặc dán API key/);
  assert.ok(h.button('Đăng nhập OAuth'));
  h.button('Đăng nhập OAuth').props.onClick(); await h.flush();
  assert.equal(h.requests.find(r => r.method === 'openclaw.setup.auth.start').params.authChoice, 'xai-oauth');
  h.dispose();
});

test('Antigravity leads to the Gemini key, and Claude without Claude Code says how to bring the plan in (0068)', async () => {
  const h = harness(async () => ({ ...catalogue, authOptions: [], candidates: [], manualProviders: [
    { id: 'gemini-api-key', brandId: 'google', label: 'Gemini API key' },
    { id: 'apiKey', brandId: 'anthropic', label: 'Anthropic API key' }] }));
  await h.flush();
  assert.equal(h.button('Antigravity').props.disabled, false, 'no dead card: it has somewhere honest to go');
  h.button('Antigravity').props.onClick(); await h.flush();
  assert.match(h.text(), /Google không cho phần mềm bên ngoài đăng nhập/);
  h.button('Dùng Gemini bằng API key').props.onClick(); await h.flush();
  assert.ok(h.nodes().some(n => n.type === 'input' && n.props['aria-label'] === 'API key'), 'straight to the Gemini key box');
  h.button('← Chọn dịch vụ khác').props.onClick(); await h.flush();
  h.button('Claude / Anthropic').props.onClick(); await h.flush();
  assert.match(h.text(), /cài Claude Code, đăng nhập bằng tài khoản Claude một lần/);
  h.button('Hướng dẫn cài Claude Code').props.onClick(); await h.flush();
  assert.deepEqual(h.catalogueRequests.at(-1), { action: 'help-page', page: 'claude-code' });
  const before = h.requests.filter(r => r.method === 'openclaw.setup.detect').length;
  h.button('Dò lại').props.onClick(); await h.flush();
  assert.equal(h.requests.filter(r => r.method === 'openclaw.setup.detect').length, before + 1, 'and one click rescans once it is installed');
  h.dispose();
});

test('an empty kind shows no lid at all (0063)', async () => {
  const h = harness(async () => ({ ...catalogue, candidates: [{ kind: 'claude-cli', label: 'Claude Code', detail: 'Logged in', modelRef: 'anthropic/exact-model-64', recommended: false }],
    unavailableCandidates: [], prepareOptions: [] }));
  await h.flush();
  assert.equal(h.nodes().filter(node => node.type === 'details' && h.text(node).includes('chưa dùng được')).length, 0);
  assert.equal(h.nodes().filter(node => node.type === 'details' && h.text(node).includes('Cần chuẩn bị')).length, 0);
  h.dispose();
});

test('the dialog does not repeat the account list the provider page already shows (0067)', async () => {
  const h = harness(async () => ({ ...catalogue, setupComplete: true, configuredModel: 'openai-codex/gpt-5.4' }));
  await h.flush(); await h.flush();
  assert.doesNotMatch(h.text(), /Đang dùng: openai-codex/);
  assert.ok(h.button('Xong'));
  assert.deepEqual(h.requests.map(call => call.method), ['openclaw.setup.detect'], 'one RPC to open, not two');
  h.dispose();
});

test('a blank machine never spends the account-status RPC', async () => {
  const h = harness(async method => { assert.equal(method, 'openclaw.setup.detect'); return catalogue; });
  await h.flush(); await h.flush();
  assert.doesNotMatch(h.text(), /Đang dùng/);
  h.dispose();
});

test('a terminal activation receipt survives the Gateway restart that follows activation', async () => {
  let finish;
  const h = harness(method => method === 'openclaw.setup.auth.start' ? new Promise(resolve => { finish = resolve; })
    : Promise.resolve(method === 'models.authStatus' ? { providers: [{ provider: 'synthetic', status: 'ok' }] } : catalogue));
  await h.flush(); await enter(h, 'Native browser');
  // The host restarts the Gateway before answering, so readiness drops and returns first.
  h.update({ ready: false }); await h.flush(); h.update({ ready: true }); await h.flush();
  finish({ done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model', gatewayRestartRequired: true } });
  await h.flush(); await h.flush();
  assert.match(h.text(), /Đã kết nối synthetic\/model/, 'the saved route is confirmed even though the flow token moved on');
  assert.equal(h.requests.filter(call => call.method === 'wizard.cancel').length, 0, 'a completed wizard is never cancelled');
  assert.equal(h.button('Đăng nhập OAuth').props.disabled, false);
  h.dispose();
});

test('a long browser sign-in is not abandoned by a client-side deadline', async () => {
  let release;
  const realNow = Date.now; let now = realNow();
  const h = harness(async method => {
    if (method === 'openclaw.setup.auth.start') return { done: false, status: 'running', step: { id: 'wait', type: 'progress', executor: 'gateway', message: 'Waiting for browser' } };
    if (method === 'wizard.next') return new Promise(resolve => { release = resolve; });
    if (method === 'models.authStatus') return { providers: [] };
    return catalogue;
  });
  await h.flush(); await enter(h, 'Native browser'); await h.tick();
  assert.match(h.text(), /Waiting for browser/);
  Date.now = () => now + 5 * 60_000;
  try {
    release({ done: true, status: 'done', modelActivation: { modelRef: 'synthetic/model' } });
    await h.flush(); await h.flush();
  } finally { Date.now = realNow; }
  assert.match(h.text(), /Đã kết nối synthetic\/model/);
  assert.doesNotMatch(h.text(), /không trả về bước nào/);
  assert.equal(h.requests.filter(call => call.method === 'wizard.cancel').length, 0);
  h.dispose();
});
