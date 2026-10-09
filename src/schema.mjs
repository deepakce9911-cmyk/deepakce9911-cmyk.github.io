// JSON-LD for each page, emitted as one @graph so every node can point at the others by @id.
//
// Included: WebSite, WebPage (with speakable, reviewedBy and lastReviewed), ImageObject, Article (with citations),
// BreadcrumbList, the post's author and reviewer (Person), the site owner (Person or Organization), Dextr's Organization, SoftwareApplication for Dextr's
// voice agent and for the competitor, FAQPage, ItemList and DefinedTermSet. Hub pages add
// CollectionPage and ItemList. Every node mirrors text that is visible on the page.
//
// Left out on purpose (see README): AggregateRating and Review (Google does not allow rating your own
// product on your own site), Product or Offer with a price (neither vendor publishes one), and HowTo
// (retired as a rich result, and the page has no step-by-step instructions).

const CONTEXT = 'https://schema.org';

export const IMAGE_SIZES = [
  { suffix: '1200x630', width: 1200, height: 630 }, // Open Graph and social cards
  { suffix: '16x9', width: 1200, height: 675 },
  { suffix: '4x3', width: 1200, height: 900 },
  { suffix: '1x1', width: 1200, height: 1200 },
];

export const imageUrl = (siteUrl, base, suffix) => `${siteUrl}${base}-${suffix}.png`;

function dextrNode(dextr) {
  return {
    '@type': 'Organization',
    '@id': dextr.id,
    name: dextr.name,
    legalName: dextr.legalName,
    url: dextr.url,
    logo: { '@type': 'ImageObject', '@id': `${dextr.url}#logo`, url: dextr.logo, contentUrl: dextr.logo, caption: dextr.name },
    image: { '@id': `${dextr.url}#logo` },
    email: dextr.email,
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: dextr.email },
    sameAs: dextr.sameAs,
  };
}

/** The person or company that runs the site: Deepak on the personal site, Dextr on dextr.ai. */
export function ownerRef(site, env) {
  if (env.owner === 'dextr') return { id: site.dextr.id, node: null };
  const id = `${env.siteUrl}/#owner`;
  return {
    id,
    node: { '@type': env.owner.type, '@id': id, name: env.owner.name, url: env.owner.url, sameAs: env.owner.sameAs },
  };
}

function siteNodes(site, env) {
  const owner = ownerRef(site, env);
  const nodes = [dextrNode(site.dextr)];
  if (owner.node) nodes.push(owner.node);
  nodes.push({
    '@type': 'WebSite',
    '@id': `${env.siteUrl}/#website`,
    url: `${env.siteUrl}/`,
    name: env.siteName,
    inLanguage: site.language,
    publisher: { '@id': owner.id },
  });
  return { owner, nodes };
}

/** Author and reviewer of a post, defined in its front matter. */
function personNode(person, id) {
  return { '@type': 'Person', '@id': id, name: person.name, jobTitle: person.jobTitle, description: person.bio, knowsAbout: person.knowsAbout };
}

const personId = (siteUrl, name) => `${siteUrl}/#person-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

function softwareNode(app, publisher) {
  return {
    '@type': 'SoftwareApplication',
    ...(app.id && { '@id': app.id }),
    name: app.name,
    ...(app.alternateName && { alternateName: app.alternateName }),
    url: app.url,
    applicationCategory: app.applicationCategory,
    ...(app.applicationSubCategory && { applicationSubCategory: app.applicationSubCategory }),
    operatingSystem: 'Web',
    ...(app.featureList && { featureList: app.featureList }),
    publisher,
  };
}

function breadcrumbNode(id, items) {
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url })),
  };
}

export function articleGraph({ page, site, env, wordCount }) {
  const { meta } = page;
  const pageUrl = `${env.siteUrl}${meta.slug}`;
  const id = (name) => `${pageUrl}#${name}`;
  const { owner, nodes } = siteNodes(site, env);
  const og = IMAGE_SIZES[0];
  const authorId = meta.author ? personId(env.siteUrl, meta.author.name) : owner.id;
  const reviewerId = meta.reviewer ? personId(env.siteUrl, meta.reviewer.name) : null;
  const people = [meta.author && personNode(meta.author, authorId), meta.reviewer && personNode(meta.reviewer, reviewerId)].filter(Boolean);

  const graph = [
    ...nodes,
    ...people,
    {
      '@type': 'WebPage',
      '@id': id('webpage'),
      url: pageUrl,
      name: meta.title,
      description: meta.description,
      inLanguage: site.language,
      isPartOf: { '@id': `${env.siteUrl}/#website` },
      primaryImageOfPage: { '@id': id('primaryimage') },
      image: { '@id': id('primaryimage') },
      datePublished: meta.datePublished,
      dateModified: meta.dateModified,
      breadcrumb: { '@id': id('breadcrumb') },
      mainEntity: { '@id': id('article') },
      ...(reviewerId && { reviewedBy: { '@id': reviewerId }, lastReviewed: meta.lastReviewed ?? meta.dateModified }),
      about: { '@id': meta.subject.id },
      mentions: { '@id': id('competitor') },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.quick-verdict', '.key-takeaways'] },
      potentialAction: { '@type': 'ReadAction', target: [pageUrl] },
      hasPart: [
        page.faqs.length && { '@id': id('faq') },
        meta.definedTerms?.length && { '@id': id('terms') },
      ].filter(Boolean),
    },
    {
      '@type': 'ImageObject',
      '@id': id('primaryimage'),
      url: imageUrl(env.siteUrl, meta.image.base, og.suffix),
      contentUrl: imageUrl(env.siteUrl, meta.image.base, og.suffix),
      width: og.width,
      height: og.height,
      caption: meta.image.alt,
      inLanguage: site.language,
    },
    {
      '@type': 'Article',
      '@id': id('article'),
      headline: page.h1,
      alternativeHeadline: meta.title,
      description: meta.description,
      image: IMAGE_SIZES.slice(1).map((s) => imageUrl(env.siteUrl, meta.image.base, s.suffix)),
      datePublished: meta.datePublished,
      dateModified: meta.dateModified,
      author: { '@id': authorId },
      publisher: { '@id': owner.id },
      mainEntityOfPage: { '@id': id('webpage') },
      isPartOf: { '@id': id('webpage') },
      articleSection: meta.section,
      keywords: meta.keywords,
      wordCount,
      inLanguage: site.language,
      about: [{ '@id': meta.subject.id }],
      mentions: [{ '@id': id('competitor') }, { '@id': site.dextr.id }],
      citation: page.sources.map((s) => ({ '@type': 'CreativeWork', name: s.label, url: s.url })),
    },
    breadcrumbNode(id('breadcrumb'), [
      { name: 'Home', url: `${env.siteUrl}/` },
      { name: env.hub.name, url: `${env.siteUrl}${env.hub.slug}` },
      { name: meta.breadcrumb, url: pageUrl },
    ]),
    softwareNode(meta.subject, { '@id': site.dextr.id }),
    {
      ...softwareNode(meta.competitor, { '@type': 'Organization', name: meta.competitor.publisher.name, url: meta.competitor.publisher.url }),
      '@id': id('competitor'),
    },
  ];

  if (page.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': id('faq'),
      isPartOf: { '@id': id('webpage') },
      inLanguage: site.language,
      mainEntity: page.faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    });
  }

  if (page.demoQuestions.length) {
    graph.push({
      '@type': 'ItemList',
      '@id': id('demo-questions'),
      name: 'Questions to ask in any demo',
      numberOfItems: page.demoQuestions.length,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: page.demoQuestions.map((q, i) => ({ '@type': 'ListItem', position: i + 1, name: q })),
    });
  }

  if (meta.definedTerms?.length) {
    graph.push({
      '@type': 'DefinedTermSet',
      '@id': id('terms'),
      name: `Terms used in ${meta.breadcrumb}`,
      hasDefinedTerm: meta.definedTerms.map((t) => ({ '@type': 'DefinedTerm', name: t.name, description: t.description, inDefinedTermSet: { '@id': id('terms') } })),
    });
  }

  return { '@context': CONTEXT, '@graph': graph };
}

export function hubGraph({ site, env, pages }) {
  const hubUrl = `${env.siteUrl}${env.hub.slug}`;
  const { nodes } = siteNodes(site, env);
  return {
    '@context': CONTEXT,
    '@graph': [
      ...nodes,
      {
        '@type': 'CollectionPage',
        '@id': `${hubUrl}#webpage`,
        url: hubUrl,
        name: env.hub.title,
        description: env.hub.description,
        inLanguage: site.language,
        isPartOf: { '@id': `${env.siteUrl}/#website` },
        breadcrumb: { '@id': `${hubUrl}#breadcrumb` },
        mainEntity: { '@id': `${hubUrl}#list` },
      },
      {
        '@type': 'ItemList',
        '@id': `${hubUrl}#list`,
        numberOfItems: pages.length,
        itemListElement: pages.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${env.siteUrl}${p.meta.slug}`, name: p.meta.breadcrumb })),
      },
      breadcrumbNode(`${hubUrl}#breadcrumb`, [
        { name: 'Home', url: `${env.siteUrl}/` },
        { name: env.hub.name, url: hubUrl },
      ]),
    ],
  };
}

export function homeGraph({ site, env }) {
  const { owner, nodes } = siteNodes(site, env);
  const url = `${env.siteUrl}/`;
  return {
    '@context': CONTEXT,
    '@graph': [
      ...nodes,
      {
        '@type': owner.node?.['@type'] === 'Person' ? 'ProfilePage' : 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: env.home.title,
        description: env.home.description,
        inLanguage: site.language,
        isPartOf: { '@id': `${env.siteUrl}/#website` },
        ...(owner.node?.['@type'] === 'Person' && { mainEntity: { '@id': owner.id } }),
      },
    ],
  };
}
