import { prepareSiteReviewTarget } from './site-review-target';

/**
 * Read-only structural signals from user-provided HTML source.
 * Neither parses into an active DOM nor renders, evaluates, fetches or persists the source.
 * A signal is NOT a WCAG, SEO, TLS or security certification.
 */
export const MAX_HTML_SNAPSHOT_BYTES = 256 * 1024;

export type HtmlAuditFinding = {
  ruleId: string;
  category: 'structure' | 'content' | 'accessibility' | 'seo' | 'performance' | 'security';
  status: 'present' | 'needs_review' | 'not_configured';
  severity: 'high' | 'medium' | 'low' | 'info';
  message: string;
};

export type HtmlSnapshotAudit = {
  origin: string;
  source: 'user_supplied_local_html';
  verification: 'static_heuristic_only';
  findings: HtmlAuditFinding[];
  presentCount: number;
  reviewCount: number;
  unavailableCount: number;
};

// Minimal bounded lexical scan, never interpreted as DOM. HTML edge cases
// can create false positives/negatives, therefore report only review signals.
function openingTags(markup: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b(?:"[^"]*"|'[^']*'|[^"'<>])*> `.trim(), 'gi');
  return markup.match(pattern) ?? [];
}

function attribute(tag: string, name: string): string | null {
  const expression = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, 'i');
  const match = tag.match(expression);
  return match ? match[1] ?? match[2] ?? match[3] ?? '' : null;
}

function tagWithAttribute(markup: string, tag: string, attr: string, expected: string): string | null {
  return openingTags(markup, tag).find(
    (item) => (attribute(item, attr) ?? '').toLowerCase() === expected
  ) ?? null;
}

export function auditHtmlSnapshot(markup: string, origin: string): HtmlSnapshotAudit {
  const prepared = prepareSiteReviewTarget(origin);
  if (!prepared.ok) throw new TypeError('A validated public HTTPS origin is required.');
  if (typeof markup !== 'string' || !markup.trim() || markup.length > MAX_HTML_SNAPSHOT_BYTES) {
    throw new TypeError('HTML source must be nonempty and within 256 KiB.');
  }

  // Remove comments and executable/template sections from the lexical checks,
  // without ever building an HTML document or loading external resources.
  const source = markup
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');

  const html = openingTags(source, 'html')[0] ?? '';
  const documentTitle = source.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const desc = tagWithAttribute(source, 'meta', 'name', 'description');
  const viewport = tagWithAttribute(source, 'meta', 'name', 'viewport');
  const ogTitle = tagWithAttribute(source, 'meta', 'property', 'og:title');
  const canonical = openingTags(source, 'link').find(
    (tag) => (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical')
  );
  const images = openingTags(source, 'img');
  const links = openingTags(source, 'a');
  const h1Count = openingTags(source, 'h1').length;
  const missingAltCount = images.filter((img) => attribute(img, 'alt') === null).length;
  const unaddressedLinks = links.filter(
    (link) => (attribute(link, 'href') ?? '').trim() === ''
  ).length;

  const findings: HtmlAuditFinding[] = [];
  const signal = (
    ruleId: string,
    category: HtmlAuditFinding['category'],
    severity: HtmlAuditFinding['severity'],
    condition: boolean,
    present: string,
    review: string
  ) => findings.push({
    ruleId, category, severity,
    status: condition ? 'present' : 'needs_review',
    message: condition ? present : review
  });

  signal('structure.html_root', 'structure', 'medium',
    Boolean(html), 'HTML root tag detected.', 'HTML root tag not detected.');
  signal('seo.title', 'seo', 'high',
    Boolean(documentTitle?.[1]?.trim()), 'Title element contains text.', 'Title element is missing or empty.');
  signal('seo.meta_description', 'seo', 'medium',
    Boolean(desc && (attribute(desc, 'content') ?? '').trim()),
    'Meta description found.', 'Meta description is missing or empty.');
  signal('content.viewport', 'content', 'high',
    Boolean(viewport && (attribute(viewport, 'content') ?? '').trim()),
    'Viewport metadata found.', 'Viewport metadata missing.');
  signal('seo.canonical', 'seo', 'medium',
    Boolean(canonical && (attribute(canonical, 'href') ?? '').trim()),
    'Canonical reference found.', 'Canonical reference missing.');
  signal('accessibility.html_lang', 'accessibility', 'high',
    Boolean(attribute(html, 'lang')?.trim()), 'HTML language attribute found.', 'HTML language attribute missing.');
  signal('content.h1_count', 'content', 'medium',
    h1Count === 1, 'One H1 heading found.', `${h1Count} H1 headings found; review page structure.`);
  signal('accessibility.image_alt', 'accessibility', 'high',
    missingAltCount === 0, 'All detected image tags include alt (empty alt may be appropriate).',
    `${missingAltCount} image tags lack alt; inspect their meaning.`);
  signal('content.empty_links', 'content', 'medium',
    unaddressedLinks === 0, 'No empty or missing href attributes detected.',
    `${unaddressedLinks} anchor tags have missing or empty href attributes.`);
  signal('seo.open_graph_title', 'seo', 'low',
    Boolean(ogTitle && (attribute(ogTitle, 'content') ?? '').trim()),
    'Open Graph title found.', 'Open Graph title missing.');

  for (const [ruleId, category, message] of [
    ['performance.core_web_vitals', 'performance', 'Live Core Web Vitals require an authorized measurement source.'],
    ['seo.search_console', 'seo', 'Search indexing requires an authorized provider.'],
    ['security.live_headers', 'security', 'Live HTTP security headers were not inspected.'],
    ['content.live_links', 'content', 'Outbound links were not fetched or tested.']
  ] as const) {
    findings.push({ ruleId, category, severity: 'info', status: 'not_configured', message });
  }

  return {
    origin: prepared.target.origin,
    source: 'user_supplied_local_html',
    verification: 'static_heuristic_only',
    findings,
    presentCount: findings.filter((item) => item.status === 'present').length,
    reviewCount: findings.filter((item) => item.status === 'needs_review').length,
    unavailableCount: findings.filter((item) => item.status === 'not_configured').length
  };
}
