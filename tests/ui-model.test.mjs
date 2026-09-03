import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeIssues, viewportDimensions, buildExportPayload } from '../src/modules/site-review/site-review-ui.js';

test('summarizes actual issue states without fabricated metrics', () => {
  const summary = summarizeIssues([
    { status: 'open', severity: 'critical' },
    { status: 'resolved', severity: 'medium' },
    { status: 'in_progress', severity: 'high' }
  ]);

  assert.deepEqual(summary, { total: 3, open: 1, inProgress: 1, resolved: 1, rejected: 0, critical: 1 });
});

test('returns deterministic viewport dimensions', () => {
  assert.deepEqual(viewportDimensions('desktop'), { width: 1440, height: 900 });
  assert.deepEqual(viewportDimensions('tablet'), { width: 834, height: 1112 });
  assert.deepEqual(viewportDimensions('mobile'), { width: 390, height: 844 });
  assert.throws(() => viewportDimensions('watch'), /viewport/i);
});

test('builds an export payload from real session data', () => {
  const payload = buildExportPayload({
    session: { id: 'session-1', siteUrl: 'https://example.com' },
    issues: [{ id: 'issue-1' }],
    repliesByIssue: { 'issue-1': [{ id: 'reply-1' }] },
    findings: [{ ruleId: 'seo.title', status: 'passed' }]
  });

  assert.equal(payload.session.id, 'session-1');
  assert.equal(payload.issues.length, 1);
  assert.equal(payload.repliesByIssue['issue-1'].length, 1);
  assert.equal(payload.findings[0].status, 'passed');
});
