import { useEffect, useState } from 'react';

type Source = { name: string; operator: string; purpose: string; endpoint: string; status: 'integrated' | 'reference' };
export const EARTH_SOURCES: Source[] = [
  { name: 'GOES-East / ABI GeoColor', operator: 'NOAA NESDIS', purpose: 'Hemispheric near-real-time satellite imagery', endpoint: 'https://www.star.nesdis.noaa.gov/GOES/', status: 'integrated' },
  { name: 'NASA GIBS', operator: 'NASA ESDIS', purpose: 'Global time-indexed satellite layers via WMTS/WMS', endpoint: 'https://nasa-gibs.github.io/gibs-api-docs/', status: 'reference' },
  { name: 'NASA Worldview', operator: 'NASA ESDIS', purpose: 'Explore historical and recent Earth imagery', endpoint: 'https://worldview.earthdata.nasa.gov/', status: 'reference' },
  { name: 'NWS radar and alerts', operator: 'NOAA / NWS', purpose: 'Radar reflectivity and official active weather alerts', endpoint: 'https://radar.weather.gov/', status: 'integrated' },
  { name: 'USGS seismic events', operator: 'USGS', purpose: 'Earthquake feed, last 24 hours', endpoint: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php', status: 'integrated' },
  { name: 'NASA FIRMS', operator: 'NASA', purpose: 'Thermal anomalies and potential active fires', endpoint: 'https://firms.modaps.eosdis.nasa.gov/', status: 'reference' },
  { name: 'Copernicus Data Space', operator: 'European Commission / ESA', purpose: 'Sentinel optical and radar imagery', endpoint: 'https://dataspace.copernicus.eu/', status: 'reference' },
  { name: 'EUMETSAT', operator: 'EUMETSAT', purpose: 'European meteorological satellite products', endpoint: 'https://www.eumetsat.int/', status: 'reference' },
  { name: 'JAXA Earth Observation', operator: 'JAXA', purpose: 'Earth observation mission products', endpoint: 'https://earth.jaxa.jp/en/', status: 'reference' },
  { name: 'NOAA National Data Buoy Center', operator: 'NOAA', purpose: 'Ocean observations, wave and wind measurements', endpoint: 'https://www.ndbc.noaa.gov/', status: 'reference' }
];
type Quake = { id: string; properties: { mag: number | null; place: string; time: number; url: string } };
const GOES_IMAGES = [
  { label: 'GOES-East · Full Disk', url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg' },
  { label: 'GOES-East · CONUS', url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/CONUS/GEOCOLOR/1250x750.jpg' }
] as const;
export function AtlasEarthObservatoryPage() {
  const [view, setView] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [quakeStatus, setQuakeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const timer = window.setInterval(() => setRefresh((previous) => previous + 1), 300000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setQuakeStatus('loading');
    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('USGS unavailable'); return response.json(); })
      .then((data: { features?: Quake[] }) => { setQuakes(Array.isArray(data.features) ? data.features.slice(0, 12) : []); setQuakeStatus('ready'); })
      .catch((error: unknown) => { if ((error as Error).name !== 'AbortError') setQuakeStatus('error'); });
    return () => controller.abort();
  }, [refresh]);
  const image = GOES_IMAGES[view];
  return <section className="page-stack">
    <header className="page-header"><p className="eyebrow">ATLAS Earth Observatory 777</p><h1>La Tierra desde el espacio</h1>
      <p>Imágenes de satélite de NOAA y observaciones geofísicas de USGS, con procedencia explícita y fuentes de investigación verificables.</p></header>
    <div className="feature-card">
      <div className="filter-row">
        <label className="field"><span>Vista satelital</span><select value={view} onChange={(event) => { setView(Number(event.target.value)); setImageError(false); setImageLoaded(false); }}>
          {GOES_IMAGES.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
        </select></label>
        <button type="button" onClick={() => { setRefresh((value) => value + 1); setImageError(false); setImageLoaded(false); }}>Actualizar observaciones</button>
      </div>
      <p>Fuente: NOAA GOES-19 ABI GeoColor. Imagen remota, no transmisión de video continuo. La fecha de captura no se obtiene del archivo; no se supone que corresponda al instante actual.</p>
      {!imageLoaded && !imageError && <p role="status">Cargando imagen satelital oficial...</p>}
      {imageError && <p className="notice" role="alert">No se pudo cargar la imagen de NOAA. Usa el visor oficial hasta que esté disponible.</p>}
      <img key={image.url + refresh} src={image.url + '?refresh=' + refresh}
        onLoad={() => setImageLoaded(true)} onError={() => { setImageError(true); setImageLoaded(false); }}
        alt={'Imagen satelital ' + image.label + ' del hemisferio occidental publicada por NOAA'}
        style={{ width: '100%', maxHeight: '72vh', height: 'auto', objectFit: 'contain', background: '#071322', borderRadius: 12 }} />
      <p><a href="https://www.star.nesdis.noaa.gov/GOES/" target="_blank" rel="noopener noreferrer">Abrir visor original NOAA</a> · <a href="/weather/radar">Abrir ATLAS Weather Radar</a></p>
    </div>
    <section className="feature-card" aria-live="polite">
      <h2>Actividad sísmica reciente · USGS</h2>
      <p>Eventos de magnitud 2.5 o superior en las últimas 24 horas reportados por USGS. No son predicciones.</p>
      {quakeStatus === 'loading' && <p>Consultando USGS...</p>}
      {quakeStatus === 'error' && <p role="alert" className="notice">No se pudo verificar el feed USGS. El fallo no significa ausencia de sismos.</p>}
      {quakeStatus === 'ready' && quakes.length === 0 && <p>USGS no devolvió eventos en esta consulta.</p>}
      {quakeStatus === 'ready' && <ul>{quakes.map((quake) => <li key={quake.id}><a href={quake.properties.url} target="_blank" rel="noopener noreferrer">{quake.properties.place}</a> · Magnitud {quake.properties.mag ?? 's/d'} · {new Date(quake.properties.time).toLocaleString('es-US')}</li>)}</ul>}
    </section>
    <section className="feature-card">
      <h2>Registro de fuentes: el ADN de ATLAS Earth</h2>
      <p>Una fuente en catálogo no significa integración activa. Cada nuevo conector requiere verificar licencias, metadatos, latencia, coordenadas, controles de cuota, fallos y evidencia reproducible.</p>
      <div className="evidence-list">{EARTH_SOURCES.map((source) => <article key={source.name} className="evidence-card">
        <strong>{source.name}</strong><p>{source.operator} · {source.purpose}</p><p>Estado: {source.status === 'integrated' ? 'Integración inicial en código (sin E2E)' : 'Fuente documentada, sin conexión activa'}</p>
        <a href={source.endpoint} target="_blank" rel="noopener noreferrer">Documentación / fuente primaria</a></article>)}</div>
    </section>
    <div className="notice">Esta vista muestra la imagen satelital original en 2D; no representa un globo 3D interactivo. Las imágenes y feeds no sustituyen advertencias de emergencia.</div>
  </section>;
}
