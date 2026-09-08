import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';

const uuid = /^[0-9a-f-]{36}$/u;
function fields(input, keys) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !keys.includes(k))) throw new Error('Yêu cầu chưa hợp lệ.');
}
function text(value, max = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || [...value].some(c => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)))) throw new Error('Nội dung chưa hợp lệ.');
  return value.trim();
}
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
export const messageText = content => typeof content === 'string' ? content : Array.isArray(content)
  ? content.filter(p => typeof p?.text === 'string').map(p => p.text).join('\n') : '';

/** Only app-owned metadata/projections. Native state and Agent Homes are never filesystem inputs. */
export class ProjectService {
  #tail = Promise.resolve();
  #syncs = new Map();
  constructor({ directory, request, chooseDirectory, openDirectory }) { Object.assign(this, { directory, request, chooseDirectory, openDirectory }); }
  run(input) {
    let syncKey;
    if (input?.action === 'project-sync') {
      try { fields(input, ['action', 'sessionKey']); syncKey = text(input.sessionKey, 4096); }
      catch (error) { return Promise.reject(error); }
      if (this.#syncs.has(syncKey)) return this.#syncs.get(syncKey);
      input = { action: 'project-sync', sessionKey: syncKey };
    }
    const queued = this.#tail.then(() => this.#run(input));
    // Share only queued/active exports. A later request always reads native history again.
    const work = syncKey ? queued.finally(() => { this.#syncs.delete(syncKey); }) : queued;
    if (syncKey) this.#syncs.set(syncKey, work);
    this.#tail = work.catch(() => {});
    return work;
  }
  withConversationDeletion(remove) {
    const work = this.#tail.then(async () => {
      const result = await remove();
      if (result?.ok === true && typeof result.key === 'string') {
        try {
          const data = await this.#load();
          if (Object.hasOwn(data.sessions, result.key)) {
            delete data.sessions[result.key];
            await this.#save(data);
          }
        } catch {
          return { ...result, warning: 'Đã xóa hội thoại; chưa cập nhật liên kết dự án. Tệp đã lưu vẫn được giữ.' };
        }
      }
      return result;
    });
    this.#tail = work.catch(() => {});
    return work;
  }
  recordReview(review) {
    const work = this.#tail.then(async () => {
      const data = await this.#load(), project = data.projects.find(p => p.id === data.sessions[review.key]);
      if (!project) return;
      const folder = await this.#folder(project, 'Ket qua');
      await this.#write(path.join(folder, `advisor-${digest(review.id)}.json`), { source: 'AI for Boss supervised run', ...review });
    });
    this.#tail = work.catch(() => {}); return work;
  }
  async #load() {
    await fs.mkdir(this.directory, { recursive: true });
    try {
      const value = JSON.parse(await fs.readFile(path.join(this.directory, 'projects.json'), 'utf8'));
      if (value.version !== 1 || !Array.isArray(value.projects) || !value.sessions || !value.agents) throw new Error('Metadata dự án chưa hợp lệ.');
      return value;
    } catch (error) { if (error.code === 'ENOENT') return { version: 1, projects: [], sessions: {}, agents: {} }; throw error; }
  }
  async #write(file, value) {
    try { if ((await fs.lstat(file)).isSymbolicLink()) throw new Error('Không ghi qua liên kết thư mục.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const temp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2), { flag: 'wx' });
    await fs.rename(temp, file);
  }
  #save(data) { return this.#write(path.join(this.directory, 'projects.json'), data); }
  async #folder(project, sub = '') {
    if (!project || !uuid.test(project.id.slice(5))) throw new Error('Dự án chưa hợp lệ.');
    if ((await fs.lstat(project.directory)).isSymbolicLink() || await fs.realpath(project.directory) !== project.directory) throw new Error('Đường dẫn dự án đã đổi.');
    const target = path.join(project.directory, sub);
    if (sub) {
      if (!['Tai lieu', 'Lich su', 'Ket qua'].includes(sub)) throw new Error('Thư mục chưa hợp lệ.');
      if ((await fs.lstat(target)).isSymbolicLink() || await fs.realpath(target) !== target) throw new Error('Không dùng liên kết ngoài dự án.');
    }
    return target;
  }
  async #agent(id) {
    const roster = await this.request('agents.list', {});
    const agentId = id || roster.defaultId;
    if (!roster.agents?.some(a => a.id === agentId)) throw new Error('Agent không còn khả dụng.');
    return agentId;
  }
  async #awaitCreatedAgent(agentId) {
    // Native create ACKs persistence; file APIs use the asynchronously applied roster.
    // Never repeat creation or touch the Agent Home until this exact ID becomes visible.
    for (let attempt = 0; attempt < 20; attempt++) {
      let roster;
      try { roster = await this.request('agents.list', {}); }
      catch { break; }
      if (!Array.isArray(roster?.agents)) break;
      if (roster.agents.some(agent => agent.id === agentId)) return;
      if (attempt < 19) await pause(250);
    }
    throw new Error('Agent đã được tạo nhưng Gateway chưa xác nhận sẵn sàng. Trạng thái cấu hình được giữ lại; hãy tải lại danh sách, không tạo lại agent.');
  }
  async #run(input) {
    const data = await this.#load();
    switch (input?.action) {
      case 'project-list':
        fields(input, ['action']); return { projects: data.projects, sessions: data.sessions, agents: data.agents };
      case 'project-create': {
        fields(input, ['action', 'name']); const name = text(input.name, 100);
        if (/[<>:"/\\|?*\r\n]/u.test(name) || /[. ]$/u.test(name)) throw new Error('Tên dự án có ký tự không dùng được trong thư mục.');
        const parent = await this.chooseDirectory(); if (!parent) return { cancelled: true };
        const root = await fs.realpath(parent), id = `aifb:${randomUUID()}`;
        // New child only; never adopts, overwrites or moves existing user data.
        const folder = path.join(root, `${name} - ${id.slice(5, 13)}`);
        await fs.mkdir(folder);
        const directory = await fs.realpath(folder);
        const project = { id, displayName: name, directory, source: 'aifb', createdAt: Date.now() };
        for (const sub of ['Tai lieu', 'Lich su', 'Ket qua']) await fs.mkdir(path.join(directory, sub));
        await this.#write(path.join(directory, 'DU-AN.md'), `# ${name}\n\nTai lieu: tệp đã thêm. Lich su: bản xuất qua API OpenClaw, không phải bản sao lưu toàn bộ runtime. Ket qua: kết quả công việc.\n`);
        data.projects.push(project); await this.#save(data); return project;
      }
      case 'project-open': {
        fields(input, ['action', 'projectId']); const project = data.projects.find(p => p.id === input.projectId);
        await this.openDirectory(await this.#folder(project)); return { ok: true };
      }
      case 'agent-session':
      case 'project-session': {
        fields(input, ['action', 'projectId', 'agentId', 'requestId']);
        if (!uuid.test(input.requestId ?? '')) throw new Error('Mã phiên chưa hợp lệ.');
        const project = data.projects.find(p => p.id === input.projectId);
        const cwd = input.action === 'project-session' ? await this.#folder(project) : undefined, agentId = await this.#agent(input.agentId);
        const key = `agent:${agentId}:aifb-${input.requestId}`;
        if (data.sessions[key] && data.sessions[key] !== project?.id) throw new Error('Phiên thuộc dự án khác.');
        // Persist intent first: restart/retry uses the same native key, never creates an invisible duplicate.
        if (project) { data.sessions[key] = project.id; await this.#save(data); }
        if (data.agents[agentId]?.status === 'configuring') throw new Error('Agent chưa hoàn tất cấu hình.');
        const created = await this.request('sessions.create', { key, agentId, ...(cwd ? { cwd } : {}) });
        if (created.key !== key) throw new Error('Chưa xác nhận phiên; tải lại dự án trước khi thử tiếp.');
        return { key, projectId: project?.id };
      }
      case 'project-attachments': {
        fields(input, ['action', 'sessionKey', 'files']);
        const project = data.projects.find(p => p.id === data.sessions[input.sessionKey]);
        if (!project) return { saved: false };
        const folder = await this.#folder(project, 'Tai lieu');
        if (!Array.isArray(input.files) || input.files.length > 4) throw new Error('Quá nhiều tệp.');
        let total = 0;
        const files = input.files.map(file => {
          fields(file, ['fileName', 'content', 'mimeType', 'type', 'sizeBytes']);
          const name = text(file.fileName, 255);
          if (/[\\/:<>"|?*\r\n]/u.test(name) || /[. ]$/u.test(name) || !/^[A-Za-z0-9+/]+={0,2}$/u.test(file.content ?? '')) throw new Error('Tệp không hợp lệ.');
          const bytes = Buffer.from(file.content, 'base64'); total += bytes.length;
          if (bytes.length !== file.sizeBytes || total > 8 * 1024 * 1024) throw new Error('Tệp vượt giới hạn.');
          if (bytes.subarray(0, 2).toString() === 'MZ' || bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))) throw new Error('Không lưu tệp thực thi vào dự án.');
          return { name, bytes, mimeType: text(file.mimeType), content: file.content };
        });
        for (const file of files) {
          const ext = path.extname(file.name).toLowerCase();
          const known = '.pdf .txt .md .csv .json .doc .docx .xls .xlsx .ppt .pptx .odt .ods .odp .png .jpg .jpeg .gif .webp .heic .heif .svg .bmp .tif .tiff .mp3 .wav .m4a .ogg .flac .mp4 .webm .mov'.split(' ').includes(ext);
          const safeName = file.name.length > 200 ? `${path.basename(file.name, ext).slice(0, 175)}${ext}` : file.name;
          await this.#write(path.join(folder, `${digest(file.bytes)}-${safeName}${known ? '' : '.bin'}`), file.bytes);
        }
        return { saved: true, count: files.length };
      }
      case 'project-sync': {
        fields(input, ['action', 'sessionKey']); const key = text(input.sessionKey, 4096);
        const project = data.projects.find(p => p.id === data.sessions[key]);
        if (!project) return { saved: false };
        const before = await this.request('sessions.describe', { key });
        if (before?.session === null) return { saved: false };
        if (before?.session?.key !== key || typeof before.session.sessionId !== 'string') throw new Error('Chưa xác nhận phiên để lưu lịch sử.');
        const sessionId = before.session.sessionId;
        const folder = await this.#folder(project, 'Lich su'), pages = [];
        let offset = 0, bytes = 0;
        for (let page = 0; page < 500; page++) {
          const history = await this.request('chat.history', { sessionKey: key, limit: 200, offset, maxChars: 500000 });
          if (!Array.isArray(history.messages)) throw new Error('Chưa đọc được lịch sử.');
          bytes += Buffer.byteLength(JSON.stringify(history.messages));
          if (bytes > 32 * 1024 * 1024) throw new Error('Lịch sử quá lớn cho một lần đồng bộ; bản trước được giữ.');
          pages.unshift(history.messages);
          if (history.hasMore !== true) {
            // A lost delete ACK or external deletion must never replace retained exports with an empty history.
            const current = await this.request('sessions.describe', { key });
            if (current?.session === null) return { saved: false };
            if (current?.session?.key !== key || current.session.sessionId !== sessionId) throw new Error('Phiên đã thay đổi; bản lịch sử đã lưu được giữ lại.');
            const messages = pages.flat();
            await this.#write(path.join(folder, `${digest(key)}.json`), { source: 'OpenClaw chat.history', sessionKey: key, exportedAt: Date.now(), messages });
            await this.#write(path.join(folder, `${digest(key)}.md`), messages.map(m => `## ${m.role}\n\n${messageText(m.content)}`).join('\n\n'));
            const answer = messageText(messages.filter(m => m.role === 'assistant').at(-1)?.content);
            if (answer) await this.#write(path.join(await this.#folder(project, 'Ket qua'), `${digest(key)}.md`), answer);
            return { saved: true, messages: messages.length };
          }
          if (!Number.isSafeInteger(history.nextOffset) || history.nextOffset <= offset) throw new Error('Phân trang lịch sử chưa hợp lệ.');
          offset = history.nextOffset;
        }
        throw new Error('Lịch sử vượt số trang trong một lần đồng bộ.');
      }
      case 'agent-create': {
        fields(input, ['action', 'name', 'role', 'goal', 'model', 'skills', 'emoji']);
        const name = text(input.name, 100), role = text(input.role, 2000), goal = text(input.goal, 2000), model = text(input.model, 350);
        const emoji = input.emoji ?? '🤖';
        if (!['🤖', '💼', '📊', '🎯', '✍️', '🎨', '🔎', '📚', '🧭', '💡', '🛠️', '🌱'].includes(emoji)) throw new Error('Chọn biểu tượng trong danh sách.');
        const catalog = await this.request('models.list', {});
        if (!catalog.models?.some(m => m.available === true && `${m.provider}/${m.id}` === model)) throw new Error('Mô hình chưa khả dụng.');
        const created = await this.request('agents.create', { name, model, emoji });
        if (!created.ok || !created.agentId) throw new Error('Chưa xác nhận tạo agent; tải lại trước khi thử tiếp.');
        data.agents[created.agentId] = { name, role, goal, model, emoji, status: 'configuring' };
        await this.#save(data);
        await this.#awaitCreatedAgent(created.agentId);
        const prior = await this.request('agents.files.get', { agentId: created.agentId, name: 'SOUL.md' });
        const content = `${prior.file?.content ?? ''}\n\n## Vai trò do người dùng cấu hình\n${role}\n\n## Mục tiêu\n${goal}\n`;
        await this.request('agents.files.set', { agentId: created.agentId, name: 'SOUL.md', content });
        const actual = await this.request('agents.files.get', { agentId: created.agentId, name: 'SOUL.md' });
        if (actual.file?.content !== content) throw new Error('Agent đã tạo nhưng chưa xác nhận vai trò; không tạo lại.');
        const roster = await this.request('agents.list', {});
        if (roster.agents?.find(item => item.id === created.agentId)?.identity?.emoji !== emoji) throw new Error('Agent đã tạo nhưng chưa xác nhận biểu tượng; tải lại danh sách, không tạo lại.');
        data.agents[created.agentId].status = 'ready'; await this.#save(data);
        return { id: created.agentId, name, identity: { emoji } };
      }
      default: throw new Error('Thao tác dự án chưa được hỗ trợ.');
    }
  }
}
