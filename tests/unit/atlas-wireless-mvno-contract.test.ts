import { describe, expect, it } from 'vitest';
import {
  assertMvnoActivationAllowed,
  assertMvnoMutationResult,
  assertMvnoProviderContext,
  assertMvnoSubscriberTransition,
  requireMvnoPermission,
  type MvnoMutationResultCandidate,
  type MvnoProviderContext,
  type MvnoProviderReadiness
} from '../../supabase/functions/_shared/mvno';

const context: MvnoProviderContext = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  userId: '33333333-3333-3333-3333-333333333333',
  providerInstanceId: 'pilot-provider',
  correlationId: 'corr-1',
  idempotencyKey: 'idem-1',
  permissions: ['wireless.mvno.read', 'wireless.mvno.activate']
};

const readiness = (state: MvnoProviderReadiness['state']): MvnoProviderReadiness => ({
  state,
  blocker: state === 'ready' ? null : `blocked:${state}`,
  checkedAt: '2026-09-25T12:00:00.000Z',
  capabilities: ['esim', 'voice']
});

describe('MVNO fail-closed server contract', () => {
  it('requires complete organization, tenant, actor and request context', () => {
    expect(() => assertMvnoProviderContext(context)).not.toThrow();

    for (const field of [
      'organizationId',
      'tenantId',
      'userId',
      'providerInstanceId',
      'correlationId',
      'idempotencyKey'
    ] as const) {
      const invalid = { ...context, [field]: '' };
      expect(() => assertMvnoProviderContext(invalid)).toThrow(`mvno_context_required:${field}`);
    }
  });

  it('fails closed on missing operation permission while allowing explicit admin', () => {
    expect(() => requireMvnoPermission(context, 'wireless.mvno.activate')).not.toThrow();
    expect(() => requireMvnoPermission(context, 'wireless.mvno.reconnect'))
      .toThrow('mvno_permission_denied:wireless.mvno.reconnect');
    expect(() => requireMvnoPermission(context, 'wireless.mvno.revoke'))
      .toThrow('mvno_permission_denied:wireless.mvno.revoke');

    expect(() => requireMvnoPermission(
      { ...context, permissions: ['wireless.mvno.admin'] },
      'wireless.mvno.reconnect'
    )).not.toThrow();
  });

  it('never permits active unless provider readiness is ready', () => {
    for (const state of [
      'not_configured',
      'pending_provider',
      'configured_unverified',
      'degraded',
      'offline',
      'disabled'
    ] as const) {
      expect(() => assertMvnoActivationAllowed(readiness(state)))
        .toThrow(`mvno_provider_not_ready:${state}`);
      expect(() => assertMvnoSubscriberTransition('suspended', 'active', readiness(state)))
        .toThrow(`mvno_provider_not_ready:${state}`);
    }

    expect(() => assertMvnoActivationAllowed(readiness('ready'))).not.toThrow();
    expect(() => assertMvnoSubscriberTransition('suspended', 'active', readiness('ready'))).not.toThrow();
  });

  it('rejects invalid lifecycle edges and keeps revoked terminal', () => {
    expect(() => assertMvnoSubscriberTransition('pending_provider', 'provisioning', readiness('pending_provider')))
      .not.toThrow();
    expect(() => assertMvnoSubscriberTransition('active', 'suspended', readiness('offline')))
      .not.toThrow();
    expect(() => assertMvnoSubscriberTransition('revoked', 'revoked', readiness('offline')))
      .not.toThrow();

    expect(() => assertMvnoSubscriberTransition('pending_provider', 'active', readiness('ready')))
      .toThrow('mvno_invalid_transition:pending_provider->active');
    expect(() => assertMvnoSubscriberTransition('revoked', 'provisioning', readiness('ready')))
      .toThrow('mvno_invalid_transition:revoked->provisioning');
  });

  it('rejects active mutation results without ready provider evidence', () => {
    const unsafe: MvnoMutationResultCandidate = {
      subscriber: { id: 'sub-1', state: 'active', identifiers: {} },
      evidence: { providerState: 'offline', checkedAt: '2026-09-25T12:00:00.000Z' }
    };
    const safe: MvnoMutationResultCandidate = {
      subscriber: { id: 'sub-1', state: 'active', identifiers: {} },
      evidence: { providerState: 'ready', checkedAt: '2026-09-25T12:00:00.000Z' }
    };
    const suspended: MvnoMutationResultCandidate = {
      subscriber: { id: 'sub-1', state: 'suspended', identifiers: {} },
      evidence: { providerState: 'offline', checkedAt: '2026-09-25T12:00:00.000Z' }
    };

    expect(() => assertMvnoMutationResult(unsafe))
      .toThrow('mvno_active_without_ready_provider:offline');
    expect(() => assertMvnoMutationResult(safe)).not.toThrow();
    expect(() => assertMvnoMutationResult(suspended)).not.toThrow();
  });
});
