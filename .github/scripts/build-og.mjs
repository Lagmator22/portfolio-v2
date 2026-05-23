#!/usr/bin/env node
/* ============================================================
   _github/scripts/build-og.mjs
   ------------------------------------------------------------
   Renders a 1200x630 social-card PNG from an SVG template that
   matches the portfolio's visual identity:
     - JetBrains Mono labels
     - Space Grotesk display
     - dark surface, OKLCH accent
     - accent dot mark

   Uses @resvg/resvg-js (no native build, no headless browser).
   Reads `data/config.js` if present for owner name + tagline.

   Output: og.png AND assets/og.png (we mirror to both so social
   scrapers don't 404 on whichever path the meta tag points to).
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const TITLE   = process.env.SITE_TITLE   || 'Portfolio';
const TAGLINE = process.env.SITE_TAGLINE || 'AI inference. C++ systems. Pixel monsters.';
const ACCENT  = process.env.SITE_ACCENT  || '#a78bff'; /* fallback indigo at oklch(0.72 0.18 275) ≈ */

// Counts add a sense of activity. Read JSON; ignore if absent.
function count(path) {
  if (!existsSync(path)) return 0;
  try { return JSON.parse(readFileSync(path, 'utf-8')).length || 0; } catch { return 0; }
}
const postCount    = count('data/posts.json');
const projectCount = count('data/projects.json').valueOf();

// Wrap tagline into ~38-char lines.
function wrap(s, n = 38) {
  const out = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if ((line + ' ' + word).trim().length > n) { out.push(line); line = word; }
    else line = (line ? line + ' ' : '') + word;
  }
  if (line) out.push(line);
  return out;
}
const taglineLines = wrap(TAGLINE, 38);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="78%" cy="22%" r="60%">
      <stop offset="0%"  stop-color="${ACCENT}" stop-opacity="0.35"/>
      <stop offset="55%" stop-color="${ACCENT}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse">
      <path d="M56 0H0v56" fill="none" stroke="#ffffff" stroke-opacity="0.04"/>
    </pattern>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0c0a18" stop-opacity="1"/>
      <stop offset="0.55" stop-color="#0c0a18" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- bg -->
  <rect width="1200" height="630" fill="#0c0a18"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="700" height="630" fill="url(#fade)"/>

  <!-- accent dot mark -->
  <rect x="80" y="80" width="20" height="20" rx="5" fill="${ACCENT}"/>

  <!-- handle -->
  <text x="116" y="98" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="16" fill="#ffffff" fill-opacity="0.55" letter-spacing="2">
    ${escape(TITLE.toUpperCase())} · PORTFOLIO
  </text>

  <!-- title -->
  <text x="80" y="290" font-family="ui-sans-serif, 'Space Grotesk', system-ui" font-size="108" font-weight="600" letter-spacing="-4" fill="#ffffff">
    ${escape(TITLE)}
  </text>

  <!-- tagline -->
  ${taglineLines.map((l, i) => `
  <text x="80" y="${360 + i * 44}" font-family="ui-sans-serif, 'Space Grotesk', system-ui" font-size="34" font-weight="400" fill="#ffffff" fill-opacity="0.72">${escape(l)}</text>`).join('')}

  <!-- stats strip -->
  <g font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="14" fill="#ffffff" fill-opacity="0.55" letter-spacing="1.4">
    <text x="80"  y="560">PROJECTS · ${projectCount.toString().padStart(2, '0')}</text>
    <text x="280" y="560">POSTS · ${postCount.toString().padStart(2, '0')}</text>
    <text x="480" y="560">LOCAL FIRST</text>
  </g>

  <!-- corner mark -->
  <text x="1120" y="560" text-anchor="end" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="14" letter-spacing="2" fill="${ACCENT}">
    ${new Date().getFullYear()}
  </text>
</svg>
`;

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  background: '#0c0a18',
  font: { loadSystemFonts: true },
});
const png = resvg.render().asPng();

writeFileSync('og.png', png);
if (!existsSync('assets')) mkdirSync('assets');
writeFileSync('assets/og.png', png);
console.log(`Wrote og.png (${png.length} bytes).`);
