import { describe, expect, it } from 'vitest';
import { earthMapLinks } from '../../apps/web/src/modules/gps/earthMapLinks';

describe('ATLAS Earth public map links — fail-closed', () => {
  it('generates Google Maps and Apple Maps links for a selected location', () => {
    const links = earthMapLinks({ lat: 28.5384, lon: -81.3789 });
    expect(links).not.toBeNull();
    const google = new URL(links!.googleMaps);
    const apple = new URL(links!.appleMaps);
    expect(google.origin).toBe('https://www.google.com');
    expect(google.searchParams.get('api')).toBe('1');
    expect(google.searchParams.get('query')).toBe('28.5384,-81.3789');
    expect(apple.origin).toBe('https://maps.apple.com');
    expect(apple.searchParams.get('ll')).toBe('28.5384,-81.3789');
  });

  it.each([
    { lat: NaN, lon: 0 },
    { lat: Infinity, lon: 0 },
    { lat: 91, lon: 0 },
    { lat: -91, lon: 0 },
    { lat: 0, lon: 181 },
    { lat: 0, lon: -181 }
  ])('rejects invalid coordinates %j', (point) => {
    expect(earthMapLinks(point)).toBeNull();
  });

  it('accepts boundary coordinates and zero', () => {
    expect(earthMapLinks({ lat: -90, lon: 180 })).not.toBeNull();
    expect(earthMapLinks({ lat: 0, lon: 0 })).not.toBeNull();
  });

  it('does not include user-supplied labels, tokens, or keys in outbound links', () => {
    const links = earthMapLinks({ lat: 48.8566, lon: 2.3522 });
    expect(JSON.stringify(links)).not.toMatch(/key=|token=|auth=/i);
  });
});
