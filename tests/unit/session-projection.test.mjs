import assert from "node:assert/strict";
import test from "node:test";
import { readContextUsage, toTranscriptMessages, upsertTranscriptEvent } from "../../apps/desktop/src/gateway-client.ts";

test('context meter never presents stale, unconfirmed or invalid counts as exact usage', () => {
  for (const info of [{ totalTokens: 900 }, { totalTokens: 900, totalTokensFresh: false }, { totalTokens: -1, totalTokensFresh: true }, { totalTokens: Infinity, totalTokensFresh: true }]) {
    assert.equal(readContextUsage({ sessionInfo: info }).usedTokens, null);
  }
  assert.equal(readContextUsage({ sessionInfo: { totalTokens: 0, totalTokensFresh: true } }).usedTokens, 0);
  for (const limit of [-1, 0, NaN, Infinity, 3.2]) assert.equal(readContextUsage({ sessionInfo: { contextTokens: limit } }).contextTokens, null);
});
import { selectedChatModel } from "../../apps/desktop/src/chat-state.ts";

const row = (content, id = "entry-a", seq = 7) => ({ role: "assistant", content, timestamp: 1, __openclaw: { id, seq } });

test("an image-only native user row remains visible without loading its source URL or content", () => {
  const raw = { role: "user", content: [{ type: "image", source: { url: "https://example.invalid/private", data: "private bytes" } }],
    __openclaw: { id: "image-row", seq: 1 } };
  const messages = toTranscriptMessages([raw], "session-a");
  assert.equal(messages.length, 1); assert.equal(messages[0].content.trim(), "[Ảnh đính kèm]");
  assert.equal(messages[0].role, "user"); assert.equal(messages[0].content.includes("private"), false);
});

test("one native record can produce several distinct stable display rows, including equal text", () => {
  const raw = [row("First"), row("Second"), row("Second"), row("Second", "entry-b", 8)];
  const messages = toTranscriptMessages(raw, "session-a");
  assert.equal(messages.length, 4);
  assert.equal(new Set(messages.map((entry) => entry.id)).size, 4);
  assert.deepEqual(messages.map((entry) => entry.id), toTranscriptMessages(raw, "session-a").map((entry) => entry.id));
  assert.equal(messages[0].anchorId, "entry-a");
  assert.equal(messages[0].anchorSeq, 7);
  const ambiguous = upsertTranscriptEvent(messages, { messageId: "entry-a", messageSeq: 7, message: row("Reprojected") }, "session-a");
  assert.equal(ambiguous.messages, messages, "a singular live event cannot overwrite every sibling");
  assert.equal(ambiguous.refresh, true);
});

test("live native identity uses messageId/messageSeq and never an event envelope sequence or text", () => {
  let messages = [];
  const event = { messageId: "first", messageSeq: 1, message: { role: "user", content: "Equal" } };
  messages = upsertTranscriptEvent(messages, event, "session-a").messages;
  messages = upsertTranscriptEvent(messages, event, "session-a").messages;
  messages = upsertTranscriptEvent(messages, { ...event, messageId: "second", messageSeq: 2 }, "session-a").messages;
  assert.equal(messages.length, 2);
  const seqOnly = { messageSeq: 3, message: { role: "assistant", content: "Sequence only" } };
  messages = upsertTranscriptEvent(messages, seqOnly, "session-a").messages;
  messages = upsertTranscriptEvent(messages, seqOnly, "session-a").messages;
  assert.equal(messages.length, 3);
  const unanchored = upsertTranscriptEvent(messages, { seq: 99, message: { role: "user", content: "Unknown" } }, "session-a");
  assert.equal(unanchored.messages, messages);
  assert.equal(unanchored.refresh, true);
  const projected = toTranscriptMessages([row("Old", "first", 1)], "session-a");
  const updated = upsertTranscriptEvent(projected, event, "session-a");
  assert.equal(updated.messages.length, 1);
  assert.equal(updated.messages[0].id, projected[0].id);
  assert.equal(updated.messages[0].content, "Old", "even one known row does not prove a changed event replaces it");
  assert.equal(updated.refresh, true);
  assert.equal(upsertTranscriptEvent(projected, { message: row("Old", "first", 1) }, "session-a").refresh, true,
    "a replay and an equal-text sibling require native history to distinguish them");
});

test("context and model belong to sessionInfo, independently of the configured defaults", () => {
  const selected = readContextUsage({ defaults: { model: "default", modelProvider: "other", contextTokens: 1000 },
    usage: { totalTokens: 900 }, sessionInfo: { model: "selected", modelProvider: "fixture", contextTokens: 4000, totalTokens: 300, totalTokensFresh: true } });
  assert.deepEqual(selected, { model: "selected", modelProvider: "fixture", contextTokens: 4000, usedTokens: 300 });
  assert.equal(readContextUsage({ sessionInfo: { model: "selected", totalTokens: 900, totalTokensFresh: false } }).usedTokens, null);
  assert.equal(readContextUsage({ defaults: { model: "default", modelProvider: "other" }, sessionInfo: { hasActiveRun: false } }).model, null,
    "incomplete selected-session truth cannot become an unrelated default model");
  assert.equal(readContextUsage({ defaults: { model: "legacy", modelProvider: "fixture" } }).model, "legacy");
});

test("only the selected provider and model with explicit native availability authorize send", () => {
  const selected = { model: "shared", modelProvider: "selected-provider" };
  const models = [{ id: "shared", name: "Shared", provider: "other-provider", available: true },
    { id: "shared", name: "Selected", provider: "selected-provider", available: false }];
  assert.equal(selectedChatModel(selected, models).status, "unavailable");
  assert.equal(selectedChatModel(selected, models).label, "selected-provider/shared");
  assert.equal(selectedChatModel(selected, models.slice(0, 1)).status, "unavailable");
  assert.equal(selectedChatModel({ model: null, modelProvider: null }, models).status, "unknown");
  assert.equal(selectedChatModel(selected, [{ ...models[1], available: undefined }]).status, "unknown");
  assert.equal(selectedChatModel(selected, [{ ...models[1], available: true }]).status, "ready");
  assert.equal(selectedChatModel({ ...selected, model: "selected-provider/shared" }, [{ ...models[1], available: true }]).status, "ready");
  assert.equal(selectedChatModel({ ...selected, modelProvider: null }, models).status, "unknown");
});
