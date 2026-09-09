import assert from "node:assert/strict";
import test from "node:test";
import { createSessionDraftStore, handleComposerKeyDown } from "../../apps/desktop/src/chat-drafts.ts";

test("session drafts remain independent and a delayed ACK only clears its captured revision", () => {
  const drafts = createSessionDraftStore();
  const submitted = drafts.write("A", "First draft");
  drafts.write("B", "Other conversation");
  drafts.write("A", "Edited");
  drafts.write("A", "First draft");
  assert.equal(drafts.acknowledge("A", submitted.revision), false);
  assert.equal(drafts.read("A").text, "First draft");
  assert.equal(drafts.read("B").text, "Other conversation");
  assert.equal(drafts.acknowledge("B", drafts.read("B").revision), true);
  assert.equal(drafts.read("B").text, "");
  assert.equal(drafts.read("A").text, "First draft");
  assert.equal(createSessionDraftStore().read("A").text, "", "a fresh renderer has no persisted drafts");
});

function keyEvent(patch = {}) {
  let submitted = 0, prevented = 0;
  return { event: { key: "Enter", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false,
    preventDefault: () => { prevented++; }, currentTarget: { form: { requestSubmit: () => { submitted++; } } }, ...patch },
    submitted: () => submitted, prevented: () => prevented };
}

test("Enter and Ctrl/Cmd+Enter submit through the form gate; Shift+Enter preserves newlines", () => {
  for (const patch of [{}, { ctrlKey: false }, { ctrlKey: false, metaKey: true }]) {
    const key = keyEvent(patch); handleComposerKeyDown(key.event, true);
    assert.equal(key.submitted(), 1); assert.equal(key.prevented(), 1);
  }
  const plain = keyEvent({ ctrlKey: false, shiftKey: true }); handleComposerKeyDown(plain.event, true);
  assert.equal(plain.submitted(), 0); assert.equal(plain.prevented(), 0);
  const busy = keyEvent(); handleComposerKeyDown(busy.event, false);
  assert.equal(busy.submitted(), 0); assert.equal(busy.prevented(), 1);
});

test("composition, legacy IME229, repeats and extra modifiers never send", () => {
  for (const patch of [{ isComposing: true }, { nativeEvent: { isComposing: true } }, { keyCode: 229 },
    { nativeEvent: { keyCode: 229 } }, { repeat: true }, { altKey: true }, { shiftKey: true }, { key: "a" }]) {
    const key = keyEvent(patch); handleComposerKeyDown(key.event, true);
    assert.equal(key.submitted(), 0); assert.equal(key.prevented(), 0);
  }
  const detached = keyEvent({ currentTarget: { form: null } });
  assert.doesNotThrow(() => handleComposerKeyDown(detached.event, true));
});

const attachment = (id, patch = {}) => ({ id, name: `${id}.txt`, sizeBytes: 3, mimeType: "text/plain", status: "reading", ...patch });

test("late file reads stay with their original session and cannot revive removed selections", () => {
  const drafts = createSessionDraftStore();
  const selected = attachment("old"); drafts.beginFiles("A", [selected]);
  selected.name = "mutated.txt";
  assert.equal(drafts.read("A").attachments[0].name, "old.txt", "store snapshots caller metadata");
  drafts.write("B", "Different session"); drafts.beginFiles("B", [attachment("B-file")]);
  assert.equal(drafts.completeFile("A", "old", "YWJj"), true);
  assert.equal(drafts.read("A").attachments[0].status, "ready");
  assert.equal(drafts.read("B").attachments[0].status, "reading");
  assert.equal(drafts.failFile("A", "old", "late failure"), false, "settled reads cannot be overwritten");
  drafts.beginFiles("A", [attachment("removed")]); drafts.removeFile("A", "removed");
  drafts.beginFiles("A", [attachment("replacement")]);
  assert.equal(drafts.completeFile("A", "removed", "YWJj"), false);
  assert.equal(drafts.failFile("A", "removed", "late failure"), false);
  assert.deepEqual(drafts.read("A").attachments.map((file) => file.id), ["old", "replacement"]);
  assert.equal(drafts.removeFile("A", "missing"), false);
  assert.deepEqual(createSessionDraftStore().read("A").attachments, []);
});

test("ACK clears sent attachment IDs independently of edited text and preserves later chosen files", () => {
  const drafts = createSessionDraftStore();
  drafts.write("A", "Sent text"); drafts.beginFiles("A", [attachment("sent")]); drafts.completeFile("A", "sent", "YWJj");
  const submitted = drafts.read("A");
  drafts.write("A", "Next draft"); drafts.beginFiles("A", [attachment("new")]);
  assert.equal(drafts.acknowledge("A", submitted.revision, ["sent"]), false);
  assert.equal(drafts.read("A").text, "Next draft");
  assert.deepEqual(drafts.read("A").attachments.map((file) => file.id), ["new"]);
  assert.equal(drafts.read("A").revision, submitted.revision + 1);
  assert.equal(submitted.attachments[0].id, "sent", "an in-flight snapshot remains immutable");
  const revision = drafts.read("A").revision;
  drafts.beginFiles("A", [attachment("later")]);
  assert.equal(drafts.read("A").revision, revision, "file operations do not alter text revision");
  assert.equal(drafts.acknowledge("A", revision, ["new"]), true);
  assert.equal(drafts.read("A").text, "");
  assert.deepEqual(drafts.read("A").attachments.map((file) => file.id), ["later"]);
});

test("file admission is atomic and text-only ACK does not remove unsent or failed attachments", () => {
  const drafts = createSessionDraftStore();
  drafts.write("A", "Text"); drafts.beginFiles("A", [attachment("first")]);
  assert.throws(() => drafts.beginFiles("A", [attachment("second"), attachment("first")]));
  assert.deepEqual(drafts.read("A").attachments.map((file) => file.id), ["first"]);
  assert.equal(drafts.failFile("A", "first", "Cannot read"), true);
  assert.equal(drafts.read("A").attachments[0].error, "Cannot read");
  assert.equal(drafts.completeFile("A", "first", "YWJj"), false);
  assert.equal(drafts.acknowledge("A", drafts.read("A").revision), true);
  assert.equal(drafts.read("A").attachments[0].status, "error");
});
