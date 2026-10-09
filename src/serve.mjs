// Serves a built folder locally so pages behave exactly as on GitHub Pages (root-relative links).
//   node src/serve.mjs            serves docs/ on http://localhost:4173
//   node src/serve.mjs dist 4174  serves dist/ on port 4174

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const dir = join(process.cwd(), process.argv[2] ?? 'docs');
const port = Number(process.argv[3] ?? 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' };

createServer((req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let file = join(dir, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  const found = existsSync(file);
  if (!found) file = join(dir, '404.html');
  res.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(existsSync(file) ? readFileSync(file) : 'Not found');
}).listen(port, () => console.log(`Serving ${dir} on http://localhost:${port}`));
