import { describe, expect, it } from 'vitest';
import {
  EARTH_EXPLORATION_SOURCES,
  buildGebcoMapUrl,
  type GebcoLayer,
  type GebcoRegion
} from '../../apps/web/src/modules/knowledge/earthExplorationSources';

describe('ATLAS Earth Exploration — official datasets and source boundaries', () => {
  it('preserves citable official sources and distinct observational/model classifications', () => {
    expect(EARTH_EXPLORATION_SOURCES.map(source => source.id)).toEqual(['bedmap3-2025', 'gebco-2026']);
    for (const source of EARTH_EXPLORATION_SOURCES) {
      expect(source.doi).toMatch(/^https:\/\/doi\.org\/10\./);
      expect(source.sourceUrl).toMatch(/^https:\/\//);
      expect(source.explainsUncertainty).toBeTruthy();
      expect(source.status).toBe('public-dataset-reference');
    }
    expect(EARTH_EXPLORATION_SOURCES[0].availableLayers).toContain('bm3_bed_uncertainty');
    expect(EARTH_EXPLORATION_SOURCES[1].availableLayers).toContain('TID');
  });

  it.each([
    ['surface', 'gebco_latest'],
    ['subice', 'gebco_latest_sub_ice_topo'],
    ['tid', 'gebco_latest_tid']
  ] as [GebcoLayer, string][])('maps %s to the documented GEBCO WMS layer', (layer, expected) => {
    const url = new URL(buildGebcoMapUrl(layer, 'world'));
    expect(url.origin).toBe('https://wms.gebco.net');
    expect(url.searchParams.get('service')).toBe('WMS');
    expect(url.searchParams.get('version')).toBe('1.3.0');
    expect(url.searchParams.get('request')).toBe('GetMap');
    expect(url.searchParams.get('crs')).toBe('EPSG:4326');
    expect(url.searchParams.get('layers')).toBe(expected);
    expect(url.searchParams.get('format')).toBe('image/jpeg');
    expect(url.searchParams.get('token')).toBeNull();
  });

  it.each([
    ['world', '-90,-180,90,360'],
    ['antarctica', '-90,-180,-40,180'],
    ['atlantic', '-60,-80,45,20']
  ] as [GebcoRegion, string][])('uses WMS 1.3 latitude-longitude axis order for %s', (region, bbox) => {
    const url = new URL(buildGebcoMapUrl('subice', region));
    expect(url.searchParams.get('BBOX')).toBe(bbox);
    expect(url.searchParams.get('width')).toBe('1200');
    expect(url.searchParams.get('height')).toBe('600');
  });
});
