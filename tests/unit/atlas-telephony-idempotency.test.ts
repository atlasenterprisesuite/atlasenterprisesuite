import { describe, expect, it } from 'vitest';
import {
  classifyIdempotentReplay,
  digestLogicalMutation,
  normalizeCallMutationInput
} from '../../supabase/functions/_shared/telephony-idempotency';

describe('ATLAS telephony idempotency', () => {
  it('normalizes semantically identical call inputs to the same digest', async () => {
    const a = normalizeCallMutationInput({
      to: ' +14075550100 ',
      purpose: ' Support call ',
      consent_reference: ' consent-1 '
    });
    const b = normalizeCallMutationInput({
      to: '+14075550100',
      purpose: 'Support call',
      consentReference: 'consent-1'
    });

    expect(a).toEqual(b);
    expect(await digestLogicalMutation(a)).toBe(await digestLogicalMutation(b));
    expect(await digestLogicalMutation(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('classifies new, reusable, conflicting and reconciliation-required requests', () => {
    expect(classifyIdempotentReplay({ existing: null, requestDigest: 'a'.repeat(64) })).toBe('new');
    expect(classifyIdempotentReplay({
      existing: { requestDigest: 'a'.repeat(64), reconciliationRequired: false },
      requestDigest: 'a'.repeat(64)
    })).toBe('reuse');
    expect(classifyIdempotentReplay({
      existing: { requestDigest: 'a'.repeat(64), reconciliationRequired: false },
      requestDigest: 'b'.repeat(64)
    })).toBe('conflict');
    expect(classifyIdempotentReplay({
      existing: { requestDigest: 'a'.repeat(64), reconciliationRequired: true },
      requestDigest: 'a'.repeat(64)
    })).toBe('reconciliation_required');
  });
});
