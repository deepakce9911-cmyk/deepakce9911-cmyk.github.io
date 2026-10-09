// Checks every built page for on-page SEO and structured-data problems. Exits 1 on any error.
//   node src/seo-check.mjs                    personal build (docs/)
//   node src/seo-check.mjs --env production   dextr.ai build (dist/)
//   add --links to also request every external link

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadSite } from './build.mjs';

const args = process.argv.slice(2);
const envName = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'personal';
const checkLinks = args.includes('--links');
const { env } = loadSite(envName);
const outDir = join(process.cwd(), env.outDir);

const errors = [];
const warnings = [];
const notes = [];
const error = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&middot;/g, '·').replace(/&#39;/g, "'");
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
const textOf = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

function pngSize(file) {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

// Pages that live on the main site, outside this build (dextr.ai's homepage in the production build).
const outsideBuild = (path) => !env.home && (path === '/' || path === '');

function localFileFor(url) {
  if (!url.startsWith(env.siteUrl)) return null;
  const path = url.slice(env.siteUrl.length).split('#')[0] || '/';
  if (outsideBuild(path)) return null;
  return path.endsWith('/') ? join(outDir, path, 'index.html') : join(outDir, path);
}

const externalLinks = new Map();

for (const file of htmlFiles(outDir)) {
  const name = relative(outDir, file).replace(/\\/g, '/');
  const html = readFileSync(file, 'utf8');
  const is404 = name === '404.html';

  // Document basics
  if (!/^<!doctype html>/i.test(html)) error(name, 'missing <!doctype html>');
  if (!/<html lang="[a-z]{2}(-[A-Z]{2})?">/.test(html)) error(name, 'missing <html lang>');
  if (!/<head>\n<meta charset="utf-8">/.test(html)) error(name, 'charset must be the first tag in <head>');
  if (!/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html)) error(name, 'missing viewport meta');

  // Title and description
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const description = decode(meta(html, 'name', 'description') ?? '');
  if (!title) error(name, 'missing <title>');
  else if (title.length > 60) warn(name, `title is ${title.length} characters (aim for 60 or fewer): "${title}"`);
  if (!description) error(name, 'missing meta description');
  else if (!is404 && (description.length < 70 || description.length > 160)) warn(name, `meta description is ${description.length} characters (aim for 70 to 160)`);

  // Robots and canonical
  const robots = meta(html, 'name', 'robots');
  const expectIndex = env.indexable && !is404;
  if (!robots) error(name, 'missing robots meta');
  else if (expectIndex && /noindex/.test(robots)) error(name, 'page is noindex in an indexable build');
  else if (!expectIndex && !/noindex/.test(robots)) error(name, 'page should be noindex in this build');
  const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (!canonical) error(name, 'missing canonical');
  else if (!canonical.startsWith(env.siteUrl)) error(name, `canonical ${canonical} is not on ${env.siteUrl}`);
  else if (!is404 && localFileFor(canonical) && !existsSync(localFileFor(canonical))) error(name, `canonical ${canonical} does not resolve to a built page`);

  // Social tags
  for (const prop of ['og:type', 'og:title', 'og:description', 'og:url', 'og:site_name']) if (!meta(html, 'property', prop)) error(name, `missing ${prop}`);
  if (!meta(html, 'name', 'twitter:card')) error(name, 'missing twitter:card');
  if (canonical && meta(html, 'property', 'og:url') !== canonical) error(name, 'og:url differs from canonical');
  const ogImage = meta(html, 'property', 'og:image');
  if (ogImage) {
    const local = localFileFor(ogImage);
    if (local && !existsSync(local)) error(name, `og:image file missing: ${ogImage}`);
    else if (local) {
      const size = pngSize(local);
      if (size.width < 1200 || size.height < 630) error(name, `og:image is ${size.width}x${size.height}, needs at least 1200x630`);
      if (size.bytes > 5 * 1024 * 1024) error(name, 'og:image is over 5 MB');
    }
    if (!meta(html, 'property', 'og:image:alt')) warn(name, 'og:image has no alt text');
  } else if (!is404) warn(name, 'no og:image');

  // Headings
  const body = html.slice(html.indexOf('<body>'));
  const h1s = body.match(/<h1[\s>]/g) ?? [];
  if (h1s.length !== 1) error(name, `has ${h1s.length} <h1> elements (needs exactly 1)`);
  let last = 1;
  for (const [, level] of body.matchAll(/<h([1-6])[\s>]/g)) {
    if (Number(level) > last + 1) error(name, `heading jumps from h${last} to h${level}`);
    last = Number(level);
  }

  // IDs, anchors and links
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) error(name, `duplicate id(s): ${[...new Set(dupes)].join(', ')}`);
  for (const [, anchor] of body.matchAll(/href="#([^"]+)"/g)) if (!ids.includes(anchor)) error(name, `link to missing #${anchor}`);
  for (const [, href] of body.matchAll(/href="(\/[^"#]*)"/g)) {
    if (outsideBuild(href)) continue;
    const target = join(outDir, href.endsWith('/') ? `${href}index.html` : href);
    if (!existsSync(target)) error(name, `internal link to missing page ${href}`);
  }
  for (const [tag] of body.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) if (!/rel="[^"]*noopener/.test(tag)) error(name, `target=_blank without rel=noopener: ${tag}`);
  for (const [, href] of body.matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"/g)) {
    if (!href.startsWith(env.siteUrl)) externalLinks.set(href.replace(/&amp;/g, '&'), name);
  }

  // Images
  for (const [tag] of body.matchAll(/<img [^>]*>/g)) {
    if (!/\salt="/.test(tag)) error(name, `<img> without alt: ${tag}`);
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) warn(name, `<img> without width/height (layout shift): ${tag}`);
  }

  // Structured data
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)];
  if (!blocks.length) { error(name, 'no JSON-LD'); continue; }
  let data;
  try { data = JSON.parse(blocks[0][1]); } catch (e) { error(name, `JSON-LD does not parse: ${e.message}`); continue; }
  if (is404) continue;
  const graph = data['@graph'] ?? [data];
  const byId = new Map(graph.filter((n) => n['@id']).map((n) => [n['@id'], n]));
  const visible = textOf(body);

  const walk = (value, path) => {
    if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === '@id' && !byId.has(value['@id']) && !value['@id'].startsWith('https://www.dextr.ai/#'))
        error(name, `JSON-LD reference ${value['@id']} at ${path} points to no node`);
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    }
  };
  walk(graph, '@graph');

  const types = graph.map((n) => n['@type']);
  notes.push(`${name}: ${types.join(', ')}`);

  for (const node of graph) {
    const type = node['@type'];
    if (type === 'Article') {
      for (const key of ['headline', 'image', 'datePublished', 'dateModified', 'author']) if (!node[key]) error(name, `Article missing ${key}`);
      if (node.headline?.length > 110) error(name, `Article headline is ${node.headline.length} characters (max 110)`);
      for (const img of [].concat(node.image ?? [])) if (localFileFor(img) && !existsSync(localFileFor(img))) error(name, `Article image missing: ${img}`);
      const shown = body.match(/<time datetime="([^"]+)"/)?.[1];
      if (shown && shown !== node.dateModified) error(name, `visible date ${shown} differs from dateModified ${node.dateModified}`);
      if (!/^\d{4}-\d{2}-\d{2}/.test(node.datePublished ?? '')) error(name, 'datePublished is not ISO 8601');
    }
    if (type === 'BreadcrumbList') {
      node.itemListElement.forEach((item, i) => {
        if (item.position !== i + 1) error(name, 'breadcrumb positions are not 1, 2, 3...');
        const local = localFileFor(item.item);
        if (local && !existsSync(local)) error(name, `breadcrumb item ${item.item} has no built page`);
        if (!visible.includes(item.name)) error(name, `breadcrumb "${item.name}" is not visible on the page`);
      });
    }
    if (type === 'FAQPage') {
      for (const q of node.mainEntity) {
        if (!visible.includes(q.name)) error(name, `FAQ question not visible on page: ${q.name}`);
        if (!q.acceptedAnswer?.text) error(name, `FAQ answer empty: ${q.name}`);
        else if (!visible.includes(q.acceptedAnswer.text.slice(0, 60))) error(name, `FAQ answer not visible on page: ${q.name}`);
      }
    }
    if (type === 'ItemList' && node.itemListElement) {
      for (const item of node.itemListElement) if (item.name && !visible.includes(item.name)) error(name, `ItemList entry not visible: ${item.name}`);
    }
    if (type === 'DefinedTermSet') {
      for (const term of node.hasDefinedTerm) if (!visible.toLowerCase().includes(term.name.toLowerCase())) error(name, `defined term not on page: ${term.name}`);
    }
    if (type === 'WebPage' && node.speakable) {
      for (const sel of node.speakable.cssSelector) if (!body.includes(`class="${sel.slice(1)}"`)) error(name, `speakable selector ${sel} matches nothing`);
    }
    if (['AggregateRating', 'Review'].includes(type) || node.aggregateRating || node.review) error(name, 'self-serving ratings or reviews are not allowed');
  }

  if (!is404) {
    const words = visible.split(' ').filter(Boolean).length;
    notes.push(`${name}: ${words} words, ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB HTML`);
  }
}

// robots.txt and sitemap
if (env.home) {
  const robotsTxt = join(outDir, 'robots.txt');
  if (!existsSync(robotsTxt)) error('robots.txt', 'missing');
  else if (/Disallow:\s*\/\s*$/m.test(readFileSync(robotsTxt, 'utf8'))) error('robots.txt', 'blocks the whole site, so crawlers cannot read the pages');
}
if (env.indexable && !existsSync(join(outDir, 'sitemap.xml'))) error('sitemap.xml', 'missing in an indexable build');

if (checkLinks) {
  for (const [url, page] of externalLinks) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link check)' } });
      if (res.status >= 400) (res.status === 403 || res.status === 429 ? warn : error)(page, `${res.status} ${url}`);
    } catch (e) {
      warn(page, `could not reach ${url} (${e.cause?.code ?? e.message})`);
    }
  }
  notes.push(`checked ${externalLinks.size} external links`);
}

console.log(`SEO check: ${envName} build in ${env.outDir}/`);
for (const n of notes) console.log(`  ${n}`);
for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  ERROR ${e}`);
console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
