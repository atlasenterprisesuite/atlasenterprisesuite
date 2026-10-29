import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { calculateGpsRoute, searchGpsPlaces, type GpsPoint } from '../gps/gpsApi';
import { formatDistance, formatDuration } from '../gps/gpsDomain';
import { validateRidePoints } from './routePlanning';
import { RideSubnav } from './RideSubnav';

type TripPlace = { id: number; query: string; point: GpsPoint | null };
type TripSummary = { points: GpsPoint[]; distance: number; duration: number; sources: string[] };

function PlaceField({ label, value, onChange, disabled }: {
  label: string; value: TripPlace; onChange: (query: string, point: GpsPoint | null) => void; disabled: boolean;
}) {
  const id = useId();
  const revision = useRef(0);
  const [results, setResults] = useState<GpsPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => { revision.current++; }, []);
  async function search() {
    const current = ++revision.current;
    setBusy(true); setMessage(''); setResults([]);
    try {
      const response = await searchGpsPlaces(value.query.trim(), 'es');
      if (current !== revision.current) return;
      if (response.ok !== true || !Array.isArray(response.results)) throw new Error('invalid_search');
      const places = response.results.filter(p => p.label?.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180);
      setResults(places);
      if (!places.length) setMessage('No se encontraron lugares. Prueba una dirección más precisa.');
    } catch {
      if (current === revision.current) setMessage('No se pudo buscar. Revisa la conexión y vuelve a intentar.');
    } finally { if (current === revision.current) setBusy(false); }
  }
  return <div className="ride-trip-place">
    <label htmlFor={id}>{label}</label>
    <div className="ride-trip-search">
      <input id={id} value={value.query} disabled={disabled} autoComplete="off" maxLength={200}
        placeholder="Dirección o nombre del lugar" aria-describedby={`${id}-status`}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (value.query.trim().length >= 3 && !busy && !disabled) void search(); } }}
        onChange={event => { revision.current++; setBusy(false); setResults([]); setMessage(''); onChange(event.target.value, null); }} />
      <button type="button" disabled={disabled || busy || value.query.trim().length < 3} onClick={() => void search()} aria-label={`Buscar ${label.toLowerCase()}`}>{busy ? 'Buscando…' : 'Buscar'}</button>
    </div>
    <p id={`${id}-status`} className="ride-trip-place-status" role="status">{busy ? 'Consultando lugares…' : message || (value.point ? 'Lugar seleccionado' : 'Busca y selecciona un resultado para continuar.')}</p>
    {results.length > 0 && <ul className="ride-trip-results" aria-label={`Resultados de ${label.toLowerCase()}`}>
      {results.map((point, i) => <li key={i}><button type="button" disabled={disabled} onClick={() => {
        revision.current++; setResults([]); setMessage(''); onChange(point.label, { label: point.label, lat: point.lat, lon: point.lon });
      }}>{point.label}</button></li>)}
    </ul>}
  </div>;
}

export function TripPlanningPage() {
  const nextId = useRef(2);
  const [places, setPlaces] = useState<TripPlace[]>([{ id: 0, query: '', point: null }, { id: 1, query: '', point: null }]);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);
  function update(next: TripPlace[]) {
    revision.current++; setPlaces(next); setSummary(null); setError('');
  }
  async function calculate() {
    if (busy || places.some(p => !p.point)) return;
    const current = ++revision.current;
    const points = places.map(p => p.point!);
    setBusy(true); setSummary(null); setError('');
    try {
      validateRidePoints(points[0], points[points.length - 1], points.slice(1, -1));
      let distance = 0; let duration = 0;
      const sources = new Set<string>();
      for (let i = 1; i < points.length; i++) {
        if (current !== revision.current) return;
        const response = await calculateGpsRoute(points[i - 1], points[i]);
        const leg = response.routes?.[0];
        if (response.ok !== true || !leg || !Number.isFinite(leg.distance_m) || leg.distance_m < 0 || !Number.isFinite(leg.duration_s) || leg.duration_s < 0 || !response.source?.trim()) {
          throw new Error('incomplete_route');
        }
        distance += leg.distance_m; duration += leg.duration_s; sources.add(response.source);
      }
      if (!Number.isFinite(distance) || !Number.isFinite(duration)) throw new Error('invalid_totals');
      if (current === revision.current) setSummary({ points, distance, duration, sources: [...sources] });
    } catch {
      if (current === revision.current) setError('No se pudo obtener el recorrido completo. Conservamos tus lugares para que puedas reintentar.');
    } finally { if (current === revision.current) setBusy(false); }
  }
  const destination = summary?.points[summary.points.length - 1];
  return <section className="ride-page ride-trip-page">
    <header><p className="eyebrow">ATLAS Ride</p><h1>Prepara tu viaje</h1><p>Elige tus lugares y consulta el recorrido antes de salir.</p></header>
    <RideSubnav />
    <p className="ride-operation-status">Reserva y pago no disponibles. Esta pantalla prepara un recorrido; no asigna vehículo ni solicita un viaje. Waymo no está conectado.</p>
    <div className="ride-trip-layout">
      <form className="ride-requirement-card ride-trip-form" aria-label="Preparar viaje" aria-busy={busy} onSubmit={event => { event.preventDefault(); void calculate(); }}>
        <h2>¿A dónde vamos?</h2>
        {places.map((place, index) => <div key={place.id}>
          <PlaceField label={index === 0 ? 'Origen' : index === places.length - 1 ? 'Destino' : `Parada ${index}`} value={place} disabled={busy}
            onChange={(query, point) => update(places.map(p => p.id === place.id ? { ...p, query, point } : p))} />
          {index > 0 && index < places.length - 1 && <button type="button" disabled={busy} onClick={() => update(places.filter(p => p.id !== place.id))}>Quitar parada {index}</button>}
        </div>)}
        <div className="ride-route-actions">
          <button type="button" disabled={busy || places.length >= 6} onClick={() => update([...places.slice(0, -1), { id: nextId.current++, query: '', point: null }, places[places.length - 1]])}>Agregar parada</button>
          <button type="submit" disabled={busy || places.some(p => !p.point)}>{busy ? 'Consultando…' : 'Consultar recorrido'}</button>
          <button type="button" disabled={busy} onClick={() => update([{ id: nextId.current++, query: '', point: null }, { id: nextId.current++, query: '', point: null }])}>Limpiar viaje</button>
        </div>
        <p>Hasta cuatro paradas intermedias. Se respeta el orden que introduces.</p>
      </form>
      <aside className="ride-requirement-card" aria-label="Resumen del recorrido" aria-live="polite">
        {busy && <p role="status">Consultando todos los tramos con GPS…</p>}
        {error && <p className="ride-message error" role="alert">{error}</p>}
        {!summary && !busy && <p>Selecciona los lugares y consulta para ver la distancia y la duración estimadas.</p>}
        {summary && destination && <>
          <h2>Tu recorrido</h2>
          <ol>{summary.points.map((point, index) => <li key={index}>{point.label}</li>)}</ol>
          <dl className="ride-metadata-grid">
            <div><dt>Distancia vial</dt><dd>{formatDistance(summary.distance)}</dd></div>
            <div><dt>Duración estimada</dt><dd>{formatDuration(summary.duration)}</dd></div>
          </dl>
          <p>Estimación del recorrido sin tráfico en vivo ni tiempo de espera de un vehículo. Proveedor: {summary.sources.join(', ')}.</p>
          <Link to={`/gps?${new URLSearchParams({ lat: String(destination.lat), lon: String(destination.lon), label: destination.label })}`}>Abrir destino en GPS 4D</Link>
          <p>GPS abre el destino final. El origen y las paradas de este plan no se transfieren.</p>
        </>}
      </aside>
    </div>
    <p className="ride-privacy-note">Los lugares permanecen en esta pantalla y se borran al salir. Al buscar o consultar se envían al servicio de GPS de tu organización y a sus proveedores de mapas y rutas. El proveedor vial puede no estar disponible; no se muestra un recorrido parcial como completo.</p>
    <Link to="/ride/routes">Abrir planificador avanzado y exportar rutas</Link>
  </section>;
}
