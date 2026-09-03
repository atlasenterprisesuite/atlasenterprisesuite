import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryReviewStore } from '../src/modules/site-review/review-store.js';
import { createReviewService } from '../src/modules/site-review/review-service.js';

function createHarness() {
  let counter = 0;
  const store = createMemoryReviewStore();
  const service = createReviewService({
    store,
    now: () => '2026-09-03T01:30:00.000Z',
    id: (prefix) => `${prefix}-${++counter}`
  });
  return { store, service };
}

test('creates a valid review session and rejects invalid URLs', () => {
  const { service } = createHarness();
  const session = service.createSession({ siteUrl: 'https://example.com/path', title: 'Homepage review' });

  assert.equal(session.siteUrl, 'https://example.com/path');
  assert.equal(session.status, 'active');
  assert.throws(() => service.createSession({ siteUrl: 'javascript:alert(1)', title: 'Bad' }), /valid http/i);
});

test('creates normalized pinned issues and rejects out-of-range coordinates', () => {
  const { service } = createHarness();
  const session = service.createSession({ siteUrl: 'https://example.com', title: 'Review' });
  const issue = service.addIssue({
    sessionId: session.id,
    pageUrl: 'https://example.com',
    viewport: 'mobile',
    x: 0.25,
    y: 0.8,
    message: 'Button overlaps text',
    severity: 'high',
    createdBy: 'reviewer-1'
  });

  assert.equal(issue.status, 'open');
  assert.equal(issue.assigneeId, null);
  assert.equal(issue.viewport, 'mobile');
  assert.throws(() => service.addIssue({
    sessionId: session.id,
    pageUrl: 'https://example.com',
    viewport: 'desktop',
    x: 1.2,
    y: 0.2,
    message: 'Bad point',
    severity: 'low',
    createdBy: 'reviewer-1'
  }), /coordinates/i);
});

test('updates issue workflow, replies, assignment and filters', () => {
  const { service } = createHarness();
  const session = service.createSession({ siteUrl: 'https://example.com', title: 'Review' });
  const issueA = service.addIssue({
    sessionId: session.id,
    pageUrl: 'https://example.com',
    viewport: 'desktop',
    x: 0.2,
    y: 0.3,
    message: 'Spacing',
    severity: 'medium',
    createdBy: 'reviewer-1'
  });
  service.addIssue({
    sessionId: session.id,
    pageUrl: 'https://example.com',
    viewport: 'mobile',
    x: 0.4,
    y: 0.5,
    message: 'Menu',
    severity: 'critical',
    createdBy: 'reviewer-2'
  });

  const assigned = service.assignIssue(issueA.id, 'developer-7');
  const resolved = service.setIssueStatus(issueA.id, 'resolved');
  const reply = service.addReply(issueA.id, { message: 'Corrected in branch', createdBy: 'developer-7' });

  assert.equal(assigned.assigneeId, 'developer-7');
  assert.equal(resolved.status, 'resolved');
  assert.equal(reply.issueId, issueA.id);
  assert.equal(service.listIssues(session.id, { status: 'resolved' }).length, 1);
  assert.equal(service.listIssues(session.id, { viewport: 'mobile', severity: 'critical' }).length, 1);
  assert.equal(service.listIssues(session.id, { assigneeId: 'developer-7' }).length, 1);
});
