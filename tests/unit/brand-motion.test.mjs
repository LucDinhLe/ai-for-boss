import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url), exports = {};
const read = name => fs.readFileSync(new URL(`../../apps/desktop/src/${name}`, import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(read('BrandMark.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports, require: id => id.endsWith('.svg') ? { __esModule: true, default: id } : id.endsWith('.css') ? {} : require(id)
});
const render = active => renderToStaticMarkup(createElement(exports.default, active === undefined ? {} : { active }));

test('approved decorative light/dark marks gain activity only from the explicit current state', () => {
  assert.doesNotMatch(render(), /brand-mark--active/);
  const running = render(true);
  assert.match(running, /brand-mark--active/);
  assert.match(running, /data-model-active="true"/);
  assert.match(running, /aria-hidden="true"/);
  for (const asset of ['ai-for-boss-mark.svg', 'ai-for-boss-mark-dark.svg']) assert.ok(render(false).includes(asset));
  assert.doesNotMatch(running, /<img/);
  assert.doesNotMatch(render(false), /brand-mark--active/);
  assert.doesNotMatch(render(false), /brand-mark__ring|brand-mark__core/);
});

test('animated layers retain the approved SVG geometry/colors and separate gradient IDs per mark', () => {
  const running = render(true), light = fs.readFileSync(new URL('../../docs/brand/assets/ai-for-boss-mark.svg', import.meta.url), 'utf8');
  for (const attribute of ['viewBox="0 0 100 100"', 'd="M50,15 A35,35 0 1 1 16,59"', 'stroke-width="13"', 'stroke-linecap="round"', 'cx="50"', 'cy="50"', 'r="17"']) {
    assert.ok(light.includes(attribute)); assert.ok(running.includes(attribute));
  }
  for (const color of ['#38BDF8', '#4F46B8']) assert.ok(running.includes(color) && light.includes(color));
  const css = read('brand-mark.css');
  assert.match(css, /\.brand-mark__core \{ fill: #3D7A73;/);
  assert.match(css, /:root\[data-theme="dark"\] \.brand-mark__core \{ fill: #4FA69D; \}/);
  const pair = renderToStaticMarkup(createElement('div', null, createElement(exports.default, { active: true }), createElement(exports.default, { active: true })));
  const ids = [...pair.matchAll(/<linearGradient id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 2); assert.notEqual(ids[0], ids[1]);
  for (const id of ids) assert.ok(pair.includes(`stroke="url(#${id})"`));
  assert.match(running, /focusable="false"/);
  assert.doesNotMatch(read('BrandMark.tsx'), /dangerouslySetInnerHTML|<script|https?:/);
});

test('ZIP motion rotates the ring at 2.2s and pulses the centered radius at 1.6s; reduced-motion stops both', () => {
  const css = read('brand-mark.css');
  assert.match(css, /\.brand-mark__ring \{ transform-origin: 50px 50px; \}/);
  assert.match(css, /\.brand-mark--active \.brand-mark__ring \{ animation: brand-mark-spin-ring 2\.2s linear infinite; \}/);
  assert.match(css, /\.brand-mark--active \.brand-mark__core \{ animation: brand-mark-pulse-core 1\.6s ease-in-out infinite; \}/);
  assert.match(css, /@keyframes brand-mark-spin-ring\s*\{\s*from \{ transform: rotate\(0deg\); \}\s*to \{ transform: rotate\(360deg\); \}/);
  assert.match(css, /@keyframes brand-mark-pulse-core\s*\{\s*0%, 100% \{ r: 17; opacity: 1; \}\s*50% \{ r: 19; opacity: \.88; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.brand-mark--active \.brand-mark__ring,\s*\.brand-mark--active \.brand-mark__core \{ animation: none; \}/);
  assert.doesNotMatch(css, /brand-mark-breathe|filter|shadow/);
  assert.doesNotMatch(read('BrandMark.tsx'), /setTimeout|setInterval|requestAnimationFrame|useEffect/);
});
