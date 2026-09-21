import { describe, expect, it } from 'vitest';
import {
  ADVISORY_EXTERNAL_CAPABILITIES,
  resolveAdvisoryProviderReadiness
} from '../../packages/advisory/src';

describe('Advisory external provider readiness', () => {
  it('keeps every external capability authorization-gated without verified evidence', () => {
    const readiness = resolveAdvisoryProviderReadiness([]);
    expect(readiness).toHaveLength(5);
    expect(readiness.map((item) => item.capability)).toEqual(
      ADVISORY_EXTERNAL_CAPABILITIES.map((item) => item.id)
    );
    expect(readiness.every((item) => item.status === 'authorization_required')).toBe(true);
  });

  it('reports connected only when authorization and provider verification are both true', () => {
    const readiness = resolveAdvisoryProviderReadiness([
      {
        provider: 'example-esign',
        connectionName: 'advisory:esign:primary',
        state: 'connected',
        authorized: true,
        providerVerified: true,
        providerAccountLabel: 'Verified account',
        lastVerifiedAt: '2026-09-21T12:00:00Z',
        metadata: { advisory_capability: 'esign' }
      },
      {
        provider: 'example-payments',
        connectionName: 'advisory:payment:primary',
        state: 'connected',
        authorized: true,
        providerVerified: false,
        metadata: { advisory_capability: 'payment' }
      }
    ]);

    expect(readiness.find((item) => item.capability === 'esign')?.status).toBe('connected');
    expect(readiness.find((item) => item.capability === 'payment')?.status).not.toBe('connected');
  });

  it('preserves degraded and authorizing states without fabricating readiness', () => {
    const readiness = resolveAdvisoryProviderReadiness([
      {
        provider: 'example-media',
        connectionName: 'advisory:paid_media:primary',
        state: 'authorizing',
        authorized: false,
        providerVerified: false,
        metadata: { advisory_capability: 'paid_media' }
      },
      {
        provider: 'example-print',
        connectionName: 'advisory:print_fulfillment:primary',
        state: 'degraded',
        authorized: true,
        providerVerified: false,
        lastErrorCode: 'provider_unavailable',
        metadata: { advisory_capability: 'print_fulfillment' }
      }
    ]);

    expect(readiness.find((item) => item.capability === 'paid_media')?.status).toBe('authorizing');
    expect(readiness.find((item) => item.capability === 'print_fulfillment')?.status).toBe('degraded');
  });
});
