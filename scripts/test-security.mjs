// =============================================================================
// test-security.mjs — Uji PR-006 Security & DOM Hardening.
// escape/sanitasi, validasi URL, safe render (highlight), dan file terkait.
// =============================================================================
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  escapeHTML,
  sanitizeString,
  safeText,
  isSafeProtocol,
  validateURL,
  safeURL,
} = await import("../js/utils/security.js");

// --- escapeHTML ---
assert.equal(
  escapeHTML("<script>alert('x')</script>"),
  "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
);
assert.equal(escapeHTML('"&<>'), "&quot;&amp;&lt;&gt;");
assert.equal(escapeHTML(null), "");
assert.equal(escapeHTML(42), "42");

// --- sanitizeString / safeText ---
assert.equal(sanitizeString("halo\u0000dunia"), "halodunia");
assert.equal(sanitizeString("baris1\nbaris2"), "baris1\nbaris2");
assert.equal(sanitizeString("baris1\nbaris2", { allowNewlines: false }), "baris1baris2");
assert.equal(sanitizeString("abcdef", { maxLength: 3 }), "abc");
assert.equal(safeText("<b>tetap teks</b>"), "<b>tetap teks</b>"); // tidak dieksekusi, tetap string

// --- isSafeProtocol / validateURL / safeURL ---
for (const ok of ["https://x.com", "http://x.com", "mailto:a@b.com", "tel:+62", "#anchor", "/path", "./rel", "../up"]) {
  assert.equal(isSafeProtocol(ok), true, `harus aman: ${ok}`);
  assert.notEqual(validateURL(ok), null, `harus valid: ${ok}`);
}
for (const bad of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "  javascript:alert(1)", "data:text/html,<script>", "vbscript:msgbox", "file:///etc/passwd", "blob:https://x"]) {
  assert.equal(validateURL(bad), null, `harus ditolak: ${bad}`);
  assert.equal(safeURL(bad), "#", `fallback aman: ${bad}`);
  assert.equal(safeURL(bad, "/home"), "/home");
}
assert.equal(safeURL("https://x.com"), "https://x.com");
assert.equal(validateURL(""), null);

// --- highlight() aman dari HTML injection ---
const { highlight } = await import("../js/search.js");
const injected = highlight("<img src=x onerror=alert(1)> takut TUHAN", "takut");
assert.ok(!injected.includes("<img"), "highlight harus escape tag berbahaya");
assert.ok(injected.includes("&lt;img"), "highlight harus meng-escape < menjadi entity");
assert.ok(injected.includes("<mark>takut</mark>"), "highlight tetap membungkus term dengan <mark>");

// --- markdownToSafeHtml aman ---
const { markdownToSafeHtml } = await import("../js/journal/export.js");
const md = markdownToSafeHtml("# Judul\n<script>alert(1)</script>\n<img src=x onerror=alert(2)>");
assert.ok(!md.includes("<script>"), "markdown export tidak boleh membiarkan <script>");
assert.ok(md.includes("&lt;script&gt;"));
assert.ok(md.includes("&lt;img"));

// --- Tidak ada duplikasi escapeHTML/escapeHtml di luar util bersama ---
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}
const jsFiles = await walk(path.join(ROOT, "js"));
const definers = [];
for (const file of jsFiles) {
  if (file.endsWith(path.join("utils", "security.js"))) continue;
  const src = await readFile(file, "utf8");
  if (/function\s+escapeH(?:tml|TML)\s*\(/.test(src)) definers.push(path.relative(ROOT, file));
}
assert.deepEqual(definers, [], `escapeHTML tidak boleh didefinisikan ulang: ${definers.join(", ")}`);

// --- target="_blank" WAJIB rel noopener noreferrer ---
async function assertBlankRel(relFile) {
  const src = await readFile(path.join(ROOT, relFile), "utf8");
  const matches = src.match(/target:\s*["']_blank["'][^)]*?\)/g) || [];
  matches.forEach((frag) => {
    assert.ok(/rel:\s*["']noopener noreferrer["']/.test(frag), `${relFile}: target _blank butuh rel noopener noreferrer → ${frag}`);
  });
}
await assertBlankRel("js/ui/about.js");
await assertBlankRel("js/ui/reader.js");

const html = await readFile(path.join(ROOT, "index.html"), "utf8");
const blankAnchors = html.match(/<a[^>]*target="_blank"[^>]*>/g) || [];
blankAnchors.forEach((a) => {
  assert.ok(/rel="noopener noreferrer"/.test(a), `index.html target _blank butuh rel noopener noreferrer → ${a}`);
});

// --- quiz.js tidak lagi memakai innerHTML ---
const quizSrc = await readFile(path.join(ROOT, "js/ui/quiz.js"), "utf8");
assert.ok(!/\.innerHTML/.test(quizSrc), "quiz.js tidak boleh memakai innerHTML");

// --- Tidak ada eval / new Function / setTimeout(string) di kode aplikasi ---
for (const file of jsFiles) {
  const src = await readFile(file, "utf8");
  assert.ok(!/\beval\s*\(/.test(src), `${path.relative(ROOT, file)} tidak boleh eval()`);
  assert.ok(!/new\s+Function\s*\(/.test(src), `${path.relative(ROOT, file)} tidak boleh new Function()`);
  assert.ok(!/set(?:Timeout|Interval)\s*\(\s*["'`]/.test(src), `${path.relative(ROOT, file)} tidak boleh set*(string)`);
}

console.log("VALID: escape/sanitasi, URL validation, safe render, link security, dan DOM hardening lolos.");
