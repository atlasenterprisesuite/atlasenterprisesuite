import { describe, expect, it } from 'vitest';
import {
  ATLAS_PROTECTED_ACTION_CODES,
  ATLAS_PROTECTED_ACTION_POLICY_V1,
  getProtectedActionPolicy,
  isProtectedActionCode
} from '../../packages/security-protection/src';

const expectedActions = [
  'account.password.change',
  'account.recovery.change',
  'account.passkey.remove',
  'account.protection.disable',
  'account.delete',
  'admin.role.grant',
  'admin.role.revoke',
  'payout.destination.change',
  'api_key.create_privileged',
  'api_key.revoke_privileged',
  'session.revoke_others',
  'device.trust',
  'device.revoke'
] as const;

const delayedActions = [
  'account.recovery.change',
  'account.passkey.remove',
  'account.protection.disable',
  'account.delete',
  'admin.role.grant',
  'payout.destination.change'
] as const;

describe('ATLAS protected action policy v1', () => {
  it('exposes the exact protected action catalog', () => {
    expect(ATLAS_PROTECTED_ACTION_CODES).toEqual(expectedActions);
    expect(ATLAS_PROTECTED_ACTION_POLICY_V1.version).toBe('security-protection-v1');
  });

  it('requires passkey assurance for every protected action', () => {
    for (const action of expectedActions) {
      expect(getProtectedActionPolicy(action).requiresPasskey).toBe(true);
    }
  });

  it('applies the exact delay boundaries to critical actions', () => {
    for (const action of delayedActions) {
      expect(getProtectedActionPolicy(action)).toMatchObject({
        delayOnUntrustedOrHighRisk: true,
        defaultDelaySeconds: 3600,
        minDelaySeconds: 900,
        maxDelaySeconds: 86400
      });
    }
  });

  it('does not delay protected actions outside the configured delayed set', () => {
    for (const action of expectedActions.filter((value) => !delayedActions.includes(value as typeof delayedActions[number]))) {
      const policy = getProtectedActionPolicy(action);
      expect(policy.delayOnUntrustedOrHighRisk).toBe(false);
      expect(policy.defaultDelaySeconds).toBeNull();
    }
  });

  it('rejects unknown action strings', () => {
    expect(isProtectedActionCode('account.password.change')).toBe(true);
    expect(isProtectedActionCode('finance.transfer.all')).toBe(false);
  });
});
