import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignedTransactionEnvelope } from '../../supabase/functions/_shared/pay-transaction-signature';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const secret = 'ATLAS-TEST-ONLY-HMAC-SECRET-32-CHARACTERS';
const ts = 1791800000;
const event = {
  provider_event_id: 'event-hotel-123',
  account_id: '11111111-1111-4111-8111-111111111111',
  transaction_reference: 'hotel-authorization-abc',
  event_kind: 'authorization',
  amount_minor_text: '10000',
  currency: 'USD',
  observed_at: '2026-10-12T09:00:00Z'
};

async function signed(body = JSON.stringify(event), timestamp = ts) {
  const key = await subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  return { rawBody: body, timestamp: String(timestamp), signature: [...new Uint8Array(signature)].map(x => x.toString(16).padStart(2, '0')).join('') };
}

async function verify(input: Awaited<ReturnType<typeof signed>>, nowUnixSeconds = ts) {
  return verifySignedTransactionEnvelope({ ...input, secret, nowUnixSeconds, subtle });
}

describe('ATLAS Pay signed transaction ingress — Day 2', () => {
  it('accepts fresh authenticated evidence with bounded numeric fields and a digest', async () => {
    const x = await verify(await signed());
    expect(x).toMatchObject({ ok: true, event: { ...event, amountMinor: 10000n } });
    if (x.ok) expect(x.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects tampered payloads, wrong secrets and forged signatures', async () => {
    const x = await signed();
    expect((await verify({ ...x, rawBody: x.rawBody.replace('10000', '90000') })).ok).toBe(false);
    expect((await verifySignedTransactionEnvelope({ ...x, secret: 'a-different-secret-with-at-least-32-chars', nowUnixSeconds: ts, subtle })).ok).toBe(false);
    expect((await verify({ ...x, signature: '0'.repeat(64) })).ok).toBe(false);
  });

  it('enforces transport replay window and rejects missing configuration', async () => {
    expect((await verify(await signed(undefined, ts - 301))).ok).toBe(false);
    expect((await verify(await signed(undefined, ts + 301))).ok).toBe(false);
    const x = await signed();
    expect((await verifySignedTransactionEnvelope({ ...x, secret: '', nowUnixSeconds: ts, subtle })).ok).toBe(false);
  });

  it('rejects malformed body, wrong amounts, PII-like identifiers and arbitrary event types', async () => {
    for (const e of [
      { ...event, amount_minor_text: '0' },
      { ...event, amount_minor_text: '-1' },
      { ...event, amount_minor_text: '1e4' },
      { ...event, amount_minor_text: '9223372036854775808' },
      { ...event, account_id: 'not-a-uuid' },
      { ...event, event_kind: 'refund' },
      { ...event, currency: 'usd' },
      { ...event, transaction_reference: '   ' },
      { ...event, org_id: 'claimed-tenant' },
      { ...event, observed_at: 'tomorrow' }
    ]) {
      const x = await signed(JSON.stringify(e));
      expect((await verify(x)).ok, JSON.stringify(e)).toBe(false);
    }
  });

  it('rejects oversized requests and hex signature attacks', async () => {
    const x = await signed();
    expect((await verify({ ...x, rawBody: 'x'.repeat(65537) })).ok).toBe(false);
    expect((await verify({ ...x, signature: 'ffff' })).ok).toBe(false);
  });
});
