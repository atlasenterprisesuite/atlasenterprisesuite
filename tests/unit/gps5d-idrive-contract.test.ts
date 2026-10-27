import { describe, expect, it } from 'vitest';
import { validateIrvDevelopment, selectVisibleDevelopments, simulateMobilityImpact } from '../../apps/web/src/modules/gps/gps5dIrvDomain';

const verified = {
  id: 'example-1', tenantId: 'tenant-a', sourceUrl: 'https://www.idrivedistrict.com/economic-development/',
  sourceDate: '2026-10', licenseStatus: 'unknown', verification: 'unverified',
  lat: 28.45, lon: -81.47, startYear: 2026, endYear: 2028,
  investmentUsd: 1000000, title: 'Illustrative project'
};

describe('GPS 5D I-Drive fail-closed development contract', () => {
  it('rejects unverified developments from published layers', () => {
    expect(validateIrvDevelopment(verified).publishable).toBe(false);
  });
  it('rejects unknown redistribution licenses', () => {
    expect(validateIrvDevelopment({ ...verified, verification: 'verified' }).publishable).toBe(false);
  });
  it('rejects invalid coordinates and reversed time intervals', () => {
    expect(validateIrvDevelopment({ ...verified, lat: 999, startYear: 2030, endYear: 2028 }).valid).toBe(false);
  });
  it('does not leak cross-tenant development records', () => {
    expect(selectVisibleDevelopments([verified], 'tenant-b')).toEqual([]);
  });
  it('requires authorization and active membership before tenant reads', () => {
    expect(selectVisibleDevelopments([verified], 'tenant-a', { authorized: false, activeMember: true })).toEqual([]);
    expect(selectVisibleDevelopments([verified], 'tenant-a', { authorized: true, activeMember: false })).toEqual([]);
  });
  it('does not present mobility estimates as observed data', () => {
    expect(simulateMobilityImpact({ baselineTrips: 100, scenarioMultiplier: 1.2 }).kind).toBe('simulation');
  });
  it('exposes accessible text labels for development states', () => {
    expect(validateIrvDevelopment(verified).accessibilityLabel).toMatch(/unverified|no verificado/i);
  });
});
