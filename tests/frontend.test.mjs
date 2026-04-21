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

test('@media print removes padding and max-width', () => {
  assert(html.includes('padding: 0 !important'));
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

// --- Summary ---

console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
