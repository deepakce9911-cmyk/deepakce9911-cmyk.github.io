// HTML document shells. Head order: charset, viewport, title, description, robots, canonical,
// social tags, icons, fonts, inline styles, structured data.

import { readFileSync } from 'node:fs';
import { escapeHtml } from './markdown.mjs';
import { IMAGE_SIZES, imageUrl } from './schema.mjs';

const FONTS = 'https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700;800&display=swap';

// Small enough to inline, so no extra request blocks the first paint.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').trim();
const CSS = read('./styles/main.css');
const SCRIPT = read('./scripts/listen.js');
const ICONS = Object.fromEntries(['openai', 'perplexity', 'gemini', 'claude', 'grok', 'google'].map((n) => [n, read(`./icons/${n}.svg`)]));

const robots = (env) =>
  env.indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow';

export function formatDate(iso, month = 'long') {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' });
}

const path = (root, slug) => `${root}${slug.replace(/^\//, '')}`;

function head({ env, title, description, url, ogType = 'website', image, extraMeta = [], schema }) {
  const imageMeta = image
    ? [
        `<meta property="og:image" content="${image.url}">`,
        `<meta property="og:image:width" content="${image.width}">`,
        `<meta property="og:image:height" content="${image.height}">`,
        `<meta property="og:image:alt" content="${escapeHtml(image.alt)}">`,
        `<meta name="twitter:image" content="${image.url}">`,
        `<meta name="twitter:image:alt" content="${escapeHtml(image.alt)}">`,
      ]
    : [];
  return [
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<meta name="robots" content="${robots(env)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:site_name" content="${escapeHtml(env.siteName)}">`,
    '<meta property="og:locale" content="en_US">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${url}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    ...imageMeta,
    ...extraMeta,
    '<meta name="theme-color" content="#f7f7f7">',
    `<link rel="icon" href="${env.icon}"${env.icon.endsWith('.svg') ? ' type="image/svg+xml"' : ''}>`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="preload" as="style" href="${FONTS}">`,
    `<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">`,
    `<noscript><link rel="stylesheet" href="${FONTS}"></noscript>`,
    `<style>\n${CSS}\n</style>`,
    '<script type="application/ld+json">',
    JSON.stringify(schema, null, 2),
    '</script>',
    '</head>',
  ].join('\n');
}

function siteHeader({ env, root }) {
  const brandHref = env.brand.href === '/' ? root : env.brand.href;
  const linkHref = env.headerLink.href.startsWith('/') ? path(root, env.headerLink.href) : env.headerLink.href;
  const banner = env.banner ? `<div class="banner" role="note">${escapeHtml(env.banner)}</div>\n` : '';
  return `<a class="skip-link" href="#main">Skip to content</a>
${banner}<header class="site-header">
<div class="container site-header__inner">
<a class="brand" href="${brandHref}">${escapeHtml(env.brand.label)}</a>
<a class="pill pill--dark" href="${linkHref}">${escapeHtml(env.headerLink.label)}</a>
</div>
</header>`;
}

function breadcrumbs(crumbs) {
  const items = crumbs
    .map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${escapeHtml(c.name)}</li>` : `<li><a href="${c.href}">${escapeHtml(c.name)}</a></li>`))
    .join('');
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items}</ol></nav>`;
}

const siteFooter = (env) => `<footer class="site-footer">
<div class="container"><p>${escapeHtml(env.footer)}</p></div>
</footer>`;

function document({ site, headHtml, bodyHtml }) {
  return `<!doctype html>
<html lang="${site.language}">
${headHtml}
<body>
${bodyHtml}
</body>
</html>
`;
}

// ---------- article ----------

export function articleDocument({ page, site, env, root, body, schema, readMinutes }) {
  const { meta } = page;
  const url = `${env.siteUrl}${meta.slug}`;
  const og = IMAGE_SIZES[0];
  const hero = IMAGE_SIZES[1];
  const headHtml = head({
    env,
    title: meta.title,
    description: meta.description,
    url,
    ogType: 'article',
    image: { url: imageUrl(env.siteUrl, meta.image.base, og.suffix), width: og.width, height: og.height, alt: meta.image.alt },
    extraMeta: [
      `<meta property="article:published_time" content="${meta.datePublished}">`,
      `<meta property="article:modified_time" content="${meta.dateModified}">`,
      `<meta property="article:section" content="${escapeHtml(meta.section)}">`,
      ...meta.keywords.map((k) => `<meta property="article:tag" content="${escapeHtml(k)}">`),
    ],
    schema,
  });
  const hubHref = path(root, env.hub.slug);
  const crumbs = [{ name: 'Home', href: root }, { name: env.hub.name, href: hubHref }, { name: meta.breadcrumb }];
  const toc = page.sections.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join('\n');
  const updated = `<time datetime="${meta.dateModified}">${formatDate(meta.dateModified, 'short')}</time>`;

  const bodyHtml = `${siteHeader({ env, root })}
<div class="container layout">
<aside class="sidebar" aria-label="About this post">
<p class="eyebrow">${escapeHtml(env.hub.name)}</p>
<dl class="facts">
<div><dt>Category</dt><dd>${escapeHtml(meta.category ?? meta.section)}</dd></div>
<div><dt>Read</dt><dd>${readMinutes} min read</dd></div>
${meta.writtenFor ? `<div><dt>Written for</dt><dd>${escapeHtml(meta.writtenFor)}</dd></div>` : ''}
<div><dt>Updated</dt><dd>${updated}</dd></div>
</dl>
<nav class="toc" aria-label="On this page">
<p class="toc__title">On this page</p>
<ol>
${toc}
</ol>
</nav>
</aside>
<main id="main" class="content">
<article>
<header class="article-header">
${breadcrumbs(crumbs)}
<p class="tags"><a class="tag" href="${hubHref}">${escapeHtml(meta.section)}</a>${meta.category ? `<span>${escapeHtml(meta.category)}</span>` : ''}</p>
<h1>${escapeHtml(page.h1)}</h1>
${meta.dek ? `<p class="dek">${escapeHtml(meta.dek)}</p>` : ''}
${byline(meta, updated, readMinutes)}
<img class="hero" src="${imageUrl('', meta.image.base, hero.suffix)}" width="${hero.width}" height="${hero.height}" alt="${escapeHtml(meta.image.alt)}" fetchpriority="high">
<div class="toolbar">
${listenPlayer()}
${summarizeBar(url)}
</div>
</header>
${body.intro}

${body.sections}
${authorCards(meta)}
</article>
</main>
</div>
${siteFooter(env)}
<script>
${SCRIPT}
</script>`;
  return document({ site, headHtml, bodyHtml });
}

const initials = (name) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

function byline(meta, updated, readMinutes) {
  if (!meta.author) return '';
  const reviewer = meta.reviewer ? ` <span class="dot" aria-hidden="true"></span> Reviewed by <a href="#reviewer">${escapeHtml(meta.reviewer.name)}</a>` : '';
  return `<div class="byline">
<span class="avatar avatar--sm" aria-hidden="true">${escapeHtml(initials(meta.author.name))}</span>
<p>By <a href="#author">${escapeHtml(meta.author.name)}</a>${reviewer} <span class="dot" aria-hidden="true"></span> ${updated} <span class="dot" aria-hidden="true"></span> ${readMinutes} min read</p>
</div>`;
}

const PLAY = '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
const PAUSE = '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z"/></svg>';

/** Hidden until the script confirms the browser can speak (see src/scripts/listen.js). */
function listenPlayer() {
  return `<div class="listen" data-listen hidden>
<button type="button" class="listen__play" data-action="toggle" data-state="paused" aria-label="Listen to this article">${PLAY}${PAUSE}</button>
<div class="listen__body">
<span class="listen__title">Listen</span>
<span class="listen__status" data-status aria-live="polite"></span>
<span class="listen__bar" data-progress role="progressbar" aria-label="Listening progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></span>
</div>
<button type="button" class="listen__speed" data-action="speed" aria-label="Change playback speed">1x</button>
</div>`;
}

function summarizeBar(url) {
  const prompt = `Summarize the key takeaways of this article in 5 bullet points: ${url}`;
  const q = encodeURIComponent(prompt);
  const tools = [
    { name: 'ChatGPT', icon: 'openai', href: `https://chatgpt.com/?hints=search&q=${q}` },
    { name: 'Perplexity', icon: 'perplexity', href: `https://www.perplexity.ai/search/new?q=${q}` },
    { name: 'Gemini', icon: 'gemini', href: 'https://gemini.google.com/app', copy: prompt },
    { name: 'Claude', icon: 'claude', href: `https://claude.ai/new?q=${q}` },
    { name: 'Grok', icon: 'grok', href: `https://grok.com/?q=${q}` },
    { name: 'Google AI Mode', icon: 'google', href: `https://www.google.com/search?udm=50&q=${q}` },
  ];
  const links = tools
    .map(
      (t) =>
        `<a class="ai-link" href="${escapeHtml(t.href)}" target="_blank" rel="nofollow noopener" aria-label="Summarize with ${t.name}" data-tip="${t.name}"${t.copy ? ` data-copy-prompt="${escapeHtml(t.copy)}"` : ''}>${ICONS[t.icon]}</a>`,
    )
    .join('');
  return `<div class="summarize" role="group" aria-labelledby="summarize-label">
<span class="summarize__label" id="summarize-label">Summarize with</span>
<div class="summarize__links">${links}</div>
<span class="summarize__note" data-summarize-note aria-live="polite"></span>
</div>`;
}

function personCard(person, id, role) {
  return `<div class="person-card" id="${id}">
<span class="avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</span>
<div>
<p class="person-card__role">${role}</p>
<p class="person-card__name">${escapeHtml(person.name)}</p>
<p class="person-card__title">${escapeHtml(person.jobTitle)}</p>
<p class="person-card__bio">${escapeHtml(person.bio)}</p>
</div>
</div>`;
}

function authorCards(meta) {
  if (!meta.author) return '';
  const reviewed = meta.lastReviewed ?? meta.dateModified;
  return `<footer class="author-cards" aria-label="About the author and reviewer">
${personCard(meta.author, 'author', 'Written by')}
${meta.reviewer ? personCard(meta.reviewer, 'reviewer', `Reviewed by &middot; <time datetime="${reviewed}">${formatDate(reviewed, 'short')}</time>`) : ''}
</footer>`;
}

// ---------- listing pages ----------

function listingImage(env, pages) {
  const og = IMAGE_SIZES[0];
  const latest = pages[0];
  return latest ? { url: imageUrl(env.siteUrl, latest.meta.image.base, og.suffix), width: og.width, height: og.height, alt: latest.meta.image.alt } : undefined;
}

function cardList(pages, root) {
  return pages
    .map((p) => {
      const thumb = IMAGE_SIZES[1];
      return `<li class="card">
<a class="card__link" href="${path(root, p.meta.slug)}">
<img src="${imageUrl('', p.meta.image.base, thumb.suffix)}" width="${thumb.width}" height="${thumb.height}" alt="" loading="lazy">
<span class="card__body">
<span class="tag">${escapeHtml(p.meta.section)}</span>
<span class="card__title">${escapeHtml(p.meta.breadcrumb)}</span>
<span class="card__text">${escapeHtml(p.meta.description)}</span>
<span class="card__meta">Updated <time datetime="${p.meta.dateModified}">${formatDate(p.meta.dateModified, 'short')}</time></span>
</span>
</a>
</li>`;
    })
    .join('\n');
}

function listingDocument({ site, env, root, pages, schema, title, description, url, heading, lede, crumbs }) {
  const headHtml = head({ env, title, description, url, image: listingImage(env, pages), schema });
  const bodyHtml = `${siteHeader({ env, root })}
<main id="main" class="container listing">
${crumbs ? breadcrumbs(crumbs) : ''}
<p class="eyebrow">${escapeHtml(env.hub.name)}</p>
<h1>${escapeHtml(heading)}</h1>
<p class="dek">${escapeHtml(lede)}</p>
<ul class="cards">
${cardList(pages, root)}
</ul>
</main>
${siteFooter(env)}`;
  return document({ site, headHtml, bodyHtml });
}

export function hubDocument({ site, env, root, pages, schema }) {
  return listingDocument({
    site, env, root, pages, schema,
    title: env.hub.title,
    description: env.hub.description,
    url: `${env.siteUrl}${env.hub.slug}`,
    heading: env.hub.heading,
    lede: env.hub.description,
    crumbs: [{ name: 'Home', href: root }, { name: env.hub.name }],
  });
}

export function homeDocument({ site, env, root, pages, schema }) {
  return listingDocument({
    site, env, root, pages, schema,
    title: env.home.title,
    description: env.home.description,
    url: `${env.siteUrl}/`,
    heading: env.home.heading,
    lede: env.home.description,
  });
}

export function notFoundDocument({ site, env, root }) {
  const headHtml = head({
    env: { ...env, indexable: false },
    title: `Page not found | ${env.siteName}`,
    description: 'This page does not exist.',
    url: `${env.siteUrl}/404.html`,
    schema: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page not found' },
  });
  const bodyHtml = `${siteHeader({ env, root })}
<main id="main" class="container listing">
<h1>Page not found</h1>
<p class="dek">That page does not exist. <a href="${root}">Go to the home page</a>.</p>
</main>
${siteFooter(env)}`;
  return document({ site, headHtml, bodyHtml });
}
