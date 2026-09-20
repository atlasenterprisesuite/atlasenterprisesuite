import { createHmac, timingSafeEqual } from 'node:crypto';

export const supportedGitHubWebhookEvents = new Set([
  'ping',
  'installation',
  'installation_repositories',
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'push',
  'check_run',
  'check_suite',
  'workflow_run',
  'deployment',
  'deployment_status',
] as const);

export type GitHubWebhookEnvelope = {
  deliveryId: string;
  event: string;
  action: string | null;
  installationId: number | null;
  repository: string | null;
  payload: Record<string, unknown>;
};

export class GitHubWebhookError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'GitHubWebhookError';
    this.status = status;
    this.code = code;
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function verifyGitHubWebhookSignature(
  secret: string,
  signature: string | undefined,
  body: Buffer,
): boolean {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret || !signature || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;

  const expected = `sha256=${createHmac('sha256', normalizedSecret).update(body).digest('hex')}`;
  const suppliedBytes = Buffer.from(signature, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');

  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}

export function ingestGitHubWebhook(input: {
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  secret: string | undefined;
}): GitHubWebhookEnvelope {
  const secret = String(input.secret || '').trim();
  if (!secret) throw new GitHubWebhookError(503, 'github_webhook_secret_not_configured');

  const deliveryId = firstHeader(input.headers['x-github-delivery'])?.trim();
  const event = firstHeader(input.headers['x-github-event'])?.trim();
  const signature = firstHeader(input.headers['x-hub-signature-256'])?.trim();

  if (!deliveryId) throw new GitHubWebhookError(400, 'github_delivery_id_required');
  if (!event) throw new GitHubWebhookError(400, 'github_event_required');
  if (!verifyGitHubWebhookSignature(secret, signature, input.body)) {
    throw new GitHubWebhookError(401, 'github_webhook_signature_invalid');
  }
  if (!supportedGitHubWebhookEvents.has(event as never)) {
    throw new GitHubWebhookError(422, 'github_webhook_event_not_allowed');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body.toString('utf8'));
  } catch {
    throw new GitHubWebhookError(400, 'github_webhook_payload_invalid_json');
  }
  if (!isRecord(parsed)) throw new GitHubWebhookError(400, 'github_webhook_payload_invalid');

  const action = typeof parsed.action === 'string' ? parsed.action : null;
  const installation = isRecord(parsed.installation) ? parsed.installation : null;
  const repository = isRecord(parsed.repository) ? parsed.repository : null;

  return {
    deliveryId,
    event,
    action,
    installationId: typeof installation?.id === 'number' ? installation.id : null,
    repository: typeof repository?.full_name === 'string' ? repository.full_name : null,
    payload: parsed,
  };
}
