function tags(markup, name) {
  const pattern = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return markup.match(pattern) ?? [];
}

function getAttr(tag, name) {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function metaBy(markup, attribute, value) {
  return tags(markup, 'meta').find((tag) => (getAttr(tag, attribute) ?? '').toLowerCase() === value.toLowerCase()) ?? null;
}

function finding(ruleId, category, severity, status, message) {
  return { id: ruleId, ruleId, category, severity, status, message };
}

function passOrDetect(condition, ruleId, category, severity, passMessage, detectMessage) {
  return finding(ruleId, category, severity, condition ? 'passed' : 'detected', condition ? passMessage : detectMessage);
}

export function auditDocument(markup, pageUrl) {
  if (typeof markup !== 'string') throw new TypeError('Markup must be a string');

  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    throw new TypeError('Page URL must be valid');
  }

  const titleMatch = markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? '';
  const description = metaBy(markup, 'name', 'description');
  const viewport = metaBy(markup, 'name', 'viewport');
  const robots = metaBy(markup, 'name', 'robots');
  const ogTitle = metaBy(markup, 'property', 'og:title');
  const ogDescription = metaBy(markup, 'property', 'og:description');
  const canonical = tags(markup, 'link').find((tag) => (getAttr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical')) ?? null;
  const h1Count = (markup.match(/<h1\b[^>]*>/gi) ?? []).length;
  const images = tags(markup, 'img');
  const missingAlt = images.filter((tag) => getAttr(tag, 'alt') === null).length;
  const anchors = tags(markup, 'a');
  const emptyLinks = anchors.filter((tag) => (getAttr(tag, 'href') ?? '').trim() === '').length;

  return [
    passOrDetect(url.protocol === 'https:', 'security.https', 'security', 'high', 'Page uses HTTPS.', 'Page does not use HTTPS.'),
    passOrDetect(title.length > 0, 'seo.title', 'seo', 'high', 'Page title is present.', 'Page title is missing or empty.'),
    passOrDetect(Boolean(description && (getAttr(description, 'content') ?? '').trim()), 'seo.meta_description', 'seo', 'medium', 'Meta description is present.', 'Meta description is missing or empty.'),
    passOrDetect(Boolean(canonical && (getAttr(canonical, 'href') ?? '').trim()), 'seo.canonical', 'seo', 'medium', 'Canonical URL is present.', 'Canonical URL is missing.'),
    passOrDetect(Boolean(viewport && (getAttr(viewport, 'content') ?? '').trim()), 'content.viewport', 'content', 'high', 'Viewport metadata is present.', 'Viewport metadata is missing.'),
    passOrDetect(h1Count === 1, 'content.h1_count', 'content', 'medium', 'Page contains exactly one H1.', `Page contains ${h1Count} H1 headings; expected exactly one.`),
    passOrDetect(missingAlt === 0, 'accessibility.image_alt', 'accessibility', 'high', 'All images include alt attributes.', `${missingAlt} image(s) are missing alt attributes.`),
    passOrDetect(emptyLinks === 0, 'content.empty_links', 'content', 'medium', 'No empty links detected.', `${emptyLinks} empty link(s) detected.`),
    passOrDetect(Boolean(robots), 'seo.robots_meta', 'seo', 'info', 'Robots meta is present.', 'Robots meta is not present.'),
    passOrDetect(Boolean(ogTitle && (getAttr(ogTitle, 'content') ?? '').trim()), 'seo.open_graph_title', 'seo', 'low', 'Open Graph title is present.', 'Open Graph title is missing.'),
    passOrDetect(Boolean(ogDescription && (getAttr(ogDescription, 'content') ?? '').trim()), 'seo.open_graph_description', 'seo', 'low', 'Open Graph description is present.', 'Open Graph description is missing.')
  ];
}

export function providerDependentFindings() {
  return [
    finding('performance.core_web_vitals', 'performance', 'info', 'not_configured', 'Core Web Vitals require a configured browser/Lighthouse or field-data provider.'),
    finding('seo.search_console_indexing', 'seo', 'info', 'not_configured', 'Search Console indexing requires an authorized Google Search Console integration.'),
    finding('security.external_headers', 'security', 'info', 'not_configured', 'Live response-header inspection requires network access to the reviewed site.'),
    finding('content.broken_links_live', 'content', 'info', 'not_configured', 'Live broken-link validation requires network crawling to be configured.')
  ];
}
