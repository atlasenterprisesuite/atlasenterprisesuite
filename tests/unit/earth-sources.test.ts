import { describe, expect, it } from 'vitest';
import { earthRasterSource, terrainDemSource, decodeTerrarium, earthRasterStyle, hasLoadedEarthTile } from '../../apps/web/src/modules/gps/earthSources';

describe('Earth source contracts', () => {
  it('uses an explicit valid date for NASA imagery and bounded zoom', () => {
    const source = earthRasterSource('satellite', '2025-06-01');
    expect(source.tiles[0]).toContain('/2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}');
    expect(source.maxzoom).toBe(9);
    expect(() => earthRasterSource('satellite', '2025-02-30')).toThrow();
    expect(() => earthRasterSource('satellite', '../bad')).toThrow();
  });
  it('keeps bathymetric relief separate from numerical depth', () => {
    const source = earthRasterSource('bathymetry');
    expect(source.tiles[0]).toContain('GEBCO_basemap_NCEI/MapServer/tile/{z}/{y}/{x}');
    expect(source.attribution).toContain('GEBCO_2024');
    expect(source.type).toBe('raster');
  });
  it('specifies Terrarium format and decodes signed elevation', () => {
    expect(terrainDemSource()).toMatchObject({type:'raster-dem', encoding:'terrarium', tileSize:512});
    expect(decodeTerrarium(128,0,0)).toBe(0);
    expect(decodeTerrarium(127,255,128)).toBe(-0.5);
    expect(decodeTerrarium(128,10,128)).toBe(10.5);
    expect(() => decodeTerrarium(256,0,0)).toThrow();
  });
  it('builds a real provider style with attribution and no synthetic fallback', () => {
    const style = earthRasterStyle('satellite', '2025-06-01');
    expect(style.version).toBe(8);
    expect(style.sources['earth-observation']).toEqual(earthRasterSource('satellite', '2025-06-01'));
    expect(style.layers).toContainEqual({id:'earth-observation',type:'raster',source:'earth-observation'});
    expect(earthRasterStyle('bathymetry').sources['earth-observation']).toEqual(earthRasterSource('bathymetry'));
  });
  it('requires a loaded tile, not just a style or metadata event', () => {
    expect(hasLoadedEarthTile({sourceId:'earth-observation',sourceDataType:'metadata'})).toBe(false);
    expect(hasLoadedEarthTile({sourceId:'earth-observation',tile:{state:'errored'}})).toBe(false);
    expect(hasLoadedEarthTile({sourceId:'other',tile:{state:'loaded'}})).toBe(false);
    expect(hasLoadedEarthTile({sourceId:'earth-observation',tile:{state:'loaded'}})).toBe(true);
    expect(hasLoadedEarthTile(null)).toBe(false);
  });
});
