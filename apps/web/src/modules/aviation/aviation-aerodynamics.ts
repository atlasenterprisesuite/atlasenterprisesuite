/**
 * ATLAS Aviation 777 — educational aerodynamic calculations.
 * SI units throughout. Not approved for flight planning or certification.
 */
export type AerodynamicInput = {
  airDensityKgM3: number;
  trueAirspeedMs: number;
  wingAreaM2: number;
  liftCoefficient: number;
  dragCoefficient: number;
  massKg: number;
  thrustN: number;
};
export type AerodynamicResult = {
  dynamicPressurePa: number;
  liftN: number;
  dragN: number;
  weightN: number;
  netVerticalForceN: number;
  netLongitudinalForceN: number;
  liftToDragRatio: number | null;
  model: 'steady-coefficients-educational';
};
const GRAVITY_MS2 = 9.80665;
function finiteInRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`Invalid ${field}: outside educational model limits`);
  }
}
export function calculateAerodynamics(input: AerodynamicInput): AerodynamicResult {
  finiteInRange(input.airDensityKgM3, 0.01, 2, 'airDensityKgM3');
  finiteInRange(input.trueAirspeedMs, 0, 350, 'trueAirspeedMs');
  finiteInRange(input.wingAreaM2, 0.01, 2000, 'wingAreaM2');
  finiteInRange(input.liftCoefficient, -2, 3, 'liftCoefficient');
  finiteInRange(input.dragCoefficient, 0, 3, 'dragCoefficient');
  finiteInRange(input.massKg, 0.01, 1_000_000, 'massKg');
  finiteInRange(input.thrustN, 0, 10_000_000, 'thrustN');
  const dynamicPressurePa = 0.5 * input.airDensityKgM3 * input.trueAirspeedMs ** 2;
  const liftN = dynamicPressurePa * input.wingAreaM2 * input.liftCoefficient;
  const dragN = dynamicPressurePa * input.wingAreaM2 * input.dragCoefficient;
  const weightN = input.massKg * GRAVITY_MS2;
  return {
    dynamicPressurePa, liftN, dragN, weightN,
    netVerticalForceN: liftN - weightN,
    netLongitudinalForceN: input.thrustN - dragN,
    liftToDragRatio: dragN > 0 ? liftN / dragN : null,
    model: 'steady-coefficients-educational',
  };
}
