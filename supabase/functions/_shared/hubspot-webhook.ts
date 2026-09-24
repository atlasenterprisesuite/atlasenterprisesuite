const HUBSPOT_V3_MAX_AGE_MS = 5 * 60 * 1000;

const HUBSPOT_URI_DECODE: ReadonlyArray<[RegExp, string]> = [
  [/%3A/gi, ':'], [/%2F/gi, '/'], [/%3F/gi, '?'], [/%40/gi, '@'],
  [/%21/gi, '!'], [/%24/gi, '$'], [/%27/gi, "'"], [/%28/gi, '('],
  [/%29/gi, ')'], [/%2A/gi, '*'], [/%2C/gi, ','], [/%3B/gi, ';']
];

const OBJECT_TYPE_IDS: Readonly<Record<string, string>> = {
  '0-1': 'contact',
  '0-2': 'company',
  '0-3': 'deal',
  '0-5': 'ticket'
};

export type HubSpotWebhookEvent = {
  eventKey: string;
  providerEventId: string | null;
  providerAccountId: string;
  subscriptionType: string;
  providerObjectType: string | null;
  providerObjectId: string | null;
  propertyName: string | null;
  occurredAt: string | null;
};

function decodedHubSpotUri(value: string): string {
  let decoded = value;
  for (const [pattern, replacement] of HUBSPOT_URI_DECODE) {
    decoded = decoded.replace(pattern, replacement);
  }
  return decoded;
}

function constantTimeTextEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let index = 0; index < a.byteLength; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

async function hmacBase64(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  let binary = '';
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifyHubSpotV3Signature(input: {
  method: string;
  uri: string;
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  clientSecret: string;
  now?: number;
}): Promise<boolean> {
  const timestampNumber = Number(input.timestamp);
  const now = input.now ?? Date.now();
  if (!input.signature || !input.timestamp || !Number.isFinite(timestampNumber)) return false;
  if (Math.abs(now - timestampNumber) > HUBSPOT_V3_MAX_AGE_MS) return false;
  if (!input.clientSecret.trim()) return false;

  const source = `${input.method.toUpperCase()}${decodedHubSpotUri(input.uri)}${input.rawBody}${input.timestamp}`;
  const expected = await hmacBase64(input.clientSecret, source);
  return constantTimeTextEqual(expected, input.signature.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function occurredAt(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function objectType(body: Record<string, unknown>): string | null {
  const objectTypeId = text(body.objectTypeId);
  if (objectTypeId && OBJECT_TYPE_IDS[objectTypeId]) return OBJECT_TYPE_IDS[objectTypeId];

  const subscription = text(body.subscriptionType);
  if (!subscription) return null;
  const prefix = subscription.split('.')[0];
  return ['contact', 'company', 'deal', 'ticket'].includes(prefix) ? prefix : null;
}

export async function normalizeHubSpotWebhookEvents(rawBody: string): Promise<HubSpotWebhookEvent[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('invalid_webhook_json');
  }
  if (!Array.isArray(parsed)) throw new Error('invalid_webhook_shape');
  if (parsed.length > 1000) throw new Error('webhook_batch_too_large');

  const events: HubSpotWebhookEvent[] = [];
  for (const raw of parsed) {
    const body = asRecord(raw);
    if (!body) continue;
    const providerAccountId = text(body.portalId);
    const subscriptionType = text(body.subscriptionType);
    if (!providerAccountId || !subscriptionType) continue;

    const providerEventId = text(body.eventId);
    const providerObjectId = text(body.objectId);
    const propertyName = text(body.propertyName);
    const eventOccurredAt = occurredAt(body.occurredAt);
    const providerObjectType = objectType(body);
    const eventKey = await sha256Hex([
      providerAccountId,
      providerEventId ?? '',
      subscriptionType,
      providerObjectType ?? '',
      providerObjectId ?? '',
      propertyName ?? '',
      eventOccurredAt ?? ''
    ].join('|'));

    events.push({
      eventKey,
      providerEventId,
      providerAccountId,
      subscriptionType,
      providerObjectType,
      providerObjectId,
      propertyName,
      occurredAt: eventOccurredAt
    });
  }
  return events;
}
