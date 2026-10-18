import { describe, expect, it } from 'vitest';
import { filterTransportModes, WORLD_TRANSPORT_MODES } from '../../apps/web/src/modules/ride/worldTransportCatalog';

describe('ATLAS world transportation catalog', () => {
  it('has unique stable IDs and valid maturity states', () => {
    expect(new Set(WORLD_TRANSPORT_MODES.map(x=>x.id)).size).toBe(WORLD_TRANSPORT_MODES.length);
    expect(WORLD_TRANSPORT_MODES.every(x=>['operational','limited','pilot','concept'].includes(x.maturity))).toBe(true);
  });
  it('labels theoretical technologies as concepts', () => {
    expect(WORLD_TRANSPORT_MODES.find(x=>x.id==='space-elevator')?.maturity).toBe('concept');
    expect(WORLD_TRANSPORT_MODES.find(x=>x.id==='hyperloop')?.maturity).toBe('concept');
  });
  it('filters by category, maturity and case-insensitive Spanish search', () => {
    expect(filterTransportModes('rail','concept','HYPERLOOP').map(x=>x.id)).toEqual(['hyperloop']);
    expect(filterTransportModes('water','concept','')).toEqual([]);
    expect(filterTransportModes('all','all','sin-coincidencia')).toEqual([]);
  });
});
