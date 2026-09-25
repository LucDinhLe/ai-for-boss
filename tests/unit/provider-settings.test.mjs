import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as providerOrder from '../../apps/desktop/src/provider-order.ts';
import * as providerAccounts from '../../apps/desktop/src/provider-accounts.ts';

const require = createRequire(import.meta.url);
const walk = node => node == null || typeof node === 'boolean' ? [] : Array.isArray(node) ? node.flatMap(walk)
  : typeof node !== 'object' ? [] : [node, ...walk(node.props?.children)];
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children)
  : node == null || typeof node === 'boolean' ? '' : String(node);

/**
 * The page holds three pieces of state in one order — cards, error, busy — so
 * the fixture answers `useState` from that queue and can render any moment of
 * the page without a DOM. Spec 0063 took the catalogue off this page, so asking
 * for it here is now a failure, not a fourth slot.
 */
function render(props, { cards = null, error = null, busy = null, defaultModel = null, labels = {}, manageCalls = [], setupCalls = [] } = {}) {
  const exports = {}, catalogueMounts = [], queue = [cards, error, busy, defaultModel, labels, null, '', null, null];
  let index = 0;
  const source = fs.readFileSync(new URL('../../apps/desktop/src/ProviderSettings.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { exports, window: { aiForBoss: { setup: { request: (method, params) => {
    setupCalls.push({ method, params }); return Promise.resolve({ providers: [] });
  } } } }, require: id => {
    if (id === 'react') return {
      useState: () => [queue[index++], () => {}],
      useEffect: () => {}, useRef: initial => ({ current: initial }), useCallback: fn => fn
    };
    if (id === './CapabilityCatalog') throw new Error('spec 0063: the provider page must not pull in the 84-entry catalogue');
    if (id === './BrandIcon') return { __esModule: true, default: 'brand-icon' };
    if (id === './WorkspaceSidebar') return { WorkbenchIcon: 'icon' };
    if (id === './provider-order') return providerOrder;
    if (id === './provider-accounts') return providerAccounts;
    if (id === './workbench-api') return { manage: input => { manageCalls.push(input); return Promise.resolve({}); } };
    return require(id);
  } });
  const tree = exports.default(props);
  catalogueMounts.push(...walk(tree).filter(node => node.type === 'catalogue').map(node => node.props));
  return { tree, catalogueMounts, manageCalls, setupCalls };
}

const models = [
  { id: 'gpt', provider: 'openai-codex', name: 'GPT', available: true },
  { id: 'claude', provider: 'anthropic', name: 'Claude', available: true },
  { id: 'claude-2', provider: 'anthropic', name: 'Claude 2', available: true },
  { id: 'gemini', provider: 'google', name: 'Gemini', available: false }
];
const status = [
  { provider: 'anthropic', status: 'ok', usage: { plan: 'Max', summary: 'còn 62% cửa sổ 5 giờ' }, profiles: [
    { profileId: 'anthropic:cong-ty', type: 'oauth', status: 'ok', logoutSupported: true },
    { profileId: 'anthropic:ca-nhan', type: 'oauth', status: 'expiring', expiry: { label: '2 ngày' }, logoutSupported: true }
  ] },
  { provider: 'openai-codex', status: 'static', profiles: [{ profileId: 'openai-codex:setup-3c9947ca-91f2-4d3a-88b1-9e0d', type: 'api_key', status: 'static' }] },
  { provider: 'google', status: 'missing', profiles: [] }
];
const cards = () => providerAccounts.providerCards(status, {
  order: { anthropic: ['anthropic:ca-nhan', 'anthropic:cong-ty'] },
  modelCounts: { 'openai-codex': 1, anthropic: 2 }
});

test('providerCards: order, tones, usage and model counts all come from the core', () => {
  const list = cards();
  assert.deepEqual(list.map(card => card.provider), ['openai-codex', 'anthropic', 'google'], 'popularity order, unconnected providers included');
  const anthropic = list.find(card => card.provider === 'anthropic');
  assert.deepEqual(anthropic.accounts.map(account => account.profileId), ['anthropic:ca-nhan', 'anthropic:cong-ty'], 'the stored order is what the page shows');
  assert.deepEqual(anthropic.accounts.map(account => account.primary), [true, false]);
  assert.equal(anthropic.accounts[0].health.tone, 'warn');
  assert.match(anthropic.accounts[0].health.label, /Sắp hết hạn · còn 2 ngày/);
  assert.equal(anthropic.accounts[0].name, 'ca-nhan');
  assert.equal(anthropic.accounts[0].kind, 'OAuth');
  assert.equal(anthropic.canReorder, true);
  assert.equal(anthropic.modelCount, 2);
  assert.equal(anthropic.usage, 'Max · còn 62% cửa sổ 5 giờ');
  const openai = list.find(card => card.provider === 'openai-codex');
  assert.equal(openai.accounts[0].name, null, 'a generated setup id is noise, and so is repeating the provider name');
  assert.equal(openai.accounts[0].kind, 'API key', 'so the row leads with what the account actually is');
  assert.equal(openai.accounts[0].kind, 'API key');
  assert.equal(openai.accounts[0].canLogout, false, 'the core did not say this one can be logged out');
  assert.equal(openai.canReorder, false, 'one account has no order to change');
  assert.equal(list.find(card => card.provider === 'google').accounts.length, 0);
});

test('projection: a stale stored order never hides a working account, and reorder respects the ends', () => {
  const profiles = [{ profileId: 'a', type: 'oauth', status: 'ok' }, { profileId: 'b', type: 'oauth', status: 'ok' }];
  assert.deepEqual(providerAccounts.orderProfiles(profiles, ['gone', 'b']).map(p => p.profileId), ['b', 'a']);
  assert.deepEqual(providerAccounts.orderProfiles(profiles, undefined).map(p => p.profileId), ['a', 'b']);
  assert.deepEqual(providerAccounts.reorder(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b']);
  assert.equal(providerAccounts.reorder(['a', 'b'], 'a', -1), null);
  assert.equal(providerAccounts.reorder(['a', 'b'], 'b', 1), null);
  assert.equal(providerAccounts.reorder(['a', 'b'], 'missing', 1), null);
  // A generated id is not a name, and neither is the provider's own name: three
  // OAuth logins under one provider would then all read the same and the rows
  // would be indistinguishable. Null means "lead with the kind instead".
  assert.equal(providerAccounts.accountName('openai:setup-3c9947ca9182'), null);
  assert.equal(providerAccounts.accountName('openai:work@example.com'), 'work@example.com');
});

const icons = tree => walk(tree).filter(node => node.type === 'button' && String(node.props.className ?? '').includes('pset__icon'));

test('the page reads like the reference screen: one add button, a card per provider with its pill, star and pencil (0067)', async () => {
  const clicks = [], manageCalls = [];
  const { tree, catalogueMounts } = render({ ready: true, models, onConnect: query => clicks.push(query ?? 'connect') },
    { cards: cards(), defaultModel: 'anthropic/claude', manageCalls });
  const rendered = text(tree);
  assert.match(rendered, /Cấu hình nhà cung cấp mô hình AI và API key/);
  assert.match(rendered, /Tài khoản primary được dùng trước/, 'the lead explains primary and fallback in one paragraph');
  assert.equal(catalogueMounts.length, 0, 'the full catalogue and its native scan stay off this page');
  assert.doesNotMatch(rendered, /Lõi còn hỗ trợ/, 'no dim tail of unconnected providers: the add dialog owns that');
  const add = walk(tree).find(node => node.type === 'button' && String(node.props.className).includes('pset__add'));
  assert.equal(text(add), 'Thêm nhà cung cấp');
  add.props.onClick(); assert.deepEqual(clicks, ['connect']);
  assert.match(rendered, /OAuth đang hoạt động/, 'one pill per card says what kind of connection and whether it works');
  assert.match(rendered, /API key đang hoạt động/);
  assert.match(rendered, /Openai-Codex/, 'the core id sits under the brand name');
  assert.match(rendered, /1ca-nhanprimary/, 'rows are numbered, and the first carries the primary badge');
  const cardsOnPage = walk(tree).filter(node => String(node.props?.className ?? '').startsWith('pcard ') || node.props?.className === 'pcard');
  assert.deepEqual(cardsOnPage.map(node => node.props.className), ['pcard', 'pcard pcard--default'],
    'the provider behind the default model is the outlined card');
  const stars = icons(tree).filter(node => node.props['aria-label']?.endsWith('làm nhà cung cấp mặc định'));
  assert.equal(stars.length, 2, 'every card has its star');
  const anthropicStar = stars.find(node => node.props['aria-label'].includes('Claude'));
  assert.equal(anthropicStar.props['aria-pressed'], true);
  assert.equal(anthropicStar.props.disabled, true, 'the default cannot be chosen again');
  stars.find(node => node.props['aria-label'].includes('ChatGPT')).props.onClick();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(JSON.stringify(manageCalls[0]), JSON.stringify({ action: 'default-model-set', model: 'openai-codex/gpt' }),
    'the star picks a model the core reports as available for that provider, through the fixed host action');
  const pencil = icons(tree).find(node => node.props['aria-label'] === 'Sửa kết nối Claude / Anthropic');
  pencil.props.onClick(); assert.deepEqual(clicks, ['connect', 'anthropic'], 'the pencil opens the dialog at that provider');
});

test('a provider with models but no stored account still shows up', () => {
  // Claude reached through the Claude Code CLI has models and no auth profile.
  const withCli = providerAccounts.providerCards(
    [{ provider: 'openai-codex', status: 'static', profiles: [{ profileId: 'openai-codex:setup-3c9947ca9182', type: 'api_key', status: 'static' }] }],
    { modelCounts: { 'openai-codex': 1, anthropic: 2 } });
  const anthropic = withCli.find(card => card.provider === 'anthropic');
  assert.ok(anthropic, 'a provider the core has models for is listed even with no credential of its own');
  assert.equal(anthropic.accounts.length, 0);
  assert.equal(anthropic.pill.label, 'Ứng dụng trên máy đang hoạt động');
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: withCli });
  assert.match(text(tree), /Chạy qua ứng dụng đã đăng nhập sẵn trên máy/, 'and the page says plainly why it has no account rows');
});

test('usage sits on every row, and says it is the provider figure, because the core has no per-account one', () => {
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: cards() });
  const meters = icons(tree).filter(node => node.props['aria-label']?.startsWith('Mức dùng'));
  assert.equal(meters.length, 3, 'one per account row, as on the reference screen');
  const anthropic = meters.find(node => node.props['aria-label'] === 'Mức dùng của tài khoản 1 của Claude / Anthropic');
  assert.equal(anthropic.props.title, 'Mức dùng của Claude / Anthropic: Max · còn 62% cửa sổ 5 giờ');
  const openai = meters.find(node => node.props['aria-label'] === 'Mức dùng của tài khoản 1 của ChatGPT / OpenAI');
  assert.equal(openai.props.disabled, true, 'no figure from the core means a dimmed button, not a missing one');
  assert.match(openai.props.title, /chưa báo mức dùng/);
});

test('every row carries the same six icons, dimmed with a reason where the core says no', async () => {
  const manageCalls = [];
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: cards(), manageCalls });
  const all = icons(tree).filter(node => !node.props['aria-label']?.endsWith('làm nhà cung cấp mặc định') && !node.props['aria-label']?.startsWith('Sửa kết nối'));
  assert.equal(all.length, 18, 'three accounts, six icons each, whatever the core allows');
  for (const icon of icons(tree)) {
    assert.ok(icon.props.title?.length, 'an icon with no words on it must say what it does on hover');
    assert.ok(icon.props['aria-label']?.length, 'and must say it to a screen reader');
  }
  const up = all.filter(node => node.props['aria-label']?.endsWith('lên trên'));
  assert.equal(up.length, 3, 'the single-account provider keeps its slot instead of dropping a button');
  const upFor = (position, provider) => up.find(node => node.props['aria-label'] === `Đưa tài khoản ${position} của ${provider} lên trên`);
  assert.equal(upFor(1, 'Claude / Anthropic').props.disabled, true, 'the first account cannot move up');
  assert.equal(upFor(1, 'Claude / Anthropic').props.title, 'Đã ở trên cùng');
  const alone = upFor(1, 'ChatGPT / OpenAI');
  assert.equal(alone.props.disabled, true);
  assert.equal(alone.props.title, 'Chỉ có một tài khoản, chưa có gì để đổi thứ tự', 'a blocked button explains itself');
  await upFor(2, 'Claude / Anthropic').props.onClick();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(JSON.stringify(manageCalls[0]), JSON.stringify({ action: 'provider-order-set', provider: 'anthropic', profileIds: ['anthropic:cong-ty', 'anthropic:ca-nhan'] }),
    'the write is a fixed action carrying the whole new order');
  assert.ok(manageCalls.slice(1).some(call => call.action === 'provider-order-read'), 'and the page rereads what the core stored');
  const remove = all.filter(node => node.props['aria-label']?.startsWith('Gỡ tài khoản'));
  assert.equal(remove.length, 3);
  assert.equal(remove.filter(node => !node.props.disabled).length, 2, 'only the two profiles the core marked logoutSupported');
  assert.equal(all.filter(node => node.props['aria-label']?.startsWith('Đăng nhập lại')).length, 3, 're-login on every account');
  assert.equal(all.filter(node => node.props['aria-label']?.startsWith('Đặt nhãn')).length, 3, 'and a label on every account');
});

test('a label is the shell\'s own note: it names the row and never reaches the core', () => {
  const manageCalls = [], setupCalls = [];
  const { tree } = render({ ready: true, models, onConnect() {} },
    { cards: cards(), labels: { 'anthropic:ca-nhan': 'Công ty' }, manageCalls, setupCalls });
  assert.match(text(tree), /1Công typrimary/, 'the label replaces the raw profile name');
  assert.doesNotMatch(text(tree), /ca-nhan/);
  const tag = icons(tree).find(node => node.props['aria-label'] === 'Đặt nhãn cho tài khoản 1 của Claude / Anthropic');
  assert.match(tag.props.title, /chỉ lưu trên máy này/, 'and it says where the label lives');
  assert.equal(manageCalls.length + setupCalls.length, 0);
});

test('a blank machine gets one clear call to action', () => {
  const blank = render({ ready: true, models: [], onConnect() {} }, { cards: [] });
  assert.match(text(blank.tree), /Chưa có tài khoản nào/);
  const offline = render({ ready: false, models, onConnect() {} }, { cards: null });
  assert.match(text(offline.tree), /Bộ chạy đang khởi động/);
  assert.equal(walk(offline.tree).find(node => node.type === 'button' && String(node.props.className).includes('pset__add')).props.disabled, true);
  const loading = render({ ready: true, models, onConnect() {} }, { cards: null });
  assert.match(text(loading.tree), /Đang đọc danh sách tài khoản/);
  const failed = render({ ready: true, models, onConnect() {} }, { cards: [], error: 'kênh thiết lập chưa sẵn sàng' });
  assert.match(text(walk(failed.tree).find(node => node.props?.role === 'alert')), /kênh thiết lập chưa sẵn sàng/);
});

test('shell wiring: the order write is a fixed host call that validates against the core, and config.* stays out of the renderer', async () => {
  const read = file => fs.promises.readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
  const setup = await read('apps/desktop/electron/setup-channel.mjs');
  assert.match(setup, /async setAuthOrder\(provider,profileIds\)/);
  assert.match(setup, /replacePaths:\[`auth\.order\.\$\{provider\}`\]/, 'only that provider’s order is replaced');
  assert.match(setup, /models\.authStatus/, 'ids are checked against what the core reports');
  assert.match(setup, /Danh sách tài khoản đã thay đổi/);
  // The core refuses model auth when several agents are configured and no owner
  // is named. Every call whose schema takes agentId must get one, and the
  // renderer must not be the one supplying it.
  for (const method of ['models.authStatus', 'models.authLogout', 'openclaw.setup.auth.start', 'openclaw.setup.activate.start']) {
    assert.ok(setup.includes(`"${method}"`), `${method} is named in the owner list`);
  }
  assert.match(setup, /OWNED_BY_AGENT\.has\(method\)[\s\S]{0,200}#ownerAgentId\(\)/,
    'the host attaches the owning agent before the call leaves');
  assert.match(setup, /defaults\?\.systemAgent\?\.agentId/, 'the owner is the system agent the config already names');
  assert.match(setup, /entries\.length < 2/, 'a single-agent machine is left exactly as it was');
  const forbidden = setup.match(/isForbiddenOnSetupChannel[\s\S]{0,400}/)?.[0] ?? '';
  assert.match(forbidden, /\^\(config\\\./, 'config.* is still blocked as a renderer-reachable method');
  const main = await read('apps/desktop/electron/main.mjs');
  assert.match(main, /provider-order-read/);
  assert.match(main, /action === 'provider-order-set'[\s\S]{0,240}channelWorkGuard\.run/, 'the write goes through the single-writer guard');
  assert.match(main, /\/\^provider-order\/u\.test/);
  const ui = await read('apps/desktop/src/ProviderSettings.tsx');
  assert.doesNotMatch(ui, /config\./, 'the page never names a config path');
});
