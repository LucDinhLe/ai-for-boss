import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = fs.readFileSync(new URL("../../apps/desktop/src/MessageContent.tsx", import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports, require: id => id === 'react' ? { ...createRequire(import.meta.url)(id), useMemo: fn => fn() } : createRequire(import.meta.url)(id), URL
});
const render = (content) => renderToStaticMarkup(createElement(exports.default, { content }));

test("headings, bold, inline code and ordered/unordered lists render semantically", () => {
  const html = render("# Kế hoạch\n## **Mục tiêu**\n- **Doanh thu** và `tỷ lệ`\n- __Chi phí__\n3. Chuẩn bị\n4. Thực hiện");
  assert.match(html, /<h1>Kế hoạch<\/h1>/);
  assert.match(html, /<h2><strong>Mục tiêu<\/strong><\/h2>/);
  assert.match(html, /<ul><li><strong>Doanh thu<\/strong> và <code>tỷ lệ<\/code><\/li><li><strong>Chi phí<\/strong><\/li><\/ul>/);
  assert.match(html, /<ol start="3"><li>Chuẩn bị<\/li><li>Thực hiện<\/li><\/ol>/);
});

test("HTML, image markup, unsafe protocols and ordinary URLs remain inert text", () => {
  const html = render('<script>alert(1)</script>\n<img src="https://remote.invalid/pixel" onerror="evil()">\n![pixel](https://remote.invalid/pixel)\n[x](javascript:evil())\n[data](data:text/html,evil)\nhttps://example.invalid/\n<https://example.invalid/>');
  assert.doesNotMatch(html, /<(?:script|img|iframe|a|link|object|embed)\b/i);
  assert.doesNotMatch(html, /\s(?:src|href|onerror)="[^"]*"/i);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /!\[pixel\]\(https:\/\/remote\.invalid\/pixel\)/);
  assert.match(html, /\[x\]\(javascript:evil\(\)\)/);
  assert.match(html, /\[data\]\(data:text\/html,evil\)/);
});

test("fenced code preserves literal markup and newlines, including a still-streaming fence", () => {
  assert.match(render("```html\n<b>**literal**</b>\n  next\n```"), /<pre[^>]*><code>&lt;b&gt;\*\*literal\*\*&lt;\/b&gt;\n {2}next<\/code><\/pre>/);
  const streaming = render("~~~txt\nfirst\n\nlast\n");
  assert.match(streaming, /<code>first\n\nlast\n<\/code>/);
  assert.doesNotMatch(streaming, /<strong>/);
  assert.match(render("````\n```\nkeep\n````\nafter"), /<code>```\nkeep<\/code><\/pre><p[^>]*>after<\/p>/);
});

test("plain text preserves soft line breaks and syntax while repeated blank lines separate paragraphs once", () => {
  const html = render("  first\r\nsecond\n\n\n> quoted text\n**unfinished\n`unfinished\n[reference]: /path");
  assert.match(html, /white-space:pre-wrap[^>]*> {2}first\nsecond<\/p>/);
  assert.equal((html.match(/<p\b/g) ?? []).length, 2);
  assert.doesNotMatch(html, /<br\b/);
  assert.match(html, /&gt; quoted text\n\*\*unfinished\n`unfinished\n\[reference\]: \/path/);
  assert.equal(render(""), '<div class="message-content"></div>');
});

test('blank separators keep same-kind list items together without consuming the following paragraph or other list kind', () => {
  const html = render('- First\n\n- Second\n  \n\n- Third\n\nFollowing paragraph\n\n1. Ordered\n\n2. Next\n\n- Another kind');
  assert.match(html, /<ul><li>First<\/li><li>Second<\/li><li>Third<\/li><\/ul><p[^>]*>Following paragraph<\/p>/);
  assert.match(html, /<ol start="1"><li>Ordered<\/li><li>Next<\/li><\/ol><ul><li>Another kind<\/li><\/ul>/);
  assert.doesNotMatch(html, /<br\b/);
  assert.match(render('```\na\n\n\n- literal\n```'), /<code>a\n\n\n- literal<\/code>/);
});

test("simple tables support escaped pipes and inline code; malformed rows keep their text", () => {
  const html = render("| Mục | Giá trị |\n| :--- | ---: |\n| **A** | `a|b` |\n| B\\|C | <script> |\n| wrong | column | count |\nafter");
  assert.match(html, /<table[^>]*><thead><tr><th scope="col">Mục<\/th><th scope="col">Giá trị<\/th>/);
  assert.match(html, /<td><strong>A<\/strong><\/td><td><code>a\|b<\/code><\/td>/);
  assert.match(html, /<td>B\|C<\/td><td>&lt;script&gt;<\/td>/);
  assert.match(html, /\| wrong \| column \| count \|\nafter/);
  assert.doesNotMatch(render("a | b\n--- | nope\nc | d"), /<table/);
});

test("long unclosed formatting remains text without creating an excessive node tree", () => {
  const input = "**" + "a".repeat(150_000) + "\ntail " + "`".repeat(10_000);
  const html = render(input);
  assert.match(html, /a{100}/);
  assert.doesNotMatch(html, /<(?:strong|code)>/);
  assert.ok(html.length < input.length + 250);
});

test('public Markdown sources require an explicit user-click callback; unsafe links stay inert', () => {
  let calls = 0;
  const html = renderToStaticMarkup(createElement(exports.default, { content: '[Nguồn](https://example.com/report) [Lỗi](javascript:evil) [Nội bộ](http://127.0.0.1/) ![Ảnh](https://example.com/image.png)', onOpenUrl: () => { calls++; } }));
  assert.match(html, /<button[^>]+message-content__link[^>]+title="https:\/\/example.com\/report"/);
  assert.equal((html.match(/<button/g) ?? []).length, 1); assert.equal(calls, 0);
  assert.doesNotMatch(html, /<(?:a|img|iframe)\b/); assert.match(html, /!\[Ảnh\]/);
  for (const bad of ['file:///C:/private', 'data:text/html,evil', 'javascript:evil', 'http://localhost/', 'http://2130706433/', 'http://[::1]/', 'https://user:pass@example.com/', 'http://office.internal/']) {
    assert.doesNotMatch(renderToStaticMarkup(createElement(exports.default, { content: `[Nguồn](${bad})`, onOpenUrl: () => { calls++; } })), /<button/, bad);
  }
  const tree = exports.default({ content: '[Nguồn](https://example.com/path?q=hello#section)', onOpenUrl: url => { assert.equal(url, 'https://example.com/path?q=hello#section'); calls++; } });
  const walk = node => { if (Array.isArray(node)) return node.flatMap(walk); if (!node || typeof node !== 'object') return []; return [node, ...walk(node.props?.children)]; };
  const button = walk(tree).find(node => node.type === 'button'); assert.ok(button); button.props.onClick(); assert.equal(calls, 1);
});
