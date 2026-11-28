import { describe, expect, it } from 'vitest';
import { readSharedGpsPoint, readTravelDestination } from '../../apps/web/src/modules/gps/earthEntry';

describe('Earth Digital Twin entry', () => {
  it('rejects absent, incomplete, blank, duplicated and malformed coordinates', () => {
    for (const query of ['', '?lat=12', '?lat=&lon=0', '?lat=0&lon=%20', '?lat=1&lat=2&lon=3', '?lat=91&lon=0', '?lat=0&lon=181', '?lat=NaN&lon=1', '?lat=0x12&lon=1']) {
      expect(readSharedGpsPoint(query)).toBeNull();
    }
  });
  it('accepts explicit zero and negative coordinates, with a bounded label', () => {
    expect(readSharedGpsPoint('?lat=0&lon=0')).toEqual({lat:0,lon:0,label:'Destino compartido'});
    expect(readSharedGpsPoint('?lat=28.5&lon=-81.3&label=Orlando')).toEqual({lat:28.5,lon:-81.3,label:'Orlando'});
    expect(readSharedGpsPoint('?lat=90&lon=-180&label='+ 'a'.repeat(200))?.label.length).toBe(160);
  });
  it('accepts only bounded explicit travel destination state', () => {
    expect(readTravelDestination({travelDestination:'  Tokyo, Japón  '})).toBe('Tokyo, Japón');
    for (const state of [null, {}, {travelDestination:42}, {travelDestination:' '}, {travelDestination:'a'.repeat(161)}, {travelDestination:'a\nb'}]) {
      expect(readTravelDestination(state)).toBe('');
    }
  });
});
