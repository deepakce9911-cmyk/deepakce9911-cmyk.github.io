// Renders the social and Article images for each post from src/og/card.html.
// Needs puppeteer-core and a local Chrome:
//   npm install && npm run og
// Optional: CHROME_PATH=/path/to/chrome, PUPPETEER_CORE=/path/to/puppeteer-core (if installed elsewhere).

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IMAGE_SIZES } from './schema.mjs';
import { loadPages, loadSite } from './build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function loadPuppeteer() {
  const dir = process.env.PUPPETEER_CORE;
  if (!dir) return (await import('puppeteer-core')).default;
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const entry = pkg.exports?.['.']?.import ?? pkg.main;
  return (await import(pathToFileURL(join(dir, entry)).href)).default;
}

const puppeteer = await loadPuppeteer();

const { env } = loadSite('personal');
const pages = loadPages(env);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
try {
  const tab = await browser.newPage();
  const card = pathToFileURL(join(ROOT, 'src', 'og', 'card.html')).href;
  for (const page of pages) {
    for (const size of IMAGE_SIZES) {
      await tab.setViewport({ width: size.width, height: size.height });
      await tab.goto(card, { waitUntil: 'networkidle0' });
      await tab.evaluate(() => document.fonts.ready);
      const out = join(ROOT, 'static', `${page.meta.image.base.replace(/^\//, '')}-${size.suffix}.png`);
      mkdirSync(dirname(out), { recursive: true });
      await tab.screenshot({ path: out, type: 'png' });
      console.log(`Rendered ${out}`);
    }
  }
} finally {
  await browser.close();
}
