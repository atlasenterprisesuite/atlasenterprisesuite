import { useEffect, useState } from 'react';

type Area = { name: string; lat: number; lon: number };
type WeatherAlert = { id: string; properties?: { event?: string; headline?: string; severity?: string; expires?: string; web?: string } };
const AREAS: Area[] = [
  { name: 'Orlando', lat: 28.5383, lon: -81.3792 },
  { name: 'Kissimmee', lat: 28.2919, lon: -81.4076 },
  { name: 'Sanford', lat: 28.8029, lon: -81.2695 },
  { name: 'Tampa', lat: 27.9506, lon: -82.4572 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 }
];
const NOAA_RADAR = 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer/export';
function radarUrl(area: Area, updatedAt: number): string {
  const halfLat = 0.95;
  const halfLon = 1.45;
  const bounds = [area.lon - halfLon, area.lat - halfLat, area.lon + halfLon, area.lat + halfLat].join(',');
  const params = new URLSearchParams({
    bbox: bounds, bboxSR: '4326', imageSR: '4326', size: '960,620',
    format: 'png32', transparent: 'false', f: 'image', _refresh: String(updatedAt)
  });
  return NOAA_RADAR + '?' + params.toString();
}
export function AtlasWeatherRadarPage() {
  const [areaIndex, setAreaIndex] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(Date.now());
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [alertStatus, setAlertStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [radarError, setRadarError] = useState(false);
  const area = AREAS[areaIndex];

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshedAt(Date.now()), 300000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setAlertStatus('loading');
    setAlerts([]);
    const url = 'https://api.weather.gov/alerts/active?point=' + area.lat + ',' + area.lon;
    fetch(url, { signal: controller.signal, headers: { Accept: 'application/geo+json' } })
      .then((response) => { if (!response.ok) throw new Error('NOAA alerts unavailable'); return response.json(); })
      .then((body: { features?: WeatherAlert[] }) => { setAlerts(Array.isArray(body.features) ? body.features : []); setAlertStatus('ready'); })
      .catch((error: unknown) => { if ((error as Error)?.name !== 'AbortError') setAlertStatus('error'); });
    return () => controller.abort();
  }, [area.lat, area.lon, refreshedAt]);

  return <section className="page-stack" aria-labelledby="atlas-weather-title">
    <header className="page-header">
      <p className="eyebrow">ATLAS 777 REVIEW · NOAA MRMS</p>
      <h1 id="atlas-weather-title">Weather Radar</h1>
      <p>Radar oficial de reflectividad y alertas del National Weather Service. Información observada, no predicción de trayectoria.</p>
    </header>
    <div className="feature-card">
      <div className="filter-row">
        <label className="field"><span>Región</span>
          <select value={areaIndex} onChange={(event) => { setAreaIndex(Number(event.target.value)); setRadarError(false); }} aria-label="Seleccionar región">
            {AREAS.map((item, index) => <option value={index} key={item.name}>{item.name}, Florida</option>)}
          </select>
        </label>
        <button type="button" onClick={() => { setRefreshedAt(Date.now()); setRadarError(false); }}>Actualizar radar y alertas</button>
      </div>
      <p>Última solicitud: {new Date(refreshedAt).toLocaleString('es-US')} · Actualización automática cada 5 minutos. La imagen puede corresponder a una observación anterior.</p>
      {radarError ? <div role="alert" className="notice">No fue posible cargar la imagen del radar. Comprueba el servicio oficial o vuelve a actualizar.</div> : null}
      <img key={area.name + refreshedAt} src={radarUrl(area, refreshedAt)} onError={() => setRadarError(true)}
        alt={'Mapa de reflectividad radar NOAA centrado en ' + area.name + ', Florida. Los colores indican ecos de radar, no necesariamente lluvia al suelo.'}
        style={{ width: '100%', height: 'auto', maxHeight: 620, objectFit: 'contain', background: '#eaf1f6', borderRadius: 12 }} />
      <p>Fuente: <a href="https://radar.weather.gov/" target="_blank" rel="noopener noreferrer">NOAA / National Weather Service Radar</a> · <a href="https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer" target="_blank" rel="noopener noreferrer">servicio GIS de reflectividad MRMS</a>.</p>
    </div>
    <section className="feature-card" aria-live="polite">
      <h2>Alertas oficiales para {area.name}</h2>
      {alertStatus === 'loading' && <p>Consultando avisos oficiales...</p>}
      {alertStatus === 'error' && <div role="alert" className="notice">No se pudieron verificar las alertas. Consulta <a href="https://www.weather.gov/mlb/" target="_blank" rel="noopener noreferrer">NWS Melbourne</a>. No interpretes el error como ausencia de riesgo.</div>}
      {alertStatus === 'ready' && alerts.length === 0 && <p>La API no devuelve alertas activas para este punto en esta consulta. Comprueba siempre los avisos locales.</p>}
      {alertStatus === 'ready' && alerts.map((alert) => <article key={alert.id} className="notice"><strong>{alert.properties?.event || 'Aviso meteorológico'}</strong><p>{alert.properties?.headline || 'Revisa el aviso completo en NOAA.'}</p><p>Severidad: {alert.properties?.severity || 'No especificada'} · Expira: {alert.properties?.expires || 'No especificado'}</p></article>)}
      <p>Fuente: <a href="https://api.weather.gov/alerts/active" target="_blank" rel="noopener noreferrer">NWS Alerts API</a>. Las alertas pueden actualizarse antes que el radar.</p>
    </section>
    <p className="notice">ATLAS no emite avisos oficiales ni sustituye alertas de emergencia. Si un servicio falla, el estado se muestra explícitamente; nunca se inventan observaciones.</p>
  </section>;
}
