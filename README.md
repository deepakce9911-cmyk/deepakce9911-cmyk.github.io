# deepakce9911-cmyk.github.io

Deepak's blog, published with GitHub Pages at **https://deepakce9911-cmyk.github.io/**.

The first post is a comparison page: [Dextr vs Canary AI Voice (2026)](https://deepakce9911-cmyk.github.io/blog/dextr-vs-canary-ai-voice/).

Posts are written in Markdown and built into static HTML with full JSON-LD structured data. There are no runtime dependencies, so you only need Node 20 or newer.

## Structure

```
content/posts/          one Markdown file per post, with JSON front matter
src/
  build.mjs             builds the site for one environment
  page.mjs              turns a post into a page model and renders the article
  markdown.mjs          the small Markdown renderer
  schema.mjs            JSON-LD @graph for posts, the blog index and the home page
  template.mjs          HTML documents: head, header, breadcrumbs, article, footer
  styles/main.css       the stylesheet, inlined into every page
  scripts/listen.js     the listen player and the Gemini copy button, inlined into posts
  seo-check.mjs         on-page SEO and structured-data checks
  og-image.mjs          renders social images from src/og/card.html
  serve.mjs             local server that behaves like GitHub Pages
static/                 copied as-is: images and favicon
site.config.json        site settings per environment
docs/                   the built site that GitHub Pages serves (do not edit by hand)
```

## Commands

```bash
npm run build              # build the blog into docs/
npm run check              # SEO and schema checks on docs/
npm run check:links        # the same, plus every external link
npm run serve              # preview docs/ at http://localhost:4173
npm run build:production   # build the post for dextr.ai into dist/
npm run check:production
npm run og                 # re-render social images (needs: npm install)
```

Publish a change: edit `content/posts/*.md`, run `npm run build && npm run check`, then commit and push. GitHub Pages serves `docs/` from the `main` branch.

## Writing a post

Front matter (JSON between `---` lines) holds the title tag, meta description, dates, keywords, image, the author and reviewer (name, job title, short bio), and the products the post is about. The Markdown body uses a few conventions:

- `**Quick verdict:** ...` as the first paragraph: the answer readers and AI engines see first
- `> **Key takeaways**` followed by bullets: the summary box under the intro
- `> **Key takeaway:** ...` at the end of a section: the one-line takeaway
- `## Frequently asked questions` with `###` questions: also emitted as FAQPage
- `## Questions to ask ...` with a numbered list: also emitted as an ItemList
- `## Sources` with `- Label https://url` bullets: rendered as links and listed as Article citations

## Reader features

- **Listen to this article.** The browser's built-in speech engine reads the post aloud. It highlights the paragraph being read and offers 0.75x to 1.5x speed. The player stays hidden in browsers that cannot speak.
- **Summarize with AI.** Buttons open ChatGPT, Perplexity, Claude, Grok and Google AI Mode with a summary prompt for the post. Gemini cannot take a prompt in its link, so its button copies the prompt first.

## Structured data

Every page carries one JSON-LD `@graph`. Nodes point at each other by `@id`, and each one mirrors text that is visible on the page.

| Page | Types |
|---|---|
| Post | WebSite, Person (site owner, author and reviewer), Organization (Dextr), WebPage with speakable, reviewedBy and lastReviewed, ImageObject, Article with citations, BreadcrumbList, SoftwareApplication (Daisy and Canary AI Voice), FAQPage, ItemList, DefinedTermSet |
| Blog index | WebSite, Person, Organization, CollectionPage, ItemList, BreadcrumbList |
| Home | WebSite, Person, Organization, ProfilePage |

Left out on purpose:

- **AggregateRating and Review.** Google does not allow a site to rate its own product.
- **Product or Offer with a price.** Neither company publishes a price.
- **HowTo.** It no longer shows as a rich result, and the post has no step-by-step instructions.

## Search indexing

`site.config.json` sets `"indexable": false` for this blog, so pages carry `noindex`. This keeps the post from competing in search with the copy Dextr publishes on its own site. To let search engines index the blog, set it to `true` and rebuild. That adds `index, follow`, a `sitemap.xml` and a sitemap line in `robots.txt`.

## The dextr.ai version

`npm run build:production` writes the same post to `dist/compare/dextr-vs-canary-ai-voice/` with dextr.ai URLs, Dextr as author and publisher, and `index, follow`. It also writes a `/compare/` hub page and a `sitemap.xml` to merge into Dextr's own sitemap.
