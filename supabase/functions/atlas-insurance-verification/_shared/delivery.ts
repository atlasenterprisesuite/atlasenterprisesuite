import { insuranceError } from './errors.ts';

const EMAIL_WEBHOOK_URL = Deno.env.get('ATLAS_INSURANCE_EMAIL_WEBHOOK_URL') || '';
const EMAIL_WEBHOOK_TOKEN = Deno.env.get('ATLAS_INSURANCE_EMAIL_WEBHOOK_TOKEN') || '';

export function maskEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '';
  const visible = local.slice(0, Math.min(1, local.length));
  return `${visible}${'*'.repeat(Math.max(3, Math.min(8, local.length - visible.length)))}@${domain}`;
}

function configuredWebhook() {
  if (!EMAIL_WEBHOOK_URL || !EMAIL_WEBHOOK_TOKEN) {
    throw insuranceError('delivery_not_configured', 503);
  }
  let parsed: URL;
  try {
    parsed = new URL(EMAIL_WEBHOOK_URL);
  } catch {
    throw insuranceError('delivery_not_configured', 503);
  }
  if (parsed.protocol !== 'https:') throw insuranceError('delivery_not_configured', 503);
  return parsed.toString();
}

export async function deliverVerificationCode(input: {
  email: string;
  code: string;
  expiresInSeconds: number;
}) {
  const target = input.email.trim();
  if (!target || !target.includes('@')) throw insuranceError('delivery_not_configured', 503);
  const endpoint = configuredWebhook();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${EMAIL_WEBHOOK_TOKEN}`,
        'content-type': 'application/json',
        'cache-control': 'no-store'
      },
      body: JSON.stringify({
        to: target,
        template: 'atlas-insurance-verification',
        code: input.code,
        expires_in_seconds: input.expiresInSeconds
      }),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw insuranceError('delivery_failed', 502);
  }

  if (!response.ok) throw insuranceError('delivery_failed', 502);
}
