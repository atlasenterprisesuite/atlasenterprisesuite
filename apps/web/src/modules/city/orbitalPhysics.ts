/** ATLAS Orbital City 777 — preliminary physics only; not flight-certified. */
export const STANDARD_GRAVITY_M_S2 = 9.80665;
export const EARTH_RADIUS_M = 6371000;
export const EARTH_MU_M3_S2 = 3.986004418e14;
export type OrbitalScenario = {
  radiusMeters: number;
  targetGravityMps2: number;
  altitudeMeters: number;
};
export type OrbitalResult = {
  angularVelocityRadPerSec: number;
  rotationRpm: number;
  rimSpeedMetersPerSec: number;
  orbitalPeriodSeconds: number;
  orbitalSpeedMetersPerSec: number;
};
export function simulateOrbitalCity(input: OrbitalScenario): OrbitalResult {
  const {radiusMeters:r,targetGravityMps2:g,altitudeMeters:h}=input;
  if (![r,g,h].every(Number.isFinite) || r <= 0 || g <= 0 || h < 160000 || h > 2000000) {
    throw new RangeError('Invalid scenario: radius and gravity must be positive; altitude must be between 160 and 2000 km');
  }
  const omega=Math.sqrt(g/r);
  const orbitRadius=EARTH_RADIUS_M+h;
  return {
    angularVelocityRadPerSec:omega,
    rotationRpm:omega*60/(2*Math.PI),
    rimSpeedMetersPerSec:omega*r,
    orbitalPeriodSeconds:2*Math.PI*Math.sqrt(orbitRadius**3/EARTH_MU_M3_S2),
    orbitalSpeedMetersPerSec:Math.sqrt(EARTH_MU_M3_S2/orbitRadius),
  };
}
