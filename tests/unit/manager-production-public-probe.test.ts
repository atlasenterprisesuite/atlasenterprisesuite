import { describe, expect, it } from 'vitest';
import { evaluateRecentPublicProductionProbe } from '../../supabase/functions/atlas-execution/manager-readiness';

const SHA = 'd9dfae686d9f0a266be18064b4cf3d410bb09e89';
const NOW = Date.parse('2026-11-22T12:30:00Z');
const healthyProbe = {
  status: 'passed',
  provider_state: 'verified',
  created_at: '2026-11-22T12:22:00Z',
  error_code: null,
  checks: {
    root_status: 200,
    status_page_status: 200,
    public_health_status: 200,
    public_health_overall: 'operational',
    public_version_tag: SHA,
    public_version_id_present: true,
    artifact_verified: true
  }
};

describe('ATLAS Manager current public production gate (P0)', () => {
  it('passes only with a recent, healthy, exact-SHA public verification', () => {
    expect(evaluateRecentPublicProductionProbe(healthyProbe, SHA, NOW).state).toBe('verified');
  });

  it('fails closed when the current public probe actually failed', () => {
    const probe = { ...healthyProbe, status: 'failed', provider_state: 'degraded', error_code: 'public_probe_failed' };
    const result = evaluateRecentPublicProductionProbe(probe, SHA, NOW);
    expect(result.state).toBe('failed');
    expect(result.error_code).toBe('public_probe_failed');
  });

  it('fails closed even if a probe says passed while public health reports outage', () => {
    const probe = { ...healthyProbe, checks: { ...healthyProbe.checks, public_health_overall: 'outage' } };
    expect(evaluateRecentPublicProductionProbe(probe, SHA, NOW).state).toBe('failed');
  });

  it('does not accept a different runtime SHA or missing health observation', () => {
    const wrongSha = { ...healthyProbe, checks: { ...healthyProbe.checks, public_version_tag: 'another-sha' } };
    expect(evaluateRecentPublicProductionProbe(wrongSha, SHA, NOW).state).toBe('failed');
    const missingHealth = { ...healthyProbe, checks: { ...healthyProbe.checks, public_health_status: null } };
    expect(evaluateRecentPublicProductionProbe(missingHealth, SHA, NOW).state).toBe('failed');
  });

  it('treats old, future-dated, malformed and missing evidence as unverified', () => {
    const older = { ...healthyProbe, created_at: '2026-11-16T15:48:26Z' };
    const future = { ...healthyProbe, created_at: '2026-11-22T13:00:00Z' };
    expect(evaluateRecentPublicProductionProbe(older, SHA, NOW).state).toBe('stale');
    expect(evaluateRecentPublicProductionProbe(future, SHA, NOW).state).toBe('stale');
    expect(evaluateRecentPublicProductionProbe({ ...healthyProbe, created_at: 'invalid' }, SHA, NOW).state).toBe('stale');
    expect(evaluateRecentPublicProductionProbe(null, SHA, NOW).state).toBe('unavailable');
  });
});
