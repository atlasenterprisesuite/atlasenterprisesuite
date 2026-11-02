import { describe, expect, it } from 'vitest';
import { simulateOrbitalCity, STANDARD_GRAVITY_M_S2 } from './orbitalPhysics';

describe('ATLAS Orbital City 777 physics', () => {
  it('calculates approximately 2 rpm for a 225 m ring at 1 g', () => {
    const result = simulateOrbitalCity({radiusMeters:225,targetGravityMps2:STANDARD_GRAVITY_M_S2,altitudeMeters:500000});
    expect(result.rotationRpm).toBeCloseTo(1.993,2);
    expect(result.orbitalPeriodSeconds).toBeGreaterThan(5000);
    expect(result.orbitalPeriodSeconds).toBeLessThan(6000);
  });
  it.each([0,-1,NaN,Infinity])('rejects invalid radius %s', radiusMeters => {
    expect(() => simulateOrbitalCity({radiusMeters,targetGravityMps2:9.8,altitudeMeters:500000})).toThrow(RangeError);
  });
  it('rejects out of range orbit altitude', () => {
    expect(() => simulateOrbitalCity({radiusMeters:225,targetGravityMps2:9.8,altitudeMeters:1000})).toThrow(RangeError);
  });
});
