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
 * The page holds four pieces of state in one order — cards, error, busy,
 * catalogue — so the fixture answers `useState` from that queue and can render
 * any moment of the page without a DOM.
 */
function render(props, { cards = null, error = null, busy = null, showCatalogue = false, manageCalls = [], setupCalls = [] } = {}) {
  const exports = {}, catalogueMounts = [], queue = [cards, error, busy, showCatalogue];
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
    if (id === './CapabilityCatalog') return { __esModule: true, default: 'catalogue' };
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
  assert.equal(anthropic.accounts[0].kind, 'Đăng nhập tài khoản');
  assert.equal(anthropic.canReorder, true);
  assert.equal(anthropic.modelCount, 2);
  assert.equal(anthropic.usage, 'Max · còn 62% cửa sổ 5 giờ');
  const openai = list.find(card => card.provider === 'openai-codex');
  assert.equal(openai.accounts[0].name, 'ChatGPT / OpenAI', 'a generated setup id is noise, so the label is shown instead');
  assert.equal(openai.accounts[0].kind, 'Khoá API');
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
  assert.equal(providerAccounts.accountName('openai:setup-3c9947ca9182', 'ChatGPT'), 'ChatGPT');
  assert.equal(providerAccounts.accountName('openai:work@example.com', 'ChatGPT'), 'work@example.com');
});

test('the page shows the accounts in the order the core will try them, and never scans the catalogue unless opened', () => {
  const clicks = [];
  const { tree, catalogueMounts } = render({ ready: true, models, currentProvider: 'anthropic', currentModel: 'claude', onConnect: () => clicks.push('connect') }, { cards: cards() });
  const rendered = text(tree);
  assert.match(rendered, /1ca-nhan/, 'the first account is numbered one');
  assert.match(rendered, /Dùng trước/);
  assert.match(rendered, /Đang dùng claude/, 'the card says which model is live rather than a bare count');
  assert.match(rendered, /1 mô hình khả dụng/);
  assert.match(rendered, /Mức dùng theo lõi ghi nhận: Max · còn 62% cửa sổ 5 giờ/);
  assert.match(rendered, /Gemini \/ Google/, 'a provider with no account is listed separately, not hidden');
  assert.equal(catalogueMounts.length, 0, 'the full catalogue (and its native scan) is not mounted by default');
  const primary = walk(tree).find(node => node.type === 'button' && node.props.className === 'settings-primary');
  assert.equal(text(primary), 'Thêm tài khoản');
  primary.props.onClick(); assert.deepEqual(clicks, ['connect']);
});

test('reorder buttons stop at the ends, logout only where the core allows it, and the order write goes through the fixed host call', async () => {
  const manageCalls = [];
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: cards(), manageCalls });
  const up = walk(tree).filter(node => node.type === 'button' && node.props['aria-label']?.startsWith('Đưa') && text(node) === '↑');
  assert.equal(up.length, 2, 'both anthropic accounts offer the move; the single-account provider offers none');
  assert.equal(up[0].props.disabled, true, 'the first account cannot move up');
  await up[1].props.onClick();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(JSON.stringify(manageCalls[0]), JSON.stringify({ action: 'provider-order-set', provider: 'anthropic', profileIds: ['anthropic:cong-ty', 'anthropic:ca-nhan'] }),
    'the write is a fixed action carrying the whole new order');
  assert.ok(manageCalls.slice(1).some(call => call.action === 'provider-order-read'), 'and the page rereads what the core stored');
  const logout = walk(tree).filter(node => node.type === 'button' && text(node) === 'Đăng xuất');
  assert.equal(logout.length, 2, 'only the two profiles the core marked logoutSupported');
});

test('a blank machine gets one clear call to action, and the opened catalogue receives the connected set', () => {
  const blank = render({ ready: true, models: [], onConnect() {} }, { cards: [] });
  assert.match(text(blank.tree), /Chưa có tài khoản nào/);
  const offline = render({ ready: false, models, onConnect() {} }, { cards: null });
  assert.match(text(offline.tree), /Bật Gateway/);
  assert.equal(walk(offline.tree).find(node => node.type === 'button' && node.props.className === 'settings-primary').props.disabled, true);
  const loading = render({ ready: true, models, onConnect() {} }, { cards: null });
  assert.match(text(loading.tree), /Đang đọc danh sách tài khoản/);
  const failed = render({ ready: true, models, onConnect() {} }, { cards: [], error: 'kênh thiết lập chưa sẵn sàng' });
  assert.match(text(walk(failed.tree).find(node => node.props?.role === 'alert')), /kênh thiết lập chưa sẵn sàng/);
  const opened = render({ ready: true, models, onConnect() {} }, { cards: cards(), showCatalogue: true });
  assert.equal(opened.catalogueMounts.length, 1);
  assert.deepEqual([...opened.catalogueMounts[0].connectedProviders], ['openai-codex', 'anthropic']);
  assert.equal(opened.catalogueMounts[0].kind, 'providers');
});

test('shell wiring: the order write is a fixed host call that validates against the core, and config.* stays out of the renderer', async () => {
  const read = file => fs.promises.readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
  const setup = await read('apps/desktop/electron/setup-channel.mjs');
  assert.match(setup, /async setAuthOrder\(provider,profileIds\)/);
  assert.match(setup, /replacePaths:\[`auth\.order\.\$\{provider\}`\]/, 'only that provider’s order is replaced');
  assert.match(setup, /models\.authStatus/, 'ids are checked against what the core reports');
  assert.match(setup, /Danh sách tài khoản đã thay đổi/);
  const forbidden = setup.match(/isForbiddenOnSetupChannel[\s\S]{0,400}/)?.[0] ?? '';
  assert.match(forbidden, /\^\(config\\\./, 'config.* is still blocked as a renderer-reachable method');
  const main = await read('apps/desktop/electron/main.mjs');
  assert.match(main, /provider-order-read/);
  assert.match(main, /action === 'provider-order-set'[\s\S]{0,240}channelWorkGuard\.run/, 'the write goes through the single-writer guard');
  assert.match(main, /\/\^provider-order\/u\.test/);
  const ui = await read('apps/desktop/src/ProviderSettings.tsx');
  assert.doesNotMatch(ui, /config\./, 'the page never names a config path');
});
