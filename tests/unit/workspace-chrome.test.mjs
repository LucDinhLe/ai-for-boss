import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { conversationTitle } from "../../apps/desktop/src/workspace-ui.ts";

const require = createRequire(import.meta.url);
const walk = (node) => node == null || typeof node === "boolean" ? [] : Array.isArray(node) ? node.flatMap(walk)
  : typeof node !== "object" ? [node] : [node, ...walk(typeof node.type === "function" ? node.type(node.props) : node.props?.children)];
const text = (node) => walk(node).filter((part) => typeof part === "string" || typeof part === "number").join("");
const namedButton = (tree, value) => walk(tree).find((node) => node?.type === "button" && (node.props['aria-label'] ?? text(node)) === value);
function component(name, props) {
  const hooks = [], exports = {}, effects = [], frames = [], nodes = new Map();
  const listeners = new Map(), windowListeners = new Map();
  const document = { activeElement: null, addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name) };
  const window = { innerWidth: 1024, innerHeight: 700,
    addEventListener: (name, handler) => windowListeners.set(name, handler), removeEventListener: name => windowListeners.delete(name),
    requestAnimationFrame: handler => frames.push(handler) };
  let cursor = 0;
  const react = {
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useEffect(callback, deps) {
      const index = cursor++, old = hooks[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        effects.push(() => { old?.cleanup?.(); hooks[index] = { deps, cleanup: callback() }; });
      }
    }
  };
  const source = fs.readFileSync(new URL(`../../apps/desktop/src/${name}.tsx`, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, document, window, require: (id) => id === "react" ? react : id === "./workspace-ui" ? { conversationTitle }
      : id === "./BrandMark" ? { default: () => null } : id.endsWith('.css') ? {} : require(id)
  });
  let mounted = [];
  const dom = node => {
    const key = `${node.type}|${node.props?.id ?? node.props?.['aria-label'] ?? node.props?.title ?? text(node)}|${node.props?.role ?? ''}`;
    if (!nodes.has(key)) nodes.set(key, {
      focus() { document.activeElement = this; }, getBoundingClientRect: () => ({ left: 160, right: 188, bottom: 400 }),
      contains(target) { return walk(this.node).includes(target?.node); },
      querySelectorAll() { return walk(this.node).filter(value => typeof value?.type === 'string' && value.props?.role?.startsWith('menuitem') && !value.props.disabled).map(dom); },
      querySelector() { return this.querySelectorAll()[0] ?? null; }
    });
    const element = nodes.get(key); element.node = node; return element;
  };
  const render = () => {
    cursor = 0; const tree = exports.default(props);
    const elements = walk(tree).filter(node => typeof node?.type === 'string');
    const previous = mounted;
    for (const node of previous) {
      if (typeof node.props.ref === 'function') node.props.ref(null);
      else if (node.props.ref) node.props.ref.current = null;
    }
    mounted = elements;
    for (const element of nodes.values()) element.isConnected = false;
    for (const node of elements) {
      const element = dom(node); element.isConnected = true;
      if (typeof node.props.ref === 'function') node.props.ref(element);
      else if (node.props.ref) node.props.ref.current = element;
      if (node.props.autoFocus && !previous.some(old => dom(old) === element)) element.focus();
    }
    for (const effect of effects.splice(0)) effect();
    for (const frame of frames.splice(0)) frame();
    return tree;
  };
  return Object.assign(render, { document, window, dom,
    dispatch: (name, event) => listeners.get(name)?.(event), dispatchWindow: name => windowListeners.get(name)?.() });
}

const sessions = [
  { key: "home", displayName: "Kế hoạch tuần", label: "weekly budget", pinned: false },
  { key: "work", displayName: "Công việc", projectId: "project-a", pinned: false },
  { key: "pin", displayName: "Đã lưu", projectId: "project-a", pinned: true },
  { key: "orphan", displayName: "Phiên vẫn giữ", projectId: "missing-project" }
];
function sidebar(patch = {}) {
  const calls = [];
  const props = { sessions, projects: [{ id: "project-a", displayName: "Dự án A" }], activeKey: "home", activeView: "chat", disabled: false,
    onNewSession: () => calls.push("new"), onNavigate: (view) => calls.push(["navigate", view]),
    onOpenSession: (key) => calls.push(["open", key]), onPinSession: (key, pinned) => calls.push(["pin", key, pinned]),
    onOpenProject: (project) => calls.push(["project", project.id]), onToggle: () => calls.push("toggle"), ...patch };
  return { props, calls, render: component("WorkspaceSidebar", props) };
}

test("sidebar preserves reference menu order and routes only explicit user actions", () => {
  const f = sidebar(), tree = f.render();
  const navigation = walk(tree).find((node) => node?.props?.className === "sidebar-navigation");
  assert.deepEqual(walk(navigation).filter((node) => node?.type === "button").map(node => node.props['aria-label'] ?? text(node)),
    ["Phiên mới", "Dự án", "Thống kê sử dụng", "Kỹ năng", "Nhắn tin", "Tác vụ định kỳ"]);
  assert.deepEqual(f.calls, []);
  namedButton(navigation, "Phiên mới").props.onClick();
  namedButton(navigation, "Thống kê sử dụng").props.onClick();
  namedButton(tree, "Dự án A").props.onClick();
  assert.deepEqual(f.calls, ["new", ["navigate", "usage"], ["project", "project-a"]]);
  assert.equal(walk(tree).some((node) => node?.type === "aside"), false);
});

test("search uses native titles/labels, pinned rows appear once, and missing projects cannot hide sessions", () => {
  const f = sidebar(), tree = f.render();
  const keys = walk(tree).filter((node) => node?.props?.["data-session-key"]).map((node) => node.props["data-session-key"]);
  assert.deepEqual([...keys].sort(), ["home", "orphan", "pin", "work"]);
  assert.match(text(tree), /Dự án chưa tải/);
  walk(tree).find((node) => node?.type === "input").props.onChange({ target: { value: "WEEKLY BUDGET" } });
  assert.deepEqual(walk(f.render()).filter((node) => node?.props?.["data-session-key"]).map((node) => node.props["data-session-key"]), ["home"]);
  walk(f.render()).find((node) => node?.type === "input").props.onChange({ target: { value: "not-found" } });
  assert.match(text(f.render()), /Không tìm thấy phiên phù hợp/); assert.deepEqual(f.calls, []);
});

test("pin gestures never open or optimistically relocate a session; disabled actions remain inert", async () => {
  const f = sidebar(), tree = f.render();
  const row = walk(tree).find((node) => node?.props?.["data-session-key"] === "home");
  const buttons = walk(row).filter((node) => node?.type === "button");
  buttons[0].props.onClick({ shiftKey: true });
  await Promise.resolve(); f.render();
  buttons[1].props.onClick({ currentTarget: f.render.dom(buttons[1]) });
  namedButton(f.render(), "Ghim").props.onClick(); await Promise.resolve(); f.render();
  assert.deepEqual(f.calls, [["pin", "home", true], ["pin", "home", true]]);
  assert.equal(sessions[0].pinned, false);
  buttons[0].props.onClick({ shiftKey: false });
  assert.deepEqual(f.calls.at(-1), ["open", "home"]);
  f.props.disabled = true;
  const disabled = walk(f.render()).filter((node) => node?.type === "button" && !['Thinking', "Thu gọn thanh bên", "Cài đặt"].includes(node.props["aria-label"]));
  assert.ok(disabled.every((button) => button.props.disabled));
  for (const button of disabled) button.props.onClick({ shiftKey: true });
  assert.equal(f.calls.length, 3);
  assert.equal(namedButton(f.render(), 'Thinking'), undefined, 'Thinking belongs to the right dock');
  const settings = walk(f.render()).find(node => node?.type === 'button' && node.props['aria-label'] === 'Cài đặt');
  assert.notEqual(settings.props.disabled, true); settings.props.onClick();
  assert.deepEqual(f.calls.at(-1), ['navigate', 'settings']);
});

test("native labels render as text and shell navigation exposes active state", () => {
  const malicious = "<img src=x onerror=alert(1)>";
  const f = sidebar({ activeView: "projects", projects: [{ id: "project-a", displayName: malicious }] });
  const tree = f.render();
  assert.ok(text(tree).includes(malicious));
  assert.equal(walk(tree).some((node) => node?.props?.dangerouslySetInnerHTML), false);
  assert.equal(namedButton(tree, "Dự án").props["aria-current"], "page");
});

const sessionRow = (tree, key = 'home') => walk(tree).find(node => node?.props?.['data-session-key'] === key);
const sessionMenu = tree => walk(tree).find(node => node?.props?.role === 'menu');
const menuTrigger = (tree, key = 'home') => walk(sessionRow(tree, key)).find(node => node?.props?.className === 'sidebar-session__more');
function openSessionMenu(f, key = 'home') {
  const trigger = menuTrigger(f.render(), key);
  trigger.props.onClick({ currentTarget: f.render.dom(trigger) });
  return f.render();
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('ellipsis and right-click open the same correctly labelled menu without navigating', () => {
  const f = sidebar({ onRenameSession: async () => {}, onDeleteSession: () => {} });
  let tree = openSessionMenu(f), menu = sessionMenu(tree);
  assert.equal(menuTrigger(tree).props['aria-expanded'], true);
  assert.deepEqual(walk(menu).filter(node => node?.type === 'button').map(text), ['Đổi tên', 'Ghim', 'Xóa cuộc trò chuyện']);
  for (const [label, icon] of [['Đổi tên', 'edit'], ['Ghim', 'pin'], ['Xóa cuộc trò chuyện', 'trash']]) {
    assert.equal(walk(namedButton(menu, label)).find(node => node?.props?.name)?.props.name, icon);
  }
  assert.equal(walk(sessionRow(tree)).filter(node => node?.type === 'button').length, 2, 'only navigation and an ellipsis occupy each row');
  let prevented = false;
  const row = sessionRow(tree, 'pin');
  row.props.onContextMenu({ preventDefault() { prevented = true; }, currentTarget: f.render.dom(row), clientX: 1020, clientY: 699 });
  tree = f.render(); menu = sessionMenu(tree);
  assert.equal(prevented, true); assert.ok(namedButton(menu, 'Bỏ ghim'));
  assert.equal(namedButton(menu, 'Bỏ ghim').props['aria-checked'], true);
  assert.equal(walk(namedButton(menu, 'Bỏ ghim')).find(node => node?.props?.name)?.props.name, 'unpin');
  assert.ok(menu.props.style.left >= 8 && menu.props.style.left + 208 <= 1024);
  assert.ok(menu.props.style.top >= 8 && menu.props.style.top + 164 <= 700);
  assert.deepEqual(f.calls, []);
  assert.equal(f.props.activeKey, 'home');
});

test('conversation menu supports keyboard opening, roving focus, Escape, Tab and outside dismissal', () => {
  const f = sidebar({ onRenameSession: async () => {}, onDeleteSession: () => {} });
  const row = sessionRow(f.render()), opener = walk(row).find(node => node?.type === 'button');
  opener.props.onKeyDown({ key: 'F10', shiftKey: true, currentTarget: f.render.dom(opener), preventDefault() {} });
  let tree = f.render(), menu = sessionMenu(tree);
  assert.equal(text(f.render.document.activeElement.node), 'Đổi tên');
  for (const [key, expected] of [['ArrowDown', 'Ghim'], ['End', 'Xóa cuộc trò chuyện'], ['Home', 'Đổi tên'], ['ArrowUp', 'Xóa cuộc trò chuyện']]) {
    menu.props.onKeyDown({ key, preventDefault() {} });
    assert.equal(text(f.render.document.activeElement.node), expected);
  }
  menu.props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  tree = f.render(); assert.equal(sessionMenu(tree), undefined);
  assert.equal(f.render.document.activeElement, f.render.dom(opener), 'Escape returns to the row which opened the context menu');
  tree = openSessionMenu(f); menu = sessionMenu(tree);
  f.render.dispatch('pointerdown', { target: f.render.dom(namedButton(menu, 'Ghim')) });
  assert.ok(sessionMenu(f.render()), 'inside interaction keeps the menu open');
  f.render.dispatch('pointerdown', { target: { node: { type: 'outside' } } });
  assert.equal(sessionMenu(f.render()), undefined);
  menu = sessionMenu(openSessionMenu(f));
  menu.props.onKeyDown({ key: 'Tab' }); assert.equal(sessionMenu(f.render()), undefined);
  tree = openSessionMenu(f); menu = sessionMenu(tree);
  f.render.dispatch('scroll', { target: f.render.dom(menu) }); assert.ok(sessionMenu(f.render()));
  f.render.dispatch('scroll', { target: { node: { type: 'sidebar-scroll' } } }); assert.equal(sessionMenu(f.render()), undefined);
  openSessionMenu(f); f.render.dispatchWindow('resize'); assert.equal(sessionMenu(f.render()), undefined);
  openSessionMenu(f); f.render.dispatchWindow('blur'); assert.equal(sessionMenu(f.render()), undefined);
  const trigger = menuTrigger(f.render());
  trigger.props.onKeyDown({ key: 'ArrowDown', currentTarget: f.render.dom(trigger), preventDefault() {} });
  assert.ok(sessionMenu(f.render())); assert.deepEqual(f.calls, []);
});

test('pin action waits for native completion, prevents duplicate actions and allows retry after failure', async () => {
  let request = deferred(); const calls = [];
  const f = sidebar({ onPinSession: (key, pinned) => { calls.push([key, pinned]); return request.promise; } });
  const pin = namedButton(openSessionMenu(f), 'Ghim');
  pin.props.onClick(); pin.props.onClick();
  let tree = f.render();
  assert.deepEqual(calls, [['home', true]]); assert.match(text(tree), /Đang cập nhật ghim/);
  assert.equal(sessionRow(tree).props['aria-busy'], true); assert.equal(menuTrigger(tree).props.disabled, true);
  assert.equal(sessions[0].pinned, false, 'no optimistic native metadata update');
  request.reject(new Error('offline')); await settle(); tree = f.render();
  assert.match(text(tree), /Chưa cập nhật được ghim/); assert.equal(menuTrigger(tree).props.disabled, false);
  request = deferred(); namedButton(openSessionMenu(f), 'Ghim').props.onClick();
  request.resolve(); await settle(); tree = f.render();
  assert.equal(calls.length, 2); assert.equal(sessionRow(tree).props['aria-busy'], false);
  assert.equal(f.render.document.activeElement.node.props['aria-label'], menuTrigger(tree).props['aria-label']);
  assert.deepEqual(f.calls, [], 'pin action never selects or deletes a conversation');
});

test('rename trims the submitted label, preserves errors, blocks concurrent saves and restores focus', async () => {
  let request = deferred(); const calls = [];
  const f = sidebar({ onRenameSession: (key, label) => { calls.push([key, label]); return request.promise; } });
  namedButton(openSessionMenu(f), 'Đổi tên').props.onClick();
  let tree = f.render();
  const input = walk(tree).find(node => node?.type === 'input' && node.props.maxLength === 200);
  input.props.onChange({ target: { value: '  Kế hoạch quý mới  ' } }); tree = f.render();
  let form = walk(tree).find(node => node?.type === 'form');
  const first = form.props.onSubmit({ preventDefault() {} });
  await form.props.onSubmit({ preventDefault() {} });
  tree = f.render(); assert.equal(namedButton(tree, 'Hủy').props.disabled, true);
  assert.deepEqual(calls, [['home', 'Kế hoạch quý mới']]);
  request.reject(new Error('offline')); await first; tree = f.render();
  assert.match(text(tree), /Chưa lưu được tên/); assert.ok(walk(tree).some(node => node?.type === 'form'));
  request = deferred(); form = walk(tree).find(node => node?.type === 'form');
  const retry = form.props.onSubmit({ preventDefault() {} }); request.resolve(); await retry;
  tree = f.render(); assert.equal(walk(tree).some(node => node?.type === 'form'), false);
  assert.equal(f.render.document.activeElement.node.props['aria-label'], menuTrigger(tree).props['aria-label']);
  assert.deepEqual(f.calls, []); assert.equal(sessions[0].label, 'weekly budget');
});

test('delete only requests parent confirmation for the exact row and locked actions stay inert', () => {
  const requests = [], f = sidebar({ onRenameSession: async () => {}, onDeleteSession: key => requests.push(key) });
  namedButton(openSessionMenu(f, 'work'), 'Xóa cuộc trò chuyện').props.onClick();
  assert.deepEqual(requests, ['work']); assert.equal(sessionMenu(f.render()), undefined);
  assert.deepEqual(f.calls, []); assert.equal(f.props.sessions.length, 4); assert.equal(f.props.activeKey, 'home');
  f.props.actionBusy = true;
  let tree = f.render(); assert.equal(menuTrigger(tree).props.disabled, true);
  menuTrigger(tree).props.onClick({ currentTarget: f.render.dom(menuTrigger(tree)) });
  sessionRow(tree).props.onContextMenu({ preventDefault() {}, currentTarget: f.render.dom(sessionRow(tree)), clientX: 10, clientY: 10 });
  assert.equal(sessionMenu(f.render()), undefined); assert.deepEqual(requests, ['work']);
  f.props.actionBusy = false; openSessionMenu(f);
  f.props.sessions = sessions.filter(session => session.key !== 'home'); tree = f.render();
  assert.equal(sessionMenu(tree), undefined, 'a removed native row cannot leave an actionable stale menu');
});

test("session tabs provide one roving tab stop, wrap arrow keys and close only through the close callback", () => {
  const calls = [], props = { sessions, openKeys: ["home", "work", "home"], activeKey: "home", disabled: false,
    onSelect: (key) => calls.push(["select", key]), onClose: (key) => calls.push(["close", key]), onNew: () => calls.push("new") };
  const render = component("SessionTabs", props), tree = render();
  const tabs = walk(tree).filter((node) => node?.props?.role === "tab");
  assert.equal(tabs.length, 2); assert.deepEqual(tabs.map((node) => node.props.tabIndex), [0, -1]);
  for (const [index, tab] of tabs.entries()) tab.props.ref({ focus: () => calls.push(["focus", index]), scrollIntoView() {} });
  tabs[0].props.onKeyDown({ key: "ArrowLeft", preventDefault() {} });
  assert.deepEqual(calls.slice(0, 2), [["select", "work"], ["focus", 1]]);
  tabs[1].props.onKeyDown({ key: "Home", preventDefault() {} });
  assert.deepEqual(calls.slice(2, 4), [["select", "home"], ["focus", 0]]);
  tabs[0].props.onKeyDown({ key: "Delete", preventDefault() {} });
  assert.deepEqual(calls.at(-1), ["close", "home"]);
  walk(tree).find((node) => node?.props?.["aria-label"] === "Đóng tab Công việc").props.onClick();
  assert.deepEqual(calls.at(-1), ["close", "work"]);
  assert.deepEqual(props.openKeys, ["home", "work", "home"], "controlled keys are never mutated");
  props.disabled = true;
  for (const button of walk(render()).filter((node) => node?.type === "button")) {
    assert.equal(button.props.disabled, true); button.props.onClick();
    button.props.onKeyDown?.({ key: "Delete", preventDefault() {} });
  }
  assert.equal(calls.length, 6);
});
