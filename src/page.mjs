// Turns a content file into a page model and renders the article body.
// Conventions in the Markdown (see README):
//   **Quick verdict:** ...       first paragraph, the answer AI engines and readers see first
//   > **Key takeaways** + bullets the summary box under the intro
//   > **Key takeaway:** ...       the one-line takeaway closing a section
//   ## Frequently asked questions  ### question + answer paragraph(s)
//   ## Questions to ask ...        an ordered list (also emitted as an ItemList)
//   ## Sources                     "- Label https://url" bullets

import { escapeHtml, externalLink, parseFrontMatter, renderInline, slugify, toPlainText, tokenize } from './markdown.mjs';

const isSection = (title, pattern) => pattern.test(title);
const FAQ = /^frequently asked questions$/i;
const SOURCES = /^sources$/i;
const DEMO_QUESTIONS = /^questions to ask/i;

export function loadPage(source) {
  const { meta, body } = parseFrontMatter(source);
  const tokens = tokenize(body);
  const h1Index = tokens.findIndex((t) => t.type === 'heading' && t.depth === 1);
  if (h1Index < 0) throw new Error(`No H1 in ${meta.slug}`);

  const usedIds = new Set();
  const uniqueId = (text) => {
    let id = slugify(text) || 'section';
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(text)}-${n}`;
    usedIds.add(id);
    return id;
  };

  const intro = [];
  const sections = [];
  for (const token of tokens.slice(h1Index + 1)) {
    if (token.type === 'heading' && token.depth === 2) {
      sections.push({ title: token.text, id: uniqueId(token.text), blocks: [] });
    } else {
      (sections.at(-1)?.blocks ?? intro).push(token);
    }
  }

  return {
    meta,
    h1: tokens[h1Index].text,
    intro,
    sections,
    faqs: extractFaqs(sections.find((s) => isSection(s.title, FAQ))),
    demoQuestions: sections.find((s) => isSection(s.title, DEMO_QUESTIONS))?.blocks.find((b) => b.type === 'list')?.items ?? [],
    sources: extractSources(sections.find((s) => isSection(s.title, SOURCES))),
    uniqueId,
  };
}

function extractFaqs(section) {
  if (!section) return [];
  const faqs = [];
  for (const block of section.blocks) {
    if (block.type === 'heading' && block.depth === 3) faqs.push({ question: block.text, answer: [] });
    else if (block.type === 'paragraph' && faqs.length) faqs.at(-1).answer.push(block.text);
  }
  return faqs.map((f) => ({ question: toPlainText(f.question), answer: toPlainText(f.answer.join(' ')) }));
}

function extractSources(section) {
  const list = section?.blocks.find((b) => b.type === 'list');
  if (!list) return [];
  return list.items.map((item) => {
    const match = item.match(/^(.*?)\s+(https?:\/\/\S+)$/);
    if (!match) throw new Error(`Source needs "Label https://url": ${item}`);
    return { label: match[1].trim(), url: match[2] };
  });
}

// ---------- rendering ----------

function renderTable(token, caption) {
  const head = token.head.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join('');
  const rows = token.rows
    .map((row) => `<tr>${row.map((cell, j) => (j === 0 ? `<th scope="row">${renderInline(cell)}</th>` : `<td>${renderInline(cell)}</td>`)).join('')}</tr>`)
    .join('\n');
  return [
    `<div class="table-wrap" role="region" aria-label="${escapeHtml(toPlainText(caption))}" tabindex="0">`,
    `<table>`,
    `<caption class="visually-hidden">${renderInline(caption)}</caption>`,
    `<thead><tr>${head}</tr></thead>`,
    `<tbody>\n${rows}\n</tbody>`,
    `</table>`,
    `</div>`,
  ].join('\n');
}

function renderQuote(token) {
  if (/^\*\*Key takeaways\*\*/.test(token.text)) {
    const items = token.items.map((item) => `<li>${renderInline(item)}</li>`).join('\n');
    return `<aside class="key-takeaways" aria-labelledby="key-takeaways-title">\n<p class="box-title" id="key-takeaways-title">Key takeaways</p>\n<ul>\n${items}\n</ul>\n</aside>`;
  }
  if (/^\*\*Key takeaway:\*\*/.test(token.text)) {
    return `<aside class="takeaway" aria-label="Key takeaway">\n<p>${renderInline(token.text)}</p>\n</aside>`;
  }
  return `<blockquote>\n<p>${renderInline(token.text)}</p>\n</blockquote>`;
}

function renderBlock(token, context) {
  switch (token.type) {
    case 'paragraph':
      return /^\*\*Quick verdict:\*\*/.test(token.text)
        ? `<p class="quick-verdict">${renderInline(token.text)}</p>`
        : `<p>${renderInline(token.text)}</p>`;
    case 'quote':
      return renderQuote(token);
    case 'list': {
      const tag = token.ordered ? 'ol' : 'ul';
      return `<${tag}>\n${token.items.map((item) => `<li>${renderInline(item)}</li>`).join('\n')}\n</${tag}>`;
    }
    case 'table':
      return renderTable(token, context.title);
    case 'heading':
      return `<h${token.depth} id="${context.uniqueId(token.text)}">${renderInline(token.text)}</h${token.depth}>`;
    default:
      throw new Error(`Unknown block type ${token.type}`);
  }
}

function renderFaqSection(section, page) {
  const items = [];
  for (const block of section.blocks) {
    if (block.type === 'heading' && block.depth === 3) items.push({ heading: block, answer: [] });
    else if (items.length) items.at(-1).answer.push(block);
  }
  return items
    .map(({ heading, answer }) => `<div class="faq-item">\n<h3 id="${page.uniqueId(heading.text)}">${renderInline(heading.text)}</h3>\n${answer.map((b) => renderBlock(b, { ...page, title: section.title })).join('\n')}\n</div>`)
    .join('\n');
}

function renderSourcesSection(page) {
  const items = page.sources.map((s) => `<li>${externalLink(s.url, escapeHtml(s.label))}</li>`).join('\n');
  return `<ol class="sources">\n${items}\n</ol>`;
}

function renderSection(section, page) {
  let body;
  if (isSection(section.title, FAQ)) body = renderFaqSection(section, page);
  else if (isSection(section.title, SOURCES)) body = renderSourcesSection(page);
  else body = section.blocks.map((b) => renderBlock(b, { ...page, title: section.title })).join('\n');

  const cta = page.meta.cta;
  const isCta = cta && section.title === cta.section;
  if (isCta) body += `\n<p class="cta-actions"><a class="button" href="${escapeHtml(cta.url)}">${escapeHtml(cta.label)}</a></p>`;

  const classes = ['section', isCta && 'section--cta', isSection(section.title, SOURCES) && 'section--sources'].filter(Boolean).join(' ');
  return `<section class="${classes}" aria-labelledby="${section.id}">\n<h2 id="${section.id}">${renderInline(section.title)}</h2>\n${body}\n</section>`;
}

export function renderArticleBody(page) {
  const intro = page.intro.map((b) => renderBlock(b, { ...page, title: page.h1 })).join('\n');
  return { intro, sections: page.sections.map((s) => renderSection(s, page)).join('\n\n') };
}

export function wordCount(page) {
  const text = [page.h1, ...page.intro.map(tokenText), ...page.sections.flatMap((s) => [s.title, ...s.blocks.map(tokenText)])].join(' ');
  return toPlainText(text).split(/\s+/).filter(Boolean).length;
}

function tokenText(token) {
  if (token.type === 'table') return [...token.head, ...token.rows.flat()].join(' ');
  if (token.type === 'list') return token.items.join(' ');
  if (token.type === 'quote') return [token.text, ...token.items].join(' ');
  return token.text;
}
