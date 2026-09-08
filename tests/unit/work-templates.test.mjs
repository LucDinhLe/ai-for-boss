import assert from "node:assert/strict";
import test from "node:test";
import { WORK_TEMPLATES, appendToDraft } from "../../apps/desktop/src/work-templates.ts";

test("work starters append without erasing even an unfinished draft or dispatching work", () => {
  assert.equal(WORK_TEMPLATES.length, 3);
  for (const template of WORK_TEMPLATES) {
    assert.ok(template.text.includes("["), "templates ask the user to provide their own facts");
    assert.equal(appendToDraft("Nháp đang viết", template.text), `Nháp đang viết\n\n${template.text}`);
    assert.equal(appendToDraft("", template.text), template.text);
  }
});
