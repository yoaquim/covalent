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

function isExternalUrl(url) {
  return /^(https?|data|blob|file|asset|tauri|mailto|about):/i.test(url) ||
         url.startsWith('//') || url.startsWith('#');
}

function isAbsoluteFsPath(path) {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path);
}

function dirname(filePath) {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : '';
}

function joinPath(baseDir, rel) {
  const sep = baseDir.includes('\\') ? '\\' : '/';
  const segs = baseDir.split(/[\\/]/);
  for (const seg of rel.split(/[\\/]/)) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { if (segs.length > 1) segs.pop(); }
    else segs.push(seg);
  }
  return segs.join(sep);
}

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

// --- Summary ---

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
