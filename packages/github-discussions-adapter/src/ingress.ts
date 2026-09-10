import {
  createCouncilTask,
  hasCouncilPermission,
  isCouncilGeneratedContent,
  parseCouncilCommand,
  transitionCouncilTask,
  type CouncilActor,
  type CouncilCommand,
  type CouncilPermission,
  type CouncilTask,
} from '../../ai-council-core/src';
import { sameScope, type TenantScope } from '../../core/src';
import {
  InMemoryCouncilDeliveryStore,
  normalizeDiscussionWebhook,
  verifyGitHubWebhookSignature,
  type NormalizedDiscussionEvent,
} from './index';

export type CouncilActorResolver = (
  event: NormalizedDiscussionEvent,
) => Promise<CouncilActor | null>;

export class InMemoryCouncilTaskStore {
  private readonly tasks = new Map<string, CouncilTask>();

  save(task: CouncilTask): CouncilTask {
    if (this.tasks.has(task.taskId)) throw new Error(`AI Council task already exists: ${task.taskId}`);
    this.tasks.set(task.taskId, task);
    return task;
  }

  get(scope: TenantScope, taskId: string): CouncilTask | null {
    const task = this.tasks.get(taskId);
    return task && sameScope(scope, task) ? task : null;
  }

  list(scope: TenantScope): CouncilTask[] {
    return [...this.tasks.values()].filter((task) => sameScope(scope, task));
  }

  linkIssue(
    scope: TenantScope,
    taskId: string,
    issueNumber: number,
    now: () => string = () => new Date().toISOString(),
  ): CouncilTask | null {
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error('Issue number must be a positive integer');
    const task = this.get(scope, taskId);
    if (!task) return null;
    const next = Object.freeze({ ...task, linkedIssue: issueNumber, updatedAt: now() });
    this.tasks.set(taskId, next);
    return next;
  }
}

export type CouncilDiscussionIngressResult =
  | Readonly<{ status: 'accepted'; task: CouncilTask; event: NormalizedDiscussionEvent }>
  | Readonly<{ status: 'duplicate'; deliveryId: string }>
  | Readonly<{ status: 'ignored'; reason: 'unsupported_event' | 'generated_content' | 'no_command' }>
  | Readonly<{
      status: 'rejected';
      reason: 'invalid_signature' | 'malformed_payload' | 'actor_unmapped' | 'permission_denied';
    }>;

function permissionForCommand(command: CouncilCommand): CouncilPermission {
  switch (command.kind) {
    case 'status':
      return 'ai_council.read';
    case 'consensus':
      return 'ai_council.consensus';
    case 'delegate':
    case 'implement':
      return 'ai_council.delegate';
    case 'ask':
    case 'review':
      return 'ai_council.invoke';
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPrompt(prompt: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prompt));
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

export function createCouncilDiscussionIngress(options: {
  webhookSecret: string;
  taskStore: InMemoryCouncilTaskStore;
  deliveryStore: InMemoryCouncilDeliveryStore;
  resolveActor: CouncilActorResolver;
  now?: () => string;
  taskId?: () => string;
}) {
  const now = options.now ?? (() => new Date().toISOString());
  const taskId = options.taskId ?? (() => `ai-task-${crypto.randomUUID()}`);

  return Object.freeze({
    async handle(input: {
      eventName: string;
      deliveryId: string;
      rawBody: string;
      signature: string | null | undefined;
    }): Promise<CouncilDiscussionIngressResult> {
      const signatureValid = await verifyGitHubWebhookSignature(
        options.webhookSecret,
        input.rawBody,
        input.signature,
      );
      if (!signatureValid) return Object.freeze({ status: 'rejected', reason: 'invalid_signature' });

      let payload: unknown;
      try {
        payload = JSON.parse(input.rawBody) as unknown;
      } catch {
        return Object.freeze({ status: 'rejected', reason: 'malformed_payload' });
      }

      const event = normalizeDiscussionWebhook({
        eventName: input.eventName,
        deliveryId: input.deliveryId,
        payload,
      });
      if (!event) return Object.freeze({ status: 'ignored', reason: 'unsupported_event' });

      if (!options.deliveryStore.claim(event.deliveryId)) {
        return Object.freeze({ status: 'duplicate', deliveryId: event.deliveryId });
      }

      if (isCouncilGeneratedContent(event.body)) {
        return Object.freeze({ status: 'ignored', reason: 'generated_content' });
      }

      const command = parseCouncilCommand(event.body);
      if (!command) return Object.freeze({ status: 'ignored', reason: 'no_command' });

      const actor = await options.resolveActor(event);
      if (!actor) return Object.freeze({ status: 'rejected', reason: 'actor_unmapped' });

      const requiredPermission = permissionForCommand(command);
      if (!hasCouncilPermission(actor.permissions, requiredPermission)) {
        return Object.freeze({ status: 'rejected', reason: 'permission_denied' });
      }

      const received = createCouncilTask(
        {
          tenantId: actor.tenantId,
          organizationId: actor.organizationId,
          repositoryId: event.repositoryId,
          discussionId: event.discussionNodeId,
          originCommentId: event.originNodeId,
          requestingActor: actor.userId,
          command,
          promptHash: await hashPrompt(event.body),
          promptSnapshot: event.body,
        },
        { id: taskId, now },
      );
      const authorized = transitionCouncilTask(received, 'authorized', now);
      options.taskStore.save(authorized);

      return Object.freeze({ status: 'accepted', task: authorized, event });
    },
  });
}
