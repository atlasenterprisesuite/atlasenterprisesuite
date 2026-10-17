import { describe, expect, it } from 'vitest';
import { canonicalizeTrustAction, hashTrustAction } from '../../packages/trustpass/src';

describe('ATLAS TrustPass transaction binding', () => {
  it('canonicalizes equivalent object property orders identically', () => {
    const left = canonicalizeTrustAction({
      actionType: 'payout.destination.change',
      tenantId: 'org-a',
      resourceId: 'payout-1',
      payload: { routing: '021000021', accountLast4: '1234', nested: { b: 2, a: 1 } }
    });
    const right = canonicalizeTrustAction({
      resourceId: 'payout-1',
      tenantId: 'org-a',
      actionType: 'payout.destination.change',
      payload: { nested: { a: 1, b: 2 }, accountLast4: '1234', routing: '021000021' }
    });

    expect(left).toBe(right);
  });

  it('keeps tenant, action type, resource, and material payload separated', async () => {
    const base = {
      actionType: 'payout.destination.change',
      tenantId: 'org-a',
      resourceId: 'payout-1',
      payload: { accountLast4: '1234' }
    };

    const digest = await hashTrustAction(base);
    expect(await hashTrustAction({ ...base, tenantId: 'org-b' })).not.toBe(digest);
    expect(await hashTrustAction({ ...base, actionType: 'payroll.bank.change' })).not.toBe(digest);
    expect(await hashTrustAction({ ...base, resourceId: 'payout-2' })).not.toBe(digest);
    expect(await hashTrustAction({ ...base, payload: { accountLast4: '9876' } })).not.toBe(digest);
  });

  it('normalizes JSON-safe primitives and arrays deterministically', () => {
    const value = canonicalizeTrustAction({
      actionType: 'admin.policy.update',
      tenantId: 'org-a',
      resourceId: null,
      payload: { enabled: true, count: 3, note: null, labels: ['a', 'b'] }
    });

    expect(value).toContain('"enabled":true');
    expect(value).toContain('"count":3');
    expect(value).toContain('"note":null');
    expect(value).toContain('"labels":["a","b"]');
  });

  it('rejects unsupported values instead of silently changing the protected payload', () => {
    expect(() => canonicalizeTrustAction({
      actionType: 'admin.policy.update',
      tenantId: 'org-a',
      resourceId: null,
      payload: { unsafe: undefined }
    })).toThrow('unsupported_trust_action_value');
  });
});
