// Minimal, dependency-free Markdown for the subset these pages use:
// headings, paragraphs, bold, links, tables, blockquotes, and ordered or unordered lists.

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => HTML_ESCAPES[ch]);
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Plain text for meta tags and JSON-LD: drops Markdown markers and links. */
export function toPlainText(text) {
  return String(text)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function externalLink(url, label) {
  return `<a href="${escapeHtml(url)}" rel="noopener" target="_blank">${label}</a>`;
}

export function renderInline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => externalLink(url.replace(/&amp;/g, '&'), label))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

const BLOCK_START = /^(#{1,6}\s|\||>|[-*]\s|\d+\.\s)/;

function splitRow(row) {
  return row.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

/** Turns Markdown into a flat list of block tokens. */
export function tokenize(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const tokens = [];
  let i = 0;
  const takeWhile = (test) => {
    const taken = [];
    while (i < lines.length && test(lines[i])) taken.push(lines[i++]);
    return taken;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      tokens.push({ type: 'heading', depth: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const [head, , ...rows] = takeWhile((l) => l.startsWith('|'));
      tokens.push({ type: 'table', head: splitRow(head), rows: rows.map(splitRow) });
      continue;
    }
    if (line.startsWith('>')) {
      const body = takeWhile((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, ''));
      tokens.push({
        type: 'quote',
        text: body.filter((l) => l.trim() && !/^[-*]\s+/.test(l)).join(' '),
        items: body.filter((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '')),
      });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      tokens.push({ type: 'list', ordered: false, items: takeWhile((l) => /^[-*]\s+/.test(l)).map((l) => l.replace(/^[-*]\s+/, '')) });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      tokens.push({ type: 'list', ordered: true, items: takeWhile((l) => /^\d+\.\s+/.test(l)).map((l) => l.replace(/^\d+\.\s+/, '')) });
      continue;
    }
    tokens.push({ type: 'paragraph', text: takeWhile((l) => l.trim() && !BLOCK_START.test(l)).join(' ') });
  }
  return tokens;
}

/** Splits a file into its JSON front matter (between --- lines) and the Markdown body. */
export function parseFrontMatter(source) {
  const match = source.replace(/\r\n?/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('Missing JSON front matter between --- lines');
  return { meta: JSON.parse(match[1]), body: match[2] };
}
