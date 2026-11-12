/**
 * ATLAS Earth Exploration: reproducible public-source registry only.
 * No remote raster is bundled or represented as a verified local ingestion.
 * A map image being served by WMS proves only that imagery was retrieved.
 */
export type GebcoLayer = 'surface' | 'subice' | 'tid';
export type GebcoRegion = 'world' | 'antarctica' | 'atlantic';

export type EarthExplorationSource = {
  id: string;
  title: string;
  institution: string;
  year: number;
  doi: string;
  sourceUrl: string;
  browseUrl: string;
  nativeResolution: string;
  availableLayers: readonly string[];
  status: 'public-dataset-reference';
  explainsUncertainty: string;
  attribution: string;
};

export const EARTH_EXPLORATION_SOURCES: readonly EarthExplorationSource[] = [
  {
    id: 'bedmap3-2025',
    title: 'Bedmap3 — Antarctic bed, ice surface and thickness',
    institution: 'British Antarctic Survey / international Bedmap collaboration',
    year: 2025,
    doi: 'https://doi.org/10.5285/2d0e4791-8e20-46a3-80e4-f5f6716025d2',
    sourceUrl: 'https://www.bas.ac.uk/project/bedmap/',
    browseUrl: 'https://bedmap.scar.org/',
    nativeResolution: '500 m grid spacing (gridded model; not a 500 m detection guarantee)',
    availableLayers: [
      'bm3_bed', 'bm3_surface', 'bm3_thickness', 'bm3_bed_uncertainty',
      'bm3_thickness_uncertainty', 'bm3_masks', 'bm3_thickness_survey_count'
    ],
    status: 'public-dataset-reference',
    explainsUncertainty: 'Measured ice thickness and interpolated/modelled bed elevations must remain distinguishable. Survey coverage and uncertainty layers are required for scientific interpretation.',
    attribution: 'Pritchard, H. D., Fretwell, P. T., Fremand, A. C. et al. Bedmap3. Scientific Data 12, 414 (2025). https://doi.org/10.1038/s41597-025-04672-y'
  },
  {
    id: 'gebco-2026',
    title: 'GEBCO_2026 — global ocean and land terrain',
    institution: 'GEBCO / British Oceanographic Data Centre',
    year: 2026,
    doi: 'https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa',
    sourceUrl: 'https://www.gebco.net/data-products/gridded-bathymetry-data',
    browseUrl: 'https://www.gebco.net/data-products/gebco-web-services/web-map-service',
    nativeResolution: '15 arc-second grid interval; underlying measurements vary by area',
    availableLayers: ['ice surface elevation', 'sub-ice topography/bathymetry', 'TID'],
    status: 'public-dataset-reference',
    explainsUncertainty: 'The Type Identifier (TID) grid distinguishes source-data categories. Grid cell interval does not establish direct sounding coverage or archaeological detection resolution.',
    attribution: 'GEBCO Bathymetric Compilation Group 2026. The GEBCO_2026 Grid. https://doi.org/10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa'
  }
] as const;

// Documented layer names and example request: gebco.net/data-products/gebco-web-services/web-map-service
const LAYERS: Readonly<Record<GebcoLayer, string>> = {
  surface: 'gebco_latest',
  subice: 'gebco_latest_sub_ice_topo',
  tid: 'gebco_latest_tid'
};
// WMS 1.3.0 EPSG:4326 BBOX is latitude/longitude order (not longitude/latitude).
const REGIONS: Readonly<Record<GebcoRegion, string>> = {
  world: '-90,-180,90,360',
  antarctica: '-90,-180,-40,180',
  atlantic: '-60,-80,45,20'
};

export function buildGebcoMapUrl(layer: GebcoLayer, region: GebcoRegion): string {
  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: LAYERS[layer],
    crs: 'EPSG:4326',
    BBOX: REGIONS[region],
    width: '1200',
    height: '600',
    format: 'image/jpeg'
  });
  return `https://wms.gebco.net/mapserv?${params.toString()}`;
}
