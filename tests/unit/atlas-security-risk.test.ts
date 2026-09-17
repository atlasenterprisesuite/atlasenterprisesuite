import { describe, expect, it } from 'vitest';
import { evaluateSecurityRisk } from '../../packages/security-protection/src';

describe('ATLAS security risk engine', () => {
  it('denies a revoked device even after passkey step-up', () => {
    const result = evaluateSecurityRisk({
      action: 'account.password.change',
      deviceStatus: 'revoked',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'low'
    });

    expect(result.decision).toBe('deny');
    expect(result.reasons).toContain('device_revoked');
  });

  it('denies a compromised device and a revoked session', () => {
    expect(evaluateSecurityRisk({
      action: 'api_key.create_privileged',
      deviceStatus: 'compromised',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'low'
    }).decision).toBe('deny');

    expect(evaluateSecurityRisk({
      action: 'api_key.create_privileged',
      deviceStatus: 'trusted',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: true,
      recentCriticalChange: false,
      riskLevel: 'low'
    }).decision).toBe('deny');
  });

  it('requires passkey step-up for a protected action', () => {
    const result = evaluateSecurityRisk({
      action: 'api_key.create_privileged',
      deviceStatus: 'trusted',
      passkeyVerified: false,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'low'
    });

    expect(result.decision).toBe('step_up');
    expect(result.requiredAssurance).toBe('passkey');
  });

  it('delays an account-critical change from an untrusted device after step-up', () => {
    const result = evaluateSecurityRisk({
      action: 'account.recovery.change',
      deviceStatus: 'untrusted',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'medium'
    });

    expect(result.decision).toBe('delay');
    expect(result.delaySeconds).toBe(3600);
    expect(result.reasons).toContain('untrusted_device');
  });

  it('delays a configured critical action on a high-risk trusted context', () => {
    const result = evaluateSecurityRisk({
      action: 'payout.destination.change',
      deviceStatus: 'trusted',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: true,
      riskLevel: 'high'
    });

    expect(result.decision).toBe('delay');
    expect(result.delaySeconds).toBe(3600);
    expect(result.reasons).toEqual(expect.arrayContaining(['high_risk_context', 'recent_critical_change']));
  });

  it('allows a protected action after fresh step-up in a low-risk trusted context', () => {
    const result = evaluateSecurityRisk({
      action: 'session.revoke_others',
      deviceStatus: 'trusted',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'low'
    });

    expect(result.decision).toBe('allow');
    expect(result.delaySeconds).toBeNull();
  });

  it('records unavailable provider signals as unknown instead of trusted evidence', () => {
    const result = evaluateSecurityRisk({
      action: 'account.password.change',
      deviceStatus: 'unknown',
      passkeyVerified: true,
      recoveryHold: false,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'low',
      networkReputation: 'unknown',
      locationConsistency: 'unknown',
      simEvidence: 'unknown'
    });

    expect(result.signalsUnknown).toEqual(expect.arrayContaining([
      'device_status',
      'network_reputation',
      'location_consistency',
      'sim_evidence'
    ]));
    expect(result.signalsUsed).not.toContain('network_reputation_positive');
  });

  it('denies destructive and administrative actions while recovery is held', () => {
    const result = evaluateSecurityRisk({
      action: 'admin.role.grant',
      deviceStatus: 'trusted',
      passkeyVerified: true,
      recoveryHold: true,
      sessionRevoked: false,
      recentCriticalChange: false,
      riskLevel: 'low'
    });

    expect(result.decision).toBe('deny');
    expect(result.reasons).toContain('recovery_hold');
  });
});
