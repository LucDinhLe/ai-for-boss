import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { createSetupPageAccess, isAllowedSetupPage } from "../../apps/desktop/electron/setup-page-access.mjs";
import { isTrustedRendererEvent } from "../../apps/desktop/electron/security-policy.mjs";

const start = "openclaw.setup.auth.start";
const page = "https://login.example.test/authorize?code=synthetic%2Fvalue";
const reply = (sessionId = "session-1", externalUrl = page) => ({ sessionId, status: "running", step: { externalUrl } });
function fixture(options = {}) {
  const opened = [];
  const access = createSetupPageAccess({ canOpen: () => true, openExternal: async url => { opened.push(url); }, ...options });
  return { access, opened, grant(id = "session-1", url = page) { access.begin(start, { sessionId: id }).complete(reply(id, url)); } };
}

test("setup pages permit HTTPS and HTTP loopback only, without embedded credentials", () => {
  for (const url of [page, "https://example.test:444/", "http://localhost:3456/callback", "http://127.0.0.1/", "http://[::1]:2345/"])
    assert.equal(isAllowedSetupPage(url), true, url);
  for (const url of [undefined, null, {}, "", "not a url", "javascript:alert(1)", "file:///tmp/secret", "ftp://example.test/",
    "http://example.test/", "http://127.0.0.1.example.test/", "http://[::2]/", "https://user:pass@example.test/",
    "http://user@localhost/", "https://example.test/" + "x".repeat(8192), "https://example.test/\ud800"])
    assert.equal(isAllowedSetupPage(url), false, String(url));
});

test("only a successful native start grants an exact URL, and opening requires a separate click", async () => {
  const { access, opened } = fixture();
  access.begin("wizard.status", { sessionId: "forged" }).complete(reply("forged"));
  access.begin("models.authStatus", { sessionId: "forged" }).complete(reply("forged"));
  assert.equal(await access.openPage("forged"), false);
  const pending = access.begin(start, { sessionId: "session-1" });
  assert.equal(await access.openPage("session-1"), false);
  pending.complete(reply());
  assert.deepEqual(opened, [], "native response never opens a browser by itself");
  for (const id of [page, "other-session", {}, undefined, "", "invalid/id"])
    assert.equal(await access.openPage(id), false);
  assert.equal(await access.openPage("session-1"), true);
  assert.deepEqual(opened, [page], "native URL is kept byte for byte rather than reconstructed");
});

test("unscoped, failed and terminal replies cannot retain a page grant", async () => {
  for (const result of [null, [], {}, { sessionId: "different" }, { done: true }, { error: "synthetic" },
    ...["done", "completed", "error", "failed", "cancelled", "canceled"].map(status => ({ status })), reply("session-1", "file:///tmp/no")]) {
    const { access, grant } = fixture();
    grant();
    access.begin("wizard.next", { sessionId: "session-1" }).complete(result);
    assert.equal(await access.openPage("session-1"), false);
  }
  for (const operation of ["cancel", "failure", "disconnect"]) {
    const { access, grant } = fixture();
    grant();
    if (operation === "cancel") access.begin("wizard.cancel", { sessionId: "session-1" });
    if (operation === "failure") access.begin("wizard.status", { sessionId: "session-1" }).fail();
    if (operation === "disconnect") access.clear();
    assert.equal(await access.openPage("session-1"), false);
  }
});

test("next without an answer replaces the pending step while status cannot invent or erase a URL", async () => {
  const { access, grant, opened } = fixture();
  grant();
  access.begin("wizard.status", { sessionId: "session-1" }).complete({ status: "running" });
  assert.equal(await access.openPage("session-1"), true);
  const pending = access.begin("wizard.next", { sessionId: "session-1" });
  assert.equal(await access.openPage("session-1"), false);
  const nextPage = "http://127.0.0.1:43210/login";
  pending.complete(reply("session-1", nextPage));
  assert.equal(await access.openPage("session-1"), true);
  assert.deepEqual(opened, [page, nextPage]);
});

test("late replies cannot restore a cancelled, superseded or cleared session", async () => {
  for (const transition of ["cancel", "next", "clear", "restart-session"]) {
    const { access, grant } = fixture();
    grant();
    const stale = access.begin("wizard.next", { sessionId: "session-1" });
    if (transition === "cancel") access.begin("wizard.cancel", { sessionId: "session-1" });
    if (transition === "next") access.begin("wizard.next", { sessionId: "session-1" }).complete({ step: { title: "No page" } });
    if (transition === "clear") access.clear();
    if (transition === "restart-session") access.begin(start, { sessionId: "session-1" });
    stale.complete(reply());
    assert.equal(await access.openPage("session-1"), false);
  }
});

test("active sessions are bounded and expire without native replies reviving them", async () => {
  let clock = 0;
  const { access, grant } = fixture({ now: () => clock, ttlMs: 100, maxSessions: 2 });
  grant("one"); grant("two"); grant("three");
  assert.equal(await access.openPage("one"), false);
  assert.equal(await access.openPage("two"), true);
  const pending = access.begin("wizard.next", { sessionId: "three" });
  clock = 100;
  pending.complete(reply("three"));
  assert.equal(await access.openPage("two"), false);
  assert.equal(await access.openPage("three"), false);
});

test("concurrent clicks coalesce and permission is checked again immediately before opening", async () => {
  let enabled = true;
  const { access, grant, opened } = fixture({ canOpen: () => enabled });
  grant();
  const first = access.openPage("session-1");
  assert.equal(access.openPage("session-1"), first);
  assert.equal(await first, true);
  assert.equal(opened.length, 1);
  const second = access.openPage("session-1");
  enabled = false;
  assert.equal(await second, false);
  assert.equal(await access.openPage("session-1"), false);
  assert.equal(opened.length, 1);
  enabled = true;
  const cancelled = access.openPage("session-1");
  access.begin("wizard.cancel", { sessionId: "session-1" });
  assert.equal(await cancelled, false);
  assert.equal(opened.length, 1);
});

test("an opener failure returns false without exposing native error contents", async () => {
  const { access, grant } = fixture({ openExternal: async () => { throw new Error("PRIVATE_NATIVE_MESSAGE"); } });
  grant();
  assert.equal(await access.openPage("session-1"), false);
});

test("actual page IPC handler rejects foreign frames, arbitrary arguments, smoke and shutdown", async () => {
  const source = fs.readFileSync(new URL("../../apps/desktop/electron/main.mjs", import.meta.url), "utf8");
  const match = source.match(/ipcMain\.handle\(SETUP_OPEN_PAGE_CHANNEL, ([\s\S]*?)\n\}\);/u);
  assert.ok(match);
  const mainFrame = {};
  const mainContents = { mainFrame };
  const mainWindow = { isDestroyed: () => false, webContents: mainContents };
  const event = { sender: mainContents, senderFrame: mainFrame };
  const { access, grant, opened } = fixture();
  grant();
  const context = { mainWindow, isTrustedRendererEvent, smoke: false, shuttingDown: false, setupPageAccess: access };
  const handler = vm.runInNewContext(`(${match[1]}\n})`, context);
  for (const foreign of [{}, { ...event, sender: {} }, { ...event, senderFrame: {} }])
    assert.throws(() => handler(foreign, "session-1"), /Untrusted/u);
  for (const args of [[], [{}], [undefined], [null], ["session-1", page], [page], ["unknown"]])
    assert.equal(await handler(event, ...args), false);
  context.smoke = true;
  assert.equal(await handler(event, "session-1"), false);
  context.smoke = false; context.shuttingDown = true;
  assert.equal(await handler(event, "session-1"), false);
  assert.deepEqual(opened, []);
  context.shuttingDown = false;
  assert.equal(await handler(event, "session-1"), true);
  assert.deepEqual(opened, [page]);
});

test("preload exposes only session selection and never opens a page automatically", async () => {
  const source = fs.readFileSync(new URL("../../apps/desktop/electron/preload.cjs", import.meta.url), "utf8");
  const calls = [];
  let exposed;
  vm.runInNewContext(source, { require: name => {
    assert.equal(name, "electron");
    return { contextBridge: { exposeInMainWorld: (_name, api) => { exposed = api; } },
      ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve(true); } } };
  } });
  assert.deepEqual(calls, []);
  assert.equal(await exposed.setup.openPage("session-1", page), true);
  assert.deepEqual(calls, [["aifb:setup-open-page", "session-1"]]);
});
