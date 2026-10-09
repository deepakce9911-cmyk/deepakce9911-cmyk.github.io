// HTML document shells. Head order: charset, viewport, title, description, robots, canonical,
// social tags, icons, fonts, stylesheet, structured data.

import { readFileSync } from 'node:fs';
import { escapeHtml } from './markdown.mjs';
import { IMAGE_SIZES, imageUrl } from './schema.mjs';

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;600&family=Sora:wght@700;800&display=swap';

// The stylesheet is small, so it is inlined: no extra request blocks the first paint.
const CSS = readFileSync(new URL('./styles/main.css', import.meta.url), 'utf8').trim();

const robots = (env) =>
  env.indexable ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1' : 'noindex, nofollow';

export function formatDate(iso) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function head({ env, root, title, description, url, ogType = 'website', image, extraMeta = [], schema }) {
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
    '<meta name="theme-color" content="#141B34">',
    `<link rel="icon" href="${env.icon}"${env.icon.endsWith(".svg") ? " type=\"image/svg+xml\"" : ""}>`,
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="preload" as="style" href="${FONTS}">`,
    `<link rel="stylesheet" href="${FONTS}" media="print" onload="this.media='all'">`,
    `<noscript><link rel="stylesheet" href="${FONTS}"></noscript>`,
    `<style>
${CSS}
</style>`,
    '<script type="application/ld+json">',
    JSON.stringify(schema, null, 2),
    '</script>',
    '</head>',
  ].join('\n');
}

function siteHeader({ env, root, crumbs }) {
  const banner = env.banner ? `<div class="banner" role="note">${escapeHtml(env.banner)}</div>\n` : '';
  const brandHref = env.brand.href === '/' ? root : env.brand.href;
  const trail = crumbs.length
    ? `<nav class="container breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs
        .map((c, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${escapeHtml(c.name)}</li>` : `<li><a href="${c.href}">${escapeHtml(c.name)}</a></li>`))
        .join('')}</ol></nav>`
    : '';
  return `<a class="skip-link" href="#main">Skip to content</a>
${banner}<header class="site-header">
<div class="container site-header__inner">
<a class="brand" href="${brandHref}">${escapeHtml(env.brand.label)}</a>
<a class="header-link" href="${env.headerLink.href}">${escapeHtml(env.headerLink.label)}</a>
</div>
</header>
${trail}`;
}

const siteFooter = (env) => `<footer class="site-footer">
<div class="container">
<p>${escapeHtml(env.footer)}</p>
</div>
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

export function articleDocument({ page, site, env, root, body, schema }) {
  const { meta } = page;
  const url = `${env.siteUrl}${meta.slug}`;
  const og = IMAGE_SIZES[0];
  const headHtml = head({
    env,
    root,
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
  const crumbs = [
    { name: 'Home', href: root },
    { name: env.hub.name, href: `${root}${env.hub.slug.replace(/^\//, '')}` },
    { name: meta.breadcrumb },
  ];
  const toc = page.sections.map((s) => `<li><a href="#${s.id}">${escapeHtml(s.title)}</a></li>`).join('\n');

  const bodyHtml = `${siteHeader({ env, root, crumbs })}
<div class="container layout">
<main id="main" class="content">
<article>
<header class="article-header">
<h1>${escapeHtml(page.h1)}</h1>
<p class="byline">${escapeHtml(env.byline)} <span aria-hidden="true">&middot;</span> Updated <time datetime="${meta.dateModified}">${formatDate(meta.dateModified)}</time></p>
</header>
${body.intro}

${body.sections}
</article>
</main>
<nav class="toc" aria-label="On this page">
<p class="toc__title">On this page</p>
<ol>
${toc}
</ol>
</nav>
</div>
${siteFooter(env)}`;
  return document({ site, headHtml, bodyHtml });
}

function listingImage(env, pages) {
  const og = IMAGE_SIZES[0];
  const latest = pages[0];
  return latest ? { url: imageUrl(env.siteUrl, latest.meta.image.base, og.suffix), width: og.width, height: og.height, alt: latest.meta.image.alt } : undefined;
}

function cardList(pages, root) {
  return pages
    .map(
      (p) => `<li class="card">
<h2><a href="${root}${p.meta.slug.replace(/^\//, '')}">${escapeHtml(p.meta.breadcrumb)}</a></h2>
<p>${escapeHtml(p.meta.description)}</p>
<p class="byline">Updated <time datetime="${p.meta.dateModified}">${formatDate(p.meta.dateModified)}</time></p>
</li>`,
    )
    .join('\n');
}

export function hubDocument({ site, env, root, pages, schema }) {
  const url = `${env.siteUrl}${env.hub.slug}`;
  const headHtml = head({ env, root, title: env.hub.title, description: env.hub.description, url, image: listingImage(env, pages), schema });
  const bodyHtml = `${siteHeader({ env, root, crumbs: [{ name: 'Home', href: root }, { name: env.hub.name }] })}
<main id="main" class="container content content--wide">
<h1>${escapeHtml(env.hub.heading)}</h1>
<p class="lede">${escapeHtml(env.hub.description)}</p>
<ul class="cards">
${cardList(pages, root)}
</ul>
</main>
${siteFooter(env)}`;
  return document({ site, headHtml, bodyHtml });
}

export function homeDocument({ site, env, root, pages, schema }) {
  const url = `${env.siteUrl}/`;
  const headHtml = head({ env, root, title: env.home.title, description: env.home.description, url, image: listingImage(env, pages), schema });
  const bodyHtml = `${siteHeader({ env, root, crumbs: [] })}
<main id="main" class="container content content--wide">
<h1>${escapeHtml(env.home.heading)}</h1>
<p class="lede">${escapeHtml(env.home.description)}</p>
<h2 class="section-label"><a href="${root}${env.hub.slug.replace(/^\//, '')}">${escapeHtml(env.hub.name)}</a></h2>
<ul class="cards">
${cardList(pages, root)}
</ul>
</main>
${siteFooter(env)}`;
  return document({ site, headHtml, bodyHtml });
}

export function notFoundDocument({ site, env, root }) {
  const headHtml = head({
    env: { ...env, indexable: false },
    root,
    title: `Page not found | ${env.siteName}`,
    description: 'This page does not exist.',
    url: `${env.siteUrl}/404.html`,
    schema: { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Page not found' },
  });
  const bodyHtml = `${siteHeader({ env, root, crumbs: [] })}
<main id="main" class="container content content--wide">
<h1>Page not found</h1>
<p class="lede">That page does not exist. <a href="${root}">Go to the home page</a>.</p>
</main>
${siteFooter(env)}`;
  return document({ site, headHtml, bodyHtml });
}
