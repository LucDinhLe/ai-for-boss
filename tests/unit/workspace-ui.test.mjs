import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { conversationTitle, workspaceStage } from "../../apps/desktop/src/workspace-ui.ts";

const ready = { supervisor: "ready", connected: true, setupReady: true };
const input = { runtime: ready, modelCatalogueState: "ready", availableModelCount: 1,
  activeKey: "synthetic-session", busy: false, opening: false, historyReady: true, selectedModelStatus: "ready" };

test("workspace readiness describes the next usable step, not merely an idle chat run", () => {
  const cases = [
    [{ runtime: { supervisor: "idle", connected: false, setupReady: false, paused: true } }, "paused", null],
    [{ runtime: { supervisor: "idle", connected: false, setupReady: false } }, "starting", null],
    [{ runtime: { supervisor: "starting", connected: false, setupReady: false } }, "starting", null],
    [{ runtime: { supervisor: "restarting", connected: false, setupReady: false } }, "starting", null],
    [{ runtime: { ...ready, supervisor: "safe-mode", connected: false, setupReady: false } }, "unavailable", null],
    [{ runtime: { ...ready, connected: false } }, "disconnected", null],
    [{ runtime: { ...ready, setupReady: false } }, "preparing", null],
    [{ modelCatalogueState: "loading" }, "loading-models", null],
    [{ modelCatalogueState: "error" }, "catalogue-error", "reload"],
    [{ availableModelCount: 0 }, "connect", "connect"],
    [{ activeKey: null }, "new-chat", "new-chat"],
    [{ opening: true, activeKey: null }, "opening", null],
    [{ historyReady: false }, "loading-history", null],
    [{ historyReady: false, historyError: true }, "history-error", "retry-history"],
    [{ busy: true }, "responding", null],
    [{ selectedModelStatus: "unavailable" }, "session-model-unavailable", "connect"],
    [{ selectedModelStatus: "unknown" }, "session-model-unknown", "reload"],
    [{}, "ready", null]
  ];
  for (const [patch, kind, action] of cases) {
    const actual = workspaceStage({ ...input, ...patch });
    assert.equal(actual.kind, kind);
    assert.equal(actual.action, action);
    if (kind !== "ready") assert.notEqual(actual.badge, "Sẵn sàng");
  }
});

test("lost connection overrides a streaming badge, while active streaming permits a next draft", () => {
  const lost = workspaceStage({ ...input, busy: true, runtime: { ...ready, connected: false } });
  assert.equal(lost.kind, "disconnected");
  const streaming = workspaceStage({ ...input, busy: true, historyReady: false });
  assert.equal(streaming.kind, "responding");
  assert.match(streaming.detail, /soạn tin tiếp theo/);
  assert.equal(streaming.action, null, "a guide never schedules or sends another message");
  const recovery = workspaceStage({ ...input, busy: true, historyReady: false, historyError: true });
  assert.equal(recovery.kind, "history-error", "an old busy state must not hide recovery after a failed reconnect snapshot");
  assert.equal(recovery.action, "retry-history");
});

test("conversation titles use native human labels and never expose an opaque key as the fallback", () => {
  const rows = [{ key: "opaque-a", displayName: "Kế hoạch tuần", label: "raw-label" },
    { key: "opaque-b", label: "Phân tích kết quả" }, { key: "opaque-c", label: "opaque-c" }];
  assert.equal(conversationTitle(null, rows), "Bắt đầu cùng AI for Boss");
  assert.equal(conversationTitle("opaque-a", rows), "raw-label", "manual label takes precedence");
  assert.equal(conversationTitle("opaque-b", rows), "Phân tích kết quả");
  assert.equal(conversationTitle("opaque-c", rows), "Cuộc trò chuyện mới");
  assert.equal(conversationTitle("missing", rows), "Cuộc trò chuyện mới");
  assert.equal(conversationTitle("native", [{ key: "native", derivedTitle: "Lập kế hoạch tuần" }]), "Lập kế hoạch tuần");
});

test("the guide exposes just the current user action and never dispatches it during rendering", () => {
  const require = createRequire(import.meta.url);
  const source = fs.readFileSync(new URL("../../apps/desktop/src/WorkspaceGuide.tsx", import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { require: id => id === './BrandMark' ? { __esModule: true, default: () => null } : require(id), exports });
  const Guide = exports.default;
  const calls = [];
  const callbacks = { onConnect: () => calls.push("connect"), onNewChat: () => calls.push("new-chat"), onReload: () => calls.push("reload"),
    onReloadHistory: () => calls.push("retry-history") };
  for (const [patch, label, action] of [
    [{ availableModelCount: 0 }, "Kết nối AI", "connect"],
    [{ activeKey: null }, "Cuộc trò chuyện mới", "new-chat"],
    [{ modelCatalogueState: "error" }, "Tải lại kết nối", "reload"],
    [{ selectedModelStatus: "unavailable" }, "Kết nối AI", "connect"],
    [{ selectedModelStatus: "unknown" }, "Tải lại kết nối", "reload"],
    [{ historyReady: false, historyError: true }, "Tải lại cuộc trò chuyện", "retry-history"]
  ]) {
    const before = calls.length;
    const node = Guide({ ...callbacks, stage: workspaceStage({ ...input, ...patch }) });
    assert.equal(calls.length, before);
    const button = node.props.children.find((child) => child?.type === "button");
    assert.equal(button.props.type, "button");
    assert.equal(button.props.children, label);
    button.props.onClick();
    assert.equal(calls.at(-1), action);
  }
  const waiting = Guide({ ...callbacks, stage: workspaceStage({ ...input, busy: true }) });
  assert.equal(waiting.props.children.some((child) => child?.type === "button"), false);
  const disabled = Guide({ ...callbacks, stage: workspaceStage({ ...input, activeKey: null }), actionDisabled: true });
  assert.equal(disabled.props.children.find((child) => child?.type === "button").props.disabled, true);
});
