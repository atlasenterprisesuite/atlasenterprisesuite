import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './atlasDigitalDistrict.css';

type DistrictMode = 'simulation' | 'live';
type DistrictLayer = 'mobility' | 'infrastructure' | 'buildings' | 'network' | 'community';

const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.css';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@6.11.1/dist/maplibre-gl.mjs';
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const LAKE_EOLA: [number, number] = [-81.3732, 28.5439];

const SIMULATION_POINTS = [
  { id: 'core', label: 'Lake Eola Core', coordinates: [-81.3732, 28.5439] as [number, number], kind: 'Command' },
  { id: 'mobility', label: 'Mobility Sandbox', coordinates: [-81.3762, 28.5419] as [number, number], kind: 'Mobility' },
  { id: 'infra', label: 'Infrastructure Sandbox', coordinates: [-81.3698, 28.5456] as [number, number], kind: 'Infrastructure' }
] as const;

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
  const [mode, setMode] = useState<DistrictMode>('simulation');
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeLayers, setActiveLayers] = useState<Record<DistrictLayer, boolean>>({
    mobility: true,
    infrastructure: true,
    buildings: true,
    network: true,
    community: false
  });

  useEffect(() => {
    let cancelled = false;
    let markers: any[] = [];

    void loadMapLibre()
      .then((maplibre) => {
        if (cancelled || !mapNode.current) return;
        const instance = new maplibre.Map({
          container: mapNode.current,
          style: STREET_STYLE,
          center: LAKE_EOLA,
          zoom: 14.7,
          pitch: 54,
          bearing: -22,
          antialias: true
        });
        map.current = instance;
        instance.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'bottom-right');
        instance.once('load', () => {
          if (cancelled) return;
          try {
            instance.setProjection?.({ type: 'globe' });
          } catch {
            // A flat map remains a valid fallback when globe projection is unavailable.
          }
          markers = SIMULATION_POINTS.map((point) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'atlas-district-marker';
            element.setAttribute('aria-label', `${point.label} — simulation point`);
            element.title = `${point.label} · SIMULATION`;
            element.innerHTML = '<span></span>';
            return new maplibre.Marker({ element })
              .setLngLat(point.coordinates)
              .setPopup(new maplibre.Popup({ offset: 18 }).setHTML(
                `<strong>${point.label}</strong><br/><small>${point.kind} · SIMULATION</small>`
              ))
              .addTo(instance);
          });
          setMapState('ready');
        });
        instance.once('error', () => {
          if (!cancelled) setMapState('error');
        });
      })
      .catch(() => {
        if (!cancelled) setMapState('error');
      });

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove?.());
      map.current?.remove?.();
      map.current = null;
    };
  }, []);

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

      <div className="atlas-district-status-row">
        <span className={`atlas-district-status ${mapState}`}>Map · {mapState}</span>
        <span className={`atlas-district-status ${mode}`}>Mode · {mode}</span>
        <span className="atlas-district-status neutral">Pilot · Lake Eola</span>
        {mode === 'live' ? <span className="atlas-district-status gated">Telemetry · not connected</span> : null}
      </div>

      <div className="atlas-district-command-grid">
        <section className="atlas-district-map-shell" aria-label="Orlando digital district map">
          <div ref={mapNode} className="atlas-district-map" />
          {mapState === 'loading' ? <div className="atlas-district-map-overlay">Loading spatial engine…</div> : null}
          {mapState === 'error' ? <div className="atlas-district-map-overlay error">Map provider did not respond. No live state is inferred.</div> : null}
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

          <div className="atlas-district-layer-list">
            {LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                className={activeLayers[layer.id] ? 'active' : ''}
                aria-pressed={activeLayers[layer.id]}
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
                ? 'Pins and operational states on this pilot surface are intentionally marked as simulation.'
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
