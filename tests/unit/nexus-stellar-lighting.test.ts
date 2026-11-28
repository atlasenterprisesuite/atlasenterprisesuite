import { describe, expect, it } from 'vitest';
import { cameraLight, directVisibility, shadeSurface, atmosphericGlow } from '../../apps/web/src/modules/galaxy/stellarLighting';

describe('NEXUS stellar lighting', () => {
  const star = {x:0,y:0,z:0,radius:1};
  const planet = {x:8,y:0,z:0,radius:0.5};
  it('rotates the physical light direction with the camera', () => {
    const a = cameraLight(planet, star, 0);
    const b = cameraLight(planet, star, Math.PI/2);
    expect(a.x).toBeCloseTo(-1);
    expect(b.x).toBeCloseTo(0);
    expect(b.z).toBeLessThan(-0.9);
    expect(Math.hypot(b.x,b.y,b.z)).toBeCloseTo(1);
  });
  it('darkens the night side and respects eclipse visibility', () => {
    const light = {x:1,y:0,z:0};
    const day = shadeSurface([150,150,150], light, light, 1, false);
    const night = shadeSurface([150,150,150], {x:-1,y:0,z:0}, light, 1, false);
    const eclipse = shadeSurface([150,150,150], light, light, 0, false);
    expect(day[0]).toBeGreaterThan(night[0]);
    expect(eclipse).toEqual(night);
    expect(shadeSurface([150,150,150], light, light, 0, true)[0]).toBeGreaterThan(eclipse[0]);
  });
  it('detects an intervening body but not one behind the star or target', () => {
    expect(directVisibility(planet,star,[])).toBe(1);
    expect(directVisibility(planet,star,[{x:4,y:0,z:0,radius:1}])).toBe(0);
    expect(directVisibility(planet,star,[{x:4,y:4,z:0,radius:1}])).toBe(1);
    expect(directVisibility(planet,star,[{x:-4,y:0,z:0,radius:1},{x:10,y:0,z:0,radius:1}])).toBe(1);
    const partial = directVisibility(planet,star,[{x:4,y:0.5,z:0,radius:0.5}]);
    expect(partial).toBeGreaterThan(0); expect(partial).toBeLessThan(1);
  });
  it('brightens atmospheric limbs and reduces scattering in eclipse', () => {
    expect(atmosphericGlow(0.1,1,1)).toBeGreaterThan(atmosphericGlow(1,1,1));
    expect(atmosphericGlow(0.1,1,0)).toBe(0);
    expect(atmosphericGlow(0.1,0,1)).toBeLessThan(atmosphericGlow(0.1,1,1));
    expect(() => cameraLight(planet,planet,0)).toThrow();
    expect(() => atmosphericGlow(NaN,1,1)).toThrow();
  });
});
