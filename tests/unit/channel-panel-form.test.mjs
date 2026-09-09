import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../../apps/desktop/src/ChannelPanel.tsx', import.meta.url), 'utf8');
const walk = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = node => node == null ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children);
const settle = async () => { for (let index = 0; index < 10; index++) await Promise.resolve(); };
const secretStep = { sessionId: 'owned-form', setupRoute: 'native-config', step: { id: 'googlechat:credential', type: 'text', title: 'Khóa JSON', sensitive: true, multiline: true, initialValue: 'must-never-echo' } };
const confirmStep = { sessionId: 'owned-form', setupRoute: 'native-config', step: { id: 'googlechat:confirm', type: 'confirm', title: 'Thiết lập Google Chat', confirmLabel: 'Lưu và bật tài khoản', declineLabel: 'Hủy thiết lập' } };
function harness(answer = async () => confirmStep, options = {}) {
  const exports = {}, slots = [], effects = [], requests = []; let cursor = 0, refreshes = 0;
  const react = {
    useState(initial) { const id = cursor++; if (!(id in slots)) slots[id] = initial;
      return [slots[id], value => { slots[id] = typeof value === 'function' ? value(slots[id]) : value; }]; },
    useRef(initial) { const id = cursor++; return slots[id] ??= { current: initial }; },
    useCallback(callback) { const id = cursor++; return slots[id] ??= callback; },
    useEffect(callback, dependencies) { const id = cursor++, before = slots[id];
      if (!before || dependencies.some((value, index) => !Object.is(value, before.dependencies[index])))
        effects.push(() => { before?.cleanup?.(); slots[id] = { dependencies, cleanup: callback() }; }); }
  };
  const manage = async packet => {
    requests.push(packet);
    if (packet.action === 'catalog') return { channels: options.catalogueChannels ?? [{ id: 'googlechat', label: 'Google Chat', bundled: true }] };
    if (packet.action === 'plugin-inventory') return { plugins: [] };
    if (packet.action === 'channel-bundle-status') return { channels: [] };
    if (packet.action === 'channel-setup') return options.setupReply ?? secretStep;
    if (packet.action === 'channel-next') return answer(packet);
    if (packet.action === 'channel-cancel') return { done: true, status: 'cancelled' };
    if (packet.action.startsWith('channel-qr-')) return options.qr?.(packet);
    throw new Error('Unexpected fixture management action');
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, Date, setTimeout, clearTimeout, require: id => {
    if (id === 'react') return react;
    if (id === './WorkspaceSidebar') return { WorkbenchIcon: 'icon' };
    if (id === './BrandIcon') return { default: 'brand-icon' };
    if (id === './capability-role') return { capabilityRole: () => '' };
    if (id === './workbench-api') return { manage };
    if (id === './connect/wizard-vi') return { localiseStep: step => ({ title: step.title, message: step.message, recognised: false }) };
    if (id.endsWith('.css')) return {};
    return require(id);
  } });
  const render = (patch = {}) => { cursor = 0; const tree = exports.default({ channels: options.channels ?? [], ready: true, onRefresh: () => { refreshes++; }, ...patch });
    for (const effect of effects.splice(0)) effect(); return tree; };
  const button = label => walk(render()).find(node => node.type === 'button' && text(node) === label);
  return { render, button, requests, get refreshes() { return refreshes; } };
}

test('multiline channel secret is blank, masked and bounded; reveal is explicit and submission clears the visible copy', async () => {
  let complete; const h = harness(() => new Promise(resolve => { complete = resolve; }));
  h.render(); await settle(); h.button('Thiết lập Google Chat').props.onClick(); await settle();
  let input = walk(h.render()).find(node => node.type === 'textarea');
  assert.equal(input.props.value, ''); assert.match(input.props.className, /--masked/u);
  assert.equal(input.props.autoComplete, 'off'); assert.equal(input.props.spellCheck, false); assert.equal(input.props.maxLength, 65536);
  const json = '{\n  "type": "service_account",\n  "private_key": "synthetic\\nkey"\n}';
  input.props.onChange({ target: { value: json } }); h.button('Hiện nội dung').props.onClick();
  input = walk(h.render()).find(node => node.type === 'textarea'); assert.equal(input.props.value, json); assert.doesNotMatch(input.props.className, /--masked/u);
  assert.equal(h.button('Ẩn nội dung').props['aria-pressed'], true);
  walk(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await settle();
  input = walk(h.render()).find(node => node.type === 'textarea'); assert.equal(input.props.value, ''); assert.match(input.props.className, /--masked/u); assert.equal(input.props.disabled, true);
  const sent = h.requests.find(packet => packet.action === 'channel-next'); assert.equal(sent.answer.value, json); assert.equal(sent.answer.stepId, 'googlechat:credential');
  complete(confirmStep); await settle(); assert.equal(walk(h.render()).some(node => node.type === 'textarea'), false);
  assert.equal(text(h.render()).includes(json), false);
});

test('explicit save label sends one boolean confirmation and never claims completion before readback', async () => {
  let complete; const h = harness(packet => packet.answer.stepId === 'googlechat:credential' ? confirmStep : new Promise(resolve => { complete = resolve; }));
  h.render(); await settle(); h.button('Thiết lập Google Chat').props.onClick(); await settle();
  walk(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await settle();
  assert.ok(h.button('Lưu và bật tài khoản')); assert.ok(h.button('Hủy thiết lập'));
  assert.equal(walk(h.render()).filter(node => node.type === 'button' && text(node) === 'Hủy thiết lập').length, 1, 'idle confirm has a single cancel action');
  assert.equal(walk(h.render()).some(node => node.type === 'h3' && text(node) === 'Thiết lập Google Chat'), false, 'identical step heading is not repeated');
  h.button('Lưu và bật tài khoản').props.onClick(); await settle();
  assert.equal(h.button('Lưu và bật tài khoản').props.disabled, true); assert.equal(h.refreshes, 0);
  assert.equal(walk(h.render()).filter(node => node.type === 'button' && text(node) === 'Hủy thiết lập' && !node.props.disabled).length, 0, 'confirmed config write is no longer cancellable');
  assert.equal(text(h.render()).includes('Đã lưu thiết lập.'), false);
  const sent = h.requests.filter(packet => packet.action === 'channel-next').at(-1); assert.equal(sent.answer.value, true); assert.equal(sent.answer.stepId, 'googlechat:confirm');
  complete({ done: true, status: 'error', error: 'Chưa xác nhận tài khoản đã được áp dụng.' }); await settle();
  assert.equal(h.refreshes, 0); assert.equal(text(h.render()).includes('Đã lưu thiết lập.'), false);
  assert.ok(text(h.render()).includes('Chưa xác nhận tài khoản đã được áp dụng.'));
});

test('cancel arriving during confirmed native config write cannot invalidate its delayed successful readback', async () => {
  let complete; const h = harness(packet => packet.answer.stepId === 'googlechat:credential' ? confirmStep : new Promise(resolve => { complete = resolve; }));
  h.render(); await settle(); h.button('Thiết lập Google Chat').props.onClick(); await settle();
  const staleCancel = h.button('Hủy thiết lập').props.onClick;
  walk(h.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); await settle();
  h.button('Lưu và bật tài khoản').props.onClick();
  staleCancel(); await settle();
  assert.equal(h.requests.some(packet => packet.action === 'channel-cancel'), false, 'synchronous latch prevents local cancellation even before render');
  assert.ok(text(h.render()).includes('Đang lưu tài khoản và kiểm tra kết quả…'));
  complete({ done: true, status: 'done', setupRoute: 'native-config', accounts: [{ channel: 'googlechat', accountId: 'default' }] }); await settle();
  assert.equal(h.refreshes, 1); assert.ok(text(h.render()).includes('Đã lưu thiết lập.'));
  assert.equal(walk(h.render()).some(node => node.type === 'section' && node.props['aria-label'] === 'Thiết lập Google Chat'), false);
});

test('cancel clears multiline secret and offline or active work disables edit, reveal and submission', async () => {
  const h = harness(); h.render(); await settle(); h.button('Thiết lập Google Chat').props.onClick(); await settle();
  walk(h.render()).find(node => node.type === 'textarea').props.onChange({ target: { value: 'synthetic private text' } });
  for (const patch of [{ ready: false }, { mutationsDisabled: true }]) {
    const nodes = walk(h.render(patch));
    assert.equal(nodes.find(node => node.type === 'textarea').props.disabled, true);
    assert.equal(nodes.find(node => node.type === 'button' && text(node) === 'Hiện nội dung').props.disabled, true);
    assert.equal(nodes.find(node => node.type === 'button' && text(node) === 'Tiếp tục').props.disabled, true);
  }
  h.button('Hủy thiết lập').props.onClick(); await settle();
  assert.equal(walk(h.render()).some(node => node.type === 'textarea'), false);
  assert.equal(h.requests.filter(packet => packet.action === 'channel-next').length, 0);
  assert.equal(h.requests.find(packet => packet.action === 'channel-cancel').sessionId, 'owned-form');
});

test('an explicit unpaired WhatsApp account can request QR; account creation and an unconnected QR never claim linked', async () => {
  const h = harness(undefined, { catalogueChannels: [{ id: 'whatsapp', label: 'WhatsApp', bundled: true }],
    channels: [{ id: 'whatsapp:default', channel: 'whatsapp', accountId: 'default', configured: false, running: false, status: 'Chưa thiết lập' }],
    qr: async packet => packet.action === 'channel-qr-clear' ? {} : { ticket: 'owned-qr', connected: false, qrDataUrl: null, message: 'Mã liên kết đang chờ.' }
  });
  h.render(); await settle();
  assert.ok(h.button('Liên kết bằng QR')); assert.equal(h.button('Liên kết bằng QR').props.disabled, false);
  assert.ok(text(h.render()).includes('Quét mã QR để liên kết điện thoại'));
  for (const patch of [{ ready: false }, { mutationsDisabled: true }]) assert.equal(walk(h.render(patch)).find(node => node.type === 'button' && text(node) === 'Liên kết bằng QR').props.disabled, true);
  h.button('Liên kết bằng QR').props.onClick(); await settle();
  const request = h.requests.find(packet => packet.action === 'channel-qr-start'); assert.equal(request.accountId, 'default'); assert.equal(request.channel, 'whatsapp');
  assert.equal(h.refreshes, 0); assert.equal(text(h.render()).includes('WhatsApp đã liên kết.'), false);
  h.button('Đóng mã QR').props.onClick(); await settle();
  assert.equal(h.requests.find(packet => packet.action === 'channel-qr-clear').ticket, 'owned-qr');
  assert.equal(h.requests.some(packet => packet.action === 'channel-next'), false);
});

test('completed WhatsApp account form continues to QR but success waits for actual connected readback', async () => {
  let linked = false;
  const h = harness(async () => ({ done: true, status: 'done', setupRoute: 'native-config', accounts: [{ channel: 'whatsapp', accountId: 'new-account' }] }), {
    catalogueChannels: [{ id: 'whatsapp', label: 'WhatsApp', bundled: true }],
    setupReply: { ...confirmStep, step: { ...confirmStep.step, title: 'Thiết lập WhatsApp' } },
    channels: [{ id: 'whatsapp:new-account', channel: 'whatsapp', accountId: 'new-account', configured: false, running: false, status: 'Chưa thiết lập' }],
    qr: async packet => packet.action === 'channel-qr-clear' ? {} : { ticket: 'owned-qr', connected: linked, qrDataUrl: null, message: '' }
  });
  h.render(); await settle(); h.button('Thiết lập WhatsApp').props.onClick(); await settle();
  h.button('Lưu và bật tài khoản').props.onClick(); await settle();
  assert.equal(h.requests.find(packet => packet.action === 'channel-qr-start').accountId, 'new-account');
  assert.equal(text(h.render()).includes('WhatsApp đã liên kết.'), false); assert.equal(h.refreshes, 1, 'saved configuration is refreshed separately from pairing');
  h.button('Đóng mã QR').props.onClick(); await settle(); linked = true;
  h.button('Liên kết bằng QR').props.onClick(); await settle();
  assert.ok(text(h.render()).includes('WhatsApp đã liên kết.')); assert.equal(h.refreshes, 2);
});
