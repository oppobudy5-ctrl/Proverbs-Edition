// =============================================================================
// test-a11y.mjs — Uji PR-007 Accessibility Enhancement.
// =============================================================================
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const a11ySrc = await readFile(path.join(ROOT, "js/a11y.js"), "utf8");
assert.match(a11ySrc, /export function trapFocus\(/);
assert.match(a11ySrc, /export function restoreFocus\(/);
assert.match(a11ySrc, /export function announce\(/);
assert.match(a11ySrc, /export function installSkipLink\(/);
assert.match(a11ySrc, /export function getFocusableElements\(/);
assert.match(a11ySrc, /Lewati ke konten utama/);

const html = await readFile(path.join(ROOT, "index.html"), "utf8");
assert.match(html, /<html lang="id">/);
assert.match(html, /<header class="topbar">/);
assert.match(html, /<main id="app"[^>]*tabindex="-1"/);
assert.match(html, /<nav class="topnav"[^>]*aria-label="Navigasi atas"/);
assert.match(html, /<nav class="bottomnav"[^>]*aria-label="Navigasi utama"/);
assert.match(html, /<nav class="footer-nav"[^>]*aria-label="Navigasi footer"/);
assert.match(html, /id="footer-top"[^>]*aria-label="Kembali ke bagian atas halaman"/);
assert.match(html, /<footer class="footer">/);
assert.match(html, /aria-hidden="true"/);
assert.match(html, /streak-pill[^>]*role="status"/);
assert.match(html, /settings-btn[\s\S]*?aria-hidden="true"/);

const css = await readFile(path.join(ROOT, "styles.css"), "utf8");
assert.match(css, /\.skip-link/);
assert.match(css, /\.sr-only/);
assert.match(css, /:focus-visible\s*\{/);
assert.match(css, /\.bgm-slider:focus-visible/);

const reader = await readFile(path.join(ROOT, "js/ui/reader.js"), "utf8");
assert.match(reader, /role:\s*"dialog"/);
assert.match(reader, /"aria-modal":\s*"true"/);
assert.match(reader, /"aria-labelledby"/);
assert.match(reader, /trapFocus\(/);
assert.match(reader, /announce\(/);
assert.match(reader, /aria-busy/);

const settings = await readFile(path.join(ROOT, "js/ui/settings-panel.js"), "utf8");
assert.match(settings, /trapFocus\(/);
assert.match(settings, /role:\s*"dialog"/);
assert.match(settings, /"aria-label":\s*"Mode Baca"/);

const vdrop = await readFile(path.join(ROOT, "js/ui/version-dropdown.js"), "utf8");
assert.match(vdrop, /role:\s*"listbox"/);
assert.match(vdrop, /ArrowDown/);
assert.match(vdrop, /restoreFocus\(/);
assert.match(vdrop, /aria-selected/);

const library = await readFile(path.join(ROOT, "js/ui/library.js"), "utf8");
assert.match(library, /role:\s*"tabpanel"/);
assert.match(library, /aria-controls/);
assert.match(library, /Home/);
assert.match(library, /End/);

const router = await readFile(path.join(ROOT, "js/router.js"), "utf8");
assert.match(router, /focusMainContent/);
assert.match(router, /announce\(/);
assert.match(router, /updateDocumentTitle/);
assert.match(router, /document\.title/);

const journal = await readFile(path.join(ROOT, "js/ui/journal-editor.js"), "utf8");
assert.match(journal, /aria-label":\s*"Judul jurnal"/);
assert.match(journal, /aria-label":\s*"Refleksi"/);
assert.match(journal, /class:\s*"journal-label"/);
assert.match(journal, /aria-live":\s*"polite"/);

// Tidak ada outline:none global yang membunuh :focus-visible pada kontrol utama.
assert.doesNotMatch(css, /^\s*\*\s*\{\s*outline:\s*none/m);

console.log("VALID: landmarks, skip link, focus helpers, modal a11y, tabs, forms, dan focus indicators lolos.");
