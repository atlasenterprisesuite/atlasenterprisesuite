import { describe, expect, it } from 'vitest';
import {
  validateIrvDevelopment, selectVisibleDevelopments, selectDevelopmentsAtYear,
  simulateMobilityImpact
} from '../../apps/web/src/modules/gps/gps5dIrvDomain';

const sample = {
  id: 'fixture-only', tenantId: 'tenant-a', title: 'Synthetic development',
  sourceUrl: 'https://example.org/source', sourceDate: '2026-10',
  licenseStatus: 'unknown', verification: 'unverified',
  lat: 28.45, lon: -81.47, startYear: 2026, endYear: 2028, investmentUsd: 1000000
};
const approved = { ...sample, licenseStatus: 'permission-granted', verification: 'verified' };
const access = { authorized: true, activeMember: true };

describe('GPS 5D I-Drive fail-closed contract (synthetic fixtures)', () => {
  it('rejects unverified sources and unknown licenses', () => {
    expect(validateIrvDevelopment(sample).publishable).toBe(false);
    expect(validateIrvDevelopment({ ...sample, verification: 'verified' }).publishable).toBe(false);
    expect(validateIrvDevelopment({ ...sample, licenseStatus: 'licensed' }).publishable).toBe(false);
  });
  it('requires both verification and redistribution permission', () => {
    expect(validateIrvDevelopment(approved).publishable).toBe(true);
  });
  it.each([NaN, Infinity, -Infinity, 90.01, -90.01])('rejects latitude %s', lat => {
    expect(validateIrvDevelopment({ ...approved, lat }).valid).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity, 180.01, -180.01])('rejects longitude %s', lon => {
    expect(validateIrvDevelopment({ ...approved, lon }).valid).toBe(false);
  });
  it('rejects reversed years, fractions and unsupported ranges', () => {
    for (const patch of [
      { startYear: 2030, endYear: 2028 }, { startYear: 2026.5 },
      { endYear: 2301 }, { startYear: 1799 }
    ]) expect(validateIrvDevelopment({ ...approved, ...patch }).valid).toBe(false);
  });
  it('rejects invalid investment and provenance fields', () => {
    for (const patch of [
      { investmentUsd: -1 }, { investmentUsd: Infinity },
      { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'http://example.org' },
      { sourceDate: '2026-13' }, { title: '' }
    ]) expect(validateIrvDevelopment({ ...approved, ...patch }).valid).toBe(false);
  });
  it('rejects invalid or missing records', () => {
    expect(validateIrvDevelopment(null).publishable).toBe(false);
    expect(validateIrvDevelopment([]).valid).toBe(false);
  });
  it('denies cross-tenant, missing and revoked membership', () => {
    expect(selectVisibleDevelopments([approved], 'tenant-b', access)).toEqual([]);
    expect(selectVisibleDevelopments([approved], 'tenant-a')).toEqual([]);
    expect(selectVisibleDevelopments([approved], 'tenant-a', { ...access, activeMember: false })).toEqual([]);
    expect(selectVisibleDevelopments([approved], 'tenant-a', { ...access, authorized: false })).toEqual([]);
  });
  it('filters unpublished data even with client authorization', () => {
    expect(selectVisibleDevelopments([sample], 'tenant-a', access)).toEqual([]);
    expect(selectVisibleDevelopments([approved], 'tenant-a', access)).toEqual([approved]);
  });
  it('selects only licensed, verified developments in temporal range', () => {
    expect(selectDevelopmentsAtYear([sample, approved], 2027, 'tenant-a', access)).toEqual([approved]);
    expect(selectDevelopmentsAtYear([approved], 2029, 'tenant-a', access)).toEqual([]);
    expect(selectDevelopmentsAtYear([approved], NaN, 'tenant-a', access)).toEqual([]);
  });
  it('denies temporal reads without valid tenant membership', () => {
    expect(selectDevelopmentsAtYear([approved], 2027, 'tenant-b', access)).toEqual([]);
    expect(selectDevelopmentsAtYear([approved], 2027, 'tenant-a', { ...access, activeMember: false })).toEqual([]);
    expect(selectDevelopmentsAtYear([approved], 2027, 'tenant-a', { ...access, authorized: false })).toEqual([]);
    expect(selectDevelopmentsAtYear([approved], 2027, '', access)).toEqual([]);
  });
  it('rejects extreme overflow in scenario arithmetic', () => {
    expect(simulateMobilityImpact({ baselineTrips: Number.MAX_VALUE, scenarioMultiplier: 2 }).estimatedTrips).toBeNull();
  });
  it('marks simulations and rejects unsafe input', () => {
    const result = simulateMobilityImpact({ baselineTrips: 100, scenarioMultiplier: 1.2 });
    expect(result.kind).toBe('simulation');
    expect(result.estimatedTrips).toBe(120);
    expect(result.disclaimer).toMatch(/hipotético/i);
    expect(simulateMobilityImpact({ baselineTrips: -1, scenarioMultiplier: 1 }).valid).toBe(false);
    expect(simulateMobilityImpact({ baselineTrips: 100, scenarioMultiplier: Infinity }).estimatedTrips).toBeNull();
  });
  it('exposes text labels independently of map colors', () => {
    expect(validateIrvDevelopment(sample).accessibilityLabel).toMatch(/no verificado/i);
    expect(validateIrvDevelopment(approved).accessibilityLabel).toMatch(/verificado/i);
  });
});
