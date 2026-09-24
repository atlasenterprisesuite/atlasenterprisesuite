import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateGpsRoute,
  deleteGpsPlace,
  listGpsSavedPlaces,
  saveGpsPlace,
  searchGpsPlaces,
  type GpsPoint,
  type GpsRoute,
  type GpsRouteStep,
  type GpsSavedPlace
} from './gpsApi';
import {
  GPS_CAPABILITY_MATRIX,
  formatDistance,
  formatDuration,
  metersBetween,
  routeDeviationMeters,
  routeProgress,
  spokenInstruction,
  type GpsViewMode
} from './gpsDomain';
import './gps4d.css';

type LivePosition = GpsPoint & {
  accuracy_m: number | null;
  heading_deg: number | null;
  speed_mps: number | null;
  timestamp: number;
};

const ORLANDO: [number, number] = [-81.3789, 28.5384];
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.css';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.mjs';
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/bright';
const USGS_TILE = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
const TERRAIN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json';
const REROUTE_THRESHOLD_M = 80;
const REROUTE_COOLDOWN_MS = 15_000;

function satelliteStyle(withTerrain = false): any {
  const style: any = {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [USGS_TILE],
        tileSize: 256,
        maxzoom: 16,
        attribution: 'USDA, USGS The National Map: Orthoimagery'
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#07101b' } },
      { id: 'satellite', type: 'raster', source: 'satellite' }
    ]
  };
  if (withTerrain) {
    style.sources.terrain = { type: 'raster-dem', url: TERRAIN_TILEJSON };
    style.terrain = { source: 'terrain', exaggeration: 1.15 };
  }
  return style;
}

async function loadMapLibre() {
  if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
  }
  return import(/* @vite-ignore */ MAPLIBRE_JS) as Promise<any>;
}

function pointFromSaved(place: GpsSavedPlace): GpsPoint {
  return {
    lat: Number(place.latitude),
    lon: Number(place.longitude),
    label: place.label,
    category: place.category || undefined
  };
}

function instructionLabel(step: GpsRouteStep | null) {
  if (!step) return 'Sin instrucción activa';
  return spokenInstruction(step) || step.name || 'Continúa';
}

function laneLabel(step: GpsRouteStep | null) {
  const lanes = step?.lanes || [];
  const usable = lanes.filter((lane) => lane.valid || lane.active);
  if (!usable.length) return 'Sin evidencia de carril';
  const labels = usable
    .flatMap((lane) => lane.indications)
    .filter(Boolean)
    .map((value) => value.replaceAll('_', ' '));
  return [...new Set(labels)].join(' / ') || 'Carril válido indicado';
}

export function Gps4DPage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const maplibre = useRef<any>(null);
  const currentMarker = useRef<any>(null);
  const selectedMarker = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const activeRouteRef = useRef<GpsRoute | null>(null);
  const selectedRef = useRef<GpsPoint | null>(null);
  const navigationActiveRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const currentStepIndexRef = useRef(0);
  const spokenStepIdRef = useRef('');
  const lastRerouteAt = useRef(0);

  const [providerState, setProviderState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [gpsState, setGpsState] = useState<'pending' | 'active' | 'blocked'>('pending');
  const [viewMode, setViewMode] = useState<GpsViewMode>('street');
  const [current, setCurrent] = useState<LivePosition | null>(null);
  const [selected, setSelected] = useState<GpsPoint | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GpsPoint[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [routes, setRoutes] = useState<GpsRoute[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [routingState, setRoutingState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [routeMessage, setRouteMessage] = useState('Activa el GPS y selecciona un destino.');
  const [navigationActive, setNavigationActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [deviationM, setDeviationM] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [remainingM, setRemainingM] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [saved, setSaved] = useState<GpsSavedPlace[]>([]);
  const [persistenceState, setPersistenceState] = useState<'loading' | 'ready' | 'blocked'>('loading');

  const activeRoute = routes[activeRouteIndex] || null;
  const activeStep = activeRoute?.steps?.[currentStepIndex] || null;

  useEffect(() => { activeRouteRef.current = activeRoute; }, [activeRoute]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { navigationActiveRef.current = navigationActive; }, [navigationActive]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { currentStepIndexRef.current = currentStepIndex; }, [currentStepIndex]);

  useEffect(() => {
    let cancelled = false;
    loadMapLibre().then((module) => {
      if (cancelled || !mapNode.current || map.current) return;
      maplibre.current = module;
      const instance = new module.Map({
        container: mapNode.current,
        style: STREET_STYLE,
        center: ORLANDO,
        zoom: 11.5,
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
        attributionControl: true
      });
      instance.addControl(new module.NavigationControl({ visualizePitch: true }), 'top-right');
      if (module.GlobeControl) instance.addControl(new module.GlobeControl(), 'top-right');
      instance.on('load', () => setProviderState('ready'));
      instance.on('error', () => {
        if (!instance.loaded()) setProviderState('error');
      });
      instance.on('click', (event: any) => {
        setSelected({
          lat: event.lngLat.lat,
          lon: event.lngLat.lng,
          label: 'Punto seleccionado'
        });
      });
      map.current = instance;
    }).catch(() => setProviderState('error'));

    return () => {
      cancelled = true;
      if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
      map.current?.remove();
      map.current = null;
      maplibre.current = null;
    };
  }, []);

  useEffect(() => {
    listGpsSavedPlaces()
      .then((result) => {
        setSaved(result.places || []);
        setPersistenceState('ready');
      })
      .catch(() => setPersistenceState('blocked'));
  }, []);

  useEffect(() => {
    if (!map.current || !selected || !maplibre.current) return;
    if (selectedMarker.current) selectedMarker.current.remove();
    selectedMarker.current = new maplibre.current.Marker({ color: '#ffb020' })
      .setLngLat([selected.lon, selected.lat])
      .setPopup(new maplibre.current.Popup({ offset: 22 }).setText(selected.label))
      .addTo(map.current);
  }, [selected]);

  useEffect(() => {
    if (!map.current) return;
    const instance = map.current;
    const applyMode = () => {
      try {
        if (viewMode === 'street') {
          if (instance.setProjection) instance.setProjection({ type: 'mercator' });
          instance.setTerrain?.(null);
          instance.setPitch(0);
          instance.setStyle(STREET_STYLE);
        } else if (viewMode === 'satellite') {
          if (instance.setProjection) instance.setProjection({ type: 'mercator' });
          instance.setTerrain?.(null);
          instance.setPitch(0);
          instance.setStyle(satelliteStyle(false));
        } else {
          instance.setStyle(satelliteStyle(true));
          instance.once('style.load', () => {
            try {
              if (instance.setProjection) instance.setProjection({ type: 'globe' });
              instance.setTerrain?.({ source: 'terrain', exaggeration: 1.15 });
              instance.easeTo({ pitch: 62, zoom: Math.max(instance.getZoom(), 12.5), duration: 650 });
              renderRoute(activeRouteRef.current);
            } catch {
              setProviderState('error');
            }
          });
          return;
        }
        instance.once('style.load', () => renderRoute(activeRouteRef.current));
      } catch {
        setProviderState('error');
      }
    };
    applyMode();
  }, [viewMode]);

  useEffect(() => {
    renderRoute(activeRoute);
  }, [activeRoute]);

  function renderRoute(route: GpsRoute | null) {
    const instance = map.current;
    if (!instance || !instance.isStyleLoaded?.()) return;
    try {
      if (instance.getLayer('atlas-route-line')) instance.removeLayer('atlas-route-line');
      if (instance.getSource('atlas-route')) instance.removeSource('atlas-route');
      if (!route?.geometry) return;
      instance.addSource('atlas-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: route.geometry }
      });
      instance.addLayer({
        id: 'atlas-route-line',
        type: 'line',
        source: 'atlas-route',
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 16, 8],
          'line-color': '#30a2ff',
          'line-opacity': 0.9
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      const coordinates = route.geometry.coordinates || [];
      if (coordinates.length > 1) {
        const bounds = coordinates.reduce(
          (box: any, coordinate: [number, number]) => box.extend(coordinate),
          new maplibre.current.LngLatBounds(coordinates[0], coordinates[0])
        );
        instance.fitBounds(bounds, { padding: 70, duration: 550 });
      }
    } catch {
      // Style transitions can invalidate transient sources; the next route/mode update restores them.
    }
  }

  function updateNavigation(next: LivePosition) {
    const route = activeRouteRef.current;
    if (!navigationActiveRef.current || !route) return;

    const deviation = routeDeviationMeters(next, route);
    setDeviationM(Number.isFinite(deviation) ? deviation : null);
    const progressState = routeProgress(next, route);
    setProgress(progressState.progress);
    setRemainingM(progressState.remaining_m);

    const steps = route.steps || [];
    let index = currentStepIndexRef.current;
    const currentStep = steps[index];
    const stepLocation = currentStep?.location;
    if (stepLocation) {
      const distanceToStep = metersBetween(next, { lat: stepLocation[1], lon: stepLocation[0] });
      if (distanceToStep < 35 && index < steps.length - 1) {
        index += 1;
        setCurrentStepIndex(index);
        currentStepIndexRef.current = index;
      }
    }

    const nextStep = steps[index] || null;
    if (voiceEnabledRef.current && nextStep && nextStep.id !== spokenStepIdRef.current) {
      const phrase = spokenInstruction(nextStep);
      if (phrase && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.lang = 'es-US';
        window.speechSynthesis.speak(utterance);
        spokenStepIdRef.current = nextStep.id;
      }
    }

    if (
      deviation > REROUTE_THRESHOLD_M &&
      selectedRef.current &&
      Date.now() - lastRerouteAt.current > REROUTE_COOLDOWN_MS
    ) {
      lastRerouteAt.current = Date.now();
      void loadRoute(next, selectedRef.current, true);
    }
  }

  function startGps(center = true) {
    if (!navigator.geolocation) {
      setGpsState('blocked');
      return;
    }
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);

    watchId.current = navigator.geolocation.watchPosition((position) => {
      const next: LivePosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        label: 'Tu ubicación',
        accuracy_m: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        heading_deg: typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading) ? position.coords.heading : null,
        speed_mps: typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed) ? position.coords.speed : null,
        timestamp: position.timestamp
      };
      setCurrent(next);
      setGpsState('active');

      if (map.current && maplibre.current) {
        if (!currentMarker.current) {
          currentMarker.current = new maplibre.current.Marker({ color: '#20d67a' })
            .setLngLat([next.lon, next.lat])
            .setPopup(new maplibre.current.Popup({ offset: 22 }).setText('Tu ubicación'))
            .addTo(map.current);
        } else {
          currentMarker.current.setLngLat([next.lon, next.lat]);
        }
        if (center) {
          map.current.easeTo({
            center: [next.lon, next.lat],
            zoom: Math.max(map.current.getZoom(), navigationActiveRef.current ? 16.5 : 15),
            bearing: navigationActiveRef.current && next.heading_deg !== null ? next.heading_deg : map.current.getBearing(),
            pitch: navigationActiveRef.current ? (viewMode === 'terrain3d' ? 62 : 45) : map.current.getPitch(),
            duration: 450
          });
        }
      }
      updateNavigation(next);
    }, () => setGpsState('blocked'), {
      enableHighAccuracy: true,
      maximumAge: 1500,
      timeout: 15_000
    });
  }

  async function searchPlace() {
    const q = query.trim();
    if (!q) return;
    setSearchState('loading');
    try {
      const result = await searchGpsPlaces(q, 'es');
      const points = result.results.map((item) => ({
        lat: item.lat,
        lon: item.lon,
        label: item.label,
        category: item.category
      }));
      setSearchResults(points);
      setSearchState('idle');
      if (points.length === 1) chooseDestination(points[0]);
    } catch {
      setSearchResults([]);
      setSearchState('error');
      setRouteMessage('La búsqueda está bloqueada o el proveedor externo no está disponible.');
    }
  }

  function chooseDestination(point: GpsPoint) {
    setSelected(point);
    setSearchResults([]);
    map.current?.easeTo({ center: [point.lon, point.lat], zoom: 16, duration: 500 });
  }

  async function loadRoute(from: GpsPoint, destination: GpsPoint, reroute = false) {
    setRoutingState('loading');
    try {
      const result = await calculateGpsRoute(from, destination);
      setRoutes(result.routes || []);
      setActiveRouteIndex(0);
      setCurrentStepIndex(0);
      currentStepIndexRef.current = 0;
      spokenStepIdRef.current = '';
      const primary = result.routes?.[0] || null;
      activeRouteRef.current = primary;
      if (primary) {
        setRouteMessage(`${formatDistance(primary.distance_m)} · ${formatDuration(primary.duration_s)} · ${reroute ? 'ruta recalculada' : 'automóvil'}`);
        renderRoute(primary);
      } else {
        setRouteMessage('No se encontró una ruta verificable.');
      }
      setRoutingState('idle');
    } catch {
      setRoutingState('error');
      setRouteMessage('El proveedor de rutas no respondió. ATLAS mantiene navegación como no verificada.');
    }
  }

  async function calculateRoute() {
    if (!current || !selected) {
      setRouteMessage('Activa el GPS y selecciona un destino.');
      return;
    }
    await loadRoute(current, selected, false);
  }

  function beginNavigation() {
    if (!activeRoute || !current) return;
    setNavigationActive(true);
    navigationActiveRef.current = true;
    setCurrentStepIndex(0);
    currentStepIndexRef.current = 0;
    spokenStepIdRef.current = '';
    startGps(true);
  }

  function stopNavigation() {
    setNavigationActive(false);
    navigationActiveRef.current = false;
    setDeviationM(null);
    setProgress(0);
    setRemainingM(0);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  async function saveSelected() {
    if (!selected || persistenceState !== 'ready') return;
    try {
      const result = await saveGpsPlace(selected);
      setSaved((items) => [result.place, ...items.filter((item) => item.id !== result.place.id)]);
    } catch {
      setPersistenceState('blocked');
    }
  }

  async function removeSaved(id: string) {
    try {
      await deleteGpsPlace(id);
      setSaved((items) => items.filter((item) => item.id !== id));
    } catch {
      setPersistenceState('blocked');
    }
  }

  const directDistance = current && selected ? metersBetween(current, selected) : null;
  const speedMph = current?.speed_mps === null || current?.speed_mps === undefined
    ? null
    : current.speed_mps * 2.236936;
  const etaMinutes = activeRoute && navigationActive
    ? Math.max(1, Math.round(activeRoute.duration_s * (1 - progress) / 60))
    : activeRoute
      ? Math.max(1, Math.round(activeRoute.duration_s / 60))
      : null;

  const mapModeDetail = useMemo(() => {
    if (viewMode === 'street') return 'OpenFreeMap + OpenStreetMap';
    if (viewMode === 'satellite') return 'USGS The National Map imagery · U.S. coverage';
    return 'USGS imagery + Mapterhorn elevation · 3D globe';
  }, [viewMode]);

  return (
    <section className="gps4d-page">
      <header className="gps4d-header">
        <div>
          <p className="eyebrow">ATLAS GPS 4D</p>
          <h1>Navigation & Spatial Intelligence</h1>
          <p>GPS, satellite, 3D terrain, routing, voice guidance, lane evidence, rerouting and governed mobility foundations.</p>
        </div>
        <div className="gps4d-badges">
          <span className="status-chip warning">EXTERNAL-GATED</span>
          <span className={`status-chip ${gpsState === 'active' ? '' : 'neutral'}`}>GPS {gpsState}</span>
          <span className={`status-chip ${persistenceState === 'ready' ? '' : 'neutral'}`}>DATA {persistenceState}</span>
        </div>
      </header>

      <div className="notice">
        Public map/routing services are capability-gated and are not presented as SLA-backed ATLAS providers. Live traffic, incidents, street-level imagery, realtime transit and offline world tiles remain blocked until authoritative providers or self-hosted data are verified.
      </div>

      <nav className="gps4d-view-modes" aria-label="GPS map layers">
        <button type="button" aria-pressed={viewMode === 'street'} onClick={() => setViewMode('street')}>Map</button>
        <button type="button" aria-pressed={viewMode === 'satellite'} onClick={() => setViewMode('satellite')}>Satellite</button>
        <button type="button" aria-pressed={viewMode === 'terrain3d'} onClick={() => setViewMode('terrain3d')}>3D</button>
        <span>{mapModeDetail}</span>
      </nav>

      <div className="gps4d-toolbar">
        <div className="gps4d-search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && void searchPlace()}
            placeholder="Buscar dirección, aeropuerto, hotel, negocio…"
            aria-label="Buscar lugar"
          />
          {searchResults.length > 0 && (
            <div className="gps4d-search-results">
              {searchResults.map((place, index) => (
                <button key={`${place.lat}-${place.lon}-${index}`} type="button" onClick={() => chooseDestination(place)}>
                  <strong>{place.label}</strong>
                  {place.category && <small>{place.category}</small>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => void searchPlace()} disabled={searchState === 'loading'}>
          {searchState === 'loading' ? 'Buscando…' : 'Buscar'}
        </button>
        <button type="button" onClick={() => startGps(true)}>Mi ubicación</button>
        <button type="button" onClick={() => void calculateRoute()} disabled={routingState === 'loading'}>
          {routingState === 'loading' ? 'Calculando…' : 'Ruta'}
        </button>
      </div>

      <div className="gps4d-layout">
        <div className="gps4d-map-wrap">
          <div ref={mapNode} className="gps4d-map" aria-label="ATLAS GPS 4D map" />
          {providerState !== 'ready' && (
            <div className="gps4d-overlay">
              {providerState === 'loading' ? 'Cargando motor espacial…' : 'Motor de mapas externo no disponible.'}
            </div>
          )}
          {navigationActive && (
            <div className="gps4d-nav-banner" role="status">
              <strong>{instructionLabel(activeStep)}</strong>
              <span>{activeStep ? formatDistance(activeStep.distance_m) : '—'} · ETA {etaMinutes ?? '—'} min</span>
              <span>Carril: {laneLabel(activeStep)}</span>
            </div>
          )}
        </div>

        <aside className="gps4d-panel">
          <div className="gps4d-panel-heading">
            <h2>Navigation</h2>
            <label className="gps4d-toggle">
              <input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} />
              Voice
            </label>
          </div>

          <dl className="gps4d-metrics">
            <div><dt>Destino</dt><dd>{selected?.label || 'Sin seleccionar'}</dd></div>
            <div><dt>Distancia directa</dt><dd>{directDistance === null ? '—' : formatDistance(directDistance)}</dd></div>
            <div><dt>Ruta</dt><dd>{routeMessage}</dd></div>
            <div><dt>Precisión GPS</dt><dd>{current?.accuracy_m ? `±${Math.round(current.accuracy_m)} m` : '—'}</dd></div>
            <div><dt>Velocidad</dt><dd>{speedMph === null ? '—' : `${speedMph.toFixed(1)} mph`}</dd></div>
            <div><dt>Rumbo</dt><dd>{current?.heading_deg === null || current?.heading_deg === undefined ? '—' : `${Math.round(current.heading_deg)}°`}</dd></div>
            <div><dt>Desvío de ruta</dt><dd>{deviationM === null ? '—' : formatDistance(deviationM)}</dd></div>
            <div><dt>Progreso</dt><dd>{navigationActive ? `${Math.round(progress * 100)}% · ${formatDistance(remainingM)} restantes` : '—'}</dd></div>
          </dl>

          {routes.length > 1 && (
            <div className="gps4d-alternatives">
              <h3>Rutas</h3>
              {routes.map((route, index) => (
                <button
                  key={route.id}
                  type="button"
                  aria-pressed={activeRouteIndex === index}
                  onClick={() => {
                    setActiveRouteIndex(index);
                    setCurrentStepIndex(0);
                    currentStepIndexRef.current = 0;
                  }}
                >
                  {index === 0 ? 'Principal' : `Alternativa ${index}`} · {formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}
                </button>
              ))}
            </div>
          )}

          <div className="gps4d-actions">
            <button type="button" disabled={!activeRoute || !current || navigationActive} onClick={beginNavigation}>Iniciar navegación</button>
            <button type="button" disabled={!navigationActive} onClick={stopNavigation}>Detener</button>
            <button type="button" disabled={!selected || persistenceState !== 'ready'} onClick={() => void saveSelected()}>Guardar punto</button>
            <button type="button" disabled={!activeRoute} onClick={() => {
              setRoutes([]);
              activeRouteRef.current = null;
              renderRoute(null);
              stopNavigation();
              setRouteMessage('Ruta eliminada.');
            }}>Limpiar ruta</button>
          </div>

          <h3>Guardados</h3>
          {saved.length === 0 ? <p className="muted">No hay puntos guardados en tu organización.</p> : (
            <div className="gps4d-saved">
              {saved.map((place) => (
                <div className="gps4d-saved-row" key={place.id}>
                  <button type="button" className="text-link" onClick={() => chooseDestination(pointFromSaved(place))}>{place.label}</button>
                  <button type="button" aria-label={`Eliminar ${place.label}`} onClick={() => void removeSaved(place.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <section className="gps4d-capabilities" aria-labelledby="gps-capabilities-title">
        <div>
          <p className="eyebrow">Truthful capability registry</p>
          <h2 id="gps-capabilities-title">GPS 4D platform status</h2>
        </div>
        <div className="gps4d-capability-grid">
          {GPS_CAPABILITY_MATRIX.map((capability) => (
            <article key={capability.id}>
              <div>
                <strong>{capability.label}</strong>
                <span className={`capability-state ${capability.state}`}>{capability.state}</span>
              </div>
              <p>{capability.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
