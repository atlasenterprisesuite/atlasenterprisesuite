import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  InMemoryCouncilDeliveryStore,
  createGitHubDiscussionsAdapter,
  formatCouncilDiscussionReply,
  normalizeDiscussionWebhook,
  verifyGitHubWebhookSignature,
} from '../../packages/github-discussions-adapter/src';
import { parseCouncilCommand } from '../../packages/ai-council-core/src';

function sign(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

describe('ATLAS GitHub Discussions adapter', () => {
  it('verifies GitHub webhook HMAC and rejects malformed or incorrect signatures', () => {
    const secret = 'test-only-webhook-secret';
    const body = JSON.stringify({ action: 'created' });

    expect(verifyGitHubWebhookSignature(secret, body, sign(secret, body))).toBe(true);
    expect(verifyGitHubWebhookSignature(secret, body, 'sha256=deadbeef')).toBe(false);
    expect(verifyGitHubWebhookSignature(secret, body, 'not-sha256')).toBe(false);
  });

  it('normalizes created discussion comments into a provider-independent event', () => {
    const event = normalizeDiscussionWebhook({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-1',
      payload: {
        action: 'created',
        repository: { id: 1329354275, full_name: 'atlasenterprisesuite/atlasenterprisesuite' },
        sender: { login: 'winder' },
        discussion: { node_id: 'D_kwDO1', number: 7, title: 'AI Council' },
        comment: { node_id: 'DC_kwDO2', body: '/ask all\nReview identity' },
      },
    });

    expect(event).toEqual({
      kind: 'discussion_comment',
      deliveryId: 'delivery-1',
      repositoryId: '1329354275',
      repositoryFullName: 'atlasenterprisesuite/atlasenterprisesuite',
      discussionNodeId: 'D_kwDO1',
      discussionNumber: 7,
      originNodeId: 'DC_kwDO2',
      actorLogin: 'winder',
      body: '/ask all\nReview identity',
    });
    expect(parseCouncilCommand(event?.body ?? '')?.kind).toBe('ask');
  });

  it('ignores edits, deletes, unsupported webhook families, and incomplete events', () => {
    expect(normalizeDiscussionWebhook({ eventName: 'discussion_comment', deliveryId: '1', payload: { action: 'edited' } })).toBeNull();
    expect(normalizeDiscussionWebhook({ eventName: 'issues', deliveryId: '2', payload: { action: 'opened' } })).toBeNull();
    expect(normalizeDiscussionWebhook({ eventName: 'discussion', deliveryId: '3', payload: { action: 'created' } })).toBeNull();
  });

  it('prevents duplicate delivery processing independently of GitHub storage', () => {
    const store = new InMemoryCouncilDeliveryStore();
    expect(store.claim('delivery-1')).toBe(true);
    expect(store.claim('delivery-1')).toBe(false);
    expect(store.has('delivery-1')).toBe(true);
  });

  it('marks every generated reply so it cannot recursively trigger the council', () => {
    const body = formatCouncilDiscussionReply({
      taskId: 'task-1',
      provider: 'openai',
      status: 'completed',
      body: 'Architecture recommendation',
    });

    expect(body).toContain('<!-- atlas-ai-council:generated -->');
    expect(body).toContain('ATLAS Task: `task-1`');
    expect(body).toContain('Provider: `openai`');
    expect(body).toContain('Architecture recommendation');
  });

  it('publishes replies through an injected GraphQL-capable transport without leaking it into core', async () => {
    const calls: unknown[] = [];
    const adapter = createGitHubDiscussionsAdapter({
      client: {
        addDiscussionComment: async (input) => {
          calls.push(input);
          return { commentNodeId: 'DC_reply', url: 'https://github.com/example/repo/discussions/7#discussioncomment-1' };
        },
        createIssue: async () => ({ issueNumber: 123, url: 'https://github.com/example/repo/issues/123' }),
      },
    });

    const result = await adapter.publishReply({
      discussionNodeId: 'D_kwDO1',
      replyToNodeId: 'DC_kwDO2',
      taskId: 'task-1',
      provider: 'gemini',
      status: 'completed',
      body: 'Independent review',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ discussionNodeId: 'D_kwDO1', replyToNodeId: 'DC_kwDO2' });
    expect((calls[0] as { body: string }).body).toContain('atlas-ai-council:generated');
    expect(result.commentNodeId).toBe('DC_reply');
  });

  it('creates implementation issues only from an explicit task contract', async () => {
    const calls: unknown[] = [];
    const adapter = createGitHubDiscussionsAdapter({
      client: {
        addDiscussionComment: async () => ({ commentNodeId: 'DC_reply', url: 'https://github.com/example/repo/discussions/7' }),
        createIssue: async (input) => {
          calls.push(input);
          return { issueNumber: 123, url: 'https://github.com/example/repo/issues/123' };
        },
      },
    });

    const result = await adapter.createImplementationIssue({
      repositoryFullName: 'atlasenterprisesuite/atlasenterprisesuite',
      taskId: 'task-1',
      title: 'Implement approved ATLAS identity change',
      body: 'Approved contract and evidence refs',
    });

    expect(calls).toEqual([{
      repositoryFullName: 'atlasenterprisesuite/atlasenterprisesuite',
      title: '[ATLAS task-1] Implement approved ATLAS identity change',
      body: 'ATLAS Task: `task-1`\n\nApproved contract and evidence refs',
    }]);
    expect(result.issueNumber).toBe(123);
  });
});
