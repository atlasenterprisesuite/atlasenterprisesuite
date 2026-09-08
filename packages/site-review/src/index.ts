import {
  sameScope,
  type AuditSink,
  type TenantScope,
} from '../../core/src';

export type SiteReviewPermission =
  | 'site-review.read'
  | 'site-review.create'
  | 'site-review.manage'
  | 'site-review.comment'
  | 'site-review.audit'
  | 'site-review.admin';

export type SiteReviewActor = TenantScope & {
  userId: string;
  permissions: readonly SiteReviewPermission[];
};

export type ReviewViewport = 'desktop' | 'tablet' | 'mobile';
export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ReviewIssueStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';
export type ReviewSessionStatus = 'active' | 'closed';
export type AuditFindingStatus = 'passed' | 'detected' | 'not_configured';

export type ReviewSession = TenantScope & {
  id: string;
  siteUrl: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: ReviewSessionStatus;
};

export type ReviewIssue = TenantScope & {
  id: string;
  sessionId: string;
  pageUrl: string;
  viewport: ReviewViewport;
  x: number;
  y: number;
  message: string;
  status: ReviewIssueStatus;
  severity: ReviewSeverity;
  assigneeId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewReply = TenantScope & {
  id: string;
  issueId: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type AuditFinding = {
  id: string;
  ruleId: string;
  category: 'security' | 'seo' | 'content' | 'accessibility' | 'performance';
  severity: 'high' | 'medium' | 'low' | 'info';
  status: AuditFindingStatus;
  message: string;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${label} is required`);
  return value.trim();
}

function requireHttpUrl(value: unknown, label = 'URL'): string {
  let parsed: URL;
  try {
    parsed = new URL(requireText(value, label));
  } catch {
    throw new TypeError(`${label} must be a valid HTTP URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`${label} must be a valid HTTP URL`);
  }
  return parsed.toString();
}

function requireCoordinate(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 1) {
    throw new RangeError('Issue coordinates must be normalized between 0 and 1');
  }
  return value;
}

function tags(markup: string, name: string): string[] {
  const pattern = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return markup.match(pattern) ?? [];
}

function getAttr(tag: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? '';
}

function metaBy(markup: string, attribute: string, value: string): string | null {
  return tags(markup, 'meta').find(
    (tag) => (getAttr(tag, attribute) ?? '').toLowerCase() === value.toLowerCase(),
  ) ?? null;
}

function finding(
  ruleId: string,
  category: AuditFinding['category'],
  severity: AuditFinding['severity'],
  status: AuditFindingStatus,
  message: string,
): AuditFinding {
  return { id: ruleId, ruleId, category, severity, status, message };
}

function passOrDetect(
  condition: boolean,
  ruleId: string,
  category: AuditFinding['category'],
  severity: AuditFinding['severity'],
  passMessage: string,
  detectMessage: string,
): AuditFinding {
  return finding(
    ruleId,
    category,
    severity,
    condition ? 'passed' : 'detected',
    condition ? passMessage : detectMessage,
  );
}

export function auditDocument(markup: string, pageUrl: string): AuditFinding[] {
  if (typeof markup !== 'string') throw new TypeError('Markup must be a string');
  const url = new URL(requireHttpUrl(pageUrl, 'Page URL'));
  const titleMatch = markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? '';
  const description = metaBy(markup, 'name', 'description');
  const viewport = metaBy(markup, 'name', 'viewport');
  const robots = metaBy(markup, 'name', 'robots');
  const ogTitle = metaBy(markup, 'property', 'og:title');
  const ogDescription = metaBy(markup, 'property', 'og:description');
  const canonical = tags(markup, 'link').find((tag) =>
    (getAttr(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('canonical'),
  ) ?? null;
  const h1Count = (markup.match(/<h1\b[^>]*>/gi) ?? []).length;
  const missingAlt = tags(markup, 'img').filter((tag) => getAttr(tag, 'alt') === null).length;
  const emptyLinks = tags(markup, 'a').filter((tag) => (getAttr(tag, 'href') ?? '').trim() === '').length;

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
    passOrDetect(Boolean(ogDescription && (getAttr(ogDescription, 'content') ?? '').trim()), 'seo.open_graph_description', 'seo', 'low', 'Open Graph description is present.', 'Open Graph description is missing.'),
  ];
}

export function providerDependentFindings(): AuditFinding[] {
  return [
    finding('performance.core_web_vitals', 'performance', 'info', 'not_configured', 'Core Web Vitals require a configured browser/Lighthouse or field-data provider.'),
    finding('seo.search_console_indexing', 'seo', 'info', 'not_configured', 'Search Console indexing requires an authorized Google Search Console integration.'),
    finding('security.external_headers', 'security', 'info', 'not_configured', 'Live response-header inspection requires network access to the reviewed site.'),
    finding('content.broken_links_live', 'content', 'info', 'not_configured', 'Live broken-link validation requires network crawling to be configured.'),
  ];
}

function scopeKey(scope: TenantScope): string {
  return `${scope.tenantId}\u0000${scope.organizationId}`;
}

export class InMemorySiteReviewStore {
  private readonly sessions = new Map<string, Map<string, ReviewSession>>();
  private readonly issues = new Map<string, Map<string, ReviewIssue>>();
  private readonly replies = new Map<string, Map<string, ReviewReply>>();

  private bucket<T>(root: Map<string, Map<string, T>>, scope: TenantScope): Map<string, T> {
    const key = scopeKey(scope);
    let bucket = root.get(key);
    if (!bucket) {
      bucket = new Map<string, T>();
      root.set(key, bucket);
    }
    return bucket;
  }

  saveSession(scope: TenantScope, session: ReviewSession): ReviewSession {
    if (!sameScope(scope, session)) throw new Error('Review session scope mismatch');
    this.bucket(this.sessions, scope).set(session.id, clone(session));
    return clone(session);
  }

  getSession(scope: TenantScope, id: string): ReviewSession | null {
    return clone(this.sessions.get(scopeKey(scope))?.get(id) ?? null);
  }

  listSessions(scope: TenantScope): ReviewSession[] {
    return [...(this.sessions.get(scopeKey(scope))?.values() ?? [])].map(clone);
  }

  saveIssue(scope: TenantScope, issue: ReviewIssue): ReviewIssue {
    if (!sameScope(scope, issue)) throw new Error('Review issue scope mismatch');
    this.bucket(this.issues, scope).set(issue.id, clone(issue));
    return clone(issue);
  }

  getIssue(scope: TenantScope, id: string): ReviewIssue | null {
    return clone(this.issues.get(scopeKey(scope))?.get(id) ?? null);
  }

  listIssues(scope: TenantScope, sessionId: string): ReviewIssue[] {
    return [...(this.issues.get(scopeKey(scope))?.values() ?? [])]
      .filter((issue) => issue.sessionId === sessionId)
      .map(clone);
  }

  saveReply(scope: TenantScope, reply: ReviewReply): ReviewReply {
    if (!sameScope(scope, reply)) throw new Error('Review reply scope mismatch');
    this.bucket(this.replies, scope).set(reply.id, clone(reply));
    return clone(reply);
  }

  listReplies(scope: TenantScope, issueId: string): ReviewReply[] {
    return [...(this.replies.get(scopeKey(scope))?.values() ?? [])]
      .filter((reply) => reply.issueId === issueId)
      .map(clone);
  }
}

function hasPermission(actor: SiteReviewActor, required: SiteReviewPermission): boolean {
  return actor.permissions.includes('site-review.admin') || actor.permissions.includes(required);
}

function requirePermission(actor: SiteReviewActor, required: SiteReviewPermission): void {
  if (!hasPermission(actor, required)) throw new Error(`Missing permission: ${required}`);
}

export class SiteReviewService {
  constructor(
    private readonly store: InMemorySiteReviewStore,
    private readonly audit: AuditSink,
    private readonly options: {
      now?: () => string;
      id?: (prefix: 'session' | 'issue' | 'reply' | 'audit' | 'correlation') => string;
    } = {},
  ) {}

  private now(): string {
    return (this.options.now ?? (() => new Date().toISOString()))();
  }

  private id(prefix: 'session' | 'issue' | 'reply' | 'audit' | 'correlation'): string {
    return (this.options.id ?? ((value) => `${value}-${crypto.randomUUID()}`))(prefix);
  }

  private auditMutation(actor: SiteReviewActor, action: string, entityType: string, entityId: string, before: unknown, after: unknown): void {
    this.audit.append({
      id: this.id('audit'),
      tenantId: actor.tenantId,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      action,
      entityType,
      entityId,
      before: clone(before),
      after: clone(after),
      timestamp: this.now(),
      correlationId: this.id('correlation'),
    });
  }

  createSession(actor: SiteReviewActor, input: { siteUrl: string; title: string }): ReviewSession {
    requirePermission(actor, 'site-review.create');
    const timestamp = this.now();
    const session: ReviewSession = {
      tenantId: actor.tenantId,
      organizationId: actor.organizationId,
      id: this.id('session'),
      siteUrl: requireHttpUrl(input.siteUrl, 'Site URL'),
      title: requireText(input.title, 'Title'),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'active',
    };
    const saved = this.store.saveSession(actor, session);
    this.auditMutation(actor, 'site-review.session.create', 'site-review.session', saved.id, null, saved);
    return saved;
  }

  addIssue(actor: SiteReviewActor, input: {
    sessionId: string;
    pageUrl: string;
    viewport: ReviewViewport;
    x: number;
    y: number;
    message: string;
    severity: ReviewSeverity;
  }): ReviewIssue {
    requirePermission(actor, 'site-review.create');
    const session = this.store.getSession(actor, requireText(input.sessionId, 'Session ID'));
    if (!session) throw new Error(`Review session not found: ${input.sessionId}`);
    const timestamp = this.now();
    const issue: ReviewIssue = {
      tenantId: actor.tenantId,
      organizationId: actor.organizationId,
      id: this.id('issue'),
      sessionId: session.id,
      pageUrl: requireHttpUrl(input.pageUrl, 'Page URL'),
      viewport: input.viewport,
      x: requireCoordinate(input.x),
      y: requireCoordinate(input.y),
      message: requireText(input.message, 'Message'),
      status: 'open',
      severity: input.severity,
      assigneeId: null,
      createdBy: actor.userId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    if (!(['desktop', 'tablet', 'mobile'] as ReviewViewport[]).includes(issue.viewport)) {
      throw new TypeError(`Unsupported viewport: ${issue.viewport}`);
    }
    if (!(['critical', 'high', 'medium', 'low'] as ReviewSeverity[]).includes(issue.severity)) {
      throw new TypeError(`Unsupported severity: ${issue.severity}`);
    }
    const saved = this.store.saveIssue(actor, issue);
    this.auditMutation(actor, 'site-review.issue.create', 'site-review.issue', saved.id, null, saved);
    return saved;
  }

  setIssueStatus(actor: SiteReviewActor, issueId: string, status: ReviewIssueStatus): ReviewIssue {
    requirePermission(actor, 'site-review.manage');
    if (!(['open', 'in_progress', 'resolved', 'rejected'] as ReviewIssueStatus[]).includes(status)) {
      throw new TypeError(`Unsupported issue status: ${status}`);
    }
    const current = this.store.getIssue(actor, requireText(issueId, 'Issue ID'));
    if (!current) throw new Error(`Review issue not found: ${issueId}`);
    const next = { ...current, status, updatedAt: this.now() };
    const saved = this.store.saveIssue(actor, next);
    this.auditMutation(actor, 'site-review.issue.status', 'site-review.issue', saved.id, current, saved);
    return saved;
  }

  addReply(actor: SiteReviewActor, issueId: string, message: string): ReviewReply {
    requirePermission(actor, 'site-review.comment');
    const issue = this.store.getIssue(actor, requireText(issueId, 'Issue ID'));
    if (!issue) throw new Error(`Review issue not found: ${issueId}`);
    const reply: ReviewReply = {
      tenantId: actor.tenantId,
      organizationId: actor.organizationId,
      id: this.id('reply'),
      issueId: issue.id,
      message: requireText(message, 'Message'),
      createdBy: actor.userId,
      createdAt: this.now(),
    };
    const saved = this.store.saveReply(actor, reply);
    this.auditMutation(actor, 'site-review.reply.create', 'site-review.reply', saved.id, null, saved);
    return saved;
  }

  listIssues(actor: SiteReviewActor, sessionId: string, filters: Partial<Pick<ReviewIssue, 'status' | 'severity' | 'viewport' | 'assigneeId'>> = {}): ReviewIssue[] {
    requirePermission(actor, 'site-review.read');
    const session = this.store.getSession(actor, requireText(sessionId, 'Session ID'));
    if (!session) throw new Error(`Review session not found: ${sessionId}`);
    return this.store.listIssues(actor, session.id).filter((issue) =>
      (!filters.status || issue.status === filters.status) &&
      (!filters.severity || issue.severity === filters.severity) &&
      (!filters.viewport || issue.viewport === filters.viewport) &&
      (!filters.assigneeId || issue.assigneeId === filters.assigneeId),
    );
  }

  listReplies(actor: SiteReviewActor, issueId: string): ReviewReply[] {
    requirePermission(actor, 'site-review.read');
    const issue = this.store.getIssue(actor, requireText(issueId, 'Issue ID'));
    if (!issue) throw new Error(`Review issue not found: ${issueId}`);
    return this.store.listReplies(actor, issue.id);
  }

  auditMarkup(actor: SiteReviewActor, markup: string, pageUrl: string): AuditFinding[] {
    requirePermission(actor, 'site-review.audit');
    return [...auditDocument(markup, pageUrl), ...providerDependentFindings()];
  }
}
