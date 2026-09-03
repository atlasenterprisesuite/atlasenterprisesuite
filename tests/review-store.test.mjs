import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryReviewStore } from '../src/modules/site-review/review-store.js';

test('stores and retrieves review sessions without mutating callers', () => {
  const store = createMemoryReviewStore();
  const session = {
    id: 'session-1',
    siteUrl: 'https://example.com',
    title: 'Example',
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    status: 'active'
  };

  store.saveSession(session);
  session.title = 'mutated';

  assert.equal(store.getSession('session-1').title, 'Example');
  assert.deepEqual(store.listSessions().map((item) => item.id), ['session-1']);
});

test('stores issues and replies by parent identifiers', () => {
  const store = createMemoryReviewStore();
  store.saveIssue({ id: 'issue-1', sessionId: 'session-1', status: 'open' });
  store.saveReply({ id: 'reply-1', issueId: 'issue-1', message: 'Fixed' });

  assert.equal(store.listIssues('session-1').length, 1);
  assert.equal(store.listReplies('issue-1')[0].message, 'Fixed');
});
