import { describe, expect, it } from 'vitest';
import { addPlanckScale, rsWarpedScaleGeV, kkMassGeV, propagateKkUncertainty, validateExperimentalLimit, comparableLimits } from './dimensionalPhysics';
import { EXPERIMENTAL_LIMITS } from './experimentalLimits';
describe('dimensional science numerical and evidence gates', () => {
  it('ADD matches M_Pl^2 = M_D^(n+2) R^n under stated no-2pi convention', () => {
    expect(addPlanckScale(1000,2,1e-3)).toBeCloseTo(1000);
    expect(addPlanckScale(1000,2,1)).toBeCloseTo(1e6);
  });
  it('KK energy and propagated radius uncertainty are bounded', () => {
    expect(kkMassGeV(1e-16,1)).toBeCloseTo(1.973269804);
    expect(propagateKkUncertainty(1e-16,1,1e-18).uncertaintyGeV).toBeCloseTo(0.01973269804);
    expect(() => propagateKkUncertainty(1e-16,1,2e-16)).toThrow();
  });
  it('RS underflow must not silently look like a measured zero', () => {
    expect(() => rsWarpedScaleGeV(1e19,1000)).toThrow();
  });
  it('rejects invalid confidence, untraceable and incomparable limits', () => {
    expect(() => validateExperimentalLimit({...EXPERIMENTAL_LIMITS[0], confidenceLevel: 1.5})).toThrow();
    expect(() => validateExperimentalLimit({...EXPERIMENTAL_LIMITS[0], sourceUrl:'http://example.com'})).toThrow();
    expect(comparableLimits(EXPERIMENTAL_LIMITS[0], EXPERIMENTAL_LIMITS[1])).toBe(false);
  });
  it('catalog records pass provenance validation', () => {
    EXPERIMENTAL_LIMITS.forEach(record=>expect(()=>validateExperimentalLimit(record)).not.toThrow());
  });
});