import { describe, expect, it } from 'vitest';
import { assessNetworkMeasurement, type NetworkMeasurement } from '../../apps/web/src/work/networkSentinel';

const baseline: NetworkMeasurement = {
  downloadMbps: 281, uploadMbps: 55.2, latencyMs: 33.4, jitterMs: 10,
  packetLossPercent: 0, measuredAt: '2026-10-24T15:00:00-04:00',
  source: 'user-reported-cloudflare',
};

describe('Network Sentinel baseline assessment', () => {
  it('records a valid user-reported baseline without claiming router certification', () => {
    expect(assessNetworkMeasurement(baseline)).toEqual({ status: 'baseline-recorded', warnings: [] });
  });
  it('flags degraded quality', () => {
    expect(assessNetworkMeasurement({ ...baseline, packetLossPercent: 3, latencyMs: 150 }).warnings).toEqual(['packet-loss', 'latency']);
  });
  it('rejects invalid or nonfinite measurements', () => {
    expect(() => assessNetworkMeasurement({ ...baseline, downloadMbps: Number.NaN })).toThrow();
    expect(() => assessNetworkMeasurement({ ...baseline, packetLossPercent: 101 })).toThrow();
  });
  it('rejects missing measurement provenance', () => {
    expect(() => assessNetworkMeasurement({ ...baseline, source: 'unknown' as NetworkMeasurement['source'] })).toThrow();
  });
});
