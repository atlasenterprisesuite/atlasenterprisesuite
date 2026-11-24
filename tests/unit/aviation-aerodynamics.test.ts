import { describe, expect, it } from 'vitest';
import { calculateAerodynamics, type AerodynamicInput } from '../../apps/web/src/modules/aviation/aviation-aerodynamics';

const baseline: AerodynamicInput = {
  airDensityKgM3: 1.225,
  trueAirspeedMs: 20,
  wingAreaM2: 16,
  liftCoefficient: 0.8,
  dragCoefficient: 0.05,
  massKg: 300,
  thrustN: 300,
};

describe('ATLAS Aviation 777 aerodynamic educational model', () => {
  it('calculates dynamic pressure, lift, drag and weight in SI units', () => {
    const result = calculateAerodynamics(baseline);
    expect(result.dynamicPressurePa).toBeCloseTo(245, 8);
    expect(result.liftN).toBeCloseTo(3136, 8);
    expect(result.dragN).toBeCloseTo(196, 8);
    expect(result.weightN).toBeCloseTo(2941.995, 8);
    expect(result.netVerticalForceN).toBeCloseTo(194.005, 8);
    expect(result.netLongitudinalForceN).toBeCloseTo(104, 8);
    expect(result.liftToDragRatio).toBeCloseTo(16, 8);
  });

  it('returns zero aerodynamic forces at zero airspeed', () => {
    const result = calculateAerodynamics({ ...baseline, trueAirspeedMs: 0 });
    expect(result.liftN).toBe(0);
    expect(result.dragN).toBe(0);
    expect(result.liftToDragRatio).toBeNull();
  });

  it('scales lift and drag quadratically with airspeed', () => {
    const a = calculateAerodynamics(baseline);
    const b = calculateAerodynamics({ ...baseline, trueAirspeedMs: 40 });
    expect(b.liftN).toBeCloseTo(4 * a.liftN, 8);
    expect(b.dragN).toBeCloseTo(4 * a.dragN, 8);
  });

  it.each([
    { airDensityKgM3: Number.NaN },
    { trueAirspeedMs: -1 },
    { wingAreaM2: 0 },
    { liftCoefficient: Infinity },
    { dragCoefficient: -0.1 },
    { massKg: 0 },
    { thrustN: -1 },
  ])('fails closed on invalid input %j', (override) => {
    expect(() => calculateAerodynamics({ ...baseline, ...override })).toThrow(RangeError);
  });

  it('supports negative lift coefficient without misreporting upward lift', () => {
    expect(calculateAerodynamics({ ...baseline, liftCoefficient: -0.5 }).liftN).toBeLessThan(0);
  });
});
