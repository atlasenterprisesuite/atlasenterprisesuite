import { describe, expect, it } from 'vitest';
import { kkMassGeV, classifyDimensionalClaim, validateResearchRun } from './dimensionalPhysics';
describe('Dimensional physics negative scientific contract', () => {
  it('rejects nonphysical compactification radius and mode', () => {
    expect(() => kkMassGeV(0, 1)).toThrow();
    expect(() => kkMassGeV(1e-18, -1)).toThrow();
  });
  it('rejects simulated evidence presented as observed', () => {
    expect(() => classifyDimensionalClaim({ kind:'simulation', claim:'experimentally-observed' })).toThrow();
  });
  it('rejects missing provenance, unauthorized tenant and paid compute', () => {
    const base = { tenantId:'a', actorTenantId:'a', sourceUrl:'https://cms.cern.ch', sourceDate:'2026-04-12', paidCompute:false, costApproved:false };
    expect(() => validateResearchRun({ ...base, sourceUrl:'' })).toThrow();
    expect(() => validateResearchRun({ ...base, actorTenantId:'b' })).toThrow();
    expect(() => validateResearchRun({ ...base, paidCompute:true })).toThrow();
  });
});