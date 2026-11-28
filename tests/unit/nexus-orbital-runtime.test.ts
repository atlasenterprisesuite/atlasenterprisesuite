import { describe, expect, it } from 'vitest';
import { orbitalPositions, projectOrbitalPoint } from '../../apps/web/src/modules/galaxy/orbitalRuntime';

describe('NEXUS orbital runtime', () => {
  it('keeps the core stationary and computes distinct moving 3D orbits', () => {
    const a = orbitalPositions(7, 0);
    const b = orbitalPositions(7, 2);
    expect(a).toHaveLength(7);
    expect(a[0]).toEqual(b[0]);
    expect(a[1]).not.toEqual(b[1]);
    expect(new Set(a.map(p => Math.hypot(p.x, p.z).toFixed(4))).size).toBe(7);
  });
  it('projects a point differently when camera rotation changes', () => {
    const point = orbitalPositions(7, 0)[1];
    expect(projectOrbitalPoint(point, 0, 1, 640, 360)).not.toEqual(projectOrbitalPoint(point, 1, 1, 640, 360));
  });
  it('rejects invalid counts and nonfinite camera inputs', () => {
    expect(() => orbitalPositions(-1, 0)).toThrow();
    expect(() => orbitalPositions(7, Infinity)).toThrow();
    expect(() => projectOrbitalPoint({x:0,y:0,z:0,radius:1}, NaN, 1, 640, 360)).toThrow();
  });
  it('keeps all seven bodies visible at default zoom across sampled times and orientations', () => {
    for (const width of [320, 512, 768, 1024, 1440]) {
      const height = Math.round(width * 0.56);
      for (let seconds = 0; seconds <= 60; seconds += 5) {
        for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.25) {
          for (const point of orbitalPositions(7, seconds)) {
            const p = projectOrbitalPoint(point, yaw, 1, width, height);
            if (p.x - p.radius < 0 || p.x + p.radius > width || p.y - p.radius < 0 || p.y + p.radius > height) {
              throw new Error(`Clipped body at ${width}, ${seconds}, ${yaw}: ${JSON.stringify(p)}`);
            }
          }
        }
      }
    }
  });

});
