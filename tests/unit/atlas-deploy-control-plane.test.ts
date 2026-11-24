import { describe, expect, it } from 'vitest';
import {
  canClaimAtlasProductionLive,
  planAtlasDeployQueue,
  resolveAtlasDeploymentTruth,
  type AtlasDeployRequest
} from '../../packages/core/src';

const request = (id: string, overrides: Partial<AtlasDeployRequest> = {}): AtlasDeployRequest => ({
  id,
  project: 'atlas-web',
  sourceSha: 'abc123',
  environment: 'production',
  provider: 'vercel',
  requestedAt: 1000,
  ...overrides
});

describe('ATLAS deploy control plane', () => {
  it('coalesces duplicate deployment intents for the same source/provider target', () => {
    const result = planAtlasDeployQueue({
      requests: [request('a'), request('b', { requestedAt: 1001 })],
      inFlight: [],
      now: 10_000,
      policy: {
        maxConcurrent: 2,
        minProviderIntervalMs: 0,
        coalesceSameSource: true
      }
    });

    expect(result.launch.map(item => item.id)).toEqual(['a']);
    expect(result.coalesced.map(item => item.id)).toEqual(['b']);
  });

  it('applies provider backpressure instead of repeatedly launching rate-limited builds', () => {
    const result = planAtlasDeployQueue({
      requests: [request('a')],
      inFlight: [],
      lastProviderLaunchAt: { vercel: 9_500 },
      now: 10_000,
      policy: {
        maxConcurrent: 1,
        minProviderIntervalMs: 1_000,
        coalesceSameSource: true
      }
    });

    expect(result.launch).toHaveLength(0);
    expect(result.deferred.map(item => item.id)).toEqual(['a']);
  });

  it('never calls production live without provider, runtime and exact-SHA evidence', () => {
    const evidence = {
      sourceSha: 'abc123',
      buildVerified: true,
      providerDeploymentId: 'dpl_123',
      providerVerified: true,
      runtimeVerified: true,
      exactShaVerified: false
    };

    expect(resolveAtlasDeploymentTruth(evidence)).toBe('runtime_verified');
    expect(canClaimAtlasProductionLive(evidence)).toBe(false);
    expect(canClaimAtlasProductionLive({ ...evidence, exactShaVerified: true })).toBe(true);
  });

  it('prioritizes higher-priority changes while respecting the concurrency budget', () => {
    const result = planAtlasDeployQueue({
      requests: [
        request('low', { provider: 'cloudflare', priority: 1 }),
        request('high', { provider: 'supabase', priority: 10 })
      ],
      inFlight: [],
      now: 10_000,
      policy: {
        maxConcurrent: 1,
        minProviderIntervalMs: 0,
        coalesceSameSource: false
      }
    });

    expect(result.launch.map(item => item.id)).toEqual(['high']);
    expect(result.deferred.map(item => item.id)).toEqual(['low']);
  });

  it('coalesces duplicate requests against builds already in flight', () => {
    const result = planAtlasDeployQueue({
      requests: [request('duplicate'), request('other', { sourceSha: 'def456', provider: 'cloudflare' })],
      inFlight: [request('active')],
      now: 10_000,
      policy: { maxConcurrent: 3, minProviderIntervalMs: 0, coalesceSameSource: true }
    });
    expect(result.launch.map(item => item.id)).toEqual(['other']);
    expect(result.coalesced.map(item => item.id)).toEqual(['duplicate']);
  });

  it('does not coalesce across environments or when coalescing is disabled', () => {
    const active = request('active');
    const input = {
      requests: [request('preview', { environment: 'preview' })],
      inFlight: [active],
      now: 10_000,
      policy: { maxConcurrent: 3, minProviderIntervalMs: 0, coalesceSameSource: true }
    };
    expect(planAtlasDeployQueue(input).launch.map(item => item.id)).toEqual(['preview']);
    expect(planAtlasDeployQueue({
      ...input, requests: [request('repeat')],
      policy: { ...input.policy, coalesceSameSource: false }
    }).launch.map(item => item.id)).toEqual(['repeat']);
  });
});
