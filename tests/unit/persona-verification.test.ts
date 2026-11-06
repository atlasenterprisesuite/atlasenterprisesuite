import { describe, expect, it } from 'vitest';
import { verifyAndResolvePersonaInquiryEvent, verifyPersonaWebhookSignature } from '../../packages/compliance/persona';

const now = new Date('2026-11-06T12:00:00.000Z');
const timestamp = Math.floor(now.getTime() / 1000);
const secret = 'synthetic-persona-test-secret';
const binding = {
  expectedInquiryId: 'inq_ATLAS_TEST',
  expectedReferenceId: 'atlas-subject-17',
  expectedTemplateId: 'itmpl_ATLAS_TEST'
};
function eventBody(name: string, status: string, substitute: Record<string, string> = {}) {
  return JSON.stringify({ data: { type: 'event', id: 'evt_TEST_1', attributes: {
    name, 'created-at': now.toISOString(), payload: { data: { type: 'inquiry',
      id: substitute.inquiryId ?? binding.expectedInquiryId,
      attributes: { status, 'reference-id': substitute.referenceId ?? binding.expectedReferenceId },
      relationships: { 'inquiry-template': {
        data: { type: 'inquiry-template', id: substitute.templateId ?? binding.expectedTemplateId }
      } }
    } }
  } } });
}
async function sign(body: string, key = secret, time = timestamp) {
  const signingKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', signingKey,
    new TextEncoder().encode(String(time) + '.' + body)));
  return 't=' + time + ',v1=' +
    Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
async function verified(rawBody: string, overrides: Partial<typeof binding> = {}, signatureHeader?: string | null) {
  return verifyAndResolvePersonaInquiryEvent({
    rawBody, signatureHeader: signatureHeader === undefined ? await sign(rawBody) : signatureHeader,
    webhookSecret: secret, now, ...binding, ...overrides
  });
}

describe('ATLAS Persona HMAC — negative boundary', () => {
  it('accepts a correct HMAC on untouched raw body', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    expect(await verifyPersonaWebhookSignature({
      rawBody, signatureHeader: await sign(rawBody), webhookSecret: secret, now
    })).toBe(true);
  });
  it('fails closed for missing, forged and tampered signatures', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    const header = await sign(rawBody);
    for (const signatureHeader of [null, '', 't=1,v1=bogus']) {
      expect(await verifyPersonaWebhookSignature({
        rawBody, signatureHeader, webhookSecret: secret, now
      })).toBe(false);
    }
    expect(await verifyPersonaWebhookSignature({
      rawBody: rawBody + ' ', signatureHeader: header, webhookSecret: secret, now
    })).toBe(false);
    expect(await verifyPersonaWebhookSignature({
      rawBody, signatureHeader: header, webhookSecret: '', now
    })).toBe(false);
  });
  it('blocks delayed and future replay attempts', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    for (const time of [timestamp - 301, timestamp + 301]) {
      expect(await verifyPersonaWebhookSignature({
        rawBody, signatureHeader: await sign(rawBody, secret, time), webhookSecret: secret, now
      })).toBe(false);
    }
  });
  it('accepts the active HMAC during a signing-secret rotation', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    expect(await verifyPersonaWebhookSignature({
      rawBody, signatureHeader: (await sign(rawBody, 'old-secret')) + ' ' + (await sign(rawBody)),
      webhookSecret: secret, now
    })).toBe(true);
  });
});

describe('ATLAS Persona verdict requires a verified signature in the same call', () => {
  it('returns an approved proofing event only from a correctly signed matching inquiry', async () => {
    const approved = await verified(eventBody('inquiry.approved', 'approved'));
    expect(approved.decision).toBe('approved');
    expect(approved.inquiryId).toBe(binding.expectedInquiryId);
    expect(approved.eventId).toBe('evt_TEST_1');
  });
  it('never maps completed, unrelated, or conflicting states to approved', async () => {
    expect((await verified(eventBody('inquiry.completed', 'completed'))).decision).toBe('pending');
    expect((await verified(eventBody('inquiry.approved', 'completed'))).decision).toBe('ignored');
    expect((await verified(eventBody('verification.passed', 'approved'))).decision).toBe('ignored');
  });
  it('maps denied and review results without privileged side effects', async () => {
    expect((await verified(eventBody('inquiry.declined', 'declined'))).decision).toBe('rejected');
    expect((await verified(eventBody('inquiry.marked-for-review', 'needs-review'))).decision).toBe('review');
  });
  it('rejects a plausible fake approval when unsigned or signed with an attacker key', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    await expect(verified(rawBody, {}, null)).rejects.toThrow('persona_signature_invalid');
    await expect(verified(rawBody, {}, await sign(rawBody, 'forged-secret')))
      .rejects.toThrow('persona_signature_invalid');
    await expect(verified(rawBody, {}, '')).rejects.toThrow('persona_signature_invalid');
  });
  it('rejects a body edited after its approval signature was computed', async () => {
    const original = eventBody('inquiry.completed', 'completed');
    const modified = eventBody('inquiry.approved', 'approved');
    await expect(verified(modified, {}, await sign(original))).rejects.toThrow('persona_signature_invalid');
  });
  it('rejects cross-subject, cross-inquiry, and cross-template swaps even with valid signatures', async () => {
    for (const substitute of [{ referenceId: 'other-subject' }, { inquiryId: 'inq_OTHER' },
      { templateId: 'itmpl_OTHER' }]) {
      await expect(verified(eventBody('inquiry.approved', 'approved', substitute)))
        .rejects.toThrow('persona_binding_mismatch');
    }
  });
  it('rejects malformed events and incomplete server-owned bindings', async () => {
    await expect(verified('not-json')).rejects.toThrow('persona_invalid_payload');
    await expect(verified(eventBody('inquiry.approved', 'approved'), { expectedReferenceId: '' }))
      .rejects.toThrow('persona_binding_missing');
    await expect(verified(JSON.stringify({ data: { type: 'event' } })))
      .rejects.toThrow('persona_invalid_payload');
  });
});