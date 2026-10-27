import { describe, expect, it } from 'vitest';
import { classifyAsset, canPublishGeometry, tourStops, assertTenant } from './propertyEvidence';

describe('Emerald Grove provenance fail-closed', () => {
  it('rejects unverified geometry masquerading as verified', () => {
    expect(() => classifyAsset({ id:'building-1', status:'verified', sourceUrl:'', capturedAt:'' })).toThrow();
  });
  it('permits clearly simulated geometry without presenting it as surveyed', () => {
    expect(classifyAsset({ id:'demo-building', status:'simulated' }).status).toBe('simulated');
    expect(canPublishGeometry({ id:'demo-building', status:'simulated' }, 'verified')).toBe(false);
  });
  it('rejects tenant crossing', () => {
    expect(() => assertTenant('tenant-a','tenant-b')).toThrow();
  });
  it('never invents tour stops', () => {
    expect(tourStops([{ id:'x', status:'simulated' }], ['missing'])).toEqual([]);
  });
});
