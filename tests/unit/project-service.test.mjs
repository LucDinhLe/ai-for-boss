import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProjectService } from '../../apps/desktop/electron/project-service.mjs';
import { ConversationService } from '../../apps/desktop/electron/conversation-service.mjs';

test('verified native deletion remains successful with a warning if the project index cannot be saved', async () => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(parent, 'aifb-project-metadata-'));
  try {
    const blocked = path.join(root, 'metadata'); await fs.writeFile(blocked, 'generated ordinary file');
    const service = new ProjectService({ directory: blocked, request: async () => { throw new Error('No extra native request'); } });
    const result = await service.withConversationDeletion(async () => ({ ok: true, key: 'agent:fixture:deleted' }));
    assert.equal(result.ok, true); assert.equal(result.key, 'agent:fixture:deleted'); assert.match(result.warning, /Đã xóa hội thoại/);
    assert.equal(await fs.readFile(blocked, 'utf8'), 'generated ordinary file');
  } finally {
    assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-project-metadata-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('folder projects persist bindings, isolate agent Home, save exact attachment bytes and paginate native history', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-project-test-'))), calls = [];
  const options = { directory: path.join(root, 'product'), chooseDirectory: async () => root, openDirectory: async () => {}, request: async (method, params) => {
    calls.push({ method, params });
    if (method === 'agents.list') return { defaultId: 'main', agents: [{ id: 'main' }] };
    if (method === 'sessions.create') return { key: params.key };
    if (method === 'sessions.describe') return { session: { key: params.key, sessionId: params.key } };
    if (method === 'chat.history') return params.offset === 0 ? { messages: [{ role: 'assistant', content: 'Kết quả' }], hasMore: true, nextOffset: 1 }
      : { messages: [{ role: 'user', content: 'Yêu cầu' }], hasMore: false };
    throw new Error(method);
  } };
  try {
    const service = new ProjectService(options);
    const project = await service.run({ action: 'project-create', name: 'Kế hoạch' });
    const second = await service.run({ action: 'project-create', name: 'Kế hoạch' });
    assert.notEqual(project.directory, second.directory);
    const requestId = randomUUID();
    const session = await service.run({ action: 'project-session', projectId: project.id, agentId: 'main', requestId });
    assert.equal(calls.find(c => c.method === 'sessions.create').params.cwd, project.directory);
    const reopened = await new ProjectService(options).run({ action: 'project-list' });
    assert.equal(reopened.sessions[session.key], project.id);
    const bytes = Buffer.from('Tài liệu thực trong fixture');
    await service.run({ action: 'project-attachments', sessionKey: session.key, files: [{ fileName: 'ghi chú.txt', mimeType: 'text/plain', content: bytes.toString('base64'), sizeBytes: bytes.length }] });
    const files = await fs.readdir(path.join(project.directory, 'Tai lieu'));
    assert.deepEqual(await fs.readFile(path.join(project.directory, 'Tai lieu', files[0])), bytes);
    const result = await service.run({ action: 'project-sync', sessionKey: session.key }); assert.equal(result.messages, 2);
    const exported = (await fs.readdir(path.join(project.directory, 'Lich su'))).find(f => f.endsWith('.json'));
    const history = JSON.parse(await fs.readFile(path.join(project.directory, 'Lich su', exported), 'utf8'));
    assert.deepEqual(history.messages.map(m => m.role), ['user', 'assistant']);
    await assert.rejects(service.run({ action: 'project-create', name: '../escape' }), /ký tự/);
    await assert.rejects(service.run({ action: 'project-session', projectId: 'unknown', agentId: 'main', requestId: randomUUID() }), /Dự án/);
    await assert.rejects(service.run({ action: 'project-attachments', sessionKey: session.key, files: [{ fileName: '../evil.txt', mimeType: 'text/plain', content: 'eA==', sizeBytes: 1 }] }), /Tệp/);
    assert.equal(calls.some(c => c.method.startsWith('config.') || c.method.startsWith('exec.')), false);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('cancelled directory selection does not create a project or dispatch a native call', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-project-cancel-'));
  try {
    const service = new ProjectService({ directory: root, chooseDirectory: async () => null, request: async () => assert.fail('No native call') });
    assert.equal((await service.run({ action: 'project-create', name: 'Cancelled' })).cancelled, true);
    assert.equal((await service.run({ action: 'project-list' })).projects.length, 0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('project export rejects directory junctions and keeps the previous history on upstream failure', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-project-boundary-')));
  const options = { directory: path.join(root, 'product'), chooseDirectory: async () => root, request: async (method, params) => {
    if (method === 'agents.list') return { defaultId: 'main', agents: [{ id: 'main' }] };
    if (method === 'sessions.create') return { key: params.key };
    if (method === 'sessions.describe') return { session: { key: params.key, sessionId: params.key } };
    if (method === 'chat.history') return { messages: [{ role: 'assistant', content: 'Saved result' }], hasMore: false };
    throw new Error(method);
  } };
  let link;
  try {
    const service = new ProjectService(options), project = await service.run({ action: 'project-create', name: 'Boundary' });
    const session = await service.run({ action: 'project-session', projectId: project.id, requestId: randomUUID() });
    await service.run({ action: 'project-sync', sessionKey: session.key });
    const historyPath = path.join(project.directory, 'Lich su'), file = (await fs.readdir(historyPath)).find(f => f.endsWith('.json'));
    const original = await fs.readFile(path.join(historyPath, file));
    service.request = async () => { throw new Error('Disconnected'); };
    await assert.rejects(service.run({ action: 'project-sync', sessionKey: session.key }), /Disconnected/);
    assert.deepEqual(await fs.readFile(path.join(historyPath, file)), original);
    await service.recordReview({ key: session.key, id: randomUUID(), phase: 'completed', finalReview: { pass: true } });
    assert.ok((await fs.readdir(path.join(project.directory, 'Ket qua'))).some(f => f.startsWith('advisor-')));
    const outside = path.join(root, 'outside'); await fs.mkdir(outside);
    link = path.join(project.directory, 'Tai lieu'); await fs.rmdir(link);
    await fs.symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(service.run({ action: 'project-attachments', sessionKey: session.key,
      files: [{ fileName: 'test.txt', content: 'eA==', sizeBytes: 1 }] }), /liên kết/);
    assert.deepEqual(await fs.readdir(outside), []);
  } finally { if (link) await fs.rm(link, { force: true }); await fs.rm(root, { recursive: true, force: true }); }
});

test('agent icon is passed through the native create contract and must be read back before use', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aifb-agent-icon-'));
  let soul = 'Native seed', emoji, wrongReadback = false;
  const service = new ProjectService({ directory: root, request: async (method, params) => {
    if (method === 'models.list') return { models: [{ provider: 'fixture', id: 'model', available: true }] };
    if (method === 'agents.create') { emoji = params.emoji; assert.deepEqual(params, { name: 'Planner', model: 'fixture/model', emoji: '🎯' }); return { ok: true, agentId: 'planner' }; }
    if (method === 'agents.list') return { agents: [{ id: 'planner', identity: { emoji: wrongReadback ? '🤖' : emoji } }] };
    if (method === 'agents.files.get') return { file: { content: soul } };
    if (method === 'agents.files.set') { soul = params.content; return { ok: true }; }
    throw new Error(method);
  } });
  const input = { action: 'agent-create', name: 'Planner', role: 'Planning', goal: 'Clear priorities', model: 'fixture/model', emoji: '🎯' };
  try {
    await assert.rejects(service.run({ ...input, emoji: 'https://example.com/avatar.png' }));
    assert.equal((await service.run(input)).identity.emoji, '🎯');
    assert.equal((await service.run({ action: 'project-list' })).agents.planner.status, 'ready');
    wrongReadback = true;
    await assert.rejects(service.run(input), /biểu tượng/);
    assert.equal((await service.run({ action: 'project-list' })).agents.planner.status, 'configuring');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('agent create waits for its exact runtime roster entry before reading or writing its Home', async () => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(parent, 'aifb-agent-visibility-'));
  let creates = 0, rosters = 0, visible = false, soul = 'Existing native content';
  const fileCalls = [];
  const service = new ProjectService({ directory: root, request: async (method, params) => {
    if (method === 'models.list') return { models: [{ provider: 'fixture', id: 'model', available: true }] };
    if (method === 'agents.create') { creates++; return { ok: true, agentId: 'planner' }; }
    if (method === 'agents.list') {
      visible = ++rosters >= 3;
      return { agents: [{ id: 'another-planner', identity: { emoji: '🎯' } }, ...(visible ? [{ id: 'planner', identity: { emoji: '🎯' } }] : [])] };
    }
    if (method.startsWith('agents.files.')) {
      assert.equal(visible, true, 'No Home access before native application');
      assert.equal(params.agentId, 'planner'); fileCalls.push(method);
      if (method === 'agents.files.get') return { file: { content: soul } };
      soul = params.content; return { ok: true };
    }
    throw new Error(method);
  } });
  try {
    const result = await service.run({ action: 'agent-create', name: 'Planner', role: 'Plan safely', goal: 'Readback', model: 'fixture/model', emoji: '🎯' });
    assert.equal(result.id, 'planner'); assert.equal(creates, 1); assert.equal(rosters, 4);
    assert.deepEqual(fileCalls, ['agents.files.get', 'agents.files.set', 'agents.files.get']);
    assert.ok(soul.startsWith('Existing native content')); assert.match(soul, /Plan safely/u);
    assert.equal((await service.run({ action: 'project-list' })).agents.planner.status, 'ready');
  } finally { assert.equal(path.dirname(root), parent); await fs.rm(root, { recursive: true, force: true }); }
});

test('unapplied agent create stops after bounded readback without duplicate creation or Home writes', async () => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(parent, 'aifb-agent-unapplied-'));
  let creates = 0, rosters = 0;
  const service = new ProjectService({ directory: root, request: async method => {
    if (method === 'models.list') return { models: [{ provider: 'fixture', id: 'model', available: true }] };
    if (method === 'agents.create') { creates++; return { ok: true, agentId: 'pending' }; }
    if (method === 'agents.list') { rosters++; return { agents: [{ id: 'different' }] }; }
    assert.fail('No file access or other mutation before the exact roster entry');
  } });
  try {
    await assert.rejects(service.run({ action: 'agent-create', name: 'Pending', role: 'Retained role', goal: 'Retained goal', model: 'fixture/model' }), /đã được tạo.*không tạo lại/u);
    assert.equal(creates, 1); assert.equal(rosters, 20);
    const pending = (await service.run({ action: 'project-list' })).agents.pending;
    assert.equal(pending.status, 'configuring'); assert.equal(pending.role, 'Retained role');
  } finally { assert.equal(path.dirname(root), parent); await fs.rm(root, { recursive: true, force: true }); }
});

test('agent visibility readback disconnect retains configuring state without retrying creation', async () => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.mkdtemp(path.join(parent, 'aifb-agent-disconnect-'));
  const calls = [];
  const service = new ProjectService({ directory: root, request: async method => {
    calls.push(method);
    if (method === 'models.list') return { models: [{ provider: 'fixture', id: 'model', available: true }] };
    if (method === 'agents.create') return { ok: true, agentId: 'pending' };
    if (method === 'agents.list') throw new Error('Native disconnect details');
    assert.fail('No mutation after disconnect');
  } });
  try {
    await assert.rejects(service.run({ action: 'agent-create', name: 'Pending', role: 'Role', goal: 'Goal', model: 'fixture/model' }), error => /đã được tạo/u.test(error.message) && !error.message.includes('Native disconnect details'));
    assert.deepEqual(calls, ['models.list', 'agents.create', 'agents.list']);
    assert.equal((await service.run({ action: 'project-list' })).agents.pending.status, 'configuring');
  } finally { assert.equal(path.dirname(root), parent); await fs.rm(root, { recursive: true, force: true }); }
});

test('queued and active exports share one native read/write per key, preserve other keys and never reuse a completed snapshot', async context => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.realpath(await fs.mkdtemp(path.join(parent, 'aifb-project-coalesce-')));
  let releaseHistory, enteredHistory, revision = 1;
  const entered = new Promise(resolve => { enteredHistory = resolve; }), historyCalls = [], writes = [];
  const service = new ProjectService({ directory: path.join(root, 'product'), chooseDirectory: async () => root,
    request: async (method, params) => {
      if (method === 'agents.list') return { defaultId: 'main', agents: [{ id: 'main' }] };
      if (method === 'sessions.create') return { key: params.key };
    if (method === 'sessions.describe') return { session: { key: params.key, sessionId: params.key } };
      if (method === 'chat.history') {
        historyCalls.push(params.sessionKey);
        if (historyCalls.length === 1) { enteredHistory(); await new Promise(resolve => { releaseHistory = resolve; }); }
        return { messages: [{ role: 'assistant', content: `Native revision ${revision} for ${params.sessionKey}` }], hasMore: false };
      }
      throw new Error(method);
    } });
  let renameSpy;
  try {
    const project = await service.run({ action: 'project-create', name: 'Concurrent exports' });
    const first = await service.run({ action: 'project-session', projectId: project.id, requestId: randomUUID() });
    const other = await service.run({ action: 'project-session', projectId: project.id, requestId: randomUUID() });
    const rename = fs.rename;
    renameSpy = context.mock.method(fs, 'rename', async (from, to) => { writes.push(to); return rename(from, to); });
    const active = service.run({ action: 'project-sync', sessionKey: first.key });
    assert.strictEqual(service.run({ action: 'project-sync', sessionKey: first.key }), active, 'queued duplicate shares the same work');
    await entered;
    const listing = service.run({ action: 'project-list' });
    assert.strictEqual(service.run({ action: 'project-sync', sessionKey: first.key }), active, 'active duplicate does not append another export before later actions');
    const second = service.run({ action: 'project-sync', sessionKey: other.key });
    assert.notStrictEqual(second, active);
    assert.strictEqual(service.run({ action: 'project-sync', sessionKey: other.key }), second);
    await assert.rejects(service.run({ action: 'project-sync', sessionKey: first.key, path: 'arbitrary' }), /hợp lệ/);
    assert.deepEqual(historyCalls, [first.key]);
    releaseHistory();
    assert.equal((await active).saved, true); assert.equal((await listing).projects.length, 1); assert.equal((await second).saved, true);
    assert.deepEqual(historyCalls, [first.key, other.key]);
    assert.equal(writes.length, 6, 'one JSON, Markdown and answer export per distinct key');
    assert.equal(new Set(writes).size, 6);
    revision = 2;
    const fresh = service.run({ action: 'project-sync', sessionKey: first.key }); assert.notStrictEqual(fresh, active); await fresh;
    assert.deepEqual(historyCalls, [first.key, other.key, first.key]); assert.equal(writes.length, 9);
    const exports = await fs.readdir(path.join(project.directory, 'Lich su'));
    const rows = await Promise.all(exports.filter(file => file.endsWith('.json')).map(async file => JSON.parse(await fs.readFile(path.join(project.directory, 'Lich su', file), 'utf8'))));
    assert.equal(rows.find(row => row.sessionKey === first.key).messages[0].content, `Native revision 2 for ${first.key}`);
    assert.equal(rows.find(row => row.sessionKey === other.key).messages[0].content, `Native revision 1 for ${other.key}`);
  } finally {
    releaseHistory?.(); renameSpy?.mock.restore();
    assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-project-coalesce-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('failed shared export releases its key so retry reads native history and writes normally', async () => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.realpath(await fs.mkdtemp(path.join(parent, 'aifb-project-retry-')));
  let failHistory, enteredHistory, calls = 0;
  const entered = new Promise(resolve => { enteredHistory = resolve; });
  const service = new ProjectService({ directory: path.join(root, 'product'), chooseDirectory: async () => root,
    request: async (method, params) => {
      if (method === 'agents.list') return { defaultId: 'main', agents: [{ id: 'main' }] };
      if (method === 'sessions.create') return { key: params.key };
    if (method === 'sessions.describe') return { session: { key: params.key, sessionId: params.key } };
      if (method === 'chat.history') {
        calls++;
        if (calls === 1) { enteredHistory(); return new Promise((_, reject) => { failHistory = reject; }); }
        return { messages: [{ role: 'assistant', content: 'Recovered native answer' }], hasMore: false };
      }
      throw new Error(method);
    } });
  try {
    const project = await service.run({ action: 'project-create', name: 'Retry export' });
    const session = await service.run({ action: 'project-session', projectId: project.id, requestId: randomUUID() });
    const first = service.run({ action: 'project-sync', sessionKey: session.key }); await entered;
    const duplicate = service.run({ action: 'project-sync', sessionKey: session.key }); assert.strictEqual(first, duplicate);
    const failed = Promise.allSettled([first, duplicate]); failHistory(new Error('Delayed native disconnect'));
    assert.ok((await failed).every(item => item.status === 'rejected')); assert.equal(calls, 1);
    assert.deepEqual(await fs.readdir(path.join(project.directory, 'Lich su')), []);
    assert.equal((await service.run({ action: 'project-sync', sessionKey: session.key })).saved, true); assert.equal(calls, 2);
    const file = (await fs.readdir(path.join(project.directory, 'Ket qua')))[0];
    assert.equal(await fs.readFile(path.join(project.directory, 'Ket qua', file), 'utf8'), 'Recovered native answer');
  } finally {
    assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-project-retry-'));
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('conversation deletion serializes with exports and uncertain deletion never overwrites retained project files', async context => {
  for (const outcome of ['success', 'failure-before-delete', 'lost-ack-after-delete']) await context.test(outcome, async () => {
    const parent = await fs.realpath(os.tmpdir()), root = await fs.realpath(await fs.mkdtemp(path.join(parent, 'aifb-project-delete-')));
    let row, nativeDeletes = 0, mode = outcome, blockHistory = false, enteredHistory, releaseHistory;
    const historyEntered = new Promise(resolve => { enteredHistory = resolve; });
    const request = async (method, params) => {
      if (method === 'agents.list') return { defaultId: 'main', agents: [{ id: 'main' }] };
      if (method === 'sessions.create') { row = { key: params.key, sessionId: 'original-id', updatedAt: 10 }; return { key: params.key }; }
      if (method === 'sessions.describe') return { session: row ? { ...row } : null };
      if (method === 'chat.history') {
        if (blockHistory && params.maxChars) { blockHistory = false; enteredHistory(); await new Promise(resolve => { releaseHistory = resolve; }); }
        return { messages: row ? [{ role: 'assistant', content: 'Retain this project answer' }] : [], hasMore: false };
      }
      if (method === 'sessions.delete') {
        nativeDeletes++;
        if (mode === 'failure-before-delete') throw new Error('Native delete refused');
        row = null;
        if (mode === 'lost-ack-after-delete') throw new Error('Native delete ACK lost');
        return { ok: true, key: params.key, deleted: true };
      }
      throw new Error(method);
    };
    const projects = new ProjectService({ directory: path.join(root, 'product'), chooseDirectory: async () => root, request });
    const conversations = new ConversationService(request);
    try {
      const project = await projects.run({ action: 'project-create', name: 'Retained exports' });
      const session = await projects.run({ action: 'project-session', projectId: project.id, requestId: randomUUID() });
      await projects.run({ action: 'project-sync', sessionKey: session.key });
      const snapshot = async () => {
        const result = {};
        for (const sub of ['Lich su', 'Ket qua']) for (const file of await fs.readdir(path.join(project.directory, sub))) result[`${sub}/${file}`] = await fs.readFile(path.join(project.directory, sub, file), 'utf8');
        return result;
      };
      const preview = await conversations.run({ action: 'conversation-inspect', key: session.key });
      blockHistory = true;
      const active = projects.run({ action: 'project-sync', sessionKey: session.key }); await historyEntered;
      const deleting = projects.withConversationDeletion(() => conversations.run({ action: 'conversation-delete', ticket: preview.ticket }));
      const settledDelete = deleting.then(result => ({ result }), error => ({ error }));
      assert.equal(nativeDeletes, 0, 'native deletion waits for the earlier export');
      releaseHistory(); await active;
      const retained = await snapshot();
      const queuedSync = projects.run({ action: 'project-sync', sessionKey: session.key });
      const result = await settledDelete, synchronized = await queuedSync;
      if (outcome === 'success') {
        assert.equal(result.result.ok, true); assert.equal(synchronized.saved, false);
        assert.equal((await projects.run({ action: 'project-list' })).sessions[session.key], undefined);
      } else {
        assert.ok(result.error); assert.equal((await projects.run({ action: 'project-list' })).sessions[session.key], project.id);
        if (outcome === 'lost-ack-after-delete') {
          assert.equal(synchronized.saved, false);
          await assert.rejects(conversations.run({ action: 'conversation-inspect', key: session.key }), /không còn/);
          assert.equal(nativeDeletes, 1, 'missing native target cannot issue a new delete');
        } else {
          assert.equal(synchronized.saved, true);
          mode = 'success';
          const retry = await conversations.run({ action: 'conversation-inspect', key: session.key });
          assert.equal((await projects.withConversationDeletion(() => conversations.run({ action: 'conversation-delete', ticket: retry.ticket }))).ok, true);
          assert.equal(nativeDeletes, 2);
        }
      }
      const after = await snapshot();
      if (outcome === 'failure-before-delete') {
        // A valid live export may refresh exportedAt; its exact history and result stay intact.
        for (const key of Object.keys(after)) if (key.endsWith('.json')) { const a = JSON.parse(after[key]), b = JSON.parse(retained[key]); delete a.exportedAt; delete b.exportedAt; assert.deepEqual(a, b); } else assert.equal(after[key], retained[key]);
      } else assert.deepEqual(after, retained);
    } finally { releaseHistory?.(); assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-project-delete-')); await fs.rm(root, { recursive: true, force: true }); }
  });
});

test('missing or replaced session at the final public snapshot preserves every existing export', async () => {
  const parent = await fs.realpath(os.tmpdir()), root = await fs.realpath(await fs.mkdtemp(path.join(parent, 'aifb-project-identity-')));
  let row, afterRead;
  const service = new ProjectService({ directory: path.join(root, 'product'), chooseDirectory: async () => root, request: async (method, params) => {
    if (method === 'agents.list') return { defaultId: 'main', agents: [{ id: 'main' }] };
    if (method === 'sessions.create') { row = { key: params.key, sessionId: 'original' }; return { key: params.key }; }
    if (method === 'sessions.describe') return { session: row };
    if (method === 'chat.history') { if (afterRead) afterRead(); return { messages: [{ role: 'assistant', content: afterRead ? 'Must not overwrite' : 'Original export' }], hasMore: false }; }
    throw new Error(method);
  } });
  try {
    const project = await service.run({ action: 'project-create', name: 'Public identity guard' });
    const session = await service.run({ action: 'project-session', projectId: project.id, requestId: randomUUID() });
    await service.run({ action: 'project-sync', sessionKey: session.key });
    const file = path.join(project.directory, 'Lich su', (await fs.readdir(path.join(project.directory, 'Lich su'))).find(name => name.endsWith('.json')));
    const original = await fs.readFile(file, 'utf8');
    afterRead = () => { row = null; };
    assert.equal((await service.run({ action: 'project-sync', sessionKey: session.key })).saved, false); assert.equal(await fs.readFile(file, 'utf8'), original);
    row = { key: session.key, sessionId: 'original' }; afterRead = () => { row = { ...row, sessionId: 'replacement' }; };
    await assert.rejects(service.run({ action: 'project-sync', sessionKey: session.key }), /đã thay đổi/); assert.equal(await fs.readFile(file, 'utf8'), original);
  } finally { assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-project-identity-')); await fs.rm(root, { recursive: true, force: true }); }
});
