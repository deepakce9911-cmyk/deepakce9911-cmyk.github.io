// Builds the site for one environment.
//   node src/build.mjs                  personal site (GitHub Pages, writes docs/)
//   node src/build.mjs --env production  dextr.ai version (writes dist/)

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPage, renderArticleBody, wordCount } from './page.mjs';
import { articleGraph, homeGraph, hubGraph } from './schema.mjs';
import { articleDocument, homeDocument, hubDocument, notFoundDocument } from './template.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_PATH = '/'; // every page links to assets and pages from the site root

export function loadSite(envName) {
  const site = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
  const env = site.environments[envName];
  if (!env) throw new Error(`Unknown environment "${envName}". Use: ${Object.keys(site.environments).join(', ')}`);
  return { site, env: { ...env, name: envName } };
}

export function loadPages(env) {
  const dir = join(ROOT, 'content', 'posts');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const page = loadPage(readFileSync(join(dir, f), 'utf8'));
      page.meta.slug = `${env.hub.slug}${page.meta.name}/`;
      return page;
    })
    .sort((a, b) => b.meta.datePublished.localeCompare(a.meta.datePublished));
}

function write(outDir, path, content) {
  const file = join(outDir, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function sitemap(env, urls) {
  const entries = urls.map((u) => `  <url>\n    <loc>${env.siteUrl}${u.path}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function robotsTxt(env) {
  // Crawlers must be allowed in to see each page's robots meta tag, so robots.txt never blocks pages.
  const lines = ['User-agent: *', 'Allow: /'];
  if (env.indexable) lines.push('', `Sitemap: ${env.siteUrl}/sitemap.xml`);
  return `${lines.join('\n')}\n`;
}

export function build(envName) {
  const { site, env } = loadSite(envName);
  const outDir = join(ROOT, env.outDir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  cpSync(join(ROOT, 'static'), outDir, { recursive: true });
  const pages = loadPages(env);

  for (const page of pages) {
    const schema = articleGraph({ page, site, env, wordCount: wordCount(page) });
    const html = articleDocument({ page, site, env, root: ROOT_PATH, body: renderArticleBody(page), schema });
    write(outDir, `${page.meta.slug.replace(/^\//, '')}index.html`, html);
  }

  write(outDir, `${env.hub.slug.replace(/^\//, '')}index.html`, hubDocument({ site, env, root: ROOT_PATH, pages, schema: hubGraph({ site, env, pages }) }));

  const latest = pages.map((p) => p.meta.dateModified).sort().at(-1);
  const urls = [{ path: env.hub.slug, lastmod: latest }, ...pages.map((p) => ({ path: p.meta.slug, lastmod: p.meta.dateModified }))];

  if (env.home) {
    write(outDir, 'index.html', homeDocument({ site, env, root: ROOT_PATH, pages, schema: homeGraph({ site, env }) }));
    write(outDir, '404.html', notFoundDocument({ site, env, root: ROOT_PATH }));
    write(outDir, 'robots.txt', robotsTxt(env));
    write(outDir, '.nojekyll', '');
    urls.unshift({ path: '/', lastmod: latest });
  }
  if (env.indexable) write(outDir, 'sitemap.xml', sitemap(env, urls));

  // Social images are rendered once by `npm run og` into static/; warn if any are missing.
  for (const page of pages) {
    const img = join(ROOT, 'static', `${page.meta.image.base.replace(/^\//, '')}-1200x630.png`);
    if (!existsSync(img)) console.warn(`Missing social image: ${img} (run npm run og)`);
  }

  console.log(`Built ${pages.length} post(s) for "${envName}" into ${env.outDir}/ (${env.indexable ? 'indexable' : 'noindex'})`);
  return { site, env, pages, outDir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const envFlag = process.argv.indexOf('--env');
  build(envFlag > -1 ? process.argv[envFlag + 1] : 'personal');
}
