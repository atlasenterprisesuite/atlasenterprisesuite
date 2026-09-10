import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  COUNCIL_GENERATED_MARKER,
  type CouncilActor,
} from '../../packages/ai-council-core/src';
import {
  InMemoryCouncilDeliveryStore,
  InMemoryCouncilTaskStore,
  createCouncilDiscussionIngress,
} from '../../packages/github-discussions-adapter/src';

const secret = 'test-only-webhook-secret';

function payload(body = '/ask all\nReview ATLAS identity') {
  return {
    action: 'created',
    repository: { id: 1329354275, full_name: 'atlasenterprisesuite/atlasenterprisesuite' },
    sender: { login: 'winder' },
    discussion: { node_id: 'D_kwDO1', number: 7, title: 'AI Council' },
    comment: { node_id: 'DC_kwDO2', body },
  };
}

function raw(body = '/ask all\nReview ATLAS identity') {
  return JSON.stringify(payload(body));
}

function signature(body: string) {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

const operator: CouncilActor = {
  tenantId: 'tenant-a',
  organizationId: 'org-a',
  userId: 'user-winder',
  permissions: ['ai_council.read', 'ai_council.invoke', 'ai_council.consensus', 'ai_council.delegate'],
};

function ingress(actor: CouncilActor | null = operator) {
  const taskStore = new InMemoryCouncilTaskStore();
  const deliveryStore = new InMemoryCouncilDeliveryStore();
  const resolveActor = vi.fn(async () => actor);
  const service = createCouncilDiscussionIngress({
    webhookSecret: secret,
    taskStore,
    deliveryStore,
    resolveActor,
    now: () => '2026-09-10T04:00:00.000Z',
    taskId: () => 'task-1',
  });
  return { service, taskStore, deliveryStore, resolveActor };
}

describe('ATLAS AI Council Discussion ingress', () => {
  it('fails closed on invalid signatures before actor resolution or persistence', async () => {
    const { service, taskStore, resolveActor } = ingress();
    const result = await service.handle({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-1',
      rawBody: raw(),
      signature: 'sha256=deadbeef',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'invalid_signature' });
    expect(resolveActor).not.toHaveBeenCalled();
    expect(taskStore.list({ tenantId: 'tenant-a', organizationId: 'org-a' })).toHaveLength(0);
  });

  it('authorizes an explicit command, hashes its immutable prompt snapshot, and persists ATLAS-owned task state', async () => {
    const { service, taskStore } = ingress();
    const body = raw();
    const result = await service.handle({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-1',
      rawBody: body,
      signature: signature(body),
    });

    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') throw new Error('Expected accepted result');
    expect(result.task).toMatchObject({
      taskId: 'task-1',
      tenantId: 'tenant-a',
      organizationId: 'org-a',
      requestingActor: 'user-winder',
      repositoryId: '1329354275',
      discussionId: 'D_kwDO1',
      originCommentId: 'DC_kwDO2',
      state: 'authorized',
      promptSnapshot: '/ask all\nReview ATLAS identity',
    });
    expect(result.task.promptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(taskStore.get({ tenantId: 'tenant-a', organizationId: 'org-a' }, 'task-1')?.taskId).toBe('task-1');
  });

  it('is idempotent per GitHub delivery and does not create duplicate tasks', async () => {
    const { service, taskStore } = ingress();
    const body = raw();
    const request = {
      eventName: 'discussion_comment',
      deliveryId: 'delivery-1',
      rawBody: body,
      signature: signature(body),
    };

    expect((await service.handle(request)).status).toBe('accepted');
    expect(await service.handle(request)).toEqual({ status: 'duplicate', deliveryId: 'delivery-1' });
    expect(taskStore.list({ tenantId: 'tenant-a', organizationId: 'org-a' })).toHaveLength(1);
  });

  it('rejects an authenticated actor who lacks permission for the requested command', async () => {
    const viewer: CouncilActor = { ...operator, permissions: ['ai_council.read'] };
    const { service, taskStore } = ingress(viewer);
    const body = raw('/ask openai\nReview architecture');
    const result = await service.handle({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-2',
      rawBody: body,
      signature: signature(body),
    });

    expect(result).toEqual({ status: 'rejected', reason: 'permission_denied' });
    expect(taskStore.list({ tenantId: 'tenant-a', organizationId: 'org-a' })).toHaveLength(0);
  });

  it('ignores Council-generated comments so provider replies cannot recursively create work', async () => {
    const { service, resolveActor } = ingress();
    const body = raw(`${COUNCIL_GENERATED_MARKER}\n/ask all\nDo not recurse`);
    const result = await service.handle({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-3',
      rawBody: body,
      signature: signature(body),
    });

    expect(result).toEqual({ status: 'ignored', reason: 'generated_content' });
    expect(resolveActor).not.toHaveBeenCalled();
  });

  it('ignores discussion text that is not an explicit ATLAS command', async () => {
    const { service } = ingress();
    const body = raw('General community conversation');
    const result = await service.handle({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-4',
      rawBody: body,
      signature: signature(body),
    });

    expect(result).toEqual({ status: 'ignored', reason: 'no_command' });
  });

  it('links an implementation issue only inside the same tenant and organization scope', async () => {
    const { service, taskStore } = ingress();
    const body = raw();
    await service.handle({
      eventName: 'discussion_comment',
      deliveryId: 'delivery-1',
      rawBody: body,
      signature: signature(body),
    });

    const linked = taskStore.linkIssue(
      { tenantId: 'tenant-a', organizationId: 'org-a' },
      'task-1',
      123,
      () => '2026-09-10T04:01:00.000Z',
    );
    expect(linked?.linkedIssue).toBe(123);
    expect(taskStore.linkIssue(
      { tenantId: 'tenant-a', organizationId: 'org-b' },
      'task-1',
      999,
    )).toBeNull();
  });
});
