#!/usr/bin/env node
/* ============================================================
   _github/scripts/build-sitemap.mjs
   ------------------------------------------------------------
   Reads data/posts.json + data/projects.json and writes
   sitemap.xml at the repo root. Path conventions match the
   site's hash router (#/path) — but sitemaps want absolute
   URLs so we use the rendered SPA URL form.

   GitHub Pages serves hash routes via the SPA root, so every
   entry points to "/" with a `?ref=` query so social cards
   and search bots still see the canonical site.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SITE_URL = (process.env.SITE_URL || '').replace(/\/$/, '');
if (!SITE_URL) {
  console.error('SITE_URL env required. Set repo variable SITE_URL to e.g. https://you.github.io/Portfolio');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: SITE_URL + '/',            priority: '1.0', changefreq: 'weekly', lastmod: today },
  { loc: SITE_URL + '/#/projects',  priority: '0.9', changefreq: 'monthly', lastmod: today },
  { loc: SITE_URL + '/#/blog',      priority: '0.9', changefreq: 'weekly',  lastmod: today },
  { loc: SITE_URL + '/#/study',     priority: '0.6', changefreq: 'weekly',  lastmod: today },
  { loc: SITE_URL + '/#/about',     priority: '0.7', changefreq: 'monthly', lastmod: today },
  { loc: SITE_URL + '/#/contact',   priority: '0.5', changefreq: 'yearly',  lastmod: today },
];

function loadJSON(path, fallback = []) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return fallback; }
}

const posts    = loadJSON('data/posts.json');
const projects = loadJSON('data/projects.json');

for (const p of posts) {
  urls.push({
    loc: `${SITE_URL}/#/post/${encodeURIComponent(p.id)}`,
    priority: p.featured ? '0.8' : '0.6',
    changefreq: 'yearly',
    lastmod: p.date || today,
  });
}
for (const p of projects) {
  if (p.id?.startsWith('reserved-')) continue;
  urls.push({
    loc: `${SITE_URL}/#/projects/${encodeURIComponent(p.id)}`,
    priority: p.flagship ? '0.9' : '0.7',
    changefreq: 'monthly',
    lastmod: today,
  });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync('sitemap.xml', xml);
console.log(`Wrote sitemap.xml — ${urls.length} URLs.`);
