/**
 * ATLAS 777 REVIEW — Persona identity-proofing adapter.
 * Does not authenticate ATLAS users, grant permissions or store PII.
 * Only call resolvePersonaInquiryEvent after checking the raw-body HMAC.
 */
export type PersonaDecision = 'approved' | 'rejected' | 'review' | 'pending' | 'ignored';
export interface PersonaVerifiedEvent {
  eventId: string; inquiryId: string; referenceId: string; templateId: string;
  eventName: string; decision: PersonaDecision; occurredAt: string;
}

const encoder = new TextEncoder();
const MAX_BODY_BYTES = 256 * 1024;
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function hexBytes(hex: string): Uint8Array {
  const output = new Uint8Array(hex.length / 2);
  for (let i = 0; i < output.length; i++) {
    output[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return output;
}

/** Validates the HMAC on the unmodified body, timestamps and rotated signatures. */
export async function verifyPersonaWebhookSignature(input: {
  rawBody: string; signatureHeader: string | null; webhookSecret: string; now?: Date;
}): Promise<boolean> {
  const { rawBody, signatureHeader, webhookSecret } = input;
  if (!text(webhookSecret) || !text(signatureHeader)) return false;
  const body = encoder.encode(rawBody);
  if (!body.byteLength || body.byteLength > MAX_BODY_BYTES) return false;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  if (!Number.isFinite(nowSeconds)) return false;
  const pairs = signatureHeader.trim().split(/\s+/);
  if (pairs.length > 8) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  for (const pair of pairs) {
    const match = /^t=(\d{1,12}),v1=([a-fA-F0-9]{64})$/.exec(pair);
    if (!match) continue;
    const timestamp = Number(match[1]);
    if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) continue;
    if (await crypto.subtle.verify('HMAC', key, hexBytes(match[2]),
      encoder.encode(match[1] + '.' + rawBody))) return true;
  }
  return false;
}

/** Bind a *signed* Persona inquiry to an existing ATLAS server-owned record.
 * Consumer MUST enforce tenant-scoped lookup, atomic idempotency and audit.
 */
export function resolvePersonaInquiryEvent(input: {
  rawBody: string; expectedInquiryId: string;
  expectedReferenceId: string; expectedTemplateId: string;
}): PersonaVerifiedEvent {
  if (!input.expectedInquiryId || !input.expectedReferenceId || !input.expectedTemplateId) {
    throw new Error('persona_binding_missing');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(input.rawBody); }
  catch { throw new Error('persona_invalid_payload'); }
  const event = record(record(parsed)?.data);
  const attributes = record(event?.attributes);
  const inquiry = record(record(attributes?.payload)?.data);
  const inquiryAttributes = record(inquiry?.attributes);
  const template = record(record(record(inquiry?.relationships)?.['inquiry-template'])?.data);
  const eventId = event?.id;
  const inquiryId = inquiry?.id;
  const referenceId = inquiryAttributes?.['reference-id'];
  const templateId = template?.id;
  const eventName = attributes?.name;
  const occurredAt = attributes?.['created-at'];
  const status = inquiryAttributes?.status;
  if (event?.type !== 'event' || !text(eventId) || !eventId.startsWith('evt_') ||
      inquiry?.type !== 'inquiry' || !text(inquiryId) || !inquiryId.startsWith('inq_') ||
      !text(referenceId) || !text(templateId) || !text(eventName) ||
      !text(occurredAt) || !Number.isFinite(Date.parse(occurredAt))) {
    throw new Error('persona_invalid_payload');
  }
  if (inquiryId !== input.expectedInquiryId || referenceId !== input.expectedReferenceId ||
      templateId !== input.expectedTemplateId) throw new Error('persona_binding_mismatch');

  // Completed is NOT approved; never trust the browser's onComplete callback.
  let decision: PersonaDecision = 'ignored';
  if (eventName === 'inquiry.approved' && status === 'approved') decision = 'approved';
  else if ((eventName === 'inquiry.declined' && status === 'declined') ||
    (eventName === 'inquiry.failed' && status === 'failed')) decision = 'rejected';
  else if (eventName === 'inquiry.marked-for-review' &&
    (status === 'needs-review' || status === 'pending')) decision = 'review';
  else if (eventName === 'inquiry.completed' && status === 'completed') decision = 'pending';
  return { eventId, inquiryId, referenceId, templateId, eventName, decision, occurredAt };
}
