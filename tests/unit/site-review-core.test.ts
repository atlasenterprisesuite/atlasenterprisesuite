import { describe, expect, it } from 'vitest';
import { InMemoryAuditSink } from '../../packages/core/src';
import {
  InMemorySiteReviewStore,
  SiteReviewService,
  auditDocument,
  providerDependentFindings,
  type SiteReviewActor,
} from '../../packages/site-review/src';

const scopeA = { tenantId: 'tenant-a', organizationId: 'org-a' };
const scopeB = { tenantId: 'tenant-a', organizationId: 'org-b' };

const reviewer: SiteReviewActor = {
  ...scopeA,
  userId: 'reviewer-1',
  permissions: ['site-review.admin'],
};

function serviceFixture() {
  const store = new InMemorySiteReviewStore();
  const audit = new InMemoryAuditSink();
  let sequence = 0;
  const service = new SiteReviewService(store, audit, {
    now: () => '2026-09-05T20:00:00.000Z',
    id: (prefix) => `${prefix}-${++sequence}`,
  });
  return { store, audit, service };
}

describe('ATLAS Site Review core', () => {
  it('audits supplied markup deterministically without claiming provider-backed checks', () => {
    const findings = auditDocument(
      '<html><head><meta name="viewport" content="width=device-width"></head><body><img src="x"><h1>One</h1></body></html>',
      'https://example.com/page',
    );

    expect(findings.find((entry) => entry.ruleId === 'security.https')?.status).toBe('passed');
    expect(findings.find((entry) => entry.ruleId === 'seo.title')?.status).toBe('detected');
    expect(findings.find((entry) => entry.ruleId === 'accessibility.image_alt')?.status).toBe('detected');
    expect(providerDependentFindings().every((entry) => entry.status === 'not_configured')).toBe(true);
  });

  it('isolates sessions by tenant and organization together', () => {
    const { store, service } = serviceFixture();
    const session = service.createSession(reviewer, {
      siteUrl: 'https://example.com',
      title: 'Example review',
    });

    expect(store.getSession(scopeA, session.id)?.title).toBe('Example review');
    expect(store.getSession(scopeB, session.id)).toBeNull();
  });

  it('creates scoped issues with normalized coordinates and canonical audit events', () => {
    const { audit, service } = serviceFixture();
    const session = service.createSession(reviewer, {
      siteUrl: 'https://example.com',
      title: 'Example review',
    });
    const issue = service.addIssue(reviewer, {
      sessionId: session.id,
      pageUrl: 'https://example.com/pricing',
      viewport: 'mobile',
      x: 0.25,
      y: 0.75,
      message: 'CTA overlaps content',
      severity: 'high',
    });

    expect(issue).toMatchObject({
      tenantId: scopeA.tenantId,
      organizationId: scopeA.organizationId,
      viewport: 'mobile',
      x: 0.25,
      y: 0.75,
      status: 'open',
      createdBy: reviewer.userId,
    });
    const events = audit.list(scopeA);
    expect(events.map((event) => event.action)).toEqual([
      'site-review.session.create',
      'site-review.issue.create',
    ]);
    expect(audit.list(scopeB)).toHaveLength(0);
  });

  it('rejects non-http URLs and coordinates outside the visual surface', () => {
    const { service } = serviceFixture();
    expect(() => service.createSession(reviewer, {
      siteUrl: 'javascript:alert(1)',
      title: 'Unsafe review',
    })).toThrow(/valid HTTP URL/);

    const session = service.createSession(reviewer, {
      siteUrl: 'https://example.com',
      title: 'Safe review',
    });
    expect(() => service.addIssue(reviewer, {
      sessionId: session.id,
      pageUrl: 'https://example.com',
      viewport: 'desktop',
      x: 1.2,
      y: 0.5,
      message: 'Outside surface',
      severity: 'low',
    })).toThrow(/normalized between 0 and 1/);
  });

  it('supports issue status, replies, filters and keeps cross-organization data invisible', () => {
    const { store, service } = serviceFixture();
    const session = service.createSession(reviewer, {
      siteUrl: 'https://example.com',
      title: 'Workflow review',
    });
    const issue = service.addIssue(reviewer, {
      sessionId: session.id,
      pageUrl: 'https://example.com',
      viewport: 'tablet',
      x: 0.4,
      y: 0.6,
      message: 'Spacing regression',
      severity: 'medium',
    });

    service.setIssueStatus(reviewer, issue.id, 'in_progress');
    const reply = service.addReply(reviewer, issue.id, 'Reproduced and assigned for review.');

    expect(service.listIssues(reviewer, session.id, { status: 'in_progress' })).toHaveLength(1);
    expect(service.listIssues(reviewer, session.id, { severity: 'critical' })).toHaveLength(0);
    expect(service.listReplies(reviewer, issue.id)).toEqual([reply]);
    expect(store.listIssues(scopeB, session.id)).toHaveLength(0);
    expect(store.listReplies(scopeB, issue.id)).toHaveLength(0);
  });

  it('requires explicit audit permission before running deterministic review rules', () => {
    const { service } = serviceFixture();
    const readerOnly: SiteReviewActor = {
      ...scopeA,
      userId: 'reader-1',
      permissions: ['site-review.read'],
    };

    expect(() => service.auditMarkup(readerOnly, '<title>Example</title>', 'https://example.com')).toThrow(/Missing permission/);
    expect(service.auditMarkup(reviewer, '<title>Example</title>', 'https://example.com').length).toBeGreaterThan(10);
  });
});
