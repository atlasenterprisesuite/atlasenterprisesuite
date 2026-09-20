import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GitHubWebhookError,
  ingestGitHubWebhook,
  verifyGitHubWebhookSignature,
} from '../../apps/atlas-orchestrator/src/webhooks/github';

const secret = "It's a Secret to Everybody";

function sign(body: Buffer): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('ATLAS GitHub App webhook boundary', () => {
  it('matches the official GitHub HMAC-SHA256 test vector', () => {
    const body = Buffer.from('Hello, World!', 'utf8');
    expect(sign(body)).toBe('sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17');
    expect(verifyGitHubWebhookSignature(secret, sign(body), body)).toBe(true);
  });

  it('rejects missing secrets and invalid signatures fail-closed', () => {
    const body = Buffer.from('{}');
    expect(() => ingestGitHubWebhook({
      headers: {
        'x-github-delivery': 'delivery-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': sign(body),
      },
      body,
      secret: '',
    })).toThrowError(GitHubWebhookError);

    expect(() => ingestGitHubWebhook({
      headers: {
        'x-github-delivery': 'delivery-1',
        'x-github-event': 'ping',
        'x-hub-signature-256': 'sha256=' + '0'.repeat(64),
      },
      body,
      secret,
    })).toThrow(/github_webhook_signature_invalid/);
  });

  it('requires the delivery id and rejects unsubscribed events', () => {
    const body = Buffer.from('{}');
    expect(() => ingestGitHubWebhook({
      headers: {
        'x-github-event': 'ping',
        'x-hub-signature-256': sign(body),
      },
      body,
      secret,
    })).toThrow(/github_delivery_id_required/);

    expect(() => ingestGitHubWebhook({
      headers: {
        'x-github-delivery': 'delivery-2',
        'x-github-event': 'repository_vulnerability_alert',
        'x-hub-signature-256': sign(body),
      },
      body,
      secret,
    })).toThrow(/github_webhook_event_not_allowed/);
  });

  it('normalizes trusted event metadata without authorizing execution', () => {
    const body = Buffer.from(JSON.stringify({
      action: 'opened',
      installation: { id: 12345 },
      repository: { full_name: 'atlasenterprisesuite/atlasenterprisesuite' },
      issue: { number: 103 },
    }));

    expect(ingestGitHubWebhook({
      headers: {
        'x-github-delivery': 'delivery-3',
        'x-github-event': 'issues',
        'x-hub-signature-256': sign(body),
      },
      body,
      secret,
    })).toMatchObject({
      deliveryId: 'delivery-3',
      event: 'issues',
      action: 'opened',
      installationId: 12345,
      repository: 'atlasenterprisesuite/atlasenterprisesuite',
    });
  });
});
