import { describe, expect, it } from 'vitest';
import {
  connectionIsReady,
  normalizeProviderTarget,
  type ConnectionHealth,
  type ConnectionTransport
} from '../../packages/execution/src/agent-gateway';

describe('ATLAS Agent Gateway pure contract', () => {
  it('detects HubSpot only on exact host or hubspot.com subdomains', () => {
    expect(normalizeProviderTarget('https://app-na2.hubspot.com/settings')).toEqual({
      provider: 'hubspot',
      canonicalDomain: 'hubspot.com'
    });
    expect(normalizeProviderTarget('https://www.hubspot.com/products')).toEqual({
      provider: 'hubspot',
      canonicalDomain: 'hubspot.com'
    });
    expect(normalizeProviderTarget('APP-NA2.HUBSPOT.COM')).toEqual({
      provider: 'hubspot',
      canonicalDomain: 'hubspot.com'
    });
    expect(normalizeProviderTarget('hubspot.com')).toEqual({
      provider: 'hubspot',
      canonicalDomain: 'hubspot.com'
    });
    expect(normalizeProviderTarget('https://hubspot.com.evil.example')).toEqual({
      provider: null,
      canonicalDomain: null
    });
    expect(normalizeProviderTarget('https://evilhubspot.com')).toEqual({
      provider: null,
      canonicalDomain: null
    });
  });

  it('fails closed for empty or unsupported provider targets', () => {
    expect(normalizeProviderTarget('')).toEqual({ provider: null, canonicalDomain: null });
    expect(normalizeProviderTarget('not a valid domain')).toEqual({ provider: null, canonicalDomain: null });
    expect(normalizeProviderTarget('https://example.com')).toEqual({ provider: null, canonicalDomain: null });
  });

  it('requires active lifecycle, healthy verification and at least one transport', () => {
    const ready = {
      lifecycle: 'active',
      health: 'healthy' as ConnectionHealth,
      verifiedAt: '2026-10-04T12:00:00Z',
      transports: ['api'] as ConnectionTransport[]
    };
    expect(connectionIsReady(ready)).toBe(true);
    expect(connectionIsReady({ ...ready, lifecycle: 'expired' })).toBe(false);
    expect(connectionIsReady({ ...ready, health: 'reauth_required' })).toBe(false);
    expect(connectionIsReady({ ...ready, health: 'account_changed' })).toBe(false);
    expect(connectionIsReady({ ...ready, verifiedAt: null })).toBe(false);
    expect(connectionIsReady({ ...ready, transports: [] })).toBe(false);
  });
});
