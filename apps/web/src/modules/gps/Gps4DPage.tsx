import { useEffect, useRef, useState } from 'react';
import './gps4d.css';

type GeoPoint = { lat: number; lon: number; label: string };
type StoredPlace = GeoPoint & { category?: string };
type LeafletWindow = Window & { L?: any };

const ORLANDO: [number, number] = [28.5384, -81.3789];
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet(): Promise<any> {
  const win = window as LeafletWindow;
  if (win.L) return Promise.resolve(win.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve((window as LeafletWindow).L), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as LeafletWindow).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function milesBetween(a: GeoPoint, b: GeoPoint) {
  const r = 3958.7613;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(q));
}

export function Gps4DPage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const currentMarker = useRef<any>(null);
  const selectedMarker = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  const [providerState, setProviderState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [gpsState, setGpsState] = useState<'pending' | 'active' | 'blocked'>('pending');
  const [current, setCurrent] = useState<GeoPoint | null>(null);
  const [selected, setSelected] = useState<GeoPoint | null>(null);
  const [query, setQuery] = useState('');
  const [routeSummary, setRouteSummary] = useState('Activa el GPS y selecciona un destino.');
  const [saved, setSaved] = useState<StoredPlace[]>(() => {
    try { return JSON.parse(localStorage.getItem('atlas_gps_saved') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapNode.current || map.current) return;
      const instance = L.map(mapNode.current, { zoomControl: true }).setView(ORLANDO, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(instance);
      instance.on('click', (event: any) => {
        setSelected({ lat: event.latlng.lat, lon: event.latlng.lng, label: 'Punto seleccionado' });
      });
      map.current = instance;
      setProviderState('ready');
    }).catch(() => setProviderState('error'));
    return () => {
      cancelled = true;
      if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
      if (map.current) map.current.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !selected) return;
    const L = (window as LeafletWindow).L;
    if (!L) return;
    if (selectedMarker.current) selectedMarker.current.remove();
    selectedMarker.current = L.marker([selected.lat, selected.lon]).addTo(map.current).bindPopup(selected.label).openPopup();
  }, [selected]);

  useEffect(() => {
    localStorage.setItem('atlas_gps_saved', JSON.stringify(saved));
  }, [saved]);

  function startGps(center = true) {
    if (!navigator.geolocation) {
      setGpsState('blocked');
      return;
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition((position) => {
      const next = { lat: position.coords.latitude, lon: position.coords.longitude, label: 'Tu ubicación' };
      setCurrent(next);
      setGpsState('active');
      const L = (window as LeafletWindow).L;
      if (!L || !map.current) return;
      if (!currentMarker.current) currentMarker.current = L.marker([next.lat, next.lon]).addTo(map.current).bindPopup('Tu ubicación');
      else currentMarker.current.setLatLng([next.lat, next.lon]);
      if (center) map.current.setView([next.lat, next.lon], Math.max(map.current.getZoom(), 16));
    }, () => setGpsState('blocked'), { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
  }

  async function searchPlace() {
    const q = query.trim();
    if (!q) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&q=${encodeURIComponent(q)}`, {
        headers: { 'Accept-Language': 'es' }
      });
      if (!response.ok) throw new Error('search_failed');
      const rows = await response.json();
      if (!rows.length) throw new Error('not_found');
      const point = { lat: Number(rows[0].lat), lon: Number(rows[0].lon), label: rows[0].display_name as string };
      setSelected(point);
      map.current?.setView([point.lat, point.lon], 16);
    } catch {
      setRouteSummary('La búsqueda externa no está disponible en este momento.');
    }
  }

  async function calculateRoute() {
    if (!current || !selected) {
      setRouteSummary('Activa el GPS y selecciona un destino.');
      return;
    }
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${current.lon},${current.lat};${selected.lon},${selected.lat}?overview=full&geometries=geojson`);
      if (!response.ok) throw new Error('route_failed');
      const payload = await response.json();
      const route = payload.routes?.[0];
      if (!route) throw new Error('no_route');
      const L = (window as LeafletWindow).L;
      if (routeLayer.current) routeLayer.current.remove();
      routeLayer.current = L.geoJSON(route.geometry, { style: { weight: 6, opacity: 0.88 } }).addTo(map.current);
      map.current.fitBounds(routeLayer.current.getBounds(), { padding: [40, 40] });
      setRouteSummary(`${(route.distance / 1609.344).toFixed(1)} mi · ${Math.round(route.duration / 60)} min en automóvil`);
    } catch {
      setRouteSummary('El proveedor público de rutas no respondió. ATLAS mantiene el estado como no verificado.');
    }
  }

  function saveSelected() {
    if (!selected) return;
    if (saved.some((item) => item.lat === selected.lat && item.lon === selected.lon)) return;
    setSaved((items) => [...items, selected]);
  }

  const distance = current && selected ? milesBetween(current, selected) : null;

  return (
    <section className="gps4d-page">
      <header className="gps4d-header">
        <div>
          <p className="eyebrow">ATLAS GPS 4D</p>
          <h1>Orlando Navigation Recovery</h1>
          <p>Recovered from the original ATLAS GPS backup and mounted on the canonical /gps route.</p>
        </div>
        <div className="gps4d-badges">
          <span className="status-chip warning">EXTERNAL-GATED</span>
          <span className={`status-chip ${gpsState === 'active' ? '' : 'neutral'}`}>GPS {gpsState}</span>
        </div>
      </header>

      <div className="notice">
        OpenStreetMap, Nominatim and public OSRM are external public services. They are not shown as authenticated or SLA-backed ATLAS providers. Saved prototype points remain browser-local until tenant persistence and audit adapters are implemented.
      </div>

      <div className="gps4d-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void searchPlace()} placeholder="Buscar dirección, plaza o negocio…" />
        <button type="button" onClick={() => void searchPlace()}>Buscar</button>
        <button type="button" onClick={() => startGps(true)}>Mi ubicación</button>
        <button type="button" onClick={() => void calculateRoute()}>Ruta</button>
      </div>

      <div className="gps4d-layout">
        <div className="gps4d-map-wrap">
          <div ref={mapNode} className="gps4d-map" aria-label="ATLAS GPS map" />
          {providerState !== 'ready' && <div className="gps4d-overlay">{providerState === 'loading' ? 'Cargando mapa…' : 'Mapa externo no disponible.'}</div>}
        </div>

        <aside className="gps4d-panel">
          <h2>Panel ATLAS</h2>
          <dl className="gps4d-metrics">
            <div><dt>Destino</dt><dd>{selected?.label || 'Sin seleccionar'}</dd></div>
            <div><dt>Distancia directa</dt><dd>{distance === null ? '—' : `${distance.toFixed(1)} mi`}</dd></div>
            <div><dt>Ruta</dt><dd>{routeSummary}</dd></div>
          </dl>
          <div className="gps4d-actions">
            <button type="button" disabled={!selected} onClick={saveSelected}>Guardar punto</button>
            <button type="button" disabled={!routeLayer.current} onClick={() => { routeLayer.current?.remove(); routeLayer.current = null; setRouteSummary('Ruta eliminada.'); }}>Limpiar ruta</button>
          </div>
          <h3>Guardados</h3>
          {saved.length === 0 ? <p className="muted">Todavía no hay puntos guardados.</p> : (
            <div className="gps4d-saved">
              {saved.map((place, index) => (
                <div className="gps4d-saved-row" key={`${place.lat}-${place.lon}-${index}`}>
                  <button type="button" className="text-link" onClick={() => { setSelected(place); map.current?.setView([place.lat, place.lon], 16); }}>{place.label}</button>
                  <button type="button" aria-label={`Eliminar ${place.label}`} onClick={() => setSaved((items) => items.filter((_, i) => i !== index))}>×</button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
