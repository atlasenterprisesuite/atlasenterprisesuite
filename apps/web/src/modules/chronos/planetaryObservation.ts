// Documentary registry; no entry proves download, authenticity, or scientific review.
export type PlanetarySource = {
 id: string; title: string; url: string; kind: 'catalog'|'imagery'|'reconstruction'|'archive'|'governance'; status: 'reference-only';
};
const source=(id:string,title:string,url:string,kind:PlanetarySource['kind']):PlanetarySource=>({id,title,url,kind,status:'reference-only'});
export const planetarySources = [
 source('SCAR-ADD','SCAR Antarctic Digital Database','https://www.add.scar.org/','catalog'),
 source('BAS','British Antarctic Survey','https://www.bas.ac.uk/data/our-data/','archive'),
 source('NSIDC-0756-v4','MEaSUREs BedMachine Antarctica V4','https://nsidc.org/data/nsidc-0756/versions/4','reconstruction'),
 source('SOOS','Southern Ocean Observing System','https://soos.aq/','catalog'),
 source('NOAA-PALEO','NOAA Paleoclimatology','https://www.ncei.noaa.gov/products/paleoclimatology','archive'),
 source('USAP','US Antarctic Program Data Center','https://www.usap-dc.org/','catalog'),
 source('EARTHSCOPE','EarthScope','https://www.earthscope.org/','archive'),
 source('INTERMAGNET','INTERMAGNET','https://intermagnet.org/','archive'),
 source('GRACE','NASA GRACE','https://grace.jpl.nasa.gov/','archive'),
 source('BIODIVERSITY','Antarctic Biodiversity Portal','https://www.biodiversity.aq/','catalog'),
 source('NCBI','NCBI','https://www.ncbi.nlm.nih.gov/','archive'),
 source('METEORITES','NASA Astromaterials','https://curator.jsc.nasa.gov/','archive'),
 source('IBCSO','International Bathymetric Chart of the Southern Ocean','https://ibcso.org/','reconstruction'),
 source('CCAMLR','CCAMLR','https://www.ccamlr.org/','governance'),
 source('PGC','Polar Geospatial Center','https://www.pgc.umn.edu/data/','catalog'),
 source('COMNAP','COMNAP','https://www.comnap.aq/','catalog'),
 source('ATS','Antarctic Treaty Secretariat','https://www.ats.aq/','governance'),
 source('WORLDVIEW','NASA Worldview','https://worldview.earthdata.nasa.gov/','imagery'),
 source('GIBS','NASA GIBS Antarctic WMTS','https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/1.0.0/WMTSCapabilities.xml','catalog'),
 source('ICECUBE','IceCube Neutrino Observatory','https://icecube.wisc.edu/','archive'),
 source('AMRC','Antarctic Meteorological Research Center','https://amrc.ssec.wisc.edu/','archive'),
 source('CMR','NASA Common Metadata Repository','https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html','catalog'),
];
const definitions:[string,string[]][]=[
 ['Geografía',['SCAR-ADD','PGC']],['Geología',['BAS','USAP']],['Glaciología',['NSIDC-0756-v4','BAS']],['Oceanografía',['SOOS','IBCSO']],
 ['Meteorología',['AMRC','BAS']],['Paleoclimatología',['NOAA-PALEO']],['Vulcanología',['USAP','BAS']],['Sismología',['EARTHSCOPE','USAP']],
 ['Magnetismo',['INTERMAGNET']],['Gravitación',['GRACE']],['Biología',['BIODIVERSITY']],['Microbiología',['NCBI','USAP']],
 ['Paleontología',['BAS']],['Meteoritos',['METEORITES']],['Lagos subglaciales',['NSIDC-0756-v4','USAP']],['Batimetría',['IBCSO']],
 ['Hidrología',['BAS','USAP']],['Ecosistemas',['CCAMLR','BIODIVERSITY']],['Cartografía histórica',['PGC','SCAR-ADD']],['Estaciones científicas',['COMNAP']],
 ['Tratado Antártico',['ATS']],['Expediciones históricas',['BAS']],['Observación satelital',['WORLDVIEW','GIBS','CMR']],['Astronomía polar',['ICECUBE']]
];
export const disciplines=definitions.map(([title,sourceIds],i)=>({id:String(i+1).padStart(2,'0'),title,sourceIds}));
export type Projection='geographic'|'antarctic'|'arctic';
const projections:Record<Projection,string>={geographic:'4326',antarctic:'3031',arctic:'3413'};
export function parseObservationDate(value:string):string|null {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
 const date=new Date(value+'T00:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?value:null;
}
export function buildObservationLinks(date:string,projection:Projection){
 if(!parseObservationDate(date)||!Object.prototype.hasOwnProperty.call(projections,projection)) return null;
 const view=new URL('https://worldview.earthdata.nasa.gov/');
 view.searchParams.set('p',projection);
 view.searchParams.set('t',date);
 view.searchParams.set('l','Reference_Labels_15m,Coastlines_15m,BlueMarble_NextGeneration,MODIS_Terra_CorrectedReflectance_TrueColor');
 return {
  worldview:view.toString(),
  gibs:'https://gibs.earthdata.nasa.gov/wmts/epsg'+projections[projection]+'/best/1.0.0/WMTSCapabilities.xml',
  bedmachine:'https://nsidc.org/data/nsidc-0756/versions/4'
 };
}
