import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { defaultAdvisorForm } from "../../apps/desktop/src/use-advisor.ts";

const require = createRequire(import.meta.url), exports = {};
const source = fs.readFileSync(new URL("../../apps/desktop/src/AdvisorPanel.tsx", import.meta.url), "utf8");
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { require, exports });
const Panel = exports.default;
const walk = (node) => node === null || node === undefined || typeof node === "boolean" ? [] : Array.isArray(node) ? node.flatMap(walk)
  : typeof node !== "object" ? [node] : [node, ...walk(typeof node.type === "function" ? node.type(node.props) : node.props?.children)];
const text = (node) => walk(node).filter((part) => typeof part === "string" || typeof part === "number").join("");
const byText = (tree, value) => walk(tree).find((node) => node?.type === "button" && text(node) === value);
function fixture(patch = {}) {
  const calls = [], form = { ...defaultAdvisorForm({ id: "model", provider: "fixture" }, "Goal"), sourceKind: "answer", content: "Content", sourceSnapshot: "Content" };
  const advisor = { form, entry: { form, status: "idle" }, stale: false, sourceChanged: false,
    busy: false, runningHere: false, cancelling: false, canReview: true, validation: null,
    update: (patch) => calls.push(patch), chooseSource: (kind) => calls.push(kind),
    review: () => calls.push("review"), cancel: () => calls.push("cancel"), ...patch };
  return { calls, advisor, tree: Panel({ advisor, models: [{ id: "model", name: "Model", provider: "fixture", available: true }],
    hasSession: true, latestAnswer: "Content", currentDraft: "Draft", onInsertReview: () => calls.push("insert") }) };
}

test("rendering and selecting preview never request review; only the explicit submit does", () => {
  const { tree, calls } = fixture();
  assert.equal(calls.length, 0);
  byText(tree, "Dùng câu trả lời mới nhất").props.onClick();
  byText(tree, "Dùng bản nháp đang soạn").props.onClick();
  assert.deepEqual(calls, ["answer", "draft"]);
  walk(tree).find((node) => node?.type === "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls, ["answer", "draft", "review"]);
  assert.match(text(tree), /120 giây/); assert.match(text(tree), /không phải trần tiền hoặc token/);
});

test("a global busy review disables another request and always exposes manual cancellation", () => {
  const { tree, calls } = fixture({ busy: true, canReview: false });
  assert.equal(byText(tree, "Kiểm kế hoạch").props.disabled, true);
  walk(tree).find((node) => node?.type === "form").props.onSubmit({ preventDefault() {} });
  assert.equal(calls.length, 0);
  assert.match(text(tree), /cuộc trò chuyện khác/);
  byText(tree, "Hủy kiểm tra").props.onClick(); assert.deepEqual(calls, ["cancel"]);
});

test("validated results remain plain text and stale feedback cannot be inserted as current", () => {
  const result = { decision: "revise", pass: false, summary: "<img src=x onerror=alert(1)>", confidence: 0.7,
    evidence: [{ source: "content", quote: "<script>worker data</script>" }], issues: [] };
  for (const stale of [false, true]) {
    const { tree, calls } = fixture({ stale, entry: { status: "completed", result } });
    assert.equal(walk(tree).some((node) => node?.props?.dangerouslySetInnerHTML), false);
    assert.ok(text(tree).includes(result.summary));
    const insert = byText(tree, "Đưa góp ý vào ô soạn");
    assert.equal(insert.props.disabled, stale);
    assert.equal(calls.length, 0);
    if (!stale) { insert.props.onClick(); assert.deepEqual(calls, ["insert"]); }
    else assert.match(text(tree), /Review cũ/);
  }
});
