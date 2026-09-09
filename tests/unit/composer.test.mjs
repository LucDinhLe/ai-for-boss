import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { handleComposerKeyDown } from "../../apps/desktop/src/chat-drafts.ts";
import { CHAT_FILE_ACCEPT, attachmentReadHint } from "../../apps/desktop/src/chat-attachments.ts";
import { isSelectableModel } from "../../apps/desktop/src/chat-state.ts";

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL("../../apps/desktop/src/Composer.tsx", import.meta.url), "utf8");
const walk = (node) => node == null || typeof node === "boolean" ? [] : Array.isArray(node) ? node.flatMap(walk)
  : typeof node !== "object" ? [node] : [node, ...walk(node.props?.children)];
const text = (node) => walk(node).filter((part) => typeof part === "string" || typeof part === "number").join("");
const button = (tree, label) => walk(tree).find((node) => node?.type === "button" && text(node) === label);
const element = (tree, type) => walk(tree).find((node) => node?.type === type);
function fixture(patch = {}, globals = {}) {
  const hooks = [], calls = [], effects = [], exports = {};
  let cursor = 0;
  const react = {
    useEffect(effect) { effects.push(effect); },
    useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; }
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    ...globals, exports, require: (id) => id === "react" ? react : id === "./chat-drafts" ? { handleComposerKeyDown }
      : id === "./chat-attachments" ? { CHAT_FILE_ACCEPT, attachmentReadHint } : id === "./chat-state" ? { isSelectableModel }
        : id === "./workbench-api" ? { manage: async () => ({ screens: [] }) }
        : id === "./ModelPicker" ? { __esModule: true, default: "model-picker" } : require(id)
  });
  const props = { draft: "Draft", onDraftChange: (value) => calls.push(["draft", value]), onSend: () => calls.push("send"),
    onStop: () => calls.push("stop"), canSubmit: true, busy: false, stopping: false, disabled: false,
    models: [{ id: "current", name: "Current", provider: "provider-a", available: true },
      { id: "next", name: "Next", provider: "provider-b", available: true },
      { id: "locked", name: "Locked", provider: "provider-c", available: false }],
    usage: { model: "current", modelProvider: "provider-a", usedTokens: null, contextTokens: null },
    modelsLoading: false, changingModel: false, onChangeModel: async (model) => { calls.push(["model", model.id]); },
    attachments: [], onAddFiles: (files) => calls.push(["files", ...files]), onRemoveFile: (id) => calls.push(["remove", id]),
    canAttach: true, attachmentHint: "Ảnh và tệp văn bản.", ...patch };
  const render = () => { cursor = 0; return exports.default(props); };
  return { props, calls, effects, render };
}

test('textarea measures without a scrollbar, resizes on width/font/draft changes, caps long text and releases observer', () => {
  let callback, scheduled, disconnected = false, measured = 0, height = 48;
  const f = fixture({}, {
    ResizeObserver: class { constructor(fn) { callback = fn; } observe() {} disconnect() { disconnected = true; } },
    requestAnimationFrame(fn) { scheduled = fn; return 1; }, cancelAnimationFrame() { scheduled = null; }
  });
  const input = { style: {}, clientWidth: 500, get scrollHeight() { measured++; assert.equal(this.style.overflowY, 'hidden'); return height; } };
  element(f.render(), 'textarea').props.ref.current = input;
  const cleanup = f.effects.at(-1)();
  assert.equal(input.style.height, '49px'); assert.equal(input.style.overflowY, 'hidden');
  callback(); assert.equal(measured, 1, 'height-only observer feedback does not remeasure');
  input.clientWidth = 250; height = 280; callback(); scheduled();
  assert.equal(input.style.height, '180px'); assert.equal(input.style.overflowY, 'auto');
  cleanup(); assert.equal(disconnected, true); assert.equal(scheduled, null);
  height = 65; f.props.textSize = 18; f.render(); f.effects.at(-1)();
  assert.equal(input.style.height, '66px'); assert.equal(input.style.overflowY, 'hidden');
  height = 48; f.props.draft = ''; f.render(); f.effects.at(-1)();
  assert.equal(input.style.height, '49px');
});

test('Word chip advertises readable text only after extraction and never presents an error as ready', () => {
  const file = { id: 'word', name: 'Plan.docx', sizeBytes: 100, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', status: 'reading' };
  const f = fixture({ attachments: [file] });
  assert.match(text(f.render()), /Đang đọc/); assert.doesNotMatch(text(f.render()), /Đã đọc văn bản/);
  file.status = 'ready'; file.extractedText = 'Hello';
  assert.match(text(f.render()), /Đã đọc văn bản và bảng · 5 ký tự/);
  file.status = 'error'; file.error = 'Word bị hỏng';
  assert.match(text(f.render()), /Word bị hỏng/); assert.doesNotMatch(text(f.render()), /Đã đọc văn bản và bảng/);
});

test("native reasoning choices share the composer and stay locked while running or changing a model", async () => {
  const f = fixture({ thinking: { level: "medium", levels: [{ id: "medium", label: "Vừa" }, { id: "high", label: "Cao" }] } });
  f.props.onChangeThinking = async level => { f.calls.push(["thinking", level]); };
  const choice = () => walk(f.render()).find(node => node?.props?.id === "composer-thinking");
  assert.equal(element(f.render(), "textarea").props.rows, 1);
  assert.equal(choice().props.value, "medium");
  await choice().props.onChange({ target: { value: "high" } });
  assert.deepEqual(f.calls, [["thinking", "high"]]);
  assert.equal(choice().props.value, "medium", "native history owns the selected value");
  f.props.busy = true;
  assert.equal(choice().props.disabled, true);
  await choice().props.onChange({ target: { value: "high" } });
  assert.equal(f.calls.length, 1);
  f.props.busy = false;
  element(f.render(), "model-picker").props.onSelect(f.props.models[1]);
  assert.equal(choice().props.disabled, true);
  f.props.thinking = { level: null, levels: [] };
  assert.equal(choice(), undefined, "no reasoning control without advertised choices");
});

test("one main action stays inside the textbox and composing continues while streaming", () => {
  const f = fixture(), idle = f.render();
  const shell = walk(idle).find((node) => node?.props?.className === "composer__box");
  assert.ok(walk(shell).includes(element(idle, "textarea")));
  assert.ok(walk(shell).includes(button(idle, "Gửi")));
  element(idle, "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(f.calls, ["send"]);
  f.props.busy = true;
  const busy = f.render();
  assert.equal(button(busy, "Gửi"), undefined); assert.ok(button(busy, "Dừng"));
  assert.equal(element(busy, "textarea").props.disabled, false);
  element(busy, "textarea").props.onChange({ target: { value: "Next draft" } });
  element(busy, "form").props.onSubmit({ preventDefault() {} });
  button(busy, "Dừng").props.onClick();
  assert.deepEqual(f.calls, ["send", ["draft", "Next draft"], "stop"]);
  f.props.stopping = true;
  assert.equal(button(f.render(), "Đang dừng…").props.disabled, true);
  f.props.stopping = false; f.props.stopDisabled = true;
  const offline = f.render();
  assert.equal(button(offline, "Dừng").props.disabled, true);
  assert.equal(button(offline, "Đang dừng…"), undefined, "lost connection is not an abort in progress");
  button(offline, "Dừng").props.onClick();
  assert.equal(f.calls.filter(call => call === "stop").length, 1);
});

test("one selection changes the model directly and preserves native unavailable selection", async () => {
  const f = fixture();
  f.props.usage.model = "provider-a/current";
  const normalized = element(f.render(), "model-picker");
  assert.equal(normalized.props.currentId, "current");
  assert.equal(normalized.props.currentProvider, "provider-a");
  assert.equal(normalized.props.label, "Current");
  const change = normalized.props.onSelect(f.props.models[1]);
  assert.deepEqual(f.calls, [["model", "next"]]);
  const waiting = f.render();
  assert.match(text(waiting), /Đang đổi/);
  assert.equal(button(waiting, "Đổi mô hình"), undefined);
  assert.equal(button(waiting, "Gửi").props.disabled, true);
  assert.equal(element(waiting, "model-picker").props.currentId, "current");
  await change;
  assert.deepEqual(f.calls, [["model", "next"]]);
  f.props.usage = { ...f.props.usage, model: "locked", modelProvider: "provider-c" };
  const current = element(f.render(), "model-picker");
  assert.equal(current.props.currentId, "locked");
  assert.equal(current.props.models.some(model => model.id === "locked"), true, 'unavailable rows remain visible with their native status');
  f.props.usage = { ...f.props.usage, model: "missing", modelProvider: "old-provider" };
  assert.equal(element(f.render(), "model-picker").props.label, "missing");
});

test('composer can discover and refresh the complete catalogue without blocking an existing ready chat', async () => {
  const f = fixture({ catalogueLoading: true, catalogueError: 'Danh mục chưa tải đủ', onBrowseModels: refresh => f.calls.push(['browse', refresh]) });
  const picker = element(f.render(), 'model-picker');
  assert.equal(picker.props.models, f.props.models); assert.equal(picker.props.loading, true);
  assert.equal(picker.props.error, 'Danh mục chưa tải đủ'); assert.equal(picker.props.disabled, false);
  assert.equal(button(f.render(), 'Gửi').props.disabled, false);
  picker.props.onOpen(); picker.props.onRefresh();
  assert.deepEqual(f.calls, [['browse', false], ['browse', true]]);
  f.props.models.push({ id: 'not-offered', provider: 'provider-b', available: true, selectable: false });
  await element(f.render(), 'model-picker').props.onSelect({ id: 'not-offered', provider: 'provider-b', available: true, selectable: true });
  assert.equal(f.calls.length, 2, 'selection checks the actual catalogue row, not a forged incoming flag');
  f.props.models = [];
  assert.equal(element(f.render(), 'model-picker').props.disabled, false, 'empty discovery can still be refreshed');
  f.props.modelsLoading = true;
  const starting = element(f.render(), 'model-picker');
  assert.equal(starting.props.disabled, true); starting.props.onOpen(); starting.props.onRefresh();
  assert.equal(f.calls.length, 2, 'startup gate remains independent of full discovery loading');
});

test("direct selection rejects busy, unavailable, missing and current models; errors allow retry", async () => {
  const f = fixture({ onChangeModel: async () => { throw new Error("transport"); } });
  const choose = () => element(f.render(), "model-picker").props.onSelect({ provider: "provider-b", id: "next" });
  f.props.busy = true;
  await choose(); assert.doesNotMatch(text(f.render()), /Chưa đổi được/);
  f.props.busy = false;
  f.props.models = f.props.models.filter((model) => model.id !== "next");
  await choose(); assert.doesNotMatch(text(f.render()), /Chưa đổi được/);
  for (const value of [["provider-c", "locked"], ["provider-a", "current"]]) {
    await element(f.render(), "model-picker").props.onSelect({ provider: value[0], id: value[1] });
    assert.doesNotMatch(text(f.render()), /Chưa đổi được/);
  }
  f.props.models.push({ id: "next", name: "Next", provider: "provider-b", available: true });
  await choose();
  assert.match(text(f.render()), /Chưa đổi được mô hình/);
  assert.equal(element(f.render(), "model-picker").props.currentId, "current");
  assert.equal(element(f.render(), "textarea").props.value, "Draft");
  f.props.onChangeModel = async model => f.calls.push(["model", model.id]);
  await choose();
  assert.deepEqual(f.calls, [["model", "next"]]);
  assert.doesNotMatch(text(f.render()), /Chưa đổi được/);
});

test("selection locks duplicate changes and stale send handlers before the next render", async () => {
  let finish;
  const f = fixture({ onChangeModel: model => { f.calls.push(["model", model.id]); return new Promise(resolve => { finish = resolve; }); } });
  const before = f.render();
  const choose = element(before, "model-picker").props.onSelect;
  const event = f.props.models[1];
  const pending = choose(event);
  await choose(event);
  element(before, "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(f.calls, [["model", "next"]]);
  assert.equal(element(f.render(), "textarea").props.disabled, false);
  assert.equal(element(f.render(), "model-picker").props.disabled, true);
  finish(); await pending;
  assert.equal(element(f.render(), "model-picker").props.disabled, false);
});

test("file selection only hands selected files to the owner and resets the picker; chips can be removed", () => {
  const file = { name: "<script>.txt", size: 1024 };
  const f = fixture({ attachments: [{ id: "a", name: file.name, sizeBytes: file.size, status: "reading" },
    { id: "b", name: "bad.txt", sizeBytes: 12, status: "error", error: "Không đọc được tệp." }] });
  const tree = f.render(), picker = element(tree, "input"), event = { currentTarget: { files: [file], value: "selected" } };
  assert.equal(picker.props.type, "file"); assert.equal(picker.props.multiple, true); assert.equal(picker.props.accept, CHAT_FILE_ACCEPT);
  picker.props.onChange(event);
  assert.deepEqual(f.calls, [["files", file]]); assert.equal(event.currentTarget.value, "");
  assert.match(text(tree), /Đang đọc/); assert.match(text(tree), /Không đọc được tệp/);
  assert.ok(walk(tree).indexOf(walk(tree).find(node => node?.props?.className === "composer__attachments")) < walk(tree).indexOf(element(tree, "textarea")));
  assert.equal(walk(tree).some((node) => node?.props?.dangerouslySetInnerHTML), false);
  walk(tree).find((node) => node?.props?.["aria-label"] === `Bỏ tệp ${file.name}`).props.onClick();
  assert.deepEqual(f.calls.at(-1), ["remove", "a"]);
  f.props.canAttach = false;
  element(f.render(), "input").props.onChange(event);
  assert.equal(f.calls.length, 2);
});

test("keyboard sending uses the existing gate and does not submit while changing a model", () => {
  const f = fixture(), event = { key: "Enter", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false,
    preventDefault() {}, currentTarget: { form: { requestSubmit: () => f.calls.push("shortcut") } } };
  element(f.render(), "textarea").props.onKeyDown(event);
  assert.deepEqual(f.calls, ["shortcut"]);
  element(f.render(), "model-picker").props.onSelect(f.props.models[1]);
  element(f.render(), "textarea").props.onKeyDown(event);
  assert.deepEqual(f.calls, ["shortcut", ["model", "next"]]);
});
