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
});

describe('bounded parallel builds', () => {
  const policy = { maxConcurrent: 4, minProviderIntervalMs: 0, coalesceSameSource: true };
  it('coalesces a queued intent already represented by an active build', () => {
    const result = planAtlasDeployQueue({ requests: [request('duplicate')], inFlight: [request('active')], now: 10000, policy });
    expect(result.launch).toEqual([]);
    expect(result.coalesced.map(x => x.id)).toEqual(['duplicate']);
  });
  it('defaults to one active build per provider', () => {
    const result = planAtlasDeployQueue({ requests: [request('next', { sourceSha: 'def456' })], inFlight: [request('active')], now: 10000, policy });
    expect(result.launch).toEqual([]);
    expect(result.deferred.map(x => x.id)).toEqual(['next']);
  });
  it('allows explicit bounded parallelism while retaining global capacity', () => {
    const result = planAtlasDeployQueue({
      requests: [request('a', { sourceSha: 'a' }), request('b', { sourceSha: 'b' }), request('c', { sourceSha: 'c' })],
      inFlight: [request('active')], now: 10000,
      policy: { ...policy, maxConcurrent: 2, maxConcurrentByProvider: { vercel: 3 } }
    });
    expect(result.launch.map(x => x.id)).toEqual(['a']);
    expect(result.deferred.map(x => x.id)).toEqual(['b', 'c']);
  });
  it('does not bypass a nonzero provider cooldown with parallel dispatch', () => {
    const result = planAtlasDeployQueue({
      requests: [request('a', { sourceSha: 'a' }), request('b', { sourceSha: 'b' })], inFlight: [], now: 10000,
      policy: { ...policy, minProviderIntervalMs: 1000, maxConcurrentByProvider: { vercel: 3 } }
    });
    expect(result.launch).toHaveLength(1);
    expect(result.deferred).toHaveLength(1);
  });
  it('rejects invalid provider capacity settings', () => {
    expect(() => planAtlasDeployQueue({ requests: [], inFlight: [], now: 10000,
      policy: { ...policy, maxConcurrentByProvider: { vercel: -1 } } })).toThrow();
  });
});
