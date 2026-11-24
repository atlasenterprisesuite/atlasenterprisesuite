import { describe, expect, it } from 'vitest';
import { deriveAtlasMaxGatewaySnapshot } from '../../apps/web/src/modules/atlas-max/gatewaySnapshot';
import type { AssistantStatusResponse, AssistantUsageSummary } from '../../apps/web/src/assistant/client';

const status = {
  ok: true,
  authenticated: true,
  provider: 'atlas-local',
  provider_state: 'verified_for_request',
  model: null,
  organization: 'org-a',
  role: 'owner',
  capabilities: ['generation'],
  storage_state: 'configured',
  providers: [
    { id: 'atlas-local', state: 'verified', configured: true, verified: true, model: null, capabilities: ['generation'], profiles: ['balanced'], error: null },
    { id: 'openai', state: 'configuration-required', configured: false, verified: false, model: null, capabilities: [], profiles: [], error: null }
  ]
} satisfies AssistantStatusResponse;

const usage = {
  ok: true, scope: 'organization', days: 30, period_start: '2026-10-01', period_end: '2026-10-31',
  total_requests: 12, completed_requests: 10, failed_requests: 2,
  average_latency_ms: 300, automatic_api_cost_usd: 0,
  tokens: { input: 0, output: 0, total: 0 }, providers: [], models: []
} satisfies AssistantUsageSummary;

describe('MAX gateway snapshot — authenticated read-only evidence', () => {
  it('renders only server-reported verified providers and scoped request usage', () => {
    expect(deriveAtlasMaxGatewaySnapshot('org-a', status, usage, '2026-11-06T05:00:00.000Z')).toMatchObject({
      state: 'ready', verifiedProviders: ['atlas-local'], requests: 12, usageScope: 'organization'
    });
  });
  it('fails closed when organization identity is mismatched', () => {
    expect(deriveAtlasMaxGatewaySnapshot('org-b', status, usage).state).toBe('unavailable');
  });
  it('fails closed when authentication or status succeeds only by client claim', () => {
    expect(deriveAtlasMaxGatewaySnapshot('org-a', { ...status, authenticated: false }, usage).state).toBe('unavailable');
    expect(deriveAtlasMaxGatewaySnapshot('org-a', { ...status, ok: false }, usage).state).toBe('unavailable');
  });
  it('never turns gateway readiness into paid MAX entitlement', () => {
    const result = deriveAtlasMaxGatewaySnapshot('org-a', status, usage);
    expect(result).not.toHaveProperty('entitlement');
    expect(result).not.toHaveProperty('planId');
  });
  it('rejects unusable usage and unexpected provider IDs', () => {
    const result = deriveAtlasMaxGatewaySnapshot('org-a', {
      ...status, providers: [...status.providers, { ...status.providers[0], id: '<script>' }]
    }, { ...usage, total_requests: -5 });
    expect(result).toMatchObject({ state: 'ready', verifiedProviders: ['atlas-local'], requests: null });
  });
  it('does not fabricate usage or providers from missing data', () => {
    const result = deriveAtlasMaxGatewaySnapshot('org-a', { ...status, providers: [] });
    expect(result).toMatchObject({ state: 'ready', verifiedProviders: [], requests: null });
  });
});
