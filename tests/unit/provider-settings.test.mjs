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
function render(props, { cards = null, error = null, busy = null, manageCalls = [], setupCalls = [] } = {}) {
  const exports = {}, catalogueMounts = [], queue = [cards, error, busy];
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

test('the page leads with the running model, then the accounts in the order the core will try them', () => {
  const clicks = [];
  const { tree, catalogueMounts } = render({ ready: true, models, currentProvider: 'anthropic', currentModel: 'claude',
    onConnect: query => clicks.push(query ?? 'connect'), onChangeModel: () => clicks.push('change-model') }, { cards: cards() });
  const rendered = text(tree);
  assert.match(rendered, /Mô hình mặc định — cuộc trò chuyện mới nào cũng bắt đầu bằng cái này/,
    'the model every new conversation starts on is set here, not picked for the user');
  const picker = walk(tree).find(node => node.type === 'select' && node.props['aria-label'] === 'Mô hình mặc định');
  assert.deepEqual(picker.props.children[1].map(option => option.props.value),
    ['openai-codex/gpt', 'anthropic/claude', 'anthropic/claude-2'],
    'only what the core reports as available, never a model the shell made up');
  assert.match(rendered, /Cuộc trò chuyện đang mở dùng claude/, 'and the session model is named as the separate thing it is');
  assert.match(rendered, /1ca-nhan/, 'the first account is numbered one');
  assert.match(rendered, /Dùng trước/);
  assert.match(rendered, /Đang dùng claude/, 'the card says which model is live rather than a bare count');
  assert.match(rendered, /1 mô hình khả dụng/);
  assert.match(rendered, /Lõi còn hỗ trợ, chưa nối tài khoản nào:.*Gemini \/ Google/,
    'a provider with no account is one dim line, no longer a card of its own');
  assert.equal(catalogueMounts.length, 0, 'the full catalogue and its native scan are gone from this page');
  const primary = walk(tree).find(node => node.type === 'button' && node.props.className === 'settings-primary');
  assert.equal(text(primary), 'Thêm nhà cung cấp');
  primary.props.onClick(); assert.deepEqual(clicks, ['connect']);
  walk(tree).find(node => node.type === 'button' && text(node) === 'Mở mục Mô hình').props.onClick();
  assert.deepEqual(clicks, ['connect', 'change-model']);
});

test('a provider with models but no stored account still shows up', () => {
  // Claude reached through the Claude Code CLI has models and no auth profile.
  // Before this, authStatus drove the whole list and such a provider was invisible.
  const withCli = providerAccounts.providerCards(
    [{ provider: 'openai-codex', status: 'static', profiles: [{ profileId: 'openai-codex:setup-3c9947ca9182', type: 'api_key', status: 'static' }] }],
    { modelCounts: { 'openai-codex': 1, anthropic: 2 } });
  const anthropic = withCli.find(card => card.provider === 'anthropic');
  assert.ok(anthropic, 'a provider the core has models for is listed even with no credential of its own');
  assert.equal(anthropic.accounts.length, 0);
  assert.equal(anthropic.modelCount, 2);
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: withCli });
  assert.match(text(tree), /Không có tài khoản lưu ở đây/, 'and the page says plainly why it has no account rows');
  assert.doesNotMatch(text(tree), /Lõi còn hỗ trợ, chưa nối tài khoản nào:.*Claude/,
    'it is connected through an app, so it does not belong in the not-connected tail');
});

test('usage rides on the card, because the core reports no per-account figure', () => {
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: cards() });
  const meters = walk(tree).filter(node => node.type === 'button' && node.props.className === 'provider-cards__icon');
  assert.equal(meters.length, 2, 'one per connected provider');
  const anthropic = meters.find(node => node.props['aria-label'] === 'Mức dùng của Claude / Anthropic');
  assert.equal(anthropic.props.title, 'Mức dùng theo lõi ghi nhận: Max · còn 62% cửa sổ 5 giờ');
  const openai = meters.find(node => node.props['aria-label'] === 'Mức dùng của ChatGPT / OpenAI');
  assert.equal(openai.props.disabled, true, 'no figure from the core means a dimmed button, not a missing one');
  assert.match(openai.props.title, /chưa báo mức dùng/);
});

test('every row carries the same four icons, dimmed with a reason where the core says no', async () => {
  const manageCalls = [];
  const { tree } = render({ ready: true, models, onConnect() {} }, { cards: cards(), manageCalls });
  const icons = walk(tree).filter(node => node.type === 'button' && String(node.props.className ?? '').includes('provider-accounts__icon'));
  assert.equal(icons.length, 12, 'three accounts, four icons each, whatever the core allows');
  for (const icon of icons) {
    assert.ok(icon.props.title?.length, 'an icon with no words on it must say what it does on hover');
    assert.ok(icon.props['aria-label']?.length, 'and must say it to a screen reader');
  }
  const up = icons.filter(node => node.props['aria-label']?.startsWith('Đưa') && text(node) === '↑');
  assert.equal(up.length, 3, 'the single-account provider keeps its slot instead of dropping a button');
  // Rows are addressed by position and provider now, because several accounts
  // under one provider can share every readable detail.
  const upFor = (position, provider) => up.find(node => node.props['aria-label'] === `Đưa tài khoản ${position} của ${provider} lên trên`);
  assert.equal(upFor(1, 'Claude / Anthropic').props.disabled, true, 'the first account cannot move up');
  assert.equal(upFor(1, 'Claude / Anthropic').props.title, 'Đã ở trên cùng');
  const alone = upFor(1, 'ChatGPT / OpenAI');
  assert.equal(alone.props.disabled, true);
  assert.equal(alone.props.title, 'Lõi không cho đổi thứ tự ở nhà cung cấp này', 'a blocked button explains itself');
  await upFor(2, 'Claude / Anthropic').props.onClick();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(JSON.stringify(manageCalls[0]), JSON.stringify({ action: 'provider-order-set', provider: 'anthropic', profileIds: ['anthropic:cong-ty', 'anthropic:ca-nhan'] }),
    'the write is a fixed action carrying the whole new order');
  assert.ok(manageCalls.slice(1).some(call => call.action === 'provider-order-read'), 'and the page rereads what the core stored');
  const remove = icons.filter(node => node.props['aria-label']?.startsWith('Gỡ tài khoản'));
  assert.equal(remove.length, 3);
  assert.equal(remove.filter(node => !node.props.disabled).length, 2, 'only the two profiles the core marked logoutSupported');
  const again = icons.filter(node => node.props['aria-label']?.startsWith('Đăng nhập lại'));
  assert.equal(again.length, 3, 're-login is offered on every account, and routes into the one connect flow');
});

test('a blank machine gets one clear call to action', () => {
  const blank = render({ ready: true, models: [], onConnect() {} }, { cards: [] });
  assert.match(text(blank.tree), /Chưa có tài khoản nào/);
  const offline = render({ ready: false, models, onConnect() {} }, { cards: null });
  assert.match(text(offline.tree), /Bật Gateway/);
  assert.equal(walk(offline.tree).find(node => node.type === 'button' && node.props.className === 'settings-primary').props.disabled, true);
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
  const forbidden = setup.match(/isForbiddenOnSetupChannel[\s\S]{0,400}/)?.[0] ?? '';
  assert.match(forbidden, /\^\(config\\\./, 'config.* is still blocked as a renderer-reachable method');
  const main = await read('apps/desktop/electron/main.mjs');
  assert.match(main, /provider-order-read/);
  assert.match(main, /action === 'provider-order-set'[\s\S]{0,240}channelWorkGuard\.run/, 'the write goes through the single-writer guard');
  assert.match(main, /\/\^provider-order\/u\.test/);
  const ui = await read('apps/desktop/src/ProviderSettings.tsx');
  assert.doesNotMatch(ui, /config\./, 'the page never names a config path');
});
