import { COUNCIL_GENERATED_MARKER } from '../../ai-council-core/src';

export type NormalizedDiscussionEvent = Readonly<{
  kind: 'discussion' | 'discussion_comment';
  deliveryId: string;
  repositoryId: string;
  repositoryFullName: string;
  discussionNodeId: string;
  discussionNumber: number;
  originNodeId: string;
  actorLogin: string;
  body: string;
}>;

export type GitHubWebhookInput = Readonly<{
  eventName: string;
  deliveryId: string;
  payload: unknown;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function requiredNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export async function verifyGitHubWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null | undefined,
): Promise<boolean> {
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;

  const signature = hexToBytes(signatureHeader.slice('sha256='.length));
  if (!signature || signature.length !== 32) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify('HMAC', key, signature, encoder.encode(rawBody));
  } catch {
    return false;
  }
}

export function normalizeDiscussionWebhook(
  input: GitHubWebhookInput,
): NormalizedDiscussionEvent | null {
  if (input.eventName !== 'discussion' && input.eventName !== 'discussion_comment') return null;

  const payload = asRecord(input.payload);
  if (!payload || payload.action !== 'created') return null;

  const repository = asRecord(payload.repository);
  const sender = asRecord(payload.sender);
  const discussion = asRecord(payload.discussion);
  const repositoryIdRaw = repository?.id;
  const repositoryId =
    typeof repositoryIdRaw === 'number' || typeof repositoryIdRaw === 'string'
      ? String(repositoryIdRaw)
      : null;
  const repositoryFullName = requiredString(repository, 'full_name');
  const actorLogin = requiredString(sender, 'login');
  const discussionNodeId = requiredString(discussion, 'node_id');
  const discussionNumber = requiredNumber(discussion, 'number');

  if (!repositoryId || !repositoryFullName || !actorLogin || !discussionNodeId || discussionNumber == null) {
    return null;
  }

  if (input.eventName === 'discussion_comment') {
    const comment = asRecord(payload.comment);
    const originNodeId = requiredString(comment, 'node_id');
    const body = requiredString(comment, 'body');
    if (!originNodeId || !body) return null;

    return Object.freeze({
      kind: 'discussion_comment' as const,
      deliveryId: input.deliveryId,
      repositoryId,
      repositoryFullName,
      discussionNodeId,
      discussionNumber,
      originNodeId,
      actorLogin,
      body,
    });
  }

  const originNodeId = discussionNodeId;
  const body = requiredString(discussion, 'body');
  if (!body) return null;

  return Object.freeze({
    kind: 'discussion' as const,
    deliveryId: input.deliveryId,
    repositoryId,
    repositoryFullName,
    discussionNodeId,
    discussionNumber,
    originNodeId,
    actorLogin,
    body,
  });
}

export class InMemoryCouncilDeliveryStore {
  private readonly deliveries = new Set<string>();

  claim(deliveryId: string): boolean {
    if (!deliveryId || this.deliveries.has(deliveryId)) return false;
    this.deliveries.add(deliveryId);
    return true;
  }

  has(deliveryId: string): boolean {
    return this.deliveries.has(deliveryId);
  }
}

export function formatCouncilDiscussionReply(input: {
  taskId: string;
  provider?: string;
  status: string;
  body: string;
}): string {
  const lines = [
    COUNCIL_GENERATED_MARKER,
    `ATLAS Task: \`${input.taskId}\``,
    ...(input.provider ? [`Provider: \`${input.provider}\``] : []),
    `Status: \`${input.status}\``,
    '',
    input.body.trim(),
  ];

  return lines.join('\n');
}

export type GitHubDiscussionWriteClient = {
  addDiscussionComment(input: {
    discussionNodeId: string;
    body: string;
    replyToNodeId?: string;
  }): Promise<{ commentNodeId: string; url: string }>;
  createIssue(input: {
    repositoryFullName: string;
    title: string;
    body: string;
  }): Promise<{ issueNumber: number; url: string }>;
};

export function createGitHubDiscussionsAdapter(options: {
  client: GitHubDiscussionWriteClient;
}) {
  return Object.freeze({
    async publishReply(input: {
      discussionNodeId: string;
      replyToNodeId?: string;
      taskId: string;
      provider?: string;
      status: string;
      body: string;
    }) {
      return options.client.addDiscussionComment({
        discussionNodeId: input.discussionNodeId,
        ...(input.replyToNodeId ? { replyToNodeId: input.replyToNodeId } : {}),
        body: formatCouncilDiscussionReply({
          taskId: input.taskId,
          ...(input.provider ? { provider: input.provider } : {}),
          status: input.status,
          body: input.body,
        }),
      });
    },

    async createImplementationIssue(input: {
      repositoryFullName: string;
      taskId: string;
      title: string;
      body: string;
    }) {
      return options.client.createIssue({
        repositoryFullName: input.repositoryFullName,
        title: `[ATLAS ${input.taskId}] ${input.title}`,
        body: `ATLAS Task: \`${input.taskId}\`\n\n${input.body}`,
      });
    },
  });
}

export * from './ingress';
