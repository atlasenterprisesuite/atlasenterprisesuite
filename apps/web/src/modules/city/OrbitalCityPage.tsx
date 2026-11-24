import { useState } from 'react';
import { STANDARD_GRAVITY_M_S2, simulateOrbitalCity } from './orbitalPhysics';

export function OrbitalCityPage() {
  const [radius, setRadius] = useState('225');
  const [altitude, setAltitude] = useState('500');
  const [gravity, setGravity] = useState('1');
  let result: ReturnType<typeof simulateOrbitalCity> | null = null;
  let error = '';
  try {
    if ([radius, altitude, gravity].some(value => value.trim() === '')) throw new RangeError('All inputs are required.');
    result = simulateOrbitalCity({
      radiusMeters: Number(radius),
      altitudeMeters: Number(altitude) * 1000,
      targetGravityMps2: Number(gravity) * STANDARD_GRAVITY_M_S2
    });
  } catch (cause) {
    error = cause instanceof Error ? cause.message : 'Invalid scenario';
  }
  return <section className="page-stack">
    <header className="page-header">
      <p className="eyebrow">ATLAS Digital City · Orbital City 777</p>
      <h1>Orbital Habitat Simulator</h1>
      <p>Preliminary rotating-ring and circular-orbit physics. This is a simulation, not an operational spacecraft or certified engineering design.</p>
    </header>
    <div className="notice">SIMULATION ONLY · No life-support, radiation, propulsion, collision avoidance or structural safety assessment is included.</div>
    <div className="module-grid">
      <label className="module-card">Ring radius (meters)<input type="number" min="1" step="1" value={radius} onChange={event => setRadius(event.target.value)} /></label>
      <label className="module-card">Orbit altitude (km; 160–2000)<input type="number" min="160" max="2000" step="1" value={altitude} onChange={event => setAltitude(event.target.value)} /></label>
      <label className="module-card">Artificial gravity (Earth g)<input type="number" min="0.01" step="0.01" value={gravity} onChange={event => setGravity(event.target.value)} /></label>
    </div>
    {error ? <div className="notice" role="alert">Scenario rejected: {error}</div> : null}
    {result ? <div className="stat-grid" aria-live="polite">
      <article><strong>{result.rotationRpm.toFixed(3)}</strong><span>Ring rotation (rpm)</span></article>
      <article><strong>{result.rimSpeedMetersPerSec.toFixed(1)}</strong><span>Rim speed (m/s)</span></article>
      <article><strong>{(result.orbitalPeriodSeconds / 60).toFixed(1)}</strong><span>Orbital period (minutes)</span></article>
      <article><strong>{(result.orbitalSpeedMetersPerSec / 1000).toFixed(2)}</strong><span>Orbital speed (km/s)</span></article>
    </div> : null}
  </section>;
}
