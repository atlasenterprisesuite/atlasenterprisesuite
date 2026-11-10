/**
 * ATLAS Financial OS Day 2 — shared server-only HMAC envelope verification.
 *
 * This verifies ATLAS's canonical INTERNAL adapter transport. It is NOT a
 * Chime, Stripe, Plaid, card-network or bank webhook signature scheme.
 * A separately approved provider adapter must authenticate native provider
 * messages before translating them into this envelope.
 * Do not import into the browser or accept a client verification flag.
 */
export type SignedTransactionEvent = {
  provider_event_id: string;
  account_id: string;
  transaction_reference: string;
  event_kind: 'authorization' | 'posting' | 'release';
  amount_minor_text: string;
  amountMinor: bigint;
  currency: string;
  observed_at: string;
};

export type SignedTransactionResult =
  | { ok: true; event: SignedTransactionEvent; payloadSha256: string }
  | { ok: false; reason: 'not_configured' | 'invalid_timestamp' | 'expired' | 'invalid_signature' | 'invalid_payload' };

export type SignedTransactionInput = {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
  nowUnixSeconds: number;
  subtle?: SubtleCrypto;
};

const encoder = new TextEncoder();
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_MINOR = 9223372036854775807n;
const MAX_SIZE = 65536;
const MAX_SKEW_SECONDS = 300;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function reject(reason: Exclude<SignedTransactionResult, { ok: true }>['reason']): SignedTransactionResult {
  return { ok: false, reason };
}

function parseEvent(rawBody: string): SignedTransactionEvent | null {
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const value = body as Record<string, unknown>;
  // Organization and provider binding MUST come from the trusted server config.
  if ('org_id' in value || 'organization_id' in value || 'provider_connection_id' in value) return null;

  const id = value.provider_event_id;
  const accountId = value.account_id;
  const ref = value.transaction_reference;
  const kind = value.event_kind;
  const amountText = value.amount_minor_text;
  const currency = value.currency;
  const observed = value.observed_at;

  if (typeof id !== 'string' || id.trim() !== id || !id || id.length > 200
    || typeof accountId !== 'string' || !UUID_PATTERN.test(accountId)
    || typeof ref !== 'string' || ref.trim() !== ref || !ref || ref.length > 240
    || (kind !== 'authorization' && kind !== 'posting' && kind !== 'release')
    || typeof amountText !== 'string' || !/^[1-9]\d{0,18}$/.test(amountText)
    || typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)
    || typeof observed !== 'string' || !DATE_PATTERN.test(observed)
    || !Number.isFinite(Date.parse(observed))) return null;

  const amountMinor = BigInt(amountText);
  if (amountMinor > MAX_MINOR) return null;

  return {
    provider_event_id: id,
    account_id: accountId,
    transaction_reference: ref,
    event_kind: kind,
    amount_minor_text: amountText,
    amountMinor,
    currency,
    observed_at: observed
  };
}

/**
 * HMAC-SHA256(t + '.' + rawBody), lowercase hex, five-minute timestamp window.
 * SHA-256 digest is solely an immutable evidence fingerprint, not a signature.
 * Database uniqueness remains essential to reject in-window and later replay.
 */
export async function verifySignedTransactionEnvelope(input: SignedTransactionInput): Promise<SignedTransactionResult> {
  const { rawBody, timestamp, signature, secret, nowUnixSeconds } = input;
  const subtle = input.subtle ?? globalThis.crypto?.subtle;

  if (!subtle || secret.length < 32) return reject('not_configured');
  const size = encoder.encode(rawBody).byteLength;
  if (size === 0 || size > MAX_SIZE) return reject('invalid_payload');
  if (!/^\d{10,11}$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp))
    || !Number.isSafeInteger(nowUnixSeconds)) return reject('invalid_timestamp');
  if (Math.abs(nowUnixSeconds - Number(timestamp)) > MAX_SKEW_SECONDS) return reject('expired');
  if (!SIGNATURE_PATTERN.test(signature)) return reject('invalid_signature');

  try {
    const key = await subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signatureBytes = new Uint8Array(signature.match(/../g)!.map((x) => Number.parseInt(x, 16)));
    const authenticated = await subtle.verify('HMAC', key, signatureBytes, encoder.encode(`${timestamp}.${rawBody}`));
    if (!authenticated) return reject('invalid_signature');
    const event = parseEvent(rawBody);
    if (!event) return reject('invalid_payload');
    const hash = await subtle.digest('SHA-256', encoder.encode(rawBody));
    return { ok: true, event, payloadSha256: hex(new Uint8Array(hash)) };
  } catch {
    return reject('invalid_signature');
  }
}
