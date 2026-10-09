import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getVisibleDistrictSimulationPoints } from './districtSimulation';
import './atlasDigitalDistrict.css';

type DistrictMode = 'simulation' | 'live';
type DistrictLayer = 'mobility' | 'infrastructure' | 'buildings' | 'network' | 'community';

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.css';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.mjs';
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const LAKE_EOLA: [number, number] = [-81.3732, 28.5439];

const USGS_TILE = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
const MAP_LOAD_TIMEOUT_MS = 12_000;

// Independent public-data fallback. It does not imply an operational city feed.
function aerialFallbackStyle() {
  return {
    version: 8,
    sources: {
      usgs: {
        type: 'raster',
        tiles: [USGS_TILE],
        tileSize: 256,
        maxzoom: 16,
        attribution: 'USGS The National Map — public aerial imagery'
      }
    },
    layers: [
      { id: 'district-background', type: 'background', paint: { 'background-color': '#071321' } },
      { id: 'district-aerial', type: 'raster', source: 'usgs' }
    ]
  };
}

const LAYERS: { id: DistrictLayer; label: string; detail: string }[] = [
  { id: 'mobility', label: 'Mobility', detail: 'GPS 4D, Ride and future autonomous mobility.' },
  { id: 'infrastructure', label: 'Infrastructure', detail: 'Energy, water, lighting and facility telemetry.' },
  { id: 'buildings', label: 'Buildings', detail: 'CleanScan 3D and governed digital-twin intake.' },
  { id: 'network', label: 'Network', detail: 'Connectivity, edge nodes and device health.' },
  { id: 'community', label: 'Community', detail: 'Business, events and public-service context.' }
];

const COMMAND_LINKS = [
  { to: '/city/twin', eyebrow: 'Physical twin', title: 'Urban Twin Core', description: 'Governed hierarchy and verified bindings for buildings, spaces and assets.' },
  { to: '/gps', eyebrow: 'Spatial intelligence', title: 'GPS 4D', description: 'Live mapping and navigation foundation.' },
  { to: '/ride', eyebrow: 'Mobility', title: 'Ride OS', description: 'Governed mobility and driver workflows.' },
  { to: '/connect', eyebrow: 'Communications', title: 'ATLAS Connect', description: 'Provider-aware communications control plane.' },
  { to: '/device-os', eyebrow: 'Edge & devices', title: 'Device OS', description: 'Device DNA, recovery and hardware control.' },
  { to: '/galaxy', eyebrow: 'System graph', title: 'ATLAS Galaxy', description: 'Spatial view of the ATLAS module ecosystem.' }
] as const;

async function loadMapLibre() {
  if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
  }
  return import(/* @vite-ignore */ MAPLIBRE_JS) as Promise<any>;
}

export function AtlasDigitalDistrictPage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mode, setMode] = useState<DistrictMode>('simulation');
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'fallback' | 'unavailable'>('loading');
  const [mapNotice, setMapNotice] = useState('');
  const [activeLayers, setActiveLayers] = useState<Record<DistrictLayer, boolean>>({
    mobility: true,
    infrastructure: true,
    buildings: true,
    network: true,
    community: false
  });

  useEffect(() => {
    let cancelled = false;
    let usingFallback = false;
    let mapLoaded = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    setMapState('loading');
    setMapNotice('');
    const stopTimeout = () => {
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = undefined;
    };

    const scheduleTimeout = () => {
      stopTimeout();
      timeout = setTimeout(() => {
        if (cancelled || mapLoaded) return;
        if (!usingFallback) startFallback();
        else setMapState('unavailable');
      }, MAP_LOAD_TIMEOUT_MS);
    };

    const startFallback = () => {
      if (cancelled || mapLoaded || usingFallback) return;
      usingFallback = true;
      setMapNotice('Street map unavailable; trying public USGS aerial imagery.');
      try {
        if (!map.current) throw new Error('Map engine missing');
        map.current.setStyle(aerialFallbackStyle());
        scheduleTimeout();
      } catch {
        stopTimeout();
        setMapState('unavailable');
      }
    };

    void loadMapLibre()
      .then((maplibre) => {
        if (cancelled || !mapNode.current) return;
        const instance = new maplibre.Map({
          container: mapNode.current,
          style: STREET_STYLE,
          center: LAKE_EOLA,
          zoom: 14.7,
          pitch: 46,
          bearing: -22,
          antialias: true
        });
        map.current = instance;
        maplibreRef.current = maplibre;
        instance.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'bottom-right');
        scheduleTimeout();

        instance.on('load', () => {
          if (cancelled) return;
          mapLoaded = true;
          stopTimeout();
          setMapState(usingFallback ? 'fallback' : 'ready');
        });

        // MapLibre emits recoverable tile/glyph errors. Never equate one error
        // with an entirely failed map or with a live city-state incident.
        instance.on('error', (event: { error?: { message?: string } }) => {
          if (cancelled) return;
          const message = String(event?.error?.message || '');
          if (!mapLoaded && !usingFallback && /style|failed to fetch|failed to load|network/i.test(message)) {
            startFallback();
          } else if (mapLoaded) {
            setMapNotice('Some third-party map resources did not load; the spatial view may be partial.');
          }
        });
      })
      .catch(() => {
        if (!cancelled) setMapState('unavailable');
      });

    return () => {
      cancelled = true;
      stopTimeout();
      markersRef.current.forEach((marker) => marker.remove?.());
      markersRef.current = [];
      map.current?.remove?.();
      map.current = null;
      maplibreRef.current = null;
    };
  }, [mapAttempt]);

  // The same pure selector drives the map markers and the accessible reference
  // view. Changing a control really changes the rendered synthetic layer.
  useEffect(() => {
    markersRef.current.forEach((marker) => marker.remove?.());
    markersRef.current = [];
    if (!map.current || !maplibreRef.current || (mapState !== 'ready' && mapState !== 'fallback')) return;
    const maplibre = maplibreRef.current;
    markersRef.current = getVisibleDistrictSimulationPoints(mode, activeLayers).map((point) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'atlas-district-marker';
      element.setAttribute('aria-label', `${point.label} — simulated location, not live telemetry`);
      element.title = `${point.label} · SIMULATION`;
      element.appendChild(document.createElement('span'));
      return new maplibre.Marker({ element })
        .setLngLat(point.coordinates)
        .setPopup(new maplibre.Popup({ offset: 18 }).setText(`${point.label} · ${point.kind} · SIMULATION`))
        .addTo(map.current);
    });
  }, [mode, activeLayers, mapState]);

  const visiblePoints = getVisibleDistrictSimulationPoints(mode, activeLayers);
  const retryMap = () => setMapAttempt((current) => current + 1);
  const resetMap = () => map.current?.easeTo?.({ center: LAKE_EOLA, zoom: 14.7, pitch: 46, bearing: -22 });

  const toggleLayer = (layer: DistrictLayer) => {
    setActiveLayers((current) => ({ ...current, [layer]: !current[layer] }));
  };

  return (
    <section className="atlas-district-page">
      <header className="atlas-district-hero">
        <div>
          <p className="eyebrow">ATLAS Digital City · Orlando Pilot</p>
          <h1>Digital District</h1>
          <p>
            Downtown Orlando / Lake Eola as the first governed spatial operating surface for ATLAS.
            Simulation is explicit; live state remains fail-closed until authenticated telemetry exists.
          </p>
        </div>
        <div className="atlas-district-mode" aria-label="Digital district operating mode">
          <button type="button" aria-pressed={mode === 'simulation'} onClick={() => setMode('simulation')}>Simulation</button>
          <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Live</button>
        </div>
      </header>

      <div className="atlas-district-status-row" role="status" aria-live="polite">
        <span className={`atlas-district-status ${mapState}`}>Map · {mapState === 'fallback' ? 'aerial fallback' : mapState}</span>
        <span className={`atlas-district-status ${mode}`}>Mode · {mode}</span>
        <span className="atlas-district-status neutral">Pilot · Lake Eola</span>
        {mode === 'live' ? <span className="atlas-district-status gated">Telemetry · not connected</span> : null}
      </div>

      <div className="atlas-district-command-grid">
        <section className="atlas-district-map-shell" aria-label="Orlando digital district map">
          <div ref={mapNode} className="atlas-district-map" />
          {mapState === 'loading' ? <div className="atlas-district-map-overlay" role="status">Loading spatial engine…</div> : null}
          {mapState === 'unavailable' ? (
            <div className="atlas-district-map-overlay error" role="status">
              <div className="atlas-district-offline">
                <strong>External map unavailable</strong>
                <p>The street and aerial providers could not load. The district remains accessible as a labeled synthetic reference — no live state is inferred.</p>
                <button type="button" onClick={retryMap}>Retry map</button>
                {mode === 'simulation' ? (
                  <ul aria-label="Visible synthetic reference locations">
                    {visiblePoints.map((point) => <li key={point.id}>{point.label} · SIMULATION</li>)}
                  </ul>
                ) : <p>No authenticated telemetry is connected.</p>}
              </div>
            </div>
          ) : null}
          {mapNotice && mapState !== 'unavailable' ? <div className="atlas-district-map-notice" role="status">{mapNotice}</div> : null}
          <div className="atlas-district-map-actions">
            <button type="button" onClick={resetMap} disabled={mapState !== 'ready' && mapState !== 'fallback'}>Reset view</button>
            {mapState === 'fallback' ? <span>USGS aerial · public data</span> : null}
          </div>
          {mode === 'live' ? (
            <div className="atlas-district-live-gate">
              <strong>LIVE TELEMETRY GATED</strong>
              <span>No authenticated city/device feed is bound to this surface yet.</span>
            </div>
          ) : (
            <div className="atlas-district-sim-label">SIMULATION · no operational claim</div>
          )}
          <div className="atlas-district-map-title">
            <span>28.5439° N · 81.3732° W</span>
            <strong>Lake Eola spatial core</strong>
          </div>
        </section>

        <aside className="atlas-district-panel">
          <div className="atlas-district-panel-heading">
            <div><p className="eyebrow">Operational layers</p><h2>District controls</h2></div>
            <span>{Object.values(activeLayers).filter(Boolean).length}/{LAYERS.length}</span>
          </div>

          {mode === 'live' ? <p className="atlas-district-layer-gate">Live layer controls are locked until an authenticated telemetry feed is bound.</p> : null}
          <div className="atlas-district-layer-list">
            {LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                className={activeLayers[layer.id] ? 'active' : ''}
                aria-pressed={activeLayers[layer.id]}
                disabled={mode === 'live'}
                onClick={() => toggleLayer(layer.id)}
              >
                <span className="atlas-district-layer-indicator" />
                <span><strong>{layer.label}</strong><small>{layer.detail}</small></span>
                <span>{activeLayers[layer.id] ? 'ON' : 'OFF'}</span>
              </button>
            ))}
          </div>

          <div className="atlas-district-truth-card">
            <span>Truth boundary</span>
            <strong>{mode === 'simulation' ? 'Synthetic operating model' : 'Authenticated feeds only'}</strong>
            <p>
              {mode === 'simulation'
                ? `${visiblePoints.length} visible reference points are synthetic and are not operational readings.`
                : 'No connected sensor, municipal, building or carrier state is displayed without authenticated evidence.'}
            </p>
          </div>
        </aside>
      </div>

      <section className="atlas-district-foundation">
        <div className="atlas-district-section-heading">
          <div><p className="eyebrow">Existing ATLAS foundations</p><h2>One city layer, no duplicate modules</h2></div>
          <p>Digital District orchestrates existing capabilities instead of creating parallel systems.</p>
        </div>
        <div className="atlas-district-link-grid">
          {COMMAND_LINKS.map((item) => (
            <Link key={item.to} to={item.to} className="atlas-district-link-card">
              <span>{item.eyebrow}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <small>Open module →</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="atlas-district-roadmap" aria-label="Digital district expansion path">
        <article><span>01</span><strong>Digital District</strong><p>Current pilot surface around Lake Eola.</p></article>
        <article><span>02</span><strong>ATLAS Lab</strong><p>Bind owned sensors, devices and edge nodes.</p></article>
        <article><span>03</span><strong>Smart Building</strong><p>Connect a governed physical facility twin.</p></article>
        <article><span>04</span><strong>Campus</strong><p>Unify multiple facilities and mobility flows.</p></article>
        <article><span>05</span><strong>City Network</strong><p>Expand only through authorized infrastructure partnerships.</p></article>
      </section>
    </section>
  );
}
