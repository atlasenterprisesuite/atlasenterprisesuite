/** Network Sentinel: user-reported measurements, never router credentials. */
export type NetworkMeasurement = Readonly<{
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  measuredAt: string;
  source: 'user-reported-cloudflare';
}>;

export type NetworkAssessment = Readonly<{
  status: 'baseline-recorded' | 'degraded';
  warnings: string[];
}>;

export function assessNetworkMeasurement(value: NetworkMeasurement): NetworkAssessment {
  const metrics = [value.downloadMbps, value.uploadMbps, value.latencyMs, value.jitterMs, value.packetLossPercent];
  if (metrics.some((metric) => !Number.isFinite(metric) || metric < 0) || value.packetLossPercent > 100) {
    throw new Error('Invalid network measurement');
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}T/.test(value.measuredAt) || !Number.isFinite(Date.parse(value.measuredAt))) {
    throw new Error('Invalid measurement timestamp');
  }
  if (value.source !== 'user-reported-cloudflare') throw new Error('Unsupported measurement source');
  const warnings: string[] = [];
  if (value.packetLossPercent > 1) warnings.push('packet-loss');
  if (value.latencyMs > 100) warnings.push('latency');
  if (value.jitterMs > 30) warnings.push('jitter');
  if (value.downloadMbps < 10 || value.uploadMbps < 2) warnings.push('throughput');
  return { status: warnings.length ? 'degraded' : 'baseline-recorded', warnings };
}
