import assert from "node:assert/strict";
import test from "node:test";
import { listProjects, readUsage, readSkills, readChannels, readCronPage, readCronStatus, readCronRuns,
  listSessionFiles, getSessionFile, projectFilePreview } from "../../apps/desktop/src/workbench-api.ts";

const sessionKey = "agent:fixture:session-a";
function bridge(t, implementation) {
  const previous = globalThis.window;
  const calls = [];
  globalThis.window = { aiForBoss: { gateway: { request: async (method, params) => {
    calls.push({ method, params }); return implementation(method, params);
  } } } };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  return calls;
}
const listingResult = () => ({ sessionKey, root: "C:/private/workspace", files: [{ path: "result.txt", name: "result.txt", kind: "modified", missing: false }],
  browser: { path: "", entries: [{ path: "result.txt", name: "result.txt", kind: "file", sessionKind: "modified", size: 9 },
    { path: "nested", name: "nested", kind: "directory" }, { path: "link", name: "link", kind: "symlink" }], truncated: true } });

test("projects project only display identity and never expose checkout or profile paths", async t => {
  const calls = bridge(t, () => ({ projects: [{ id: "p1", displayName: "Work", source: "workspace", agentId: "fixture", repoRoot: "private", originUrl: "credential" }] }));
  assert.deepEqual(await listProjects(), [{ id: "p1", displayName: "Work", source: "workspace", agentId: "fixture" }]);
  assert.deepEqual(calls, [{ method: "projects.list", params: {} }]);
});

test("usage requests only local session usage with bounded history and preserves unknown pricing", async t => {
  const calls = bridge(t, () => ({ sessions: [{ key: "s" }], startDate: "2026-09-01", endDate: "2026-09-07", totals: {
    totalTokens: 120, input: 90, output: 30, cacheRead: 60, cacheWrite: 0, totalCost: 0, missingCostEntries: 1 }, cacheStatus: { status: "partial" } }));
  const result = await readUsage(sessionKey);
  assert.equal(result.totalTokens, 120); assert.equal(result.missingCostEntries, 1); assert.equal(result.cacheStatus, "partial");
  assert.equal(result.cacheRead, 60); assert.equal(result.cacheWrite, 0);
  assert.deepEqual(calls, [{ method: "sessions.usage", params: { agentId: "fixture", range: "7d", mode: "specific",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, limit: 100, includeContextWeight: false } }]);
});

test("invalid and missing native numbers remain unknown instead of false zeroes", async t => {
  bridge(t, () => ({ sessions: [], totals: { totalTokens: "100", totalCost: NaN, input: -1 }, cacheStatus: {} }));
  const result = await readUsage(null);
  for (const field of ["totalTokens", "totalCost", "input", "output", "cacheRead", "cacheWrite", "missingCostEntries"]) assert.equal(result[field], null);
});

test("skill eligibility respects exclusions and projects no install commands or environment values", async t => {
  const calls = bridge(t, () => ({ skills: [{ skillKey: "a", name: "Skill", description: "Text", eligible: true,
    blockedByAgentFilter: true, missing: { bins: ["tool"], env: ["TOKEN_NAME"] }, primaryEnv: "SECRET", filePath: "private", install: [{ command: "execute" }] }] }));
  assert.deepEqual(await readSkills(sessionKey), [{ id: "a", name: "Skill", description: "Text", eligible: false, disabled: false, blocked: true, source: "", missing: ["tool", "TOKEN_NAME"] }]);
  assert.deepEqual(calls[0], { method: "skills.status", params: { agentId: "fixture", sessionKey } });
});

test("channel status explicitly disables live probes and handles partial account snapshots", async t => {
  const calls = bridge(t, () => ({ channelOrder: ["chat"], channelLabels: { chat: "Chat" }, channels: {}, partial: true,
    channelAccounts: { chat: [{ accountId: "a", configured: true, connected: false, token: "secret" }] } }));
  const result = await readChannels();
  assert.deepEqual(calls, [{ method: "channels.status", params: { probe: false } }]);
  assert.equal(result.partial, true); assert.equal(result.channels[0].status, "Đã thiết lập");
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("cron consumes flat compact fields and validated native next page", async t => {
  const calls = bridge(t, () => ({ jobs: [{ id: "j", name: "Daily", enabled: true, scheduleKind: "cron", nextRunAtMs: 100,
    lastRunAtMs: 50, lastRunStatus: "ok", lastRunError: null, payload: { script: "private" } }], total: 70, hasMore: true, nextOffset: 50 }));
  const page = await readCronPage(sessionKey);
  assert.equal(page.jobs[0].nextRunAtMs, 100); assert.equal(page.jobs[0].lastRunStatus, "ok");
  assert.equal(page.nextOffset, 50); assert.equal("payload" in page.jobs[0], false);
  assert.deepEqual(calls[0], { method: "cron.list", params: { agentId: "fixture", includeDisabled: true, limit: 50, offset: 0, compact: true, includeDeliveryPreviews: false } });
  await assert.rejects(readCronPage(null, -1), /Trang lịch/); assert.equal(calls.length, 1);
});

test("bad cron pagination stays visibly incomplete without looping or guessing offsets", async t => {
  bridge(t, () => ({ jobs: [], hasMore: true, nextOffset: 50 }));
  assert.deepEqual(await readCronPage(null, 50), { jobs: [], total: null, hasMore: true, nextOffset: null });
});

test("cron status and history exclude store paths and never run a task", async t => {
  const calls = bridge(t, method => method === "cron.status" ? { enabled: false, jobs: 1, storePath: "private" }
    : { entries: [{ runId: "r", ts: 50, status: "error", error: "Stopped", summary: "Result", durationMs: 5 }], hasMore: true });
  assert.deepEqual(await readCronStatus(), { enabled: false, jobs: 1 });
  assert.equal((await readCronRuns("j", sessionKey)).hasMore, true);
  assert.deepEqual(calls.map(call => call.method), ["cron.status", "cron.runs"]);
  assert.deepEqual(calls[1].params, { agentId: "fixture", scope: "job", id: "j", limit: 20, offset: 0 });
});

test("file listing preserves truncation and bounded paths but drops absolute root and inline content", async t => {
  const calls = bridge(t, () => listingResult());
  const listing = await listSessionFiles(sessionKey);
  assert.equal(listing.truncated, true); assert.equal(listing.entries[0].modified, true);
  assert.equal(listing.files[0].modified, true); assert.equal("root" in listing, false);
  assert.deepEqual(calls[0], { method: "sessions.files.list", params: { sessionKey, path: "" } });
  for (const path of ["../outside", "nested/../../x", "C:/outside", "\\host\\share", "/absolute", "x\u0000"]) await assert.rejects(listSessionFiles(sessionKey, path), /Thư mục/);
  assert.equal(calls.length, 1);
});

test("file reads require a listed file of the exact session and reject wrong-session responses", async t => {
  const calls = bridge(t, method => method === "sessions.files.list" ? listingResult()
    : { sessionKey, file: { path: "result.txt", name: "result.txt", content: "<script>inert</script>", contentEncoding: "utf8", previewKind: "text" } });
  const listing = await listSessionFiles(sessionKey);
  const preview = await getSessionFile(listing, listing.entries[0]);
  assert.equal(preview.content, "<script>inert</script>"); assert.equal(preview.imageUrl, null);
  for (const entry of [listing.entries[1], listing.entries[2], { ...listing.entries[0], path: "private" }]) await assert.rejects(getSessionFile(listing, entry), /Hãy chọn/);
  assert.equal(calls.length, 2); assert.deepEqual(calls[1].params, { sessionKey, path: "result.txt" });
});

test("cross-session listings and substituted file responses fail closed", async t => {
  let response = { ...listingResult(), sessionKey: "other" };
  bridge(t, () => response);
  await assert.rejects(listSessionFiles(sessionKey), /không thuộc phiên/);
  response = listingResult(); const listing = await listSessionFiles(sessionKey);
  response = { sessionKey: "other", file: { path: "result.txt" } };
  await assert.rejects(getSessionFile(listing, listing.entries[0]), /không thuộc phiên/);
  response = { sessionKey, file: { path: "elsewhere" } };
  await assert.rejects(getSessionFile(listing, listing.entries[0]), /không khớp/);
});

test("preview allows only bounded inline raster images; SVG, external URLs and malformed base64 stay inert", () => {
  const image = { name: "image.png", previewKind: "image", contentEncoding: "base64", mimeType: "image/png", content: "iVBORw0KGgo=" };
  assert.equal(projectFilePreview(image).imageUrl, "data:image/png;base64,iVBORw0KGgo=");
  for (const mimeType of ["image/svg+xml", "text/html", "application/javascript"]) {
    assert.deepEqual(projectFilePreview({ ...image, mimeType }), { name: "image.png", kind: "unsupported", content: "", imageUrl: null });
  }
  for (const content of ["https://example.com/a.png", "data:image/png;base64,AA==", "a===", "", "AA=A"]) assert.throws(() => projectFilePreview({ ...image, content }), /hợp lệ/);
  assert.throws(() => projectFilePreview({ ...image, content: Buffer.alloc(262145).toString("base64") }), /giới hạn|hợp lệ/);
});

test("text preview counts UTF-8 bytes, preserves inert text, and refuses missing files", () => {
  const text = { name: "test.html", previewKind: "text", contentEncoding: "utf8", content: "<img onerror=alert(1)>" };
  assert.equal(projectFilePreview(text).content, text.content);
  assert.throws(() => projectFilePreview({ ...text, content: "đ".repeat(131073) }), /giới hạn/);
  assert.throws(() => projectFilePreview({ ...text, missing: true }), /không còn/);
});

test("missing bridge, malformed lists and native rejection remain errors, not empty success", async t => {
  const previous = globalThis.window; delete globalThis.window;
  await assert.rejects(listProjects(), /Chưa kết nối/); globalThis.window = previous;
  bridge(t, () => ({})); await assert.rejects(listProjects(), /định dạng/);
  globalThis.window.aiForBoss.gateway.request = async () => { throw new Error("Denied"); };
  await assert.rejects(readSkills(null), /Denied/);
});
