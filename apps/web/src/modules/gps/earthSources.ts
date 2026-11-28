/** Public geospatial source contracts. Runtime coverage and provider terms require separate verification. */
export type EarthRasterKind = 'satellite' | 'bathymetry';
export function decodeTerrarium(red: number,green: number,blue: number): number{if(![red,green,blue].every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw new RangeError("Invalid Terrarium channel");return red*256+green+blue/256-32768}
export function terrainDemSource(){return {type:"raster-dem" as const,url:"https://tiles.mapterhorn.com/tilejson.json",encoding:"terrarium" as const,tileSize:512,attribution:"Mapterhorn — attribution: https://mapterhorn.com/attribution"}}
export function earthRasterSource(kind: EarthRasterKind,date?: string){
 if(kind==="bathymetry")return {type:"raster" as const,tiles:["https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/GEBCO_basemap_NCEI/MapServer/tile/{z}/{y}/{x}"],tileSize:256,maxzoom:8,attribution:"GEBCO_2024; NOAA NCEI; Natural Earth; Esri coastlines — shaded relief, not measured depth"};
 if(kind!=="satellite")throw new RangeError("Invalid Earth source");
 if(typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new RangeError("Invalid observation date");
 const timestamp=Date.parse(date+"T00:00:00Z");
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==date)throw new RangeError("Invalid observation date");
 return {type:"raster" as const,tiles:["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/"+date+"/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"],tileSize:256,maxzoom:9,attribution:"NASA GIBS / NOAA-20 VIIRS — observation date "+date+"; clouds and gaps possible"};
}
