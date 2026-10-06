import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { calculateGpsRoute, type GpsPoint } from '../gps/gpsApi';
import { formatDistance, formatDuration } from '../gps/gpsDomain';
import { buildGoogleRouteRequest, planRideStops } from './routePlanning';
import { RideSubnav } from './RideSubnav';

function parsePoints(text: string): GpsPoint[] {
  return text.trim().split('\n').filter(Boolean).map(line => {
    const fields = line.split(';').map(v => v.trim());
    if (fields.length !== 3 || !fields[1] || !fields[2]) throw new Error('Usa nombre;latitud;longitud en cada línea.');
    return { label: fields[0], lat: Number(fields[1]), lon: Number(fields[2]) };
  });
}

export function RoutePlanningPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof planRideStops> | null>(null);
  const [road, setRoad] = useState<{ distance: number; duration: number } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  function input() {
    const points = parsePoints(text);
    if (points.length < 2) throw new Error('Introduce origen y destino, con paradas intermedias opcionales.');
    return { origin: points[0], destination: points[points.length - 1], stops: points.slice(1, -1) };
  }
  function plan() {
    setError(''); setRoad(null); setResult(null);
    try {
      const { origin, destination, stops } = input();
      setResult(planRideStops(origin, destination, stops));
    } catch (e) { setError((e as Error).message); }
  }
  async function roadRoute() {
    if (!result || busy) return;
    const revision = version.current;
    setBusy(true); setError(''); setRoad(null);
    try {
      const { origin, destination } = input();
      const points = [origin, ...result.stops, destination];
      let distance = 0; let duration = 0;
      for (let i = 1; i < points.length; i++) {
        if (revision !== version.current) return;
        const response = await calculateGpsRoute(points[i - 1], points[i]);
        const leg = response.routes?.[0];
        if (!leg || !Number.isFinite(leg.distance_m) || !Number.isFinite(leg.duration_s) || leg.distance_m < 0 || leg.duration_s < 0) {
          throw new Error('No se obtuvo una ruta vial verificable para todas las paradas.');
        }
        distance += leg.distance_m; duration += leg.duration_s;
      }
      if (revision === version.current) setRoad({ distance, duration });
    } catch {
      if (revision === version.current) setError('El proveedor vial no respondió con una ruta completa. Puedes conservar el plan geométrico y reintentar.');
    } finally { setBusy(false); }
  }
  function download(google: boolean) {
    if (!result) return;
    try {
      const { origin, destination } = input();
      const data = google ? buildGoogleRouteRequest(origin, destination, result.stops) : { origin, destination, ...result, road };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = google ? 'atlas-google-route-request.json' : 'atlas-route-plan.json'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError((e as Error).message); }
  }
  return <section className="ride-page ride-route-pilot">
    <header><p className="eyebrow">ATLAS Ride OS</p><h1>Planificador de rutas</h1>
      <p>Piloto de un vehículo · hasta 8 paradas · sin despacho de viajes.</p></header>
    <RideSubnav />
    <p className="ride-operation-status">ATLAS ordena paradas localmente por distancia geométrica. No considera tráfico, horarios ni capacidad. La consulta vial utiliza el proveedor existente de GPS y no garantiza el mejor orden por carretera.</p>
    <label htmlFor="ride-route-points">Origen, paradas y destino — una línea por punto: nombre;latitud;longitud</label>
    <textarea id="ride-route-points" rows={8} value={text} placeholder="Introduce coordenadas de tus ubicaciones" disabled={busy}
      onChange={e => { version.current++; setText(e.target.value); setResult(null); setRoad(null); setError(''); }} />
    <div className="ride-route-actions">
      <button type="button" disabled={busy || !text.trim()} onClick={plan}>Ordenar paradas</button>
      <button type="button" disabled={busy || !result} onClick={() => void roadRoute()}>{busy ? 'Consultando…' : 'Consultar distancia vial'}</button>
      <button type="button" disabled={busy || !result} onClick={() => download(false)}>Exportar plan ATLAS</button>
      <button type="button" disabled={busy || !result} onClick={() => download(true)}>Exportar solicitud Google</button>
    </div>
    {error && <p className="ride-message error" role="alert">{error}</p>}
    {busy && <p role="status">Calculando tramos con el proveedor de GPS…</p>}
    {result && <div className="ride-message" aria-live="polite">
      <h2>Orden propuesto</h2><ol>{[input().origin, ...result.stops, input().destination].map((p, i) => <li key={i}>{p.label}</li>)}</ol>
      <p>Distancia geométrica: {formatDistance(result.distance_m)} · orden original: {formatDistance(result.original_distance_m)}</p>
      {road && <p>Ruta vial consultada: {formatDistance(road.distance)} · duración estimada por el proveedor: {formatDuration(road.duration)}</p>}
    </div>}
    <p className="ride-privacy-note">Los puntos permanecen en esta página hasta que consultes rutas o exportes. Google Route Optimization no está conectado: la exportación prepara el cuerpo de una solicitud para un proyecto autorizado, con OAuth, IAM y facturación. No ejecuta llamadas a Google.</p>
    <Link to="/gps">Abrir GPS 4D y capas de mapas</Link>
  </section>;
}
