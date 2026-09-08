import assert from "node:assert/strict";
import test from "node:test";
import { readSessionThinking } from "../../apps/desktop/src/session-thinking.ts";

const usage = { model: "shared", modelProvider: "selected", usedTokens: null, contextTokens: null };
const modelOptions = [{ id: "adaptive", label: "Native adaptive" }];
const models = [{ id: "shared", provider: "other", thinkingLevels: [{ id: "wrong", label: "Wrong provider" }] },
  { id: "shared", provider: "selected", thinkingLevels: modelOptions, thinkingDefault: "adaptive" }];

test("thinking options require an exact selected model and never infer levels from a model name", () => {
  assert.deepEqual(readSessionThinking(null, usage, models), { level: "adaptive", levels: modelOptions });
  assert.deepEqual(readSessionThinking(null, { ...usage, model: "selected/shared" }, models), { level: "adaptive", levels: modelOptions });
  assert.deepEqual(readSessionThinking(null, { ...usage, modelProvider: "missing" }, models), { level: null, levels: [] });
  assert.deepEqual(readSessionThinking(null, usage, [{ id: "shared", provider: "selected", reasoning: true }]), { level: null, levels: [] });
});

test("session capabilities override the matching catalogue and explicit empty lists stay authoritative", () => {
  const defaults = { model: "shared", modelProvider: "selected", thinkingDefault: "default-level",
    thinkingLevels: [{ id: "default-level", label: "Default" }] };
  const sessionInfo = { thinkingLevel: "session-level", thinkingLevels: [{ id: "session-level", label: "Session" }] };
  assert.deepEqual(readSessionThinking({ defaults, sessionInfo }, usage, models), {
    level: "session-level", levels: sessionInfo.thinkingLevels
  });
  assert.deepEqual(readSessionThinking({ defaults, sessionInfo: { thinkingLevels: [] } }, usage, models), {
    level: "adaptive", levels: []
  });
  assert.deepEqual(readSessionThinking({ defaults }, usage, models), { level: "adaptive", levels: modelOptions });
  assert.deepEqual(readSessionThinking({ defaults }, usage, [{ id: "shared", provider: "selected", thinkingLevels: [] }]), {
    level: "default-level", levels: []
  });
  assert.equal(readSessionThinking({ sessionInfo: { thinkingDefault: "session-default" } }, usage, models).level, "session-default");
});

test("defaults are usable only when both their model and provider identify the selected model", () => {
  const defaults = { thinkingDefault: "default-level", thinkingLevels: [{ id: "default-level", label: "Default" }] };
  for (const identity of [{}, { model: "shared" }, { modelProvider: "selected" },
    { model: "other-model", modelProvider: "selected" }, { model: "shared", modelProvider: "other" }]) {
    assert.deepEqual(readSessionThinking({ defaults: { ...defaults, ...identity } }, usage, []), { level: null, levels: [] });
    assert.deepEqual(readSessionThinking({ defaults: { ...defaults, ...identity } }, usage, models), { level: "adaptive", levels: modelOptions });
  }
  for (const [model, selectedModel] of [["shared", "shared"], ["shared", "selected/shared"], ["selected/shared", "shared"]]) {
    assert.deepEqual(readSessionThinking({ defaults: { ...defaults, model, modelProvider: "selected" } },
      { ...usage, model: selectedModel }, []), { level: "default-level", levels: defaults.thinkingLevels });
  }
});

test("ambiguous matching catalogue entries supply no capabilities or defaults unless session evidence exists", () => {
  const ambiguous = [models[1], { ...models[1], thinkingDefault: "conflict", thinkingLevels: [{ id: "conflict", label: "Conflict" }] }];
  assert.deepEqual(readSessionThinking(null, usage, ambiguous), { level: null, levels: [] });
  const sessionInfo = { thinkingLevel: "session-only", thinkingLevels: [{ id: "session-only", label: "Session" }] };
  assert.deepEqual(readSessionThinking({ sessionInfo }, usage, ambiguous), { level: "session-only", levels: sessionInfo.thinkingLevels });
});

test("malformed capability entries are ignored, duplicate IDs are stable and the scan is bounded", () => {
  const options = [null, 2, "high", {}, { id: "", label: "Empty" }, { id: "bad", label: "" },
    { id: "a".repeat(101), label: "Too long" }, { id: "long-label", label: "b".repeat(101) },
    { id: "valid", label: "First label" }, { id: "valid", label: "Duplicate" },
    ...Array.from({ length: 40 }, (_, i) => ({ id: `native-${i}`, label: `Level ${i}` }))];
  const result = readSessionThinking({ sessionInfo: { thinkingLevel: "valid", thinkingLevels: options } }, usage, models);
  assert.equal(result.levels.length, 21); assert.equal(result.levels[0].label, "First label");
  assert.equal(result.levels.at(-1).id, "native-19");
  assert.deepEqual(readSessionThinking({ sessionInfo: { thinkingLevels: "high", thinkingLevel: 3 } }, usage, models), {
    level: null, levels: []
  });
});

test("an unlisted native current value remains visible truth without inventing a selectable option", () => {
  const result = readSessionThinking({ sessionInfo: { thinkingLevel: "native-new-mode", thinkingLevels: modelOptions } }, usage, models);
  assert.equal(result.level, "native-new-mode"); assert.deepEqual(result.levels, modelOptions);
});
