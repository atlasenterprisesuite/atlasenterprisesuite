import { describe, expect, it } from 'vitest';
import {
  ATLAS_INTEGRATION_PROVIDERS,
  canReportConnected,
  evaluateIntegrationExecutionGate,
  integrationProviderDefinition,
  isIntegrationProvider,
  validateIntegrationAuthPolicy
} from '../../packages/core/src';

describe('integration policy', () => {
  it('accepts modern auth mechanisms by default', () => {
    expect(validateIntegrationAuthPolicy({ kind: 'oauth2' })).toEqual({ ok: true });
    expect(validateIntegrationAuthPolicy({ kind: 'api_key' })).toEqual({ ok: true });
    expect(validateIntegrationAuthPolicy({ kind: 'service_token' })).toEqual({ ok: true });
    expect(validateIntegrationAuthPolicy({ kind: 'opaque_reference' })).toEqual({ ok: true });
  });

  it('rejects password auth without an approved exception', () => {
    expect(validateIntegrationAuthPolicy({ kind: 'password' })).toEqual({
      ok: false,
      reason: 'legacy_auth_not_approved'
    });
  });

  it('requires provider verification before connected', () => {
    expect(canReportConnected({ authorized: true, providerVerified: false })).toBe(false);
    expect(canReportConnected({ authorized: true, providerVerified: true })).toBe(true);
  });

  it('registers the provider families already used by ATLAS modules', () => {
    for (const provider of [
      'google',
      'hubspot',
      'cloudflare',
      'stripe',
      'authorize_net',
      'openai',
      'peach',
      'salto',
      'vingcard',
      'dormakaba',
      'onity',
      'generic_certified'
    ]) {
      expect(isIntegrationProvider(provider)).toBe(true);
    }

    expect(isIntegrationProvider('unknown-provider')).toBe(false);
    expect(ATLAS_INTEGRATION_PROVIDERS.length).toBeGreaterThanOrEqual(12);
    expect(integrationProviderDefinition('cloudflare').authKind).toBe('service_token');
    expect(integrationProviderDefinition('hubspot').authKind).toBe('oauth2');
  });

  it('fails closed until authorization, credentials, provider proof and capabilities all pass', () => {
    expect(evaluateIntegrationExecutionGate({
      state: 'connected',
      authorized: true,
      credentialsConfigured: true,
      providerVerified: true,
      requiredCapabilities: ['dns.read', 'dns.write'],
      grantedCapabilities: ['dns.read']
    })).toEqual({
      allowed: false,
      blockers: ['capability_missing'],
      missingCapabilities: ['dns.write']
    });

    expect(evaluateIntegrationExecutionGate({
      state: 'connected',
      authorized: true,
      credentialsConfigured: true,
      providerVerified: true,
      requiredCapabilities: ['dns.read'],
      grantedCapabilities: ['dns.read']
    })).toEqual({
      allowed: true,
      blockers: [],
      missingCapabilities: []
    });
  });

  it('does not treat an authorized but degraded provider as executable', () => {
    expect(evaluateIntegrationExecutionGate({
      state: 'degraded',
      authorized: true,
      credentialsConfigured: true,
      providerVerified: true
    })).toEqual({
      allowed: false,
      blockers: ['connection_not_connected'],
      missingCapabilities: []
    });
  });
});
