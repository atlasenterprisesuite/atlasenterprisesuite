import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROVIDER_READINESS_TTL_MS,
  evaluateCapabilityPolicy
} from '../../packages/execution/src/capability-policy';
import { resolveCapability } from '../../packages/execution/src/capability-registry';
import type { ExecutionActor } from '../../packages/execution/src/types';

const actor: ExecutionActor = {
  userId: 'user-1',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  permissions: ['communication.telephony.read', 'communication.telephony.call', 'communication.telephony.provision']
};

const now = '2026-10-04T14:30:00.000Z';
const fresh = '2026-10-04T14:29:00.000Z';

function context(overrides: Record<string, unknown> = {}) {
  return {
    actor,
    environment: 'production',
    approved: true,
    runtimeProviderStates: {
      telnyx: { state: 'verified' as const, verifiedAt: fresh }
    },
    now,
    ...overrides
  };
}

describe('ATLAS capability policy', () => {
  it('evaluates permission before environment/provider selection', () => {
    const decision = evaluateCapabilityPolicy('communications.voice.call.create', context({
      actor: { ...actor, permissions: [] },
      environment: 'invalid',
      runtimeProviderStates: {}
    }));
    expect(decision).toMatchObject({ allowed: false, blocker: 'missing_permission:communication.telephony.call' });
  });

  it('blocks disallowed environments before provider state', () => {
    const decision = evaluateCapabilityPolicy('communications.number.provision.test', context({
      environment: 'production',
      runtimeProviderStates: {}
    }));
    expect(decision).toMatchObject({ allowed: false, blocker: 'environment_not_allowed' });
  });

  it('requires approval before selecting a provider', () => {
    const decision = evaluateCapabilityPolicy('communications.number.provision.test', context({
      environment: 'test',
      approved: false
    }));
    expect(decision).toMatchObject({ allowed: false, blocker: 'approval_required' });
  });

  it('allows server-internal verification without a provider binding', () => {
    const decision = evaluateCapabilityPolicy('communications.webhook.verify', context({
      runtimeProviderStates: {}
    }));
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.provider).toBeNull();
  });

  it('chooses a verified lower-priority provider when a preferred provider is degraded', () => {
    const capability = resolveCapability('communications.voice.readiness');
    capability.providerBindings.push({
      provider: 'fallback-test',
      adapter: 'fallback-adapter',
      environments: ['production'],
      priority: 20,
      healthCheck: 'fallback.readiness'
    });
    try {
      const decision = evaluateCapabilityPolicy('communications.voice.readiness', context({
        runtimeProviderStates: {
          telnyx: { state: 'degraded', verifiedAt: fresh },
          'fallback-test': { state: 'verified', verifiedAt: fresh }
        }
      }));
      expect(decision.allowed).toBe(true);
      if (decision.allowed) expect(decision.provider?.provider).toBe('fallback-test');
    } finally {
      capability.providerBindings.pop();
    }
  });

  it('fails closed for missing, unverified, or stale provider readiness', () => {
    expect(evaluateCapabilityPolicy('communications.voice.readiness', context({ runtimeProviderStates: {} })))
      .toMatchObject({ allowed: false, blocker: 'provider_not_configured' });
    expect(evaluateCapabilityPolicy('communications.voice.readiness', context({
      runtimeProviderStates: { telnyx: { state: 'degraded', verifiedAt: fresh } }
    }))).toMatchObject({ allowed: false, blocker: 'provider_not_verified' });

    const stale = new Date(Date.parse(now) - DEFAULT_PROVIDER_READINESS_TTL_MS - 1).toISOString();
    expect(evaluateCapabilityPolicy('communications.voice.readiness', context({
      runtimeProviderStates: { telnyx: { state: 'verified', verifiedAt: stale } }
    }))).toMatchObject({ allowed: false, blocker: 'provider_not_verified' });
  });
});
