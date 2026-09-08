import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { TextEncoder } from "node:util";
import ts from "typescript";
import * as chat from "../../apps/desktop/src/chat-state.ts";
import * as draftHelpers from "../../apps/desktop/src/chat-drafts.ts";
import * as gateway from "../../apps/desktop/src/gateway-client.ts";
import * as workTemplates from "../../apps/desktop/src/work-templates.ts";
import * as attachmentHelpers from "../../apps/desktop/src/chat-attachments.ts";
import * as thinkingHelpers from "../../apps/desktop/src/session-thinking.ts";
import { DEFAULT_LAYOUT } from '../../apps/desktop/src/layout-preferences.ts';
import { fixtureDocx } from '../../scripts/fixture-documents.mjs';

// Execute the real App handlers and effects with a small React hook dispatcher.
// Gateway requests are synthetic; no socket, profile, provider or Electron starts.
const source = fs.readFileSync(new URL("../../apps/desktop/src/App.tsx", import.meta.url), "utf8");
const body = source.slice(source.indexOf("function App()"), source.indexOf("  if (showConnect)"));
const javascript = ts.transpileModule(`${body}
  return { activeKey, messages, usage, run, busy, draft, showConnect, models, historyReady, historyError, canSubmit, modelsLoading, modelCatalogueState,
    send, abort, openSession, createSession, setDraft, appendDraft, loadHistory, reloadHistory, refreshModels, browseModels, catalogueLoading, catalogueError,
    advisorModels, browseAdvisorModels, refreshAdvisorModels, advisorCatalogueLoading, advisorCatalogueError,
    changeModel, changeThinking, changingModel, thinking, composerThinking, addFiles, removeFile, attachments, notice,
    sessions, projects, sessionProjects, refreshProjects, refreshSessions, pinSession, closeTab, openKeys,
    requestDeleteSession, cancelDeleteSession, confirmDeleteSession, deleteConfirmation, deleting,
    opening, workspaceView, navigateWorkspace, openThinking, dockTab, rightHidden, supervisionChoices, setSupervisionChoices, supervision, supervisionBusy };
}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const row = (text) => ({ role: "user", content: text, __openclaw: { id: text } });

const fixtureModel = { id: "fixture", provider: "fixture", name: "Fixture", available: true };
const secondModel = { id: "second", provider: "another", name: "Second fixture", available: true };
const selectedFile = (name = "brief.txt", content = "abc", reader) => {
  const bytes = new TextEncoder().encode(content);
  return { name, size: bytes.length, type: "text/plain", arrayBuffer: reader ?? (async () => bytes.buffer) };
};
const selectedWord = () => {
  const bytes = fixtureDocx('Mục tiêu tuần');
  return { name: 'Kế hoạch.docx', size: bytes.length, type: attachmentHelpers.DOCX_MIME,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
};
function harness({ models = [fixtureModel], setupReady = true, projects = [], listProjects = async () => projects, startInChat = false } = {}) {
  const requests = [], handlers = {}, hooks = [], effects = [], listeners = new Set(), focusEvents = [];
  let cursor = 0, effectCursor = 0, dirty = false, view, nextId = 0;
  let runtime = { connected: true, setupReady, supervisor: "ready", detail: null,
    attachmentPolicy: { maxBytes: 20 * 1024 * 1024, maxImageBytes: 6 * 1024 * 1024, maxPayload: 25 * 1024 * 1024 } };
  const defaults = { "sessions.subscribe": { list: { sessions: [] } }, "sessions.list": { sessions: [] },
    "models.list": { models }, "chat.history": { messages: [], sessionInfo: { hasActiveRun: false } } };
  const memo = (make, deps) => {
    const index = cursor++, previous = hooks[index];
    if (!previous || deps.some((value, i) => value !== previous.deps[i])) hooks[index] = { deps, value: make() };
    return hooks[index].value;
  };
  const context = vm.createContext({ ...chat, ...draftHelpers, ...gateway, ...workTemplates, ...attachmentHelpers, ...thinkingHelpers, TextEncoder,
    loadLayout: () => ({ ...DEFAULT_LAYOUT }), saveLayout: () => {},
    manage: async packet => {
      if (handlers[packet.action]) { requests.push({ method: packet.action, params: packet }); return handlers[packet.action](packet); }
      if (packet.action === 'model-catalogue') throw new Error('Full catalogue is not configured in this lifecycle fixture');
      return { projects: [], sessions: {} };
    },
    listProjects: async () => { requests.push({ method: "projects.list", params: {} }); return listProjects(); },
    setInterval: () => 0, clearInterval: () => {},
    supervisionRequest: async packet => { requests.push({method:packet.action,params:packet}); return handlers[packet.action] ? handlers[packet.action](packet) : null; },
    document: { documentElement: { dataset: {} }, getElementById: (id) => {

      if (id === "composer-input" && (view?.workspaceView !== "chat")) return null;
      return { focus() { focusEvents.push({ id, workspaceView: view?.workspaceView }); } };
    } },
    SUPERVISOR_LABELS: {}, SUPERVISOR_DETAILS: {}, crypto: { randomUUID: () => `run-${++nextId}` },
    window: { aiForBoss: { getShellStatus: async () => null } },
    useRuntime: () => runtime,
    useState: (initial) => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], (value) => {
        const next = typeof value === "function" ? value(hooks[index]) : value;
        if (next !== hooks[index]) { hooks[index] = next; dirty = true; }
      }];
    },
    useRef: (initial) => { const index = cursor++; return hooks[index] ??= { current: initial }; },
    useCallback: (callback, deps) => memo(() => callback, deps),
    useMemo: memo,
    useEffect: (effect, deps) => {
      const index = effectCursor++, previous = effects[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        previous?.cleanup?.(); effects[index] = { deps, pending: effect };
      }
    },
    onGatewayEvent: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    call: async (method, params) => {
      requests.push({ method, params });
      const result = await (handlers[method] ? handlers[method](params) : defaults[method] ?? {});
      // Older lifecycle fixtures omit model fields; supply native selected truth.
      // Explicit nulls in model regressions remain unknown instead of inheriting it.
      return method === "chat.history" ? { ...result,
        sessionInfo: { model: "fixture", modelProvider: "fixture", ...result.sessionInfo } } : result;
    }
  });
  vm.runInContext(javascript, context);
  const render = () => {
    cursor = 0; effectCursor = 0; dirty = false; view = context.App();
    for (const effect of effects) if (effect.pending) {
      const pending = effect.pending; effect.pending = null; effect.cleanup = pending();
    }
  };
  const flush = async () => { for (let i = 0; i < 15; i++) { await Promise.resolve(); if (dirty) render(); } };
  render();
  // Lifecycle regressions start in Settings, then explicitly choose a session.
  // Startup tests below exercise the real default chat landing and auto-open.
  if (!startInChat) view.navigateWorkspace('settings');
  return { requests, handlers, focusEvents, flush, get view() { return view; },
    runtime: async (patch) => { runtime = { ...runtime, ...patch }; render(); await flush(); },
    event: async (payload, event = "chat") => { for (const listener of listeners) listener({ event, payload }); await flush(); },
    edit: async (text) => { view.setDraft(text); await flush(); },
    open: async (key) => { view.openSession(key); await flush(); }
  };
}

test('full model discovery preserves chat readiness and drafts; malformed and stale results cannot replace native selection state', async () => {
  const h = harness(); await h.flush(); await h.open('one'); await h.edit('keep draft');
  const waiting = deferred(); h.handlers['model-catalogue'] = () => waiting.promise;
  const request = h.view.browseModels(true); await h.flush();
  assert.equal(h.view.catalogueLoading, true); assert.equal(h.view.canSubmit, true);
  waiting.resolve({ models: [fixtureModel, { ...secondModel, selectable: false, selectionReason: 'not-offered' }] });
  await request; await h.flush();
  assert.equal(h.view.models.length, 2); assert.equal(h.view.draft, 'keep draft');
  const patches = h.requests.filter(row => row.method === 'sessions.patch').length;
  await h.view.changeModel(secondModel); await h.flush();
  assert.equal(h.requests.filter(row => row.method === 'sessions.patch').length, patches, 'browse-only model cannot be selected');
  h.handlers['model-catalogue'] = () => ({});
  await h.view.browseModels(true); await h.flush();
  assert.equal(h.view.models.length, 2); assert.ok(h.view.catalogueError); assert.equal(h.view.canSubmit, true);
  const stale = deferred(); h.handlers['model-catalogue'] = () => stale.promise;
  const old = h.view.browseModels(true); await h.flush();
  await h.runtime({ connected: false, setupReady: false });
  stale.resolve({ models: [secondModel] }); await old; await h.flush();
  assert.notEqual(h.view.models[0]?.id, secondModel.id, 'old connection result is discarded');
  assert.equal(h.view.draft, 'keep draft');
});

test('worker and default Advisor catalogues retain distinct native permissions across agent changes', async () => {
  const h = harness();
  const worker = [{ ...fixtureModel, selectable: true }, { ...secondModel, selectable: false, selectionReason: 'not-offered' }];
  const advisor = [{ ...fixtureModel, selectable: false, selectionReason: 'not-offered' }, { ...secondModel, selectable: true }];
  h.handlers['models.list'] = params => ({ models: params?.agentId ? [fixtureModel] : [secondModel] });
  h.handlers['model-catalogue'] = params => ({ models: params.agentId ? worker : advisor });
  await h.flush(); await h.open('agent:research:chat'); await h.flush(); await h.edit('Keep agent draft');
  assert.equal(h.view.models.find(model => model.id === 'second').selectable, false);
  assert.equal(h.view.advisorModels.find(model => model.id === 'second').selectable, true);
  assert.equal(h.view.advisorModels.find(model => model.id === 'fixture').selectable, false);
  const calls = h.requests.length;
  await h.view.browseAdvisorModels(true); await h.flush();
  const request = h.requests.slice(calls).find(row => row.method === 'model-catalogue');
  assert.equal(Object.hasOwn(request.params, 'agentId'), false, 'Advisor always asks native default scope');
  assert.equal(h.view.draft, 'Keep agent draft');
  await h.open('agent:other:chat'); await h.flush();
  assert.equal(h.view.advisorModels.find(model => model.id === 'second').selectable, true);
  assert.equal(h.requests.some(row => row.method === 'sessions.send' || row.method === 'supervise'), false);
});

test('Advisor catalogue refresh failure preserves only default rows; reconnect discards delayed old auth results', async () => {
  const h = harness(); await h.flush(); await h.open('one'); await h.edit('Unsent');
  h.handlers['model-catalogue'] = () => ({ models: [secondModel] });
  await h.view.browseAdvisorModels(true); await h.flush();
  h.handlers['model-catalogue'] = () => ({});
  await h.view.browseAdvisorModels(true); await h.flush();
  assert.equal(h.view.advisorModels[0].id, 'second'); assert.ok(h.view.advisorCatalogueError);
  assert.equal(h.view.models[0].id, 'fixture'); assert.equal(h.view.canSubmit, true);
  const waiting = deferred(); h.handlers['model-catalogue'] = () => waiting.promise;
  const old = h.view.browseAdvisorModels(true); await h.flush();
  assert.equal(h.view.advisorCatalogueLoading, true);
  await h.runtime({ connected: false, setupReady: false });
  waiting.resolve({ models: [secondModel] }); await old; await h.flush();
  assert.equal(h.view.advisorModels.length, 0); assert.equal(h.view.advisorCatalogueLoading, false);
  assert.equal(h.view.draft, 'Unsent');
});

test('finishing a provider connection supersedes pending Advisor discovery without using prior auth rows', async () => {
  const h = harness(); await h.flush();
  const old = deferred(); h.handlers['model-catalogue'] = () => old.promise;
  const pending = h.view.browseAdvisorModels(true); await h.flush();
  h.handlers['models.list'] = () => ({ models: [secondModel] });
  h.handlers['model-catalogue'] = () => ({ models: [secondModel] });
  await h.view.refreshAdvisorModels(); await h.flush();
  old.resolve({ models: [fixtureModel] }); await pending; await h.flush();
  assert.deepEqual(h.view.advisorModels.map(model => model.id), ['second']);
  assert.equal(h.view.advisorCatalogueLoading, false);
});

test('conversation confirmation fences navigation/send, cancel ignores late preview, delete removes only acknowledged target and draft', async () => {
  const h = harness(); await h.flush();
  let roster = [{ key: 'one', label: 'One' }, { key: 'two', label: 'Two' }];
  h.handlers['sessions.list'] = () => ({ sessions: roster }); await h.view.refreshSessions(); await h.flush();
  await h.open('two'); await h.edit('keep this draft'); await h.open('one'); await h.edit('delete this draft');
  const late = deferred(); h.handlers['conversation-inspect'] = () => late.promise;
  const pending = h.view.requestDeleteSession('one'); await h.flush();
  await h.open('two'); assert.equal(h.view.activeKey, 'one');
  await h.view.send({ preventDefault() {} }); assert.equal(h.requests.some(r => r.method === 'sessions.send'), false);
  h.view.cancelDeleteSession(); late.resolve({ key: 'one', title: 'One', ticket: 'late' }); await pending; await h.flush();
  assert.equal(h.view.deleteConfirmation, null);
  h.handlers['conversation-inspect'] = () => ({ key: 'one', title: 'One', ticket: 'fresh' });
  await h.view.requestDeleteSession('one'); await h.flush();
  const ack = deferred(); h.handlers['conversation-delete'] = () => ack.promise;
  const deleting = h.view.confirmDeleteSession(); await h.flush();
  await h.view.confirmDeleteSession(); await h.flush(); assert.equal(h.requests.filter(r => r.method === 'conversation-delete').length, 1);
  assert.equal(h.view.sessions.length, 2); assert.equal(h.view.draft, 'delete this draft');
  roster = roster.filter(row => row.key !== 'one'); ack.resolve({ ok: true, key: 'one' }); await deleting; await h.flush();
  assert.equal(h.view.activeKey, 'two'); assert.equal(h.view.draft, 'keep this draft');
  assert.deepEqual([...h.view.openKeys], ['two']); assert.equal(h.view.deleteConfirmation, null);
  await h.open('one'); assert.equal(h.view.draft, '');
});

test('failed deletion keeps tab/history/draft and cannot silently retry a consumed receipt', async () => {
  const h = harness(); await h.flush(); h.handlers['sessions.list'] = () => ({ sessions: [{ key: 'one' }] });
  await h.view.refreshSessions(); await h.flush(); await h.open('one'); await h.edit('kept');
  h.handlers['conversation-inspect'] = () => ({ key: 'one', title: 'One', ticket: 'failure' });
  await h.view.requestDeleteSession('one'); await h.flush();
  h.handlers['conversation-delete'] = () => { throw new Error('lost response'); };
  await h.view.confirmDeleteSession(); await h.flush();
  assert.equal(h.view.activeKey, 'one'); assert.equal(h.view.draft, 'kept');
  assert.equal(h.view.deleteConfirmation.ticket, undefined); assert.match(h.view.deleteConfirmation.error, /lost response/);
  await h.view.confirmDeleteSession(); assert.equal(h.requests.filter(r => r.method === 'conversation-delete').length, 1);
});

test('roster burst coalesces full scans, discards stale pages and never has two list requests in flight', async () => {
  const h = harness(); await h.flush(); const delayed = deferred(); let reads = 0;
  h.handlers['sessions.list'] = () => ++reads === 1 ? delayed.promise : { sessions: [{ key: 'fresh' }] };
  const first = h.view.refreshSessions();
  for (let i = 0; i < 20; i++) void h.view.refreshSessions();
  assert.equal(reads, 1);
  delayed.resolve({ sessions: Array.from({ length: 100 }, (_, i) => ({ key: 'stale-' + i })) });
  await first; await h.flush(); assert.equal(reads, 2);
  assert.deepEqual([...h.view.sessions.map(row => row.key)], ['fresh']);
});

test('startup opens exactly one session after both channels and model catalogue, without sending; reconnect and close-last never create more', async () => {
  const h = harness({ setupReady: false, startInChat: true });
  const created = deferred(); h.handlers['sessions.create'] = () => created.promise;
  await h.flush(); assert.equal(h.requests.some(r => r.method === 'sessions.create'), false);
  await h.runtime({ setupReady: true });
  assert.equal(h.requests.filter(r => r.method === 'sessions.create').length, 1);
  await h.view.createSession(); await h.flush();
  assert.equal(h.requests.filter(r => r.method === 'sessions.create').length, 1);
  created.resolve({ key: 'initial-native' }); await h.flush();
  assert.equal(h.view.activeKey, 'initial-native'); assert.equal(h.view.historyReady, true);
  await h.edit('Ready immediately'); assert.equal(h.view.canSubmit, true);
  assert.equal(h.requests.some(r => r.method === 'sessions.send'), false);
  await h.runtime({ connected: false }); await h.runtime({ connected: true });
  h.view.closeTab('initial-native'); await h.flush();
  assert.equal(h.view.activeKey, null);
  assert.equal(h.requests.filter(r => r.method === 'sessions.create').length, 1);
});

test('failed initial creation stays recoverable with no automatic retry loop or provider request', async () => {
  const h = harness({ startInChat: true });
  h.handlers['sessions.create'] = async () => { throw new Error('Initial session failed'); };
  await h.flush(); assert.equal(h.view.opening, false); assert.match(h.view.notice, /Initial session failed/);
  await h.runtime({ setupReady: false }); await h.runtime({ setupReady: true });
  assert.equal(h.requests.filter(r => r.method === 'sessions.create').length, 1);
  h.handlers['sessions.create'] = () => ({ key: 'retry-native' }); await h.view.createSession(); await h.flush();
  assert.equal(h.view.activeKey, 'retry-native'); assert.equal(h.requests.some(r => r.method === 'sessions.send'), false);
});

test("model patch immediately fences send/navigation and only fresh native history changes the displayed model", async () => {
  const h = harness({ models: [fixtureModel, secondModel] }), old = deferred(), patch = deferred(), history = deferred();
  await h.flush(); await h.open("session-a"); await h.edit("Keep my work");
  h.handlers["chat.history"] = () => old.promise;
  const staleRead = h.view.loadHistory("session-a");
  h.handlers["sessions.patch"] = () => patch.promise;
  h.handlers["chat.history"] = () => history.promise;
  const change = h.view.changeModel(secondModel);
  await h.view.send({ preventDefault() {} }); h.view.openSession("session-b"); await h.view.createSession(); await h.flush();
  assert.equal(h.view.activeKey, "session-a"); assert.equal(h.view.changingModel, true);
  assert.equal(h.view.canSubmit, false); assert.equal(h.view.usage.model, "fixture");
  assert.equal(h.requests.some(({ method }) => ["sessions.send", "sessions.create"].includes(method)), false);
  old.resolve({ messages: [row("stale")], sessionInfo: { model: "old" } }); await staleRead; await h.flush();
  assert.equal(h.view.usage.model, "fixture"); assert.equal(h.view.messages.length, 0);
  patch.resolve({ resolved: { model: "second", modelProvider: "another" } }); await h.flush();
  assert.equal(h.view.changingModel, true); assert.equal(h.view.canSubmit, false);
  history.resolve({ messages: [], sessionInfo: { model: "second", modelProvider: "another", hasActiveRun: false } });
  await change; await h.flush();
  assert.equal(h.view.usage.model, "second"); assert.equal(h.view.canSubmit, true); assert.equal(h.view.draft, "Keep my work");
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests.find(({ method }) => method === "sessions.patch").params)),
    { key: "session-a", model: "another/second" });
});

test("lost model ACK reconciles actual model and a failed history read keeps sending blocked", async () => {
  const h = harness({ models: [fixtureModel, secondModel] });
  await h.flush(); await h.open("session-a"); await h.edit("Retain this");
  h.handlers["sessions.patch"] = async () => { throw new Error("lost ACK"); };
  h.handlers["chat.history"] = () => ({ sessionInfo: { model: "second", modelProvider: "another", hasActiveRun: false } });
  await h.view.changeModel(secondModel); await h.flush();
  assert.equal(h.view.usage.model, "second"); assert.equal(h.view.canSubmit, true);
  h.handlers["chat.history"] = async () => { throw new Error("history offline"); };
  await h.view.changeModel(fixtureModel); await h.flush();
  assert.equal(h.view.changingModel, false); assert.equal(h.view.historyError, true);
  assert.equal(h.view.canSubmit, false); assert.equal(h.view.draft, "Retain this");
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.some(({ method }) => method === "sessions.send"), false);
});

test("file reads stay with the originating draft and removal cannot be reversed by a late read", async () => {
  const h = harness(), read = deferred(); await h.flush(); await h.open("session-a");
  h.view.addFiles([selectedFile("late.txt", "abc", () => read.promise)]); await h.flush();
  assert.equal(h.view.attachments[0].status, "reading"); assert.equal(h.view.canSubmit, false);
  await h.view.send({ preventDefault() {} }); await h.open("session-b");
  read.resolve(new TextEncoder().encode("abc").buffer); await h.flush();
  assert.equal(h.view.attachments.length, 0);
  await h.open("session-a"); assert.equal(h.view.attachments[0].status, "ready");
  const anotherRead = deferred();
  h.view.addFiles([selectedFile("removed.txt", "abc", () => anotherRead.promise)]); await h.flush();
  const removedId = h.view.attachments[1].id;
  h.view.removeFile(removedId); anotherRead.resolve(new TextEncoder().encode("abc").buffer); await h.flush();
  assert.equal(h.view.attachments.some(file => file.id === removedId), false);
  assert.equal(h.requests.some(({ method }) => method === "sessions.send"), false);
});

test('Word extraction stays pending, belongs to its draft and cannot resurrect a removed attachment', async () => {
  const h = harness(), reading = deferred(); await h.flush(); await h.open('session-a');
  h.handlers['document-read'] = () => reading.promise;
  h.view.addFiles([selectedWord()]); await h.flush();
  assert.equal(h.view.attachments[0].status, 'reading'); assert.equal(h.view.canSubmit, false);
  await h.view.send({ preventDefault() {} }); assert.equal(h.requests.some(r => r.method === 'sessions.send'), false);
  await h.open('session-b'); reading.resolve({ text: 'Ngân sách 127 triệu đồng' }); await h.flush();
  assert.equal(h.view.attachments.length, 0);
  await h.open('session-a'); assert.equal(h.view.attachments[0].extractedText, 'Ngân sách 127 triệu đồng');
  assert.equal(h.view.attachments[0].status, 'ready');
  const late = deferred(); h.handlers['document-read'] = () => late.promise;
  h.view.addFiles([selectedWord()]); await h.flush(); const id = h.view.attachments[1].id;
  h.view.removeFile(id); late.resolve({ text: 'Removed content' }); await h.flush();
  assert.equal(h.view.attachments.some(f => f.id === id), false);
});

for (const supervised of [false, true]) test(`Stop while saving project Word locally cancels ${supervised ? 'Advisor' : 'normal'} dispatch and fences late saves from a newer send/session`, async () => {
  const h = harness(), firstSave = deferred(), secondSave = deferred(); let saves = 0;
  h.handlers['project-list'] = () => ({ projects: [], sessions: { 'session-a': 'project-a' } });
  h.handlers['project-attachments'] = () => ++saves === 1 ? firstSave.promise : secondSave.promise;
  h.handlers['document-read'] = () => ({ text: 'Nội dung Word giữ trong nháp' });
  await h.flush(); await h.open('session-a'); await h.edit('Đánh giá kế hoạch');
  if (supervised) { h.view.setSupervisionChoices({ 'session-a': { enabled: true, model: fixtureModel } }); await h.flush(); }
  h.view.addFiles([selectedWord()]); await h.flush();
  const file = h.view.attachments[0];
  const first = h.view.send({ preventDefault() {} }); await h.flush();
  assert.equal(saves, 1); assert.equal(supervised ? h.view.supervisionBusy : h.view.busy, true);
  await h.view.abort(); await h.flush();
  assert.equal(supervised ? h.view.supervisionBusy : h.view.busy, false);
  assert.equal(h.view.draft, 'Đánh giá kế hoạch'); assert.equal(h.view.attachments[0].content, file.content);
  assert.equal(h.view.attachments[0].extractedText, file.extractedText);
  const second = h.view.send({ preventDefault() {} }); await h.flush(); assert.equal(saves, 2);
  firstSave.resolve({ saved: true }); await first; await h.flush();
  assert.equal(supervised ? h.view.supervisionBusy : h.view.busy, true, 'old save cannot release the new send lock');
  await h.view.abort(); await h.flush();
  await h.open('session-b'); await h.edit('Giữ phiên B');
  secondSave.resolve({ saved: true }); await second; await h.flush();
  assert.equal(h.view.activeKey, 'session-b'); assert.equal(h.view.draft, 'Giữ phiên B');
  assert.equal(h.view.attachments.length, 0);
  assert.equal(h.requests.some(r => ['sessions.send', 'supervise', 'chat.abort', 'supervision-cancel'].includes(r.method)), false,
    'pre-dispatch Stop is local; no nonexistent native run is cancelled and no cancelled request is submitted');
  await h.open('session-a');
  assert.equal(h.view.draft, 'Đánh giá kế hoạch'); assert.equal(h.view.attachments[0].content, file.content);
  assert.equal(h.view.attachments[0].status, 'ready'); assert.equal(h.view.canSubmit, true);
});

test('a project save rejecting after local Stop cannot replace cancellation with an error or clear the draft', async () => {
  const h = harness(), save = deferred();
  h.handlers['project-list'] = () => ({ projects: [], sessions: { 'session-a': 'project-a' } });
  h.handlers['project-attachments'] = () => save.promise;
  await h.flush(); await h.open('session-a'); await h.edit('Giữ bản nháp này');
  const pending = h.view.send({ preventDefault() {} }); await h.flush();
  await h.view.abort(); await h.flush();
  save.reject(new Error('Late project failure')); await pending; await h.flush();
  assert.equal(h.view.run.state, 'aborted'); assert.equal(h.view.notice, null);
  assert.equal(h.view.draft, 'Giữ bản nháp này'); assert.equal(h.view.canSubmit, true);
  assert.equal(h.requests.some(r => ['sessions.send', 'chat.abort'].includes(r.method)), false);
});

for (const retryWithAdvisor of [false, true]) for (const abortFails of [false, true]) test(`Stop on lost-ACK ${retryWithAdvisor ? 'Advisor' : 'normal'} retry cancels the previously dispatched id and ${abortFails ? 'retains uncertain ownership' : 'clears confirmed ownership'}`, async () => {
  const h = harness(), save = deferred(), abort = deferred();
  h.handlers['project-list'] = () => ({ projects: [], sessions: { 'session-a': 'project-a' } });
  h.handlers['project-attachments'] = () => ({ saved: true });
  h.handlers['sessions.send'] = async () => { throw new Error('Lost ACK'); };
  await h.flush(); await h.open('session-a'); await h.edit('Giữ yêu cầu chưa xác nhận');
  await h.view.send({ preventDefault() {} }); await h.flush();
  const firstId = h.requests.find(r => r.method === 'sessions.send').params.idempotencyKey;
  if (retryWithAdvisor) { h.view.setSupervisionChoices({ 'session-a': { enabled: true, model: fixtureModel } }); await h.flush(); }
  h.handlers['project-attachments'] = () => save.promise;
  h.handlers['chat.abort'] = () => abort.promise;
  const retry = h.view.send({ preventDefault() {} }); await h.flush();
  const stopping = h.view.abort(); await h.flush();
  const cancel = h.requests.find(r => r.method === 'chat.abort');
  assert.equal(cancel.params.sessionKey, 'session-a'); assert.equal(cancel.params.runId, firstId);
  save.resolve({ saved: true }); await retry; await h.flush();
  assert.equal(h.requests.filter(r => r.method === 'sessions.send').length, 1, 'Stop stays latched while abort acknowledgement is pending');
  if (abortFails) abort.reject(new Error('Abort ACK lost')); else abort.resolve({ ok: true });
  await stopping; await h.flush();
  assert.equal(h.view.draft, 'Giữ yêu cầu chưa xác nhận'); assert.equal(h.view.busy, abortFails);
  if (abortFails) { await h.view.loadHistory('session-a'); await h.flush(); }
  if (retryWithAdvisor) { h.view.setSupervisionChoices({}); await h.flush(); }
  h.handlers['project-attachments'] = () => ({ saved: true });
  h.handlers['sessions.send'] = params => ({ status: 'started', runId: params.idempotencyKey });
  await h.view.send({ preventDefault() {} }); await h.flush();
  const nextId = h.requests.filter(r => r.method === 'sessions.send').at(-1).params.idempotencyKey;
  if (abortFails) assert.equal(nextId, firstId, 'uncertain native ownership keeps the idempotency key');
  else assert.notEqual(nextId, firstId, 'confirmed abort permits a fresh deliberate send');
});

test('a prior project-save failure alone does not invent native ownership on retry Stop', async () => {
  const h = harness(), save = deferred();
  h.handlers['project-list'] = () => ({ projects: [], sessions: { 'session-a': 'project-a' } });
  h.handlers['project-attachments'] = async () => { throw new Error('Save failed before native dispatch'); };
  await h.flush(); await h.open('session-a'); await h.edit('Giữ yêu cầu');
  await h.view.send({ preventDefault() {} }); await h.flush();
  h.handlers['project-attachments'] = () => save.promise;
  const retry = h.view.send({ preventDefault() {} }); await h.flush();
  await h.view.abort(); save.resolve({ saved: true }); await retry; await h.flush();
  assert.equal(h.requests.some(r => ['sessions.send', 'chat.abort'].includes(r.method)), false);
  assert.equal(h.view.draft, 'Giữ yêu cầu'); assert.equal(h.view.busy, false);
});

test('Word extraction error retains the draft, shows an error chip and never dispatches model work', async () => {
  const h = harness(); await h.flush(); await h.open('session-a'); await h.edit('Đánh giá tài liệu này');
  h.handlers['document-read'] = async () => { throw new Error("Error invoking remote method 'aifb:native-management': Error: Tài liệu Word bị hỏng."); };
  h.view.addFiles([selectedWord()]); await h.flush();
  assert.equal(h.view.attachments[0].status, 'error'); assert.match(h.view.attachments[0].error, /Word bị hỏng/);
  assert.doesNotMatch(h.view.attachments[0].error, /aifb:native-management/);
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.some(r => r.method === 'sessions.send' || r.method === 'supervise'), false);
  assert.equal(h.view.draft, 'Đánh giá tài liệu này'); assert.equal(h.view.canSubmit, false);
});

for (const supervised of [false, true]) test(`Word ${supervised ? 'Advisor' : 'normal'} send stores original project bytes and submits readable text, clearing only after ACK`, async () => {
  const h = harness(), ack = deferred(), file = selectedWord(), text = 'Ngân sách\t127.350.000 đồng\nHạn\t30/09/2026';
  h.handlers['project-list'] = () => ({ projects: [], sessions: { 'session-a': 'project-a' } });
  h.handlers['project-attachments'] = () => ({ ok: true }); h.handlers['document-read'] = () => ({ text });
  await h.flush(); await h.open('session-a'); await h.edit('Đánh giá kế hoạch này');
  if (supervised) { h.view.setSupervisionChoices({ 'session-a': { enabled: true, model: fixtureModel } }); await h.flush(); }
  h.view.addFiles([file]); await h.flush(); assert.equal(h.view.canSubmit, true);
  h.handlers[supervised ? 'supervise' : 'sessions.send'] = () => ack.promise;
  const sending = h.view.send({ preventDefault() {} }); await h.flush();
  assert.equal(h.view.attachments.length, 1); assert.equal(h.view.draft, 'Đánh giá kế hoạch này');
  const original = h.requests.find(r => r.method === 'project-attachments').params.files[0];
  const sent = h.requests.find(r => r.method === (supervised ? 'supervise' : 'sessions.send')).params;
  assert.equal(original.fileName, file.name); assert.equal(original.mimeType, attachmentHelpers.DOCX_MIME);
  assert.deepEqual(Buffer.from(original.content, 'base64'), Buffer.from(await file.arrayBuffer()));
  assert.equal(sent.attachments[0].mimeType, 'text/plain'); assert.equal(sent.attachments[0].fileName, file.name + '.txt');
  assert.equal(Buffer.from(sent.attachments[0].content, 'base64').toString(), text);
  ack.resolve(supervised ? { accepted: true, busy: false, phase: 'completed', key: 'session-a', id: sent.id }
    : { status: 'started', runId: sent.idempotencyKey }); await sending; await h.flush();
  assert.equal(h.view.attachments.length, 0); assert.equal(h.view.draft, '');
});

test("file-only sends contain bytes with no host path and ACK clears only the sent files and original text", async () => {
  const h = harness(), ack = deferred(); await h.flush(); await h.open("session-a");
  h.view.addFiles([selectedFile()]); await h.flush(); assert.equal(h.view.canSubmit, true);
  h.handlers["sessions.send"] = () => ack.promise;
  const send = h.view.send({ preventDefault() {} }); await h.flush();
  const request = h.requests.find(({ method }) => method === "sessions.send");
  assert.equal(request.params.message, "");
  assert.deepEqual(request.params.attachments, [{ type: "file", mimeType: "text/plain", fileName: "brief.txt", content: "YWJj", sizeBytes: 3 }]);
  await h.edit("Next question"); h.view.addFiles([selectedFile("next.txt", "def")]); await h.flush();
  ack.resolve({ status: "started", runId: request.params.idempotencyKey }); await send; await h.flush();
  assert.equal(h.view.draft, "Next question"); assert.deepEqual(h.view.attachments.map(file => file.name), ["next.txt"]);
});

test("cached terminal send failures preserve text and files and a deliberate retry gets a fresh ID", async () => {
  const h = harness(); await h.flush(); await h.open("session-a"); await h.edit("Keep this");
  h.view.addFiles([selectedFile()]); await h.flush();
  h.handlers["sessions.send"] = () => ({ status: "error", errorMessage: "Failed previously" });
  await h.view.send({ preventDefault() {} }); await h.flush();
  assert.equal(h.view.draft, "Keep this"); assert.equal(h.view.attachments.length, 1); assert.equal(h.view.busy, false);
  await h.view.send({ preventDefault() {} });
  const sends = h.requests.filter(({ method }) => method === "sessions.send");
  assert.equal(sends.length, 2); assert.notEqual(sends[0].params.idempotencyKey, sends[1].params.idempotencyKey);
});

test("unconfirmed send identity survives switching sessions but changes for a different file or model", async () => {
  const h = harness({ models: [fixtureModel, secondModel] }); await h.flush(); await h.open("session-a"); await h.edit("same");
  h.view.addFiles([selectedFile()]); await h.flush();
  h.handlers["sessions.send"] = async () => { throw new Error("lost ACK"); };
  await h.view.send({ preventDefault() {} }); await h.flush(); await h.open("session-b"); await h.open("session-a");
  await h.view.send({ preventDefault() {} }); await h.flush();
  h.view.removeFile(h.view.attachments[0].id); h.view.addFiles([selectedFile("different.txt", "def")]); await h.flush();
  await h.view.send({ preventDefault() {} }); await h.flush();
  h.handlers["chat.history"] = () => ({ sessionInfo: { model: "second", modelProvider: "another", hasActiveRun: false } });
  await h.view.changeModel(secondModel); await h.flush();
  await h.view.send({ preventDefault() {} });
  const ids = h.requests.filter(({ method }) => method === "sessions.send").map(({ params }) => params.idempotencyKey);
  assert.equal(ids.length, 4); assert.equal(ids[0], ids[1]); assert.notEqual(ids[1], ids[2]); assert.notEqual(ids[2], ids[3]);
});

test("current negotiated limits and encoded frame size are rechecked before dispatch", async () => {
  const h = harness(); await h.flush(); await h.open("session-a");
  h.view.addFiles([selectedFile()]); await h.flush();
  await h.runtime({ attachmentPolicy: { maxBytes: 20, maxImageBytes: 10, maxPayload: 1100 } });
  await h.view.send({ preventDefault() {} }); await h.flush();
  assert.match(h.view.notice, /vượt giới hạn/); assert.equal(h.view.attachments.length, 1);
  await h.runtime({ attachmentPolicy: null });
  await h.view.send({ preventDefault() {} }); await h.flush();
  assert.match(h.view.notice, /giới hạn tệp/);
  assert.equal(h.requests.some(({ method }) => method === "sessions.send"), false);
});

test("real send handler fences double clicks, keeps ACK busy, and cannot switch sessions mid-run", async () => {
  const h = harness(), ack = deferred();
  h.handlers["sessions.send"] = () => ack.promise;
  await h.flush(); await h.open("session-a"); await h.edit("Hello");
  const first = h.view.send({ preventDefault() {} });
  await h.view.send({ preventDefault() {} });
  h.view.openSession("session-b"); await h.view.createSession(); await h.flush();
  const sends = h.requests.filter((entry) => entry.method === "sessions.send");
  assert.equal(sends.length, 1);
  assert.ok(sends[0].params.idempotencyKey);
  assert.equal(h.view.activeKey, "session-a");
  assert.equal(h.requests.some((entry) => entry.method === "sessions.create"), false);
  assert.equal(h.view.messages.length, 0, "admission does not invent a persisted user row");
  ack.resolve({ status: "started", runId: sends[0].params.idempotencyKey }); await first; await h.flush();
  assert.equal(h.view.busy, true); assert.equal(h.view.draft, "");
  await h.event({ sessionKey: "session-a", runId: sends[0].params.idempotencyKey, seq: 1, state: "error", errorMessage: "fixture" });
  assert.equal(h.view.busy, false);
});

test("template and review text append through the real draft handler without dispatching AI", async () => {
  const h = harness(); await h.flush(); await h.open("session-a"); await h.edit("Nháp cũ");
  h.view.appendDraft(workTemplates.WORK_TEMPLATES[0].text); await h.flush();
  h.view.appendDraft("Góp ý của Advisor"); await h.flush();
  assert.ok(h.view.draft.startsWith("Nháp cũ\n\n"));
  assert.ok(h.view.draft.endsWith("Góp ý của Advisor"));
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
  await h.open("session-b"); assert.equal(h.view.draft, "");
  await h.open("session-a"); assert.ok(h.view.draft.includes("Góp ý của Advisor"));
});

test("inserting Advisor feedback from a native page returns to the selected chat and preserves its draft", async () => {
  const h = harness(); await h.flush(); await h.open("session-a"); await h.edit("Original draft");
  h.view.addFiles([selectedFile()]); await h.flush();
  const before = h.requests.length;
  for (const page of ["projects", "usage", "skills"]) {
    h.view.navigateWorkspace(page); await h.flush(); assert.equal(h.view.workspaceView, page);
    h.view.appendDraft(`Advisor feedback from ${page}`); await h.flush();
    assert.equal(h.view.workspaceView, "chat"); assert.equal(h.view.activeKey, "session-a");
    assert.ok(h.view.draft.endsWith(`Advisor feedback from ${page}`));
  }
  assert.ok(h.view.draft.startsWith("Original draft\n\n"));
  assert.equal(h.view.attachments[0].name, "brief.txt");
  assert.equal(h.requests.length, before, "inserting advice does not dispatch AI or change the native session");
});

test('automatic Advisor sends the current request and selected models once, keeps controls locked until settled, and clears only accepted drafts', async () => {
  const h=harness(), response=deferred(); await h.flush(); await h.open('session-a'); await h.edit('Hãy lập kế hoạch');
  h.view.setSupervisionChoices({'session-a':{enabled:true,model:{id:'reviewer',provider:'connected'}}}); await h.flush();
  h.handlers.supervise=()=>response.promise;
  const sending=h.view.send({preventDefault(){}}); await h.flush();
  assert.equal(h.view.supervisionBusy,true);
  await h.view.send({preventDefault(){}}); await h.open('session-b');
  assert.equal(h.view.activeKey,'session-a');
  const calls=h.requests.filter(r=>r.method==='supervise'); assert.equal(calls.length,1);
  assert.equal(calls[0].params.message,'Hãy lập kế hoạch');
  assert.equal(calls[0].params.advisorModel.id,'reviewer'); assert.equal(calls[0].params.model.id,'fixture');
  assert.equal(h.requests.some(r=>r.method==='sessions.send'),false);
  response.resolve({id:calls[0].params.id,key:'session-a',busy:false,accepted:true,phase:'completed'});
  await sending; await h.flush(); assert.equal(h.view.draft,''); assert.equal(h.view.supervisionBusy,false);
});

test('Advisor off uses ordinary send, while a rejected plan preserves the request without a manual form', async () => {
  const h=harness(); await h.flush(); await h.open('session-a'); await h.edit('Giữ yêu cầu');
  h.view.setSupervisionChoices({'session-a':{enabled:true,model:{id:'fixture',provider:'fixture'}}}); await h.flush();
  h.handlers.supervise=p=>({id:p.id,key:p.key,busy:false,accepted:false,phase:'needs-changes'});
  await h.view.send({preventDefault(){}}); await h.flush();
  assert.equal(h.view.draft,'Giữ yêu cầu'); assert.equal(h.requests.some(r=>r.method==='sessions.send'),false);
  h.view.setSupervisionChoices({'session-a':{enabled:false,model:{id:'fixture',provider:'fixture'}}}); await h.flush();
  h.handlers['sessions.send']=p=>({status:'accepted',runId:p.idempotencyKey});
  await h.view.send({preventDefault(){}}); await h.flush();
  assert.equal(h.requests.filter(r=>r.method==='supervise').length,1);
  assert.equal(h.requests.filter(r=>r.method==='sessions.send').length,1);
});

test('shared Stop cancels automatic Advisor without sending a chat abort for an unrelated run', async()=>{
  const h=harness(), response=deferred(); await h.flush(); await h.open('session-a'); await h.edit('Task');
  h.view.setSupervisionChoices({'session-a':{enabled:true,model:{id:'fixture',provider:'fixture'}}}); await h.flush();
  h.handlers.supervise=()=>response.promise; h.handlers['supervision-cancel']=()=>({stopped:true});
  const sending=h.view.send({preventDefault(){}}); await h.flush(); await h.view.abort(); await h.flush();
  assert.equal(h.view.supervisionBusy,false); assert.equal(h.requests.filter(r=>r.method==='supervision-cancel').length,1);
  assert.equal(h.requests.some(r=>r.method==='chat.abort'),false);
  response.resolve({key:'session-a',busy:false,accepted:false,phase:'cancelled'}); await sending; await h.flush();
  assert.equal(h.view.draft,'Task');
});

test('late cancelled supervision response cannot unlock a newer job or consume its draft', async () => {
  const h=harness(), first=deferred(), second=deferred(); await h.flush(); await h.open('session-a'); await h.edit('Task');
  h.view.setSupervisionChoices({'session-a':{enabled:true,model:{id:'fixture',provider:'fixture'}}}); await h.flush();
  let calls=0; h.handlers.supervise=()=>++calls===1?first.promise:second.promise;
  h.handlers['supervision-cancel']=()=>({stopped:true});
  const a=h.view.send({preventDefault(){}}); await h.flush(); await h.view.abort(); await h.flush();
  const b=h.view.send({preventDefault(){}}); await h.flush();
  first.resolve({busy:false,accepted:true,phase:'completed'}); await a; await h.flush();
  assert.equal(h.view.supervisionBusy,true); assert.equal(h.view.draft,'Task');
  second.resolve({busy:false,accepted:true,phase:'completed'}); await b; await h.flush();
  assert.equal(h.view.supervisionBusy,false); assert.equal(h.view.draft,'');
});

test("failed sends preserve the draft and explicit retry reuses its submission identity", async () => {
  const h = harness();
  h.handlers["sessions.send"] = async () => { throw new Error("fixture transport failure"); };
  await h.flush(); await h.open("session-a"); await h.edit("Keep this");
  await h.view.send({ preventDefault() {} }); await h.flush();
  assert.equal(h.view.draft, "Keep this"); assert.equal(h.view.busy, false);
  await h.view.send({ preventDefault() {} });
  const sends = h.requests.filter((entry) => entry.method === "sessions.send");
  assert.equal(sends.length, 2);
  assert.equal(sends[0].params.idempotencyKey, sends[1].params.idempotencyKey);
});

test("send waits for selected subscription and history instead of letting an idle snapshot erase admission", async () => {
  const h = harness(), subscription = deferred(), history = deferred(), ack = deferred();
  await h.flush();
  h.handlers["sessions.messages.subscribe"] = () => subscription.promise;
  h.handlers["chat.history"] = () => history.promise;
  h.handlers["sessions.send"] = () => ack.promise;
  await h.open("session-a"); await h.edit("Keep until ready");
  await h.view.send({ preventDefault() {} });
  assert.equal(h.view.historyReady, false); assert.equal(h.view.canSubmit, false);
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
  subscription.resolve({ subscribed: true }); await h.flush();
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
  history.resolve({ messages: [], sessionInfo: { hasActiveRun: false } }); await h.flush();
  assert.equal(h.view.canSubmit, true);
  const sent = h.view.send({ preventDefault() {} }); await h.flush();
  const id = h.requests.find((entry) => entry.method === "sessions.send").params.idempotencyKey;
  ack.resolve({ status: "started", runId: id }); await sent; await h.flush();
  assert.equal(h.view.busy, true);
  await h.event({ sessionKey: "session-a", runId: id, seq: 1, state: "delta", deltaText: "Accepted" });
  assert.equal(h.view.run.text, "Accepted");
});

test("drafts follow their session and ACK preserves a newer draft even when its text matches again", async () => {
  const h = harness(), ack = deferred();
  await h.flush(); await h.open("session-a"); await h.edit("A draft");
  await h.open("session-b"); assert.equal(h.view.draft, ""); await h.edit("B draft");
  await h.open("session-a"); assert.equal(h.view.draft, "A draft");
  h.handlers["sessions.send"] = () => ack.promise;
  const sent = h.view.send({ preventDefault() {} }); await h.flush();
  await h.edit("Changed while running"); await h.edit("A draft");
  ack.resolve({ status: "started", runId: h.view.run.runId }); await sent; await h.flush();
  assert.equal(h.view.busy, true); assert.equal(h.view.draft, "A draft");
  assert.equal(h.requests.filter((entry) => entry.method === "sessions.send").length, 1);
  await h.event({ sessionKey: "session-a", runId: h.view.run.runId, seq: 1, state: "final" });
  await h.open("session-b"); assert.equal(h.view.draft, "B draft");
  await h.open("session-a"); assert.equal(h.view.draft, "A draft");
});

test("initial subscription or history failure has an explicit single-flight retry that preserves the draft", async () => {
  for (const failedMethod of ["sessions.messages.subscribe", "chat.history"]) {
    const h = harness(), subscription = deferred(), history = deferred();
    h.handlers[failedMethod] = async () => { throw new Error("initial read failed"); };
    await h.flush(); await h.open("session-a"); await h.edit("Keep during retry");
    assert.equal(h.view.historyError, true); assert.equal(h.view.historyReady, false);
    await h.view.send({ preventDefault() {} }); await h.flush();
    assert.equal(h.requests.filter((entry) => entry.method === failedMethod).length, 1, "failed reads do not retry themselves");
    assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
    h.handlers["sessions.messages.subscribe"] = () => subscription.promise;
    h.handlers["chat.history"] = () => history.promise;
    const retry = h.view.reloadHistory();
    await h.view.reloadHistory(); await h.flush();
    assert.equal(h.requests.filter((entry) => entry.method === "sessions.messages.subscribe").length, 2);
    assert.equal(h.view.historyError, false); assert.equal(h.view.canSubmit, false);
    subscription.resolve({ subscribed: true }); await h.flush();
    assert.equal(h.view.historyReady, false, "subscription alone cannot open send");
    history.resolve({ messages: [], sessionInfo: { hasActiveRun: false } }); await retry; await h.flush();
    assert.equal(h.view.historyError, false); assert.equal(h.view.historyReady, true);
    assert.equal(h.view.draft, "Keep during retry"); assert.equal(h.view.canSubmit, true);
    assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false, "recovery never sends the retained draft");
  }
});

test("failed subscription cannot be bypassed by history and late retry failure cannot affect another session", async () => {
  const h = harness(), retrySubscription = deferred();
  h.handlers["sessions.messages.subscribe"] = async () => { throw new Error("subscription unavailable"); };
  await h.flush(); await h.open("session-a"); await h.edit("A stays here");
  await h.view.loadHistory("session-a"); await h.flush();
  assert.equal(h.view.historyReady, false); assert.equal(h.view.historyError, true);
  h.handlers["sessions.messages.subscribe"] = ({ key }) => key === "session-a" ? retrySubscription.promise : {};
  const retry = h.view.reloadHistory(); await h.flush();
  await h.open("session-b"); await h.edit("B remains ready");
  assert.equal(h.view.canSubmit, true);
  retrySubscription.reject(new Error("late A failure")); await retry; await h.flush();
  assert.equal(h.view.activeKey, "session-b"); assert.equal(h.view.historyError, false);
  assert.equal(h.view.canSubmit, true); assert.equal(h.view.draft, "B remains ready");
});

test("history retry remains available for a running session and another read failure stops for the next explicit retry", async () => {
  const h = harness();
  h.handlers["chat.history"] = async () => { throw new Error("history unavailable"); };
  await h.flush(); await h.open("session-a");
  await h.event({ sessionKey: "session-a", runId: "external-run", seq: 1, state: "delta", deltaText: "Still running" });
  assert.equal(h.view.busy, true); assert.equal(h.view.historyError, true);
  await h.view.reloadHistory(); await h.flush();
  assert.equal(h.view.historyError, true); assert.equal(h.view.historyReady, false);
  assert.equal(h.requests.filter((entry) => entry.method === "chat.history").length, 2);
  h.handlers["chat.history"] = async () => ({ messages: [], inFlightRun: { runId: "external-run", text: "Still running" } });
  await h.view.reloadHistory(); await h.flush();
  assert.equal(h.view.historyError, false); assert.equal(h.view.historyReady, true);
  assert.equal(h.view.busy, true); assert.equal(h.view.run.runId, "external-run");
  assert.equal(h.view.canSubmit, false);
});

test("an event invalidating initial history triggers one fresh snapshot before send becomes ready", async () => {
  for (const hasActiveRun of [false, true]) {
    const h = harness(), initial = deferred(), fresh = deferred();
    let reads = 0;
    h.handlers["chat.history"] = () => ++reads === 1 ? initial.promise : fresh.promise;
    await h.flush(); await h.open("session-a"); await h.edit("Ready after history");
    await h.event({ sessionKey: "session-a", messageId: "persisted", message: { role: "user", content: "Live row" } }, "session.message");
    assert.equal(reads, 1, "events do not fan out parallel initial history requests");
    initial.resolve({ messages: [], sessionInfo: { hasActiveRun: false } }); await h.flush();
    assert.equal(reads, 2); assert.equal(h.view.historyReady, false); assert.equal(h.view.canSubmit, false);
    assert.equal(h.view.messages[0].content, "Live row", "the invalidated snapshot cannot erase the live row");
    fresh.resolve({ messages: [row("Live row")], sessionInfo: { hasActiveRun, activeRunIds: hasActiveRun ? ["external-run"] : [] } });
    await h.flush();
    assert.equal(reads, 2); assert.equal(h.view.historyReady, true);
    assert.equal(h.view.canSubmit, !hasActiveRun);
    if (hasActiveRun) {
      assert.equal(h.view.run.runId, null, "aggregate activity cannot invent exact abort ownership");
      await h.view.send({ preventDefault() {} });
      assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
    }
  }
});

test("ACK for a completed old session cannot erase the selected conversation draft", async () => {
  const h = harness(), ack = deferred();
  await h.flush(); await h.open("session-a"); await h.edit("A draft");
  h.handlers["sessions.send"] = () => ack.promise;
  const sent = h.view.send({ preventDefault() {} }); await h.flush(); const runId = h.view.run.runId;
  await h.event({ sessionKey: "session-a", runId, seq: 1, state: "final" });
  await h.open("session-b"); await h.edit("B draft");
  ack.resolve({ status: "started", runId }); await sent; await h.flush();
  assert.equal(h.view.draft, "B draft");
  await h.open("session-a"); assert.equal(h.view.draft, "");
});

test("canonical ACK run IDs accept native deltas and target the same ID when stopping", async () => {
  const h = harness(); h.handlers["sessions.send"] = async () => ({ runId: "canonical-run", status: "started" });
  await h.flush(); await h.open("session-a"); await h.edit("Hello");
  await h.view.send({ preventDefault() {} }); await h.flush();
  await h.event({ sessionKey: "session-a", runId: "canonical-run", seq: 1, state: "delta", deltaText: "Reply" });
  assert.equal(h.view.busy, true); assert.equal(h.view.run.text, "Reply");
  await h.view.abort();
  assert.equal(h.requests.find((entry) => entry.method === "chat.abort").params.runId, "canonical-run");
});

test("canonical ACK catch-up recovers earlier events without clearing admission or replacing a newer stream", async () => {
  const h = harness(), ack = deferred(), catchup = deferred();
  await h.flush(); await h.open("session-a"); await h.edit("Hello");
  h.handlers["sessions.send"] = () => ack.promise;
  const sent = h.view.send({ preventDefault() {} });
  await h.event({ sessionKey: "session-a", runId: "canonical-run", seq: 1, state: "delta", deltaText: "Before ACK" });
  h.handlers["chat.history"] = () => catchup.promise;
  ack.resolve({ runId: "canonical-run", status: "started" }); await sent; await h.flush();
  await h.event({ sessionKey: "session-a", runId: "canonical-run", seq: 2, state: "delta", deltaText: "Latest", replace: true });
  catchup.resolve({ messages: [], inFlightRun: { runId: "canonical-run", text: "Before ACK" } }); await h.flush();
  assert.equal(h.view.run.text, "Latest"); assert.equal(h.view.busy, true);
  assert.equal(h.requests.filter((entry) => entry.method === "chat.history").length, 2);
});

test("native persisted message identity avoids duplicates without matching message text", async () => {
  const h = harness(), durable = [];
  h.handlers["chat.history"] = () => ({ messages: durable, sessionInfo: { hasActiveRun: false } });
  await h.flush(); await h.open("session-a");
  const payload = { sessionKey: "session-a", messageId: "message-1", message: { role: "user", content: "Same text" } };
  durable.push({ ...payload.message, __openclaw: { id: "message-1" } });
  await h.event(payload, "session.message"); await h.event(payload, "session.message");
  durable.push({ ...payload.message, __openclaw: { id: "message-2" } });
  await h.event({ ...payload, messageId: "message-2" }, "session.message");
  assert.equal(h.view.messages.length, 2, "distinct native rows survive even when their content matches");
});

test("ambiguous live projections preserve siblings and coalesce authoritative history reads", async () => {
  const h = harness(), first = deferred(), fresh = deferred();
  const siblings = [row("First"), row("Second")].map((message) => ({ ...message, __openclaw: { id: "shared", seq: 7 } }));
  h.handlers["chat.history"] = () => ({ messages: siblings, sessionInfo: { hasActiveRun: false } });
  await h.flush(); await h.open("session-a");
  assert.equal(h.view.messages.length, 2);
  assert.notEqual(h.view.messages[0].id, h.view.messages[1].id);
  let reads = 0;
  h.handlers["chat.history"] = () => ++reads === 1 ? first.promise : fresh.promise;
  const event = { sessionKey: "session-a", messageId: "shared", messageSeq: 7,
    message: { role: "assistant", content: "Ambiguous" } };
  await h.event(event, "session.message"); await h.event(event, "session.message");
  assert.equal(reads, 1, "repeated events share a pending refresh");
  assert.deepEqual(Array.from(h.view.messages, (entry) => entry.content), ["First", "Second"]);
  first.resolve({ messages: [row("Stale")] }); await h.flush();
  assert.equal(reads, 2, "an invalidated read gets one sequential current snapshot");
  fresh.resolve({ messages: siblings, sessionInfo: { hasActiveRun: false } }); await h.flush();
  assert.deepEqual(Array.from(h.view.messages, (entry) => entry.content), ["First", "Second"]);
  const orphan = { sessionKey: "session-a", seq: 999, message: { role: "user", content: "No transcript anchor" } };
  h.handlers["chat.history"] = () => ({ messages: siblings, sessionInfo: { hasActiveRun: false } });
  await h.event(orphan, "session.message");
  assert.equal(h.view.messages.length, 2, "outer sequence is never fabricated into native message identity");
});

test("a second sibling arriving after a single projected row cannot replace the first", async () => {
  const h = harness(), fresh = deferred();
  const first = { ...row("First sibling"), __openclaw: { id: "shared", seq: 7 } };
  const second = { ...row("Second sibling"), role: "assistant", __openclaw: { id: "shared", seq: 7 } };
  h.handlers["chat.history"] = () => ({ messages: [first], sessionInfo: { hasActiveRun: false } });
  await h.flush(); await h.open("session-a");
  h.handlers["chat.history"] = () => fresh.promise;
  await h.event({ sessionKey: "session-a", message: second, messageId: "shared", messageSeq: 7 }, "session.message");
  assert.equal(h.view.messages.length, 1);
  assert.equal(h.view.messages[0].content, "First sibling");
  fresh.resolve({ messages: [first, second], sessionInfo: { hasActiveRun: false } }); await h.flush();
  assert.deepEqual(Array.from(h.view.messages, (entry) => entry.content), ["First sibling", "Second sibling"]);
  assert.notEqual(h.view.messages[0].id, h.view.messages[1].id);
});

test("an equal-text sibling is recovered from history instead of being mistaken for a replay", async () => {
  const h = harness(), fresh = deferred();
  const first = { ...row("Equal sibling"), timestamp: 1, __openclaw: { id: "shared", seq: 7 } };
  const second = { ...first, timestamp: 2 };
  h.handlers["chat.history"] = () => ({ messages: [first], sessionInfo: { hasActiveRun: false } });
  await h.flush(); await h.open("session-a");
  h.handlers["chat.history"] = () => fresh.promise;
  await h.event({ sessionKey: "session-a", message: second, messageId: "shared", messageSeq: 7 }, "session.message");
  assert.equal(h.view.messages.length, 1);
  fresh.resolve({ messages: [first, second], sessionInfo: { hasActiveRun: false } }); await h.flush();
  assert.equal(h.view.messages.length, 2);
  assert.notEqual(h.view.messages[0].id, h.view.messages[1].id);
  assert.deepEqual(Array.from(h.view.messages, (entry) => entry.timestamp), [1, 2]);
});

test("a collision refresh during admission cannot mistake a pre-admission idle snapshot for completion", async () => {
  const h = harness(), ack = deferred();
  const first = { ...row("Earlier row"), __openclaw: { id: "shared", seq: 7 } };
  h.handlers["chat.history"] = () => ({ messages: [first], sessionInfo: { hasActiveRun: false } });
  await h.flush(); await h.open("session-a"); await h.edit("Pending request");
  h.handlers["sessions.send"] = () => ack.promise;
  const sending = h.view.send({ preventDefault() {} }); await h.flush();
  const id = h.view.run.runId;
  await h.event({ sessionKey: "session-a", messageId: "shared", messageSeq: 7,
    message: { role: "assistant", content: "Another projection" } }, "session.message");
  assert.equal(h.view.busy, true);
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.filter((entry) => entry.method === "sessions.send").length, 1);
  ack.resolve({ runId: id, status: "started" }); await sending; await h.flush();
  assert.equal(h.view.busy, true);
});

test("the actual selected model gates sends despite a different available provider and updates on reconnect", async () => {
  const available = { id: "shared", provider: "connected-provider", name: "Connected", available: true };
  const selected = { id: "shared", provider: "selected-provider", name: "Selected", available: false };
  const h = harness({ models: [available, selected] });
  h.handlers["chat.history"] = () => ({ messages: [],
    defaults: { model: "shared", modelProvider: "connected-provider" },
    sessionInfo: { model: "shared", modelProvider: "selected-provider", hasActiveRun: false } });
  await h.flush(); await h.open("session-a"); await h.edit("Keep until this AI is connected");
  assert.equal(h.view.usage.modelProvider, "selected-provider");
  assert.equal(h.view.canSubmit, false);
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
  h.handlers["models.list"] = () => ({ models: [available, { ...selected, available: true }] });
  await h.runtime({ connected: false }); await h.runtime({ connected: true });
  assert.equal(h.view.canSubmit, true);
  assert.equal(h.view.draft, "Keep until this AI is connected");
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false, "reconnect never sends the retained draft");
  h.handlers["chat.history"] = () => ({ messages: [], defaults: { model: "shared", modelProvider: "connected-provider" },
    sessionInfo: { model: null, modelProvider: null, hasActiveRun: false } });
  await h.view.loadHistory("session-a"); await h.flush();
  assert.equal(h.view.canSubmit, false);
  assert.equal(h.view.usage.model, null);
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
});

test("late history from a previous session and a pre-delta snapshot cannot overwrite newer state", async () => {
  const h = harness(), old = deferred();
  h.handlers["chat.history"] = ({ sessionKey }) => sessionKey === "session-a" ? old.promise : { messages: [row("B")] };
  await h.flush(); await h.open("session-a"); await h.open("session-b");
  old.resolve({ messages: [row("A")] }); await h.flush();
  assert.equal(h.view.messages[0].content, "B");
  const stale = deferred(); h.handlers["chat.history"] = () => stale.promise;
  const read = h.view.loadHistory("session-b");
  await h.event({ sessionKey: "session-b", runId: "external-run", seq: 1, state: "delta", deltaText: "New text" });
  stale.resolve({ messages: [row("Stale")], sessionInfo: { hasActiveRun: false } }); await read; await h.flush();
  assert.equal(h.view.messages[0].content, "B"); assert.equal(h.view.run.text, "New text"); assert.equal(h.view.busy, true);
});

test("abort is single flight, failed abort keeps busy, and confirmed stop ignores late deltas", async () => {
  const h = harness(), stop = deferred();
  await h.flush(); await h.open("session-a");
  await h.event({ sessionKey: "session-a", runId: "external-run", seq: 1, state: "delta", deltaText: "Partial" });
  h.handlers["chat.abort"] = () => stop.promise;
  const first = h.view.abort(); await h.view.abort();
  assert.equal(h.requests.filter((entry) => entry.method === "chat.abort").length, 1);
  stop.reject(new Error("fixture abort failure")); await first; await h.flush(); assert.equal(h.view.busy, true);
  h.handlers["chat.abort"] = async () => ({ aborted: true });
  await h.view.abort(); await h.flush(); assert.equal(h.view.busy, false);
  await h.event({ sessionKey: "session-a", runId: "external-run", seq: 2, state: "delta", deltaText: "Late" });
  assert.equal(h.view.run.text.includes("Late"), false);
});

test("reconnect renews both subscriptions and rebuilds the selected history", async () => {
  const h = harness(); await h.flush(); await h.open("session-a");
  await h.runtime({ connected: false }); await h.runtime({ connected: true });
  for (const method of ["sessions.subscribe", "sessions.messages.subscribe", "chat.history"]) {
    assert.equal(h.requests.filter((entry) => entry.method === method).length, 2, method);
  }
  assert.equal(h.requests.some((entry) => entry.method === "sessions.messages.unsubscribe"), true);
});

test("an unavailable catalog waits for setup readiness before offering Connect", async () => {
  const h = harness({ models: [{ id: "needs-auth", available: false }], setupReady: false });
  await h.flush(); assert.equal(h.view.showConnect, false);
  await h.runtime({ setupReady: true }); assert.equal(h.view.showConnect, true);
  h.handlers["models.list"] = async () => ({ models: [{ id: "now-ready", available: true }] });
  await h.view.refreshModels(false); await h.flush(); assert.equal(h.view.models[0].id, "now-ready");
});

test("a pending model refresh blocks send until its current catalogue is ready", async () => {
  const h = harness(), catalogue = deferred();
  await h.flush(); await h.open("session-a"); await h.edit("Wait for current catalogue");
  assert.equal(h.view.canSubmit, true);
  h.handlers["models.list"] = () => catalogue.promise;
  const refresh = h.view.refreshModels(false); await h.flush();
  assert.equal(h.view.modelsLoading, true); assert.equal(h.view.modelCatalogueState, "loading");
  assert.equal(h.view.canSubmit, false);
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.some((entry) => entry.method === "sessions.send"), false);
  catalogue.resolve({ models: [fixtureModel] }); await refresh; await h.flush();
  assert.equal(h.view.modelsLoading, false); assert.equal(h.view.modelCatalogueState, "ready");
  assert.equal(h.view.canSubmit, true);
});

test("stale model success and failure cannot replace the newest catalogue or survive disconnect", async () => {
  const h = harness(), old = deferred(), current = deferred(), disconnected = deferred();
  await h.flush();
  h.handlers["models.list"] = () => old.promise;
  const first = h.view.refreshModels(false);
  h.handlers["models.list"] = () => current.promise;
  const second = h.view.refreshModels(false);
  current.resolve({ models: [{ id: "newest", available: true }] }); await second; await h.flush();
  old.reject(new Error("outdated failure")); await first; await h.flush();
  assert.equal(h.view.modelCatalogueState, "ready"); assert.equal(h.view.models[0].id, "newest");
  h.handlers["models.list"] = () => disconnected.promise;
  const third = h.view.refreshModels(false); await h.flush();
  await h.runtime({ connected: false });
  assert.equal(h.view.modelsLoading, false);
  disconnected.resolve({ models: [{ id: "stale-after-disconnect", available: true }] }); await third; await h.flush();
  assert.equal(h.view.modelsLoading, false); assert.equal(h.view.modelCatalogueState, "loading");
  assert.equal(h.view.models[0].id, "newest");
});

const nativeThinkingLevels = [{ id: "low", label: "Gọn" }, { id: "high", label: "Kỹ" }];
const thinkingHistory = (level = "low") => ({ messages: [], sessionInfo: {
  model: "fixture", modelProvider: "fixture", hasActiveRun: false, thinkingLevel: level, thinkingLevels: nativeThinkingLevels
} });

test("thinking selection stays in RAM and only an explicit send applies its validated per-turn override", async () => {
  const h = harness(), ack = deferred();
  h.handlers["chat.history"] = () => thinkingHistory();
  await h.flush(); await h.open("session-a"); await h.edit("Keep this reasoning draft");
  assert.deepEqual(h.view.thinking, { level: "low", levels: nativeThinkingLevels });
  const before = h.requests.length;
  await h.view.changeThinking("invented-level");
  await h.flush(); assert.equal(h.view.composerThinking.level, "low");
  await h.view.changeThinking("high"); await h.flush();
  assert.equal(h.requests.length, before, "selecting a level never calls admin patch, history, or inference");
  assert.equal(h.view.composerThinking.level, "high"); assert.equal(h.view.thinking.level, "low");
  assert.equal(h.view.changingModel, false); assert.equal(h.view.canSubmit, true);
  assert.equal(h.view.draft, "Keep this reasoning draft");
  await h.view.loadHistory("session-a"); await h.flush();
  assert.equal(h.view.composerThinking.level, "high", "native history does not overwrite an explicit pending choice");
  h.handlers["sessions.send"] = () => ack.promise;
  const sending = h.view.send({ preventDefault() {} }); await h.view.send({ preventDefault() {} }); await h.flush();
  const sends = h.requests.filter(({ method }) => method === "sessions.send");
  assert.equal(sends.length, 1); assert.equal(sends[0].params.thinking, "high");
  assert.equal(Object.hasOwn(sends[0].params, "thinkingLevel"), false);
  await h.view.changeThinking("low"); await h.edit("Next draft while waiting");
  ack.resolve({ status: "started", runId: sends[0].params.idempotencyKey }); await sending; await h.flush();
  assert.equal(h.view.composerThinking.level, "high", "busy runs retain their selected preference");
  assert.equal(h.view.draft, "Next draft while waiting");
  assert.equal(h.view.busy, true);
  await h.event({ sessionKey: "session-a", runId: sends[0].params.idempotencyKey, seq: 1, state: "final" });
  assert.equal(h.view.busy, false); assert.equal(h.view.composerThinking.level, "high");
  assert.equal(h.requests.some(({ method }) => method === "sessions.patch"), false);
});

test("automatic thinking omits the override, while unavailable and unadvertised choices cannot be stored", async () => {
  const h = harness(); await h.flush(); await h.open("session-a");
  await h.view.changeThinking("high");
  await h.flush(); assert.equal(h.view.composerThinking.level, null);
  h.handlers["chat.history"] = () => thinkingHistory("high");
  await h.view.loadHistory("session-a"); await h.flush(); await h.edit("Automatic turn");
  await h.runtime({ setupReady: false }); await h.view.changeThinking("low"); await h.flush();
  assert.equal(h.view.composerThinking.level, "high");
  await h.runtime({ setupReady: true });
  await h.view.changeThinking("low"); await h.flush(); assert.equal(h.view.composerThinking.level, "low");
  await h.view.changeThinking(null); await h.flush();
  assert.equal(h.view.composerThinking.level, null); assert.equal(h.view.thinking.level, "high");
  h.handlers["sessions.send"] = async () => { throw new Error("retain after transport failure"); };
  await h.view.send({ preventDefault() {} }); await h.flush();
  const sent = h.requests.find(({ method }) => method === "sessions.send");
  assert.equal(Object.hasOwn(sent.params, "thinking"), false);
  assert.equal(h.view.draft, "Automatic turn"); assert.equal(h.view.composerThinking.level, null);
  assert.equal(h.requests.some(({ method }) => method === "sessions.patch"), false);
});

test("retry identity includes effective reasoning and reuses an unchanged explicit per-turn request", async () => {
  const h = harness(); h.handlers["chat.history"] = () => thinkingHistory("low");
  h.handlers["sessions.send"] = async () => { throw new Error("unconfirmed request"); };
  await h.flush(); await h.open("session-a"); await h.edit("Same question");
  await h.view.send({ preventDefault() {} }); await h.flush();
  await h.view.changeThinking("high"); await h.flush();
  await h.view.send({ preventDefault() {} }); await h.flush();
  await h.view.send({ preventDefault() {} }); await h.flush();
  await h.view.changeThinking(null); await h.flush();
  await h.view.send({ preventDefault() {} }); await h.flush();
  const sends = h.requests.filter(({ method }) => method === "sessions.send");
  assert.equal(sends.length, 4);
  assert.notEqual(sends[0].params.idempotencyKey, sends[1].params.idempotencyKey);
  assert.equal(sends[1].params.idempotencyKey, sends[2].params.idempotencyKey);
  assert.notEqual(sends[2].params.idempotencyKey, sends[3].params.idempotencyKey);
  assert.equal(sends[1].params.thinking, "high"); assert.equal(sends[2].params.thinking, "high");
  for (const sent of [sends[0], sends[3]]) assert.equal(Object.hasOwn(sent.params, "thinking"), false);
  assert.equal(h.view.draft, "Same question");
  assert.equal(h.requests.some(({ method }) => method === "sessions.patch"), false);
});

test("reasoning preferences and drafts follow their session across tab close and reopening", async () => {
  const h = harness(); h.handlers["chat.history"] = () => thinkingHistory("low");
  await h.flush(); await h.open("session-a"); await h.edit("Draft A");
  await h.view.changeThinking("high"); await h.flush();
  await h.open("session-b"); await h.edit("Draft B");
  assert.equal(h.view.composerThinking.level, "low");
  await h.view.changeThinking(null); await h.flush();
  await h.open("session-a"); assert.equal(h.view.composerThinking.level, "high"); assert.equal(h.view.draft, "Draft A");
  h.view.closeTab("session-a"); await h.flush();
  assert.equal(h.view.activeKey, "session-b"); assert.equal(h.view.composerThinking.level, null);
  await h.open("session-a"); assert.equal(h.view.composerThinking.level, "high"); assert.equal(h.view.draft, "Draft A");
  assert.equal(h.requests.some(({ method }) => ["sessions.patch", "sessions.send"].includes(method)), false);
});

test("a saved reasoning choice cannot leak to another model and matching model selection restores it", async () => {
  const h = harness({ models: [fixtureModel, secondModel] }), pending = deferred();
  let selected = fixtureModel;
  h.handlers["chat.history"] = () => ({ ...thinkingHistory("low"), sessionInfo: {
    ...thinkingHistory("low").sessionInfo, model: selected.id, modelProvider: selected.provider
  } });
  await h.flush(); await h.open("session-a"); await h.edit("Same draft across models");
  await h.view.changeThinking("high"); await h.flush();
  h.handlers["sessions.patch"] = async () => { await pending.promise; selected = secondModel; return {}; };
  const changing = h.view.changeModel(secondModel); await h.view.changeThinking("low"); await h.flush();
  assert.equal(h.view.composerThinking.level, "high"); assert.equal(h.view.changingModel, true);
  pending.resolve(); await changing; await h.flush();
  assert.equal(h.view.usage.model, "second"); assert.equal(h.view.composerThinking.level, "low");
  h.handlers["sessions.send"] = async () => { throw new Error("keep draft"); };
  await h.view.send({ preventDefault() {} }); await h.flush();
  assert.equal(Object.hasOwn(h.requests.find(({ method }) => method === "sessions.send").params, "thinking"), false);
  h.handlers["sessions.patch"] = () => { selected = fixtureModel; return {}; };
  await h.view.changeModel(fixtureModel); await h.flush();
  assert.equal(h.view.composerThinking.level, "high"); assert.equal(h.view.draft, "Same draft across models");
  await h.view.send({ preventDefault() {} });
  assert.equal(h.requests.filter(({ method }) => method === "sessions.send").at(-1).params.thinking, "high");
  assert.equal(h.requests.filter(({ method }) => method === "sessions.patch").every(({ params }) => Object.hasOwn(params, "model")), true);
});

test("a removed native reasoning option blocks the saved override and automatic reset recovers sending", async () => {
  const h = harness(); h.handlers["chat.history"] = () => thinkingHistory("low");
  await h.flush(); await h.open("session-a"); await h.edit("Keep until a valid choice");
  await h.view.changeThinking("high"); await h.flush();
  h.handlers["chat.history"] = () => ({ sessionInfo: { ...thinkingHistory("low").sessionInfo, thinkingLevels: [] } });
  await h.view.loadHistory("session-a"); await h.flush();
  assert.equal(h.view.composerThinking.level, "high"); assert.equal(h.view.composerThinking.levels.length, 0);
  await h.view.send({ preventDefault() {} }); await h.flush();
  assert.match(h.view.notice, /không còn khả dụng/);
  assert.equal(h.requests.some(({ method }) => method === "sessions.send"), false);
  assert.equal(h.view.draft, "Keep until a valid choice");
  await h.view.changeThinking(null); await h.flush();
  assert.equal(h.view.composerThinking.level, null, "automatic must clear an obsolete choice even with an empty capability list");
  h.handlers["sessions.send"] = async () => { throw new Error("keep draft"); };
  await h.view.send({ preventDefault() {} }); await h.flush();
  const sends = h.requests.filter(({ method }) => method === "sessions.send");
  assert.equal(sends.length, 1); assert.equal(Object.hasOwn(sends[0].params, "thinking"), false);
  assert.equal(h.requests.some(({ method }) => method === "sessions.patch"), false);
});

test("native pin is single flight, targets an existing session and refreshes rather than assuming success", async () => {
  const h = harness(), ack = deferred(); await h.flush();
  let pinned = false;
  h.handlers["sessions.list"] = () => ({ sessions: [{ key: "session-a", pinned }] });
  await h.view.refreshSessions(); await h.flush();
  await h.view.pinSession("missing", true);
  assert.equal(h.requests.some(({ method }) => method === "sessions.patch"), false);
  h.handlers["sessions.patch"] = () => ack.promise;
  const pin = h.view.pinSession("session-a", true);
  await h.view.pinSession("session-a", true); await h.flush();
  assert.equal(h.view.sessions[0].pinned, false);
  assert.equal(h.requests.filter(({ method }) => method === "sessions.patch").length, 1);
  pinned = true; ack.resolve({}); await pin; await h.flush();
  assert.equal(h.view.sessions[0].pinned, true);
  assert.deepEqual(JSON.parse(JSON.stringify(h.requests.find(({ method }) => method === "sessions.patch").params)),
    { key: "session-a", pinned: true });
  h.handlers["sessions.patch"] = async () => { throw new Error("pin unavailable"); };
  await assert.rejects(h.view.pinSession("session-a", false), /pin unavailable/); await h.flush();
  assert.equal(h.view.sessions[0].pinned, true); assert.match(h.view.notice, /pin unavailable/);
  h.handlers["sessions.patch"] = () => { pinned = false; return {}; };
  await h.view.pinSession("session-a", false); await h.flush();
  assert.equal(h.view.sessions[0].pinned, false, "a failed pin does not retain its single-flight lock");
  await h.runtime({ connected: false }); await h.view.pinSession("session-a", true);
  assert.equal(h.requests.filter(({ method }) => method === "sessions.patch").length, 3);
});

test("new sessions require both channels, a ready model catalogue and a verified project ID", async () => {
  const projects = deferred(), h = harness({ listProjects: () => projects.promise });
  const created = deferred(); h.handlers["sessions.create"] = () => created.promise;
  await h.flush(); await h.open("session-a"); await h.edit("Existing draft");
  await h.view.createSession("project-a");
  assert.equal(h.requests.some(({ method }) => method === "sessions.create"), false);
  projects.resolve([{ id: "project-a", displayName: "Project A", agentId: "project-agent-b" }]); await h.flush();
  await h.view.createSession("unlisted"); await h.view.createSession("");
  await h.runtime({ setupReady: false }); await h.view.createSession("project-a");
  await h.runtime({ setupReady: true });
  const models = deferred(); h.handlers["models.list"] = () => models.promise;
  const refreshing = h.view.refreshModels(false); await h.flush(); await h.view.createSession("project-a");
  assert.equal(h.requests.some(({ method }) => method === "sessions.create"), false);
  models.resolve({ models: [fixtureModel] }); await refreshing; await h.flush();
  const creating = h.view.createSession("project-a");
  await h.view.createSession("project-a"); h.view.closeTab("session-a"); await h.flush();
  assert.equal(h.view.opening, true); assert.equal(h.view.activeKey, "session-a");
  const requests = h.requests.filter(({ method }) => method === "sessions.create");
  assert.equal(requests.length, 1); assert.equal(requests[0].params.projectId, "project-a");
  assert.equal(typeof requests[0].params.key, "string");
  assert.deepEqual(JSON.parse(JSON.stringify(requests[0].params)), { key: requests[0].params.key,
    projectId: "project-a", agentId: "project-agent-b" });
  created.resolve({ key: "native-created-key" }); await creating; await h.flush();
  assert.equal(h.view.activeKey, "native-created-key"); assert.equal(h.view.sessionProjects["native-created-key"], "project-a");
  assert.equal(h.view.draft, ""); await h.open("session-a"); assert.equal(h.view.draft, "Existing draft");
  const noModel = harness({ models: [], projects: [{ id: "project-a", displayName: "A" }] });
  await noModel.flush(); await noModel.view.createSession("project-a");
  assert.equal(noModel.requests.some(({ method }) => method === "sessions.create"), false);
});

test("failed native creation preserves the selected draft and releases the create lock", async () => {
  const h = harness(); await h.flush(); await h.open("session-a"); await h.edit("Do not lose this");
  h.handlers["sessions.create"] = async () => { throw new Error("cannot create"); };
  await h.view.createSession(); await h.flush();
  assert.equal(h.view.opening, false); assert.equal(h.view.activeKey, "session-a"); assert.equal(h.view.draft, "Do not lose this");
  h.handlers["sessions.create"] = () => ({ key: "native-new" });
  await h.view.createSession(); await h.flush();
  assert.equal(h.view.activeKey, "native-new");
  const creates = h.requests.filter(({ method }) => method === "sessions.create");
  assert.equal(creates.length, 2); assert.equal(Object.hasOwn(creates[1].params, "projectId"), false);
  assert.equal(Object.hasOwn(creates[1].params, "agentId"), false);
});

test("closing selected and final tabs preserves their drafts and files and fences late history", async () => {
  const h = harness(), old = deferred(); await h.flush(); await h.open("session-a"); await h.edit("Draft A");
  h.view.addFiles([selectedFile()]); await h.flush();
  await h.open("session-b"); await h.edit("Draft B"); await h.open("session-a");
  h.handlers["chat.history"] = ({ sessionKey }) => sessionKey === "session-a" ? old.promise : { messages: [row("B history")] };
  const reading = h.view.loadHistory("session-a");
  h.view.closeTab("session-a"); await h.flush();
  assert.equal(h.view.activeKey, "session-b"); assert.equal(h.view.draft, "Draft B");
  assert.deepEqual(Array.from(h.view.openKeys), ["session-b"]);
  old.resolve({ messages: [row("Late A")], sessionInfo: { ...thinkingHistory("high").sessionInfo } });
  await reading; await h.flush();
  assert.equal(h.view.messages[0].content, "B history"); assert.equal(h.view.thinking.level, null);
  const last = deferred(); h.handlers["chat.history"] = () => last.promise;
  const lastRead = h.view.loadHistory("session-b");
  h.view.closeTab("session-b"); await h.flush();
  assert.equal(h.view.activeKey, null); assert.equal(h.view.historyReady, false); assert.equal(h.view.canSubmit, false);
  assert.equal(h.view.draft, ""); assert.equal(h.view.openKeys.length, 0);
  last.resolve({ messages: [row("Late B")] }); await lastRead; await h.flush();
  assert.equal(h.view.messages.length, 0);
  h.handlers["chat.history"] = () => ({ messages: [] });
  await h.open("session-a"); assert.equal(h.view.draft, "Draft A"); assert.equal(h.view.attachments[0].name, "brief.txt");
  await h.open("session-b"); assert.equal(h.view.draft, "Draft B");
  assert.equal(h.requests.some(({ method }) => ["sessions.delete", "sessions.reset", "chat.abort", "sessions.send"].includes(method)), false);
});

test('Thinking dock opens alongside chat during an active run or lost connection without changing session, drafts or subscriptions', async () => {
  const h = harness(); await h.flush(); await h.open('session-a'); await h.edit('Keep my draft');
  h.view.addFiles([selectedFile()]); await h.flush();
  await h.event({ sessionKey: 'session-a', runId: 'native-run', seq: 1, state: 'delta', deltaText: 'Working' });
  const before = h.requests.length;
  h.view.openThinking(); await h.flush();
  assert.equal(h.view.workspaceView, 'chat'); assert.equal(h.view.dockTab, 'thinking'); assert.equal(h.view.rightHidden, false); assert.equal(h.view.run.runId, 'native-run');
  assert.equal(h.view.draft, 'Keep my draft'); assert.equal(h.view.attachments[0].name, 'brief.txt');
  h.view.navigateWorkspace('chat'); await h.flush();
  assert.equal(h.view.workspaceView, 'chat'); assert.equal(h.requests.length, before);
  await h.runtime({ connected: false }); h.view.openThinking(); await h.flush();
  assert.equal(h.view.workspaceView, 'chat'); assert.equal(h.view.dockTab, 'thinking'); assert.equal(h.view.rightHidden, false); assert.equal(h.view.activeKey, 'session-a');
});

test("closing an inactive tab keeps the current draft and all tabs remain protected during a run", async () => {
  const h = harness(); await h.flush(); await h.open("session-a"); await h.edit("A");
  await h.open("session-b"); await h.edit("B");
  h.view.closeTab("session-a"); await h.flush();
  assert.equal(h.view.activeKey, "session-b"); assert.equal(h.view.draft, "B");
  await h.open("session-a"); assert.equal(h.view.draft, "A");
  await h.event({ sessionKey: "session-a", runId: "native-run", seq: 1, state: "delta", deltaText: "Working" });
  h.view.closeTab("session-b"); h.view.closeTab("session-a"); await h.view.changeThinking("high"); await h.flush();
  assert.equal(h.view.busy, true); assert.equal(h.view.activeKey, "session-a"); assert.equal(h.view.openKeys.length, 2);
  assert.equal(h.requests.some(({ method }) => ["chat.abort", "sessions.patch"].includes(method)), false);
});
