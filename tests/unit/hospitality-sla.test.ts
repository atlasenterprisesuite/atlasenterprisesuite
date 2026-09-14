import { describe, expect, it } from 'vitest';
import { resolveHospitalitySla } from '../../packages/hospitality/sla';

describe('Hospitality SLA policy', () => {
  it('returns unconfigured rather than inventing hotel SLA times', () => {
    expect(resolveHospitalitySla({ createdAt: '2026-09-14T12:00:00.000Z', policy: null }))
      .toEqual({ status: 'unconfigured' });
  });

  it('calculates response and resolution deadlines only from configured values', () => {
    expect(resolveHospitalitySla({
      createdAt: '2026-09-14T12:00:00.000Z',
      policy: { responseMinutes: 5, resolutionMinutes: 20, warningMinutesBeforeBreach: 3 }
    })).toEqual({
      status: 'configured',
      firstResponseDueAt: '2026-09-14T12:05:00.000Z',
      resolutionDueAt: '2026-09-14T12:20:00.000Z',
      warningAt: '2026-09-14T12:17:00.000Z'
    });
  });

  it('rejects invalid configured values', () => {
    expect(() => resolveHospitalitySla({
      createdAt: '2026-09-14T12:00:00.000Z',
      policy: { responseMinutes: 10, resolutionMinutes: 5, warningMinutesBeforeBreach: 1 }
    })).toThrow('invalid_sla_policy');
  });
});
