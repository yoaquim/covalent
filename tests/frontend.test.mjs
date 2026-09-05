// Frontend tests: math regex, path handling, print CSS validation.
// Run: node tests/frontend.test.mjs

const INLINE_START = /\$(?=[^\s$])/;
const INLINE_MATCH = /^\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?![\w$])/;
const BLOCK_MATCH = /^\$\$([\s\S]+?)\$\$/;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertMatch(regex, str, msg) {
  assert(regex.test(str), msg || `Expected "${str}" to match ${regex}`);
}

function assertNoMatch(regex, str, msg) {
  assert(!regex.test(str), msg || `Expected "${str}" NOT to match ${regex}`);
}

// Simulate the tokenizer: find start position, then try to match from there
function findInlineMath(src) {
  const startMatch = src.match(INLINE_START);
  if (!startMatch) return null;
  const idx = startMatch.index;
  const sub = src.slice(idx);
  const m = sub.match(INLINE_MATCH);
  return m ? { raw: m[0], text: m[1] } : null;
}

function findBlockMath(src) {
  const idx = src.indexOf('$$');
  if (idx === -1) return null;
  const sub = src.slice(idx);
  const m = sub.match(BLOCK_MATCH);
  return m ? { raw: m[0], text: m[1].trim() } : null;
}

// --- Inline math: should match ---

console.log('\nInline math — should match:');

test('simple variable: $x$', () => {
  const r = findInlineMath('$x$');
  assert(r && r.text === 'x');
});

test('simple equation: $E = mc^2$', () => {
  const r = findInlineMath('$E = mc^2$');
  assert(r && r.text === 'E = mc^2');
});

test('quadratic formula inline', () => {
  const r = findInlineMath('$x = \\frac{-b}{2a}$');
  assert(r && r.raw === '$x = \\frac{-b}{2a}$');
});

test('euler identity: $e^{i\\pi} + 1 = 0$', () => {
  const r = findInlineMath('$e^{i\\pi} + 1 = 0$');
  assert(r && r.text === 'e^{i\\pi} + 1 = 0');
});

test('inline math in sentence', () => {
  const r = findInlineMath('The area is $A = \\pi r^2$ for a circle.');
  assert(r && r.text === 'A = \\pi r^2');
});

test('number: $42$', () => {
  const r = findInlineMath('$42$');
  assert(r && r.text === '42');
});

test('subscript: $x_1$', () => {
  const r = findInlineMath('$x_1$');
  assert(r && r.text === 'x_1');
});

test('Greek letter: $\\alpha$', () => {
  const r = findInlineMath('$\\alpha$');
  assert(r && r.text === '\\alpha');
});

// --- Inline math: should NOT match ---

console.log('\nInline math — should NOT match:');

test('currency: $5', () => {
  const r = findInlineMath('This costs $5');
  assert(r === null);
});

test('currency pair: $5 and $10', () => {
  const r = findInlineMath('This costs $5 and $10');
  assert(r === null);
});

test('currency in sentence: costs $5 dollars and costs $10 dollars', () => {
  const r = findInlineMath('This costs $5 dollars and that costs $10 dollars');
  assert(r === null);
});

test('space after opening: $ x$', () => {
  const r = findInlineMath('$ x$');
  assert(r === null);
});

test('space before closing: $x $', () => {
  const r = findInlineMath('$x $');
  assert(r === null);
});

test('empty: $$', () => {
  const r = findInlineMath('$$');
  assert(r === null);
});

test('just spaces: $  $', () => {
  const r = findInlineMath('$  $');
  assert(r === null);
});

test('dollar followed by word char: $x$y', () => {
  // closing $ followed by word char should not match
  const r = findInlineMath('$x$y');
  assert(r === null);
});

// --- Block math ---

console.log('\nBlock math — should match:');

test('simple block equation', () => {
  const r = findBlockMath('$$x = 5$$');
  assert(r && r.text === 'x = 5');
});

test('multiline block equation', () => {
  const r = findBlockMath('$$\nx^2 + y^2 = z^2\n$$');
  assert(r && r.text === 'x^2 + y^2 = z^2');
});

test('block with integral', () => {
  const r = findBlockMath('$$\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$');
  assert(r && r.text.includes('\\int'));
});

test('block with aligned environment', () => {
  const src = '$$\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}$$';
  const r = findBlockMath(src);
  assert(r && r.text.includes('\\begin{aligned}'));
});

console.log('\nBlock math — should NOT match:');

test('single $ is not block math', () => {
  const r = findBlockMath('$x$');
  // indexOf('$$') should not find '$$' in '$x$'
  assert(r === null);
});

// --- Path separator (Windows compat) ---

console.log('\nPath handling:');

test('Unix path split', () => {
  const path = '/Users/foo/bar/file.md';
  const name = path.split(/[\\/]/).pop();
  assert(name === 'file.md');
});

test('Windows path split', () => {
  const path = 'C:\\Users\\foo\\bar\\file.md';
  const name = path.split(/[\\/]/).pop();
  assert(name === 'file.md');
});

test('Mixed path split', () => {
  const path = 'C:\\Users/foo\\bar/file.md';
  const name = path.split(/[\\/]/).pop();
  assert(name === 'file.md');
});

// --- Relative asset path resolution (image references in markdown) ---

console.log('\nRelative asset path resolution:');


// Path helpers are taken from the real source in index.html so tests can't drift from the app.
const appSrc = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf-8');
function extractFn(name, deps = {}) {
  const m = appSrc.match(new RegExp(`    function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}\\n`));
  if (!m) throw new Error(`${name} not found in index.html`);
  return new Function(...Object.keys(deps), m[0] + `\nreturn ${name};`)(...Object.values(deps));
}
const isExternalUrl = extractFn('isExternalUrl');
const isAbsoluteFsPath = extractFn('isAbsoluteFsPath');
const dirname = extractFn('dirname');
const joinPath = extractFn('joinPath');
const safeDecode = extractFn('safeDecode');
const resolveAgainst = extractFn('resolveAgainst', { isAbsoluteFsPath, joinPath });

test('external https URL detected', () => assert(isExternalUrl('https://example.com/x.png')));
test('external http URL detected', () => assert(isExternalUrl('http://example.com/x.png')));
test('data URL detected', () => assert(isExternalUrl('data:image/png;base64,abc')));
test('asset protocol detected', () => assert(isExternalUrl('asset://localhost/x.png')));
test('fragment-only detected as external', () => assert(isExternalUrl('#section')));
test('protocol-relative detected', () => assert(isExternalUrl('//cdn.example.com/x.png')));
test('relative path NOT external', () => assert(!isExternalUrl('images/x.png')));
test('dot-relative NOT external', () => assert(!isExternalUrl('./images/x.png')));
test('parent-relative NOT external', () => assert(!isExternalUrl('../shared/x.png')));

test('unix absolute path detected', () => assert(isAbsoluteFsPath('/Users/x/img.png')));
test('windows absolute path detected', () => assert(isAbsoluteFsPath('C:\\Users\\x\\img.png')));
test('windows absolute with forward slash detected', () => assert(isAbsoluteFsPath('C:/Users/x/img.png')));
test('relative path NOT absolute', () => assert(!isAbsoluteFsPath('images/x.png')));

test('dirname of unix file path', () => {
  assert(dirname('/Users/foo/bar/file.md') === '/Users/foo/bar');
});
test('dirname of windows file path', () => {
  assert(dirname('C:\\Users\\foo\\file.md') === 'C:\\Users\\foo');
});

test('joinPath unix simple', () => {
  assert(joinPath('/Users/foo/bar', 'images/x.png') === '/Users/foo/bar/images/x.png');
});
test('joinPath unix with ./', () => {
  assert(joinPath('/Users/foo/bar', './images/x.png') === '/Users/foo/bar/images/x.png');
});
test('joinPath unix with ../', () => {
  assert(joinPath('/Users/foo/bar', '../shared/x.png') === '/Users/foo/shared/x.png');
});
test('joinPath unix multiple ../', () => {
  assert(joinPath('/Users/foo/bar', '../../etc/x.png') === '/Users/etc/x.png');
});
test('joinPath windows simple', () => {
  assert(joinPath('C:\\Users\\foo', 'images\\x.png') === 'C:\\Users\\foo\\images\\x.png');
});
test('joinPath windows with forward slash in relative', () => {
  assert(joinPath('C:\\Users\\foo', 'images/x.png') === 'C:\\Users\\foo\\images\\x.png');
});
test('joinPath nested directories', () => {
  assert(joinPath('/a/b', 'c/d/e/f.png') === '/a/b/c/d/e/f.png');
});

// --- Print feature ---

console.log('\nPrint feature:');

// Parse the HTML to verify print CSS and button exist
import { readFileSync } from 'fs';
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf-8');

test('print button exists in HTML', () => {
  assert(html.includes('id="print-btn"'));
});

test('print button has printer icon SVG', () => {
  assert(html.includes('print-btn') && html.includes('<svg'));
});

test('@media print hides UI chrome', () => {
  assert(html.includes('@media print'));
  assert(html.includes('#theme-btn'));
  assert(html.includes('#print-btn'));
  assert(html.includes('.drag-bar'));
  assert(html.includes('.drop-zone'));
  assert(html.includes('.drag-overlay'));
  assert(html.includes('.modal-overlay'));
});

test('@media print forces white background', () => {
  assert(html.includes('background: #ffffff !important'));
});

test('@media print sets print padding and removes max-width', () => {
  assert(html.includes('padding: 20px 40px !important'));
  assert(html.includes('max-width: none !important'));
});

test('Cmd/Ctrl+P shortcut is registered', () => {
  assert(html.includes("e.key === 'p'"));
  assert(html.includes('window.print()'));
});

test('print button is hidden by default (no content)', () => {
  assert(html.includes("display: none"));
  // Verify button gets shown when content renders
  assert(html.includes("printBtn.style.display = 'block'"));
});

test('print button only shows after markdown is rendered', () => {
  const renderIdx = html.indexOf('async function renderMarkdown');
  const showIdx = html.indexOf("printBtn.style.display = 'block'");
  assert(renderIdx < showIdx, 'printBtn shown inside renderMarkdown');
});

// --- Find bar ---

console.log('\nFind bar:');

test('find bar exists in HTML', () => {
  assert(html.includes('id="find-bar"'));
  assert(html.includes('id="find-input"'));
  assert(html.includes('id="find-close"'));
});

test('Cmd/Ctrl+F shortcut is registered', () => {
  assert(html.includes("e.key === 'f'"));
  assert(html.includes('openFind()'));
});

test('/ key opens find bar', () => {
  assert(html.includes("case '/':"));
});

test('find highlights matches as you type', () => {
  assert(html.includes("findInput.addEventListener('input'"));
  assert(html.includes('highlightMatches'));
  assert(html.includes('find-highlight'));
});

test('find bar hidden in print', () => {
  const printMedia = html.slice(html.indexOf('@media print'));
  assert(printMedia.includes('.find-bar'));
});

// --- Vim-like keys ---

console.log('\nVim-like keys:');

test('j/k scroll keys registered', () => {
  assert(html.includes("case 'j':"));
  assert(html.includes("case 'k':"));
});

test('d/e half-page scroll registered', () => {
  assert(html.includes("case 'd':"));
  assert(html.includes("case 'e':"));
  assert(html.includes('halfPage'));
});

test('G/g scroll to top/bottom registered', () => {
  assert(html.includes("case 'G':"));
  assert(html.includes("case 'g':"));
});

test('t toggles theme', () => {
  assert(html.includes("e.key === 't'"));
  assert(html.includes('themeBtn.click()'));
});

test('vim keys disabled when find bar is open', () => {
  assert(html.includes('!findOpen()'));
});

// --- Relative image rewriting wiring ---

console.log('\nRelative image rewriting in HTML:');

test('rewriteRelativeAssets function exists', () => {
  assert(html.includes('function rewriteRelativeAssets'));
});

test('rewriteRelativeAssets called from renderMarkdown', () => {
  assert(html.includes('rewriteRelativeAssets(dirname(currentFilePath))'));
});

test('convertFileSrc used to build asset URL', () => {
  assert(html.includes('convertFileSrc'));
});

test('assetProtocol enabled in tauri.conf.json', () => {
  const conf = readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf-8');
  const parsed = JSON.parse(conf);
  assert(parsed.app.security.assetProtocol.enable === true);
  assert(Array.isArray(parsed.app.security.assetProtocol.scope));
});

// --- Vendored assets (no runtime CDN dependence) ---

console.log('\nVendored assets:');

import { existsSync } from 'fs';

const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
const linkHrefs = [...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]);
const assetRefs = [...scriptSrcs, ...linkHrefs];

test('index.html references at least one script and one stylesheet', () => {
  assert(scriptSrcs.length > 0 && linkHrefs.length > 0);
});

test('no <script> or <link> loads from a remote host', () => {
  const remote = assetRefs.filter(u => /^(https?:)?\/\//i.test(u));
  assert(remote.length === 0, `Remote references found: ${remote.join(', ')}`);
});

test('no CDN hostnames anywhere in index.html', () => {
  const cdn = html.match(/jsdelivr|unpkg\.com|cdnjs|googleapis|gstatic/gi);
  assert(!cdn, `CDN hostnames found: ${cdn && cdn.join(', ')}`);
});

test('no integrity/crossorigin attributes left on local assets', () => {
  assert(!/<(script|link)[^>]+(integrity|crossorigin)=/i.test(html));
});

test('every referenced script/stylesheet exists under dist/', () => {
  const missing = assetRefs.filter(u => !existsSync(new URL(`../dist/${u}`, import.meta.url)));
  assert(missing.length === 0, `Missing local files: ${missing.join(', ')}`);
});

test('vendored paths pin a version directory', () => {
  const unpinned = assetRefs.filter(u => !/^vendor\/[^/]+\/\d+\.\d+\.\d+\//.test(u));
  assert(unpinned.length === 0, `Unpinned vendor paths: ${unpinned.join(', ')}`);
});

test('KaTeX fonts referenced by katex.min.css are vendored', () => {
  const cssRef = linkHrefs.find(u => /katex\.min\.css$/.test(u));
  assert(cssRef, 'katex.min.css not referenced');
  const cssDir = cssRef.replace(/[^/]+$/, '');
  const css = readFileSync(new URL(`../dist/${cssRef}`, import.meta.url), 'utf-8');
  const fonts = [...new Set([...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]))];
  assert(fonts.length > 0, 'no font urls found in katex.min.css');
  const missing = fonts.filter(f => !existsSync(new URL(`../dist/${cssDir}${f}`, import.meta.url)));
  assert(missing.length === 0, `Missing fonts: ${missing.join(', ')}`);
});

test('each vendored package directory ships a LICENSE', () => {
  const dirs = [...new Set(assetRefs.map(u => u.match(/^vendor\/[^/]+\/[^/]+\//)?.[0]).filter(Boolean))];
  const missing = dirs.filter(d => !existsSync(new URL(`../dist/${d}LICENSE`, import.meta.url)));
  assert(missing.length === 0, `Missing LICENSE in: ${missing.join(', ')}`);
});

// --- Link handling (issue #4: links must not navigate the viewer away) ---

console.log('\nLink handling:');

test('content click handler intercepts anchor clicks', () => {
  assert(html.includes("content.addEventListener('click'"));
  assert(html.includes("closest('a[href]')"));
  assert(html.includes('e.preventDefault()'));
});

test('external links open in the default browser via the opener plugin', () => {
  assert(html.includes('opener.openUrl('));
  assert(html.includes("window.open(") && html.includes("'noopener'"), 'browser fallback for non-Tauri context');
});

test('relative Markdown links open in a new Covalent window', () => {
  assert(/invoke\('open_new_window',\s*\{\s*filePath:\s*action\.path/.test(html));
});

test('other relative links are revealed in the file manager, never opened', () => {
  assert(html.includes('opener.revealItemInDir('));
  assert(!html.includes('opener.openPath('));
});

test('opener plugin is registered in Rust and Cargo.toml', () => {
  const rs = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf-8');
  const toml = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf-8');
  assert(rs.includes('.plugin(tauri_plugin_opener::init())'));
  assert(/^tauri-plugin-opener\s*=/m.test(toml));
});

test('opener:default permission granted to all windows', () => {
  const cap = JSON.parse(readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf-8'));
  assert(cap.permissions.includes('opener:default'));
  assert(cap.windows.includes('main') && cap.windows.includes('window-*'));
});

// linkAction is exercised from the real source in index.html (extracted, not copied)
const linkActionSrc = html.match(/    function linkAction\(href, baseFile\) \{[\s\S]*?\n    \}\n/);
const linkAction = linkActionSrc
  ? new Function('isAbsoluteFsPath', 'dirname', 'joinPath', 'safeDecode', 'resolveAgainst', linkActionSrc[0] + '\nreturn linkAction;')(isAbsoluteFsPath, dirname, joinPath, safeDecode, resolveAgainst)
  : null;

test('linkAction is defined in index.html', () => assert(typeof linkAction === 'function'));

test('http/https/mailto/tel are external', () => {
  for (const u of ['https://a.b/c', 'http://a.b', 'mailto:x@y.z', 'tel:+1555']) {
    const r = linkAction(u, '/d/doc.md');
    assert(r.type === 'external' && r.url === u, u);
  }
});

test('protocol-relative link is external via https', () => {
  const r = linkAction('//example.org/x', '/d/doc.md');
  assert(r.type === 'external' && r.url === 'https://example.org/x');
});

test('in-page anchor is left to the browser', () => {
  assert(linkAction('#section', '/d/doc.md').type === 'anchor');
});

test('javascript:, data: and file: links are inert', () => {
  for (const u of ['javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd']) {
    assert(linkAction(u, '/d/doc.md').type === 'ignore', u);
  }
});

test('relative markdown link resolves against the document directory', () => {
  const r = linkAction('./notes/other.md', '/Users/me/docs/README.md');
  assert(r.type === 'markdown' && r.path === '/Users/me/docs/notes/other.md');
  const w = linkAction('sub\\x.markdown', 'C:\\docs\\a.md');
  assert(w.type === 'markdown' && w.path === 'C:\\docs\\sub\\x.markdown', w.path);
});

test('query and fragment are stripped from file links', () => {
  const r = linkAction('other.md?x=1#top', '/d/doc.md');
  assert(r.type === 'markdown' && r.path === '/d/other.md');
});

test('non-markdown relative file is a local reveal', () => {
  const r = linkAction('assets/pic.png', '/d/doc.md');
  assert(r.type === 'local' && r.path === '/d/assets/pic.png');
});

test('relative link with no document path is inert, not resolved against a stale directory', () => {
  assert(linkAction('other.md', null).type === 'ignore');
});

test('Windows drive-qualified absolute paths are files, not URI schemes (Codex P2)', () => {
  const a = linkAction('C:/docs/next.md', 'C:\\docs\\a.md');
  assert(a.type === 'markdown' && a.path === 'C:/docs/next.md', JSON.stringify(a));
  const b = linkAction('D:\\files\\report.pdf', '/d/doc.md');
  assert(b.type === 'local' && b.path === 'D:\\files\\report.pdf', JSON.stringify(b));
});

test('malformed percent escape does not throw (Codex P2)', () => {
  let r;
  try { r = linkAction('100%.md', '/d/doc.md'); } catch (e) { assert(false, 'threw: ' + e.message); }
  assert(r.type === 'markdown' && r.path === '/d/100%.md', JSON.stringify(r));
});

test('click handler cannot fall through to navigation on error', () => {
  const handler = html.match(/content\.addEventListener\('click', \(e\) => \{[\s\S]*?\n    \}\);\n/);
  assert(handler, 'click handler not found');
  assert(/try \{[\s\S]*\} catch/.test(handler[0]), 'handler must guard with try/catch');
  assert(handler[0].includes('e.preventDefault()'));
});

test('picker/drop loads clear the stale document path (Codex P1)', () => {
  const fn = html.match(/function handleFile\(file\) \{[\s\S]*?\n    \}\n/);
  assert(fn, 'handleFile not found');
  assert(fn[0].includes('currentFilePath = null'), 'handleFile must reset currentFilePath');
});

// Links as the real renderer emits them: marked percent-encodes backslashes and
// spaces, so classify the href marked actually produces, not the Markdown source.
import { createRequire } from 'module';
const { marked: realMarked } = createRequire(import.meta.url)('../dist/vendor/marked/18.0.11/marked.umd.js');
const renderedHref = (md) => realMarked.parse(md).match(/href="([^"]*)"/)?.[1] ?? null;

test('marked encodes backslashes; Windows absolute link still opens (Codex P2 follow-up)', () => {
  const href = renderedHref('[x](C:\\docs\\next.md)');
  assert(href === 'C:%5Cdocs%5Cnext.md', 'renderer output changed: ' + href);
  const r = linkAction(href, 'C:\\docs\\a.md');
  assert(r.type === 'markdown' && r.path === 'C:\\docs\\next.md', JSON.stringify(r));
});

test('encoded relative Windows link resolves against the document', () => {
  const r = linkAction(renderedHref('[x](sub\\x.markdown)'), 'C:\\docs\\a.md');
  assert(r.type === 'markdown' && r.path === 'C:\\docs\\sub\\x.markdown', JSON.stringify(r));
});

test('encoded space in filename is decoded', () => {
  const r = linkAction(renderedHref('[x](<my file.md>)'), '/d/doc.md');
  assert(r.type === 'markdown' && r.path === '/d/my file.md', JSON.stringify(r));
});

test('query-only link never navigates the viewer (Codex P2 follow-up)', () => {
  const r = linkAction(renderedHref('[x](?view=compact)'), '/d/doc.md');
  assert(r.type === 'ignore', JSON.stringify(r));
});

test('empty link never navigates the viewer', () => {
  assert(renderedHref('[x]()') === '');
  const r = linkAction('', '/d/doc.md');
  assert(r && r.type === 'ignore', JSON.stringify(r));
});

test('percent-encoded scheme is still inert', () => {
  assert(linkAction('javascript%3Aalert(1)', '/d/doc.md').type === 'ignore');
});

test('UNC share links are absolute, not joined onto the document folder (Codex P2)', () => {
  // In Markdown, "\\" is an escaped backslash, so a UNC target is written \\\\server\\share\\next.md
  const href = renderedHref(String.raw`[x](\\\\server\\share\\next.md)`);
  assert(href === '%5C%5Cserver%5Cshare%5Cnext.md', 'renderer output changed: ' + href);
  const r = linkAction(href, String.raw`C:\docs\a.md`);
  assert(r.type === 'markdown' && r.path === String.raw`\\server\share\next.md`, JSON.stringify(r));
  assert(isAbsoluteFsPath(String.raw`\\server\share\img.png`), 'images on shares are absolute too');
});

// Image sources as marked emits them (percent-encoded), resolved by the real helper
const resolveAssetPath = extractFn('resolveAssetPath', { isExternalUrl, safeDecode, resolveAgainst });
const renderedSrc = (md) => realMarked.parse(md).match(/src="([^"]*)"/)?.[1] ?? null;

test('resolveAssetPath is used by rewriteRelativeAssets', () => {
  const fn = html.match(/function rewriteRelativeAssets\(baseDir\) \{[\s\S]*?\n    \}\n/);
  assert(fn && fn[0].includes('resolveAssetPath('));
});

test('UNC image source is decoded and kept absolute (Codex P2)', () => {
  const src = renderedSrc(String.raw`![x](\\\\server\\share\\img.png)`);
  assert(src === '%5C%5Cserver%5Cshare%5Cimg.png', 'renderer output changed: ' + src);
  assert(resolveAssetPath(src, String.raw`C:\docs`) === String.raw`\\server\share\img.png`);
});

test('image filename with spaces is decoded before joining', () => {
  const src = renderedSrc('![x](<my pic.png>)');
  assert(src === 'my%20pic.png', 'renderer output changed: ' + src);
  assert(resolveAssetPath(src, '/d/docs') === '/d/docs/my pic.png');
});

test('literal percent in image filename does not throw', () => {
  assert(resolveAssetPath('100%.png', '/d') === '/d/100%.png');
});

test('external and absolute image sources are untouched or kept absolute', () => {
  assert(resolveAssetPath('https://x.y/a.png', '/d') === null);
  assert(resolveAssetPath('data:image/png;base64,AA', '/d') === null);
  assert(resolveAssetPath('/abs/a.png', '/d') === '/abs/a.png');
  assert(resolveAssetPath('C:/pics/a.png', 'D:\\docs') === 'C:/pics/a.png');
  assert(resolveAssetPath('../up.png', '/d/docs') === '/d/up.png');
});

// --- Cross-document fragments and heading ids (Codex follow-up, #7) ---

console.log('\nFragments and heading ids:');

test('linkAction carries the fragment for markdown links', () => {
  const r = linkAction('other.md#usage', '/d/doc.md');
  assert(r.type === 'markdown' && r.path === '/d/other.md' && r.fragment === 'usage', JSON.stringify(r));
  const enc = linkAction(renderedHref('[x](guide.md#getting%20started)'), '/d/doc.md');
  assert(enc.fragment === 'getting started', JSON.stringify(enc));
  assert(linkAction('other.md', '/d/doc.md').fragment === null);
});

test('click handler passes the fragment to open_new_window', () => {
  assert(/invoke\('open_new_window',\s*\{\s*filePath:\s*action\.path,\s*fragment:\s*action\.fragment/.test(html));
});

test('new windows receive and scroll to the initial fragment', () => {
  assert(html.includes('window.__INITIAL_FRAGMENT__'));
  assert(html.includes('function scrollToFragment('));
  const rs = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf-8');
  assert(rs.includes('__INITIAL_FRAGMENT__'), 'Rust must inject the fragment');
  assert(/fn open_new_window\([^)]*fragment: Option<String>/.test(rs), 'open_new_window must accept fragment');
});

// Node has no DOM, so the tests inject a small entity decoder; the browser build uses a <textarea>.
const nodeDecodeEntities = (str) => str
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(amp|lt|gt|quot|apos|copy|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", copy: '\u00a9', nbsp: '\u00a0' })[e]);
const headingId = extractFn('headingId', { decodeEntities: nodeDecodeEntities });

test('headings get GitHub-style ids', () => {
  const used = new Set();
  assert(headingId('Hello World!', used) === 'hello-world');
  assert(headingId('  Getting  Started ', used) === 'getting--started', 'GitHub keeps one hyphen per space');
  assert(headingId('snake_case_name', used) === 'snake_case_name');
  assert(headingId('API v2.0 / usage', used) === 'api-v20--usage');
  assert(headingId('<code>fn</code> main', used) === 'fn-main', 'tags stripped');
  assert(headingId('A &amp; B', used) === 'a--b', 'entities decoded before slugging (Codex P2)');
  assert(headingId('x &lt;T&gt; &quot;q&quot; it&#39;s', used) === 'x-t-q-its');
  assert(headingId('A &copy; B', new Set()) === 'a--b', 'named entity beyond the basic five (Codex P2)');
  assert(headingId('A &#169; B', new Set()) === 'a--b', 'decimal entity');
  assert(headingId('A &#xA9; B', new Set()) === 'a--b', 'hex entity');
});
test('browser build decodes entities with the DOM', () => {
  const fn = html.match(/    function decodeEntities\(str\) \{[\s\S]*?\n    \}\n/);
  assert(fn && fn[0].includes("createElement('textarea')") && fn[0].includes('.innerHTML') && fn[0].includes('.value'));
});

test('duplicate headings get numbered ids', () => {
  const used = new Set();
  assert(headingId('Usage', used) === 'usage');
  assert(headingId('Usage', used) === 'usage-1');
  assert(headingId('Usage', used) === 'usage-2');
});

test('generated ids never collide with a heading that already carries a suffix (Codex P2)', () => {
  const used = new Set();
  const ids = ['Usage', 'Usage', 'Usage-1', 'Usage'].map(h => headingId(h, used));
  assert(new Set(ids).size === ids.length, 'duplicate id emitted: ' + ids.join(','));
  assert(ids[2] === 'usage-1-1' && ids[3] === 'usage-2', ids.join(','));
  const used2 = new Set();
  assert(headingId('Usage-1', used2) === 'usage-1' && headingId('Usage', used2) === 'usage' && headingId('Usage', used2) === 'usage-2');
});

test('renderer emits heading ids', () => {
  assert(html.includes('renderer.heading = function'));
  assert(/<h\$\{depth\} id="\$\{id\}">/.test(html));
});

// --- Per-window file watchers (Codex follow-up) ---

console.log('\nPer-window file watchers:');

test('watchers are keyed per window, not app-wide', () => {
  const rs = readFileSync(new URL('../src-tauri/src/main.rs', import.meta.url), 'utf-8');
  assert(rs.includes('struct FileWatcher(Mutex<HashMap<String, notify::RecommendedWatcher>>)'), 'FileWatcher must be a per-label map');
  assert(/fn watch_file\([^)]*window: tauri::WebviewWindow/.test(rs), 'watch_file must know its window');
  assert(rs.includes('WindowEvent::Destroyed'), 'watchers must be dropped when a window closes');
});

test('".." never escapes a UNC share root (Codex P2)', () => {
  assert(joinPath(String.raw`\\server\share`, String.raw`..\next.md`) === String.raw`\\server\share\next.md`);
  assert(joinPath(String.raw`\\server\share\docs`, String.raw`..\next.md`) === String.raw`\\server\share\next.md`);
  assert(joinPath(String.raw`\\server\share\docs`, String.raw`..\..\..\next.md`) === String.raw`\\server\share\next.md`);
  assert(joinPath('/', '../x.md') === '/x.md');
  assert(joinPath('C:\\', '..\\x.md') === 'C:\\x.md');
  assert(joinPath('/a/b', '../c.md') === '/a/c.md');
});

test('hot-reload listener is registered before the initial-file early return (Codex P2)', () => {
  const init = html.slice(html.indexOf('async function initTauri()'));
  const listen = init.indexOf("listen('file-changed'");
  const early = init.indexOf('if (window.__INITIAL_FILE__)');
  assert(listen >= 0 && early >= 0 && listen < early, 'file-changed must be listened for in every window');
  const opened = init.indexOf("listen('file-opened'");
  assert(opened > early, 'only the main window (no initial file) should react to file-opened');
});

test('a document with no directory yields inert relative links (Codex P2)', () => {
  assert(linkAction('other.md', 'README.md').type === 'ignore');
  assert(resolveAssetPath('pic.png', '') === null);
});

test('a broken Mermaid diagram never rejects rendering or skips the file watcher (Codex P2)', () => {
  assert(html.includes("mermaid.run({ querySelector: '.mermaid', suppressErrors: true })"));
  const fn = html.match(/async function openFileFromPath\(filePath\) \{[\s\S]*?\n    \}\n/);
  assert(fn, 'openFileFromPath not found');
  const body = fn[0];
  const render = body.indexOf('await renderMarkdown(');
  const renderCatch = body.indexOf('catch', render);
  const watch = body.indexOf("invoke('watch_file'");
  assert(render >= 0 && renderCatch >= 0 && watch > renderCatch, 'watch_file must run after the render try/catch, not inside it');
});

test('single-backslash links are drive-rooted on Windows (Codex P2)', () => {
  const href = renderedHref(String.raw`[x](\next.md)`);
  assert(href === '%5Cnext.md', 'renderer output changed: ' + href);
  const drive = linkAction(href, String.raw`C:\docs\deep\a.md`);
  assert(drive.type === 'markdown' && drive.path === String.raw`C:\next.md`, JSON.stringify(drive));
  const unc = linkAction(href, String.raw`\\server\share\docs\a.md`);
  assert(unc.path === String.raw`\\server\share\next.md`, JSON.stringify(unc));
  const posix = linkAction(href, '/d/docs/a.md');
  assert(posix.path === '/d/docs/next.md', 'POSIX base keeps joining: ' + JSON.stringify(posix));
  assert(resolveAssetPath('%5Cpic.png', String.raw`C:\docs`) === String.raw`C:\pic.png`);
});

// --- Summary ---

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
