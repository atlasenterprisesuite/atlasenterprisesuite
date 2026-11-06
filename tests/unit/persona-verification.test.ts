import { describe, expect, it } from 'vitest';
import { resolvePersonaInquiryEvent, verifyPersonaWebhookSignature } from '../../packages/compliance/persona';

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

describe('ATLAS Persona signature verification — negative boundary', () => {
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
  it('blocks delayed and future replays', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    for (const time of [timestamp - 301, timestamp + 301]) {
      expect(await verifyPersonaWebhookSignature({
        rawBody, signatureHeader: await sign(rawBody, secret, time), webhookSecret: secret, now
      })).toBe(false);
    }
  });
  it('accepts an active signature during secret rotation', async () => {
    const rawBody = eventBody('inquiry.approved', 'approved');
    expect(await verifyPersonaWebhookSignature({
      rawBody, signatureHeader: (await sign(rawBody, 'old-secret')) + ' ' + (await sign(rawBody)),
      webhookSecret: secret, now
    })).toBe(true);
  });
});

describe('ATLAS Persona signed inquiry decision — no automatic privilege', () => {
  it('only maps approved + approved to an identity-proofing approval', () => {
    expect(resolvePersonaInquiryEvent({
      rawBody: eventBody('inquiry.approved', 'approved'), ...binding
    }).decision).toBe('approved');
    expect(resolvePersonaInquiryEvent({
      rawBody: eventBody('inquiry.completed', 'completed'), ...binding
    }).decision).toBe('pending');
    expect(resolvePersonaInquiryEvent({
      rawBody: eventBody('inquiry.approved', 'completed'), ...binding
    }).decision).toBe('ignored');
    expect(resolvePersonaInquiryEvent({
      rawBody: eventBody('verification.passed', 'approved'), ...binding
    }).decision).toBe('ignored');
  });
  it('maps denial and review to non-approval states', () => {
    expect(resolvePersonaInquiryEvent({
      rawBody: eventBody('inquiry.declined', 'declined'), ...binding
    }).decision).toBe('rejected');
    expect(resolvePersonaInquiryEvent({
      rawBody: eventBody('inquiry.marked-for-review', 'needs-review'), ...binding
    }).decision).toBe('review');
  });
  it('rejects different subject, tenant inquiry, or verification template', () => {
    for (const substitute of [{ referenceId: 'other-subject' }, { inquiryId: 'inq_OTHER' },
      { templateId: 'itmpl_OTHER' }]) {
      expect(() => resolvePersonaInquiryEvent({
        rawBody: eventBody('inquiry.approved', 'approved', substitute), ...binding
      })).toThrow('persona_binding_mismatch');
    }
  });
  it('rejects malformed events and incomplete server-owned bindings', () => {
    expect(() => resolvePersonaInquiryEvent({
      rawBody: 'not-json', ...binding
    })).toThrow('persona_invalid_payload');
    expect(() => resolvePersonaInquiryEvent({
      rawBody: eventBody('inquiry.approved', 'approved'), ...binding, expectedReferenceId: ''
    })).toThrow('persona_binding_missing');
    expect(() => resolvePersonaInquiryEvent({
      rawBody: JSON.stringify({ data: { type: 'event' } }), ...binding
    })).toThrow('persona_invalid_payload');
  });
});
