import { describe, expect, it } from 'vitest';
import { integrateAtmosphere, rayleighPhase, miePhase } from '../../apps/web/src/modules/galaxy/volumetricAtmosphere';

describe('NEXUS atmosphere integration', () => {
  const sun = {x:1,y:0,z:0};
  it('has symmetric Rayleigh and forward-weighted Mie scattering', () => {
    expect(rayleighPhase(-1)).toBeCloseTo(rayleighPhase(1));
    expect(rayleighPhase(1)).toBeGreaterThan(rayleighPhase(0));
    expect(miePhase(1)).toBeGreaterThan(miePhase(-1));
  });
  it('integrates the atmospheric shell beyond the solid surface', () => {
    const day = integrateAtmosphere(1.03,0,sun,1,1);
    const night = integrateAtmosphere(-1.03,0,sun,1,1);
    expect(day.opacity).toBeGreaterThan(0);
    expect(day.radiance[2]).toBeGreaterThan(day.radiance[0]);
    expect(day.radiance[2]).toBeGreaterThan(night.radiance[2]);
    expect(integrateAtmosphere(1.2,0,sun,1,1).opacity).toBe(0);
  });
  it('separates extinction from sunlight visibility', () => {
    const lit = integrateAtmosphere(0.95,0,sun,1,1);
    const eclipse = integrateAtmosphere(0.95,0,sun,1,0);
    expect(eclipse.opacity).toEqual(lit.opacity);
    expect(eclipse.radiance).toEqual([0,0,0]);
    expect(integrateAtmosphere(0.95,0,sun,0,1).opacity).toBe(0);
  });
  it('rejects invalid inputs and maintains bounded outputs', () => {
    expect(() => integrateAtmosphere(NaN,0,sun,1,1)).toThrow();
    expect(() => integrateAtmosphere(0,0,{x:0,y:0,z:0},1,1)).toThrow();
    for (let i=-12;i<=12;i++) for(let j=-12;j<=12;j++) {
      const a=integrateAtmosphere(i/10,j/10,sun,0.8,1);
      expect(a.opacity).toBeGreaterThanOrEqual(0);
      expect(a.opacity).toBeLessThanOrEqual(1);
      expect(a.radiance.every(c=>Number.isFinite(c)&&c>=0&&c<=1)).toBe(true);
    }
  });
});
