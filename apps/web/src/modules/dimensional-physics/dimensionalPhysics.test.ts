import { describe, expect, it } from 'vitest';
import { kkMassGeV, classifyDimensionalClaim, validateResearchRun, addPlanckScale, rsWarpedScaleGeV, classifyDimension, validateEvidenceRecord } from './dimensionalPhysics';

describe('Dimensional physics scientific contract', () => {
  it('rejects invalid KK radii and modes, preserves units', () => {
    expect(() => kkMassGeV(0, 1)).toThrow();
    expect(() => kkMassGeV(1e-18, -1)).toThrow();
    expect(kkMassGeV(1e-16, 1)).toBeCloseTo(1.973269804);
    expect(kkMassGeV(1e-16, 0)).toBe(0);
  });
  it('rejects simulations falsely described as observations', () => {
    expect(() => classifyDimensionalClaim({kind:'simulation', claim:'experimentally-observed'})).toThrow();
  });
  it('rejects invalid provenance, tenant and unapproved compute', () => {
    const base={tenantId:'a',actorTenantId:'a',sourceUrl:'https://cms.cern.ch',sourceDate:'2026-04-12',paidCompute:false,costApproved:false};
    expect(() => validateResearchRun(base)).not.toThrow();
    expect(() => validateResearchRun({...base,sourceDate:'2026-13-50'})).toThrow();
    expect(() => validateResearchRun({...base,sourceUrl:''})).toThrow();
    expect(() => validateResearchRun({...base,actorTenantId:'b'})).toThrow();
    expect(() => validateResearchRun({...base,paidCompute:true})).toThrow();
  });
  it('treats ADD and Randall Sundrum as model calculations, not measured facts', () => {
    expect(addPlanckScale(1000,2,1e-3)).toBeGreaterThan(0);
    expect(() => addPlanckScale(0,2,1e-3)).toThrow();
    expect(() => addPlanckScale(1000,0,1e-3)).toThrow();
    expect(rsWarpedScaleGeV(1e19,35)).toBeGreaterThan(0);
    expect(() => rsWarpedScaleGeV(1e19,-1)).toThrow();
  });
  it('distinguishes spatial, Hilbert and GPS informational axes', () => {
    expect(classifyDimension('hilbert')).toBe('mathematical-state-space');
    expect(classifyDimension('gps-context')).toBe('informational');
    expect(classifyDimension('extra-spatial')).toBe('hypothetical-physical');
  });
  it('rejects source-free experimental records', () => {
    expect(() => validateEvidenceRecord({id:'x',sourceUrl:'',publishedAt:'2026-01-01',kind:'observation',model:'ADD'})).toThrow();
  });
});