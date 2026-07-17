// =============================================================================
// gen-icons.mjs — Rasterize brand icons + OG image to PNG using sharp.
//
//   node scripts/gen-icons.mjs
//
// Produces:
//   icons/icon-192.png            (PWA, purpose "any")
//   icons/icon-512.png            (PWA, purpose "any")
//   icons/maskable-512.png        (PWA, purpose "maskable" — full-bleed safe zone)
//   icons/apple-touch-icon-180.png(iOS home screen)
//   og-image.png                  (1200x630 social preview)
//
// The star is drawn as a vector polygon (not a font glyph) so rasterization
// never depends on Georgia/serif being installed on the build machine.
// =============================================================================
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = path.join(ROOT, "icons");
fs.mkdirSync(ICONS_DIR, { recursive: true });

const BG = "#0b0d12";
const STAR = "#2a1d05";

// Four-point sparkle centered at (cx,cy): outer radius R, inner radius r.
function starPoints(cx, cy, R, r) {
  const outer = [-90, 0, 90, 180];
  const pts = [];
  for (const a of outer) {
    const rad = (a * Math.PI) / 180;
    pts.push([cx + R * Math.cos(rad), cy + R * Math.sin(rad)]);
    const ra = ((a + 45) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(ra), cy + r * Math.sin(ra)]);
  }
  return pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
}

function iconSVG({ size, maskable }) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const radius = maskable ? 0 : Math.round(s * 0.22);
  const circleR = maskable ? s * 0.29 : s * 0.32;
  const starR = maskable ? s * 0.17 : s * 0.185;
  const starInner = starR * 0.3;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="g" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#fff2c1"/>
      <stop offset="0.6" stop-color="#d6a851"/>
      <stop offset="1" stop-color="#ad7e2c"/>
    </radialGradient>
  </defs>
  <rect width="${s}" height="${s}" rx="${radius}" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="${circleR}" fill="url(#g)"/>
  <polygon points="${starPoints(cx, cy, starR, starInner)}" fill="${STAR}"/>
</svg>`;
}

function ogSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.35" r="0.9">
      <stop offset="0" stop-color="#1a1d28"/>
      <stop offset="0.6" stop-color="#0b0d12"/>
      <stop offset="1" stop-color="#06080d"/>
    </radialGradient>
    <radialGradient id="gold" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#fff2c1"/>
      <stop offset="0.6" stop-color="#d6a851"/>
      <stop offset="1" stop-color="#ad7e2c"/>
    </radialGradient>
    <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d6a851" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#58d68d" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#aurora)"/>
  <circle cx="180" cy="315" r="110" fill="url(#gold)" opacity="0.95"/>
  <polygon points="${starPoints(180, 315, 74, 22)}" fill="#2a1d05"/>
  <g transform="translate(360, 205)">
    <text x="0" y="0" font-family="Arial, sans-serif" font-size="22" fill="#d6a851" letter-spacing="6" font-weight="700">DAILY WISDOM JOURNEY</text>
    <text x="0" y="82" font-family="Georgia, serif" font-size="72" fill="#f4ecd8" font-weight="700">Bible Time</text>
    <text x="0" y="148" font-family="Georgia, serif" font-size="54" fill="#d6a851" font-style="italic" font-weight="700">31 Hari Hidup</text>
    <text x="0" y="202" font-family="Georgia, serif" font-size="54" fill="#d6a851" font-style="italic" font-weight="700">dalam Hikmat</text>
    <text x="0" y="260" font-family="Arial, sans-serif" font-size="26" fill="#b8bdc9" font-weight="400">Amsal 1&#8211;31 &#183; renungan &#183; refleksi &#183; kuis</text>
    <text x="0" y="332" font-family="Georgia, serif" font-size="30" fill="#fff2c1" font-style="italic" font-weight="400">&#8220;Takut akan TUHAN adalah permulaan pengetahuan.&#8221;</text>
    <text x="0" y="372" font-family="Arial, sans-serif" font-size="20" fill="#8c93a3" font-weight="500">&#8212; Amsal 1:7</text>
  </g>
  <rect x="0" y="0" width="1200" height="630" fill="none" stroke="#d6a851" stroke-opacity="0.15" stroke-width="2"/>
</svg>`;
}

async function render(svg, outFile, width) {
  const buf = Buffer.from(svg);
  await sharp(buf, { density: 384 }).resize({ width }).png().toFile(outFile);
  console.log("wrote", path.relative(ROOT, outFile));
}

await render(iconSVG({ size: 192, maskable: false }), path.join(ICONS_DIR, "icon-192.png"), 192);
await render(iconSVG({ size: 512, maskable: false }), path.join(ICONS_DIR, "icon-512.png"), 512);
await render(iconSVG({ size: 512, maskable: true }), path.join(ICONS_DIR, "maskable-512.png"), 512);
await render(iconSVG({ size: 180, maskable: false }), path.join(ICONS_DIR, "apple-touch-icon-180.png"), 180);
await render(ogSVG(), path.join(ROOT, "og-image.png"), 1200);

console.log("Done.");
