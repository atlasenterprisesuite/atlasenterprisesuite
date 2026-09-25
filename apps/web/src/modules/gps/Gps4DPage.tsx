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
  spokenInstruction,
  type GpsViewMode
} from './gpsDomain';
import { AtlasNavigationEngine, type NavigationEngineObservation } from './navigationEngine';
import { createNavigationLocationSource, type NavigationLocationSourceKind } from './navigationLocation';
import { Photorealistic3DView } from './Photorealistic3DView';
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
const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const USGS_TILE = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
const TERRAIN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json';
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

function maneuverSymbol(step: GpsRouteStep | null) {
  const type = String(step?.instruction_type || '').toLowerCase();
  const modifier = String(step?.modifier || '').toLowerCase();
  if (type.includes('roundabout') || type.includes('rotary')) return '⟳';
  if (modifier.includes('sharp left')) return '↶';
  if (modifier.includes('sharp right')) return '↷';
  if (modifier.includes('left')) return '↰';
  if (modifier.includes('right')) return '↱';
  if (modifier.includes('uturn')) return '↶';
  return '↑';
}

export function Gps4DPage() {
  const mapNode = useRef<HTMLDivElement | null>(null);
  const driveMapNode = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const driveMap = useRef<any>(null);
  const maplibre = useRef<any>(null);
  const currentMarker = useRef<any>(null);
  const driveMarker = useRef<any>(null);
  const selectedMarker = useRef<any>(null);
  const locationStop = useRef<(() => void) | null>(null);
  const navigationEngine = useRef(new AtlasNavigationEngine());
  const wakeLock = useRef<any>(null);
  const activeRouteRef = useRef<GpsRoute | null>(null);
  const selectedRef = useRef<GpsPoint | null>(null);
  const navigationActiveRef = useRef(false);
  const voiceEnabledRef = useRef(true);
  const currentStepIndexRef = useRef(0);
  const spokenStepIdRef = useRef('');
  const lastRerouteAt = useRef(0);

  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [layerState, setLayerState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [layerMessage, setLayerMessage] = useState('Cargando mapa…');
  const [gpsState, setGpsState] = useState<'pending' | 'active' | 'blocked'>('pending');
  const [locationSourceKind, setLocationSourceKind] = useState<NavigationLocationSourceKind>('browser-geolocation');
  const [navigationFixSource, setNavigationFixSource] = useState<'gps' | 'route-snap'>('gps');
  const [navigationConfidence, setNavigationConfidence] = useState(0);
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
  const [stops, setStops] = useState<GpsPoint[]>([]);
  const [arrivalState, setArrivalState] = useState<'idle' | 'approaching' | 'arrived'>('idle');
  const [persistenceState, setPersistenceState] = useState<'loading' | 'ready' | 'blocked'>('loading');
  const [photorealistic3D, setPhotorealistic3D] = useState(false);
  const googleMapTilesKey = String((import.meta as any).env?.VITE_ATLAS_GOOGLE_MAP_TILES_KEY || '');
  const photorealisticConfigured = googleMapTilesKey.trim().length > 0;

  const activeRoute = routes[activeRouteIndex] || null;
  const activeStep = activeRoute?.steps?.[currentStepIndex] || null;

  useEffect(() => {
    activeRouteRef.current = activeRoute;
    navigationEngine.current.reset();
  }, [activeRoute]);
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
      setEngineState('ready');
      setLayerState('loading');
      setLayerMessage('Cargando Street map…');
      instance.addControl(new module.NavigationControl({ visualizePitch: true }), 'top-right');
      if (module.GlobeControl) instance.addControl(new module.GlobeControl(), 'top-right');
      instance.on('load', () => {
        setEngineState('ready');
        setLayerState('ready');
        setLayerMessage('Street map listo');
      });
      instance.on('style.load', () => {
        setLayerState('ready');
        setLayerMessage('Capa de mapa lista');
      });
      instance.on('error', (event: any) => {
        const message = String(event?.error?.message || '');
        if (!instance.isStyleLoaded?.() || /style|source|sprite|glyph/i.test(message)) {
          setLayerState('error');
          setLayerMessage('La capa seleccionada no respondió. Cambia de capa o reintenta.');
        }
      });
      instance.on('click', (event: any) => {
        setSelected({
          lat: event.lngLat.lat,
          lon: event.lngLat.lng,
          label: 'Punto seleccionado'
        });
      });
      map.current = instance;
    }).catch(() => { setEngineState('error'); setLayerState('error'); setLayerMessage('Motor MapLibre no disponible'); });

    return () => {
      cancelled = true;
      locationStop.current?.();
      locationStop.current = null;
      void releaseWakeLock();
      map.current?.remove();
      map.current = null;
      maplibre.current = null;
    };
  }, []);

  useEffect(() => {
    if (!navigationActive || !driveMapNode.current || !maplibre.current || driveMap.current) return;

    const module = maplibre.current;
    const center: [number, number] = current ? [current.lon, current.lat] : ORLANDO;
    const instance = new module.Map({
      container: driveMapNode.current,
      style: STREET_STYLE,
      center,
      zoom: current ? 18.2 : 15.5,
      pitch: 72,
      bearing: current?.heading_deg ?? 0,
      maxPitch: 85,
      attributionControl: false,
      interactive: false
    });

    driveMap.current = instance;
    instance.on('load', () => {
      renderRouteOn(instance, activeRouteRef.current, 'atlas-drive-route', false);
      if (current) {
        const markerElement = document.createElement('div');
        markerElement.className = 'gps4d-vehicle-marker';
        markerElement.textContent = '▲';
        driveMarker.current = new module.Marker({
          element: markerElement,
          rotationAlignment: 'map',
          pitchAlignment: 'map'
        }).setLngLat([current.lon, current.lat]).addTo(instance);
      }
    });

    return () => {
      driveMap.current?.remove();
      driveMap.current = null;
      driveMarker.current = null;
    };
  }, [navigationActive]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get('lat'));
    const lon = Number(params.get('lon'));
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      setSelected({ lat, lon, label: params.get('label') || 'Destino compartido' });
    }
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
        setLayerState('loading');
        setLayerMessage(viewMode === 'street' ? 'Cargando Street map…' : viewMode === 'satellite' ? 'Cargando satélite…' : 'Cargando 3D…');
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
              setLayerState('error');
              setLayerMessage('La capa 3D no respondió.');
            }
          });
          return;
        }
        instance.once('style.load', () => renderRoute(activeRouteRef.current));
      } catch {
        setLayerState('error');
      setLayerMessage('La capa seleccionada no respondió.');
      }
    };
    applyMode();
  }, [viewMode, photorealistic3D]);

  useEffect(() => {
    renderRoute(activeRoute);
  }, [activeRoute]);

  function renderRouteOn(instance: any, route: GpsRoute | null, prefix: string, fitBounds: boolean) {
    if (!instance || !instance.isStyleLoaded?.()) return;
    const sourceId = `${prefix}-source`;
    const glowId = `${prefix}-glow`;
    const lineId = `${prefix}-line`;

    try {
      if (instance.getLayer(glowId)) instance.removeLayer(glowId);
      if (instance.getLayer(lineId)) instance.removeLayer(lineId);
      if (instance.getSource(sourceId)) instance.removeSource(sourceId);
      if (!route?.geometry) return;

      instance.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: route.geometry }
      });
      instance.addLayer({
        id: glowId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 10, 18, 26],
          'line-color': '#6f4cff',
          'line-opacity': 0.36,
          'line-blur': 4
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });
      instance.addLayer({
        id: lineId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 4, 18, 11],
          'line-color': '#35c8ff',
          'line-opacity': 0.98
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' }
      });

      const coordinates = route.geometry.coordinates || [];
      if (fitBounds && coordinates.length > 1 && maplibre.current) {
        const bounds = coordinates.reduce(
          (box: any, coordinate: [number, number]) => box.extend(coordinate),
          new maplibre.current.LngLatBounds(coordinates[0], coordinates[0])
        );
        instance.fitBounds(bounds, { padding: 70, duration: 550 });
      }
    } catch {
      // Style transitions can invalidate transient sources; the next route or map load restores them.
    }
  }

  function renderRoute(route: GpsRoute | null) {
    renderRouteOn(map.current, route, 'atlas-overview-route', true);
    renderRouteOn(driveMap.current, route, 'atlas-drive-route', false);
  }

  function updateNavigation(next: LivePosition): NavigationEngineObservation | null {
    const route = activeRouteRef.current;
    if (!navigationActiveRef.current || !route) return null;

    const observation = navigationEngine.current.update(next, route, currentStepIndexRef.current);
    setDeviationM(Number.isFinite(observation.off_route_m) ? observation.off_route_m : null);
    setProgress(observation.route_progress);
    setRemainingM(observation.remaining_m);
    setNavigationFixSource(observation.source);
    setNavigationConfidence(observation.confidence);

    if (observation.step_index !== currentStepIndexRef.current) {
      setCurrentStepIndex(observation.step_index);
      currentStepIndexRef.current = observation.step_index;
    }

    const nextStep = route.steps?.[observation.step_index] || null;
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

    if (observation.arrived) {
      setArrivalState('arrived');
    }

    if (
      observation.reroute_suggested &&
      selectedRef.current &&
      Date.now() - lastRerouteAt.current > REROUTE_COOLDOWN_MS
    ) {
      lastRerouteAt.current = Date.now();
      void loadRoute({
        lat: observation.display.lat,
        lon: observation.display.lon,
        label: 'Tu ubicación ajustada',
        category: 'navigation'
      }, selectedRef.current, true);
    }

    return observation;
  }

  async function acquireWakeLock() {
    try {
      const nav = navigator as any;
      if (nav.wakeLock?.request && !wakeLock.current) {
        wakeLock.current = await nav.wakeLock.request('screen');
      }
    } catch {
      // Navigation continues without a wake lock when the browser denies it.
    }
  }

  async function releaseWakeLock() {
    try {
      await wakeLock.current?.release?.();
    } catch {
      // A released/invalidated lock is already safe.
    } finally {
      wakeLock.current = null;
    }
  }

  function startGps(center = true) {
    locationStop.current?.();
    const source = createNavigationLocationSource();
    setLocationSourceKind(source.kind);

    locationStop.current = source.start((sample) => {
      const next: LivePosition = {
        ...sample,
        label: 'Tu ubicación'
      };
      setCurrent(next);
      setGpsState('active');

      const observation = updateNavigation(next);
      const display = observation?.display || { lat: next.lat, lon: next.lon };
      const course = observation?.course_deg ?? next.heading_deg;

      if (map.current && maplibre.current) {
        if (!currentMarker.current) {
          currentMarker.current = new maplibre.current.Marker({ color: '#20d67a' })
            .setLngLat([display.lon, display.lat])
            .setPopup(new maplibre.current.Popup({ offset: 22 }).setText('Tu ubicación'))
            .addTo(map.current);
        } else {
          currentMarker.current.setLngLat([display.lon, display.lat]);
        }
        if (center) {
          map.current.easeTo({
            center: [display.lon, display.lat],
            zoom: Math.max(map.current.getZoom(), navigationActiveRef.current ? 15.5 : 15),
            bearing: navigationActiveRef.current ? 0 : map.current.getBearing(),
            pitch: navigationActiveRef.current ? 0 : map.current.getPitch(),
            duration: 450
          });
        }
      }

      if (driveMap.current && maplibre.current) {
        if (!driveMarker.current) {
          const markerElement = document.createElement('div');
          markerElement.className = 'gps4d-vehicle-marker';
          markerElement.textContent = '▲';
          driveMarker.current = new maplibre.current.Marker({
            element: markerElement,
            rotationAlignment: 'map',
            pitchAlignment: 'map'
          }).setLngLat([display.lon, display.lat]).addTo(driveMap.current);
        } else {
          driveMarker.current.setLngLat([display.lon, display.lat]);
        }
        if (typeof driveMarker.current.setRotation === 'function') {
          driveMarker.current.setRotation(course ?? 0);
        }
        driveMap.current.easeTo({
          center: [display.lon, display.lat],
          zoom: 18.2,
          bearing: course ?? driveMap.current.getBearing(),
          pitch: 72,
          duration: 350
        });
      }

      if (!observation && selectedRef.current) {
        const destinationDistance = metersBetween(next, selectedRef.current);
        if (destinationDistance <= 35) setArrivalState('arrived');
        else if (destinationDistance <= 180) setArrivalState('approaching');
        else setArrivalState('idle');
      } else if (observation && !observation.arrived && selectedRef.current) {
        const destinationDistance = metersBetween(observation.display, selectedRef.current);
        if (destinationDistance <= 180) setArrivalState('approaching');
        else setArrivalState('idle');
      }
    }, (error) => {
      setGpsState('blocked');
      setRouteMessage(error === 'geolocation_permission_denied'
        ? 'Permiso de ubicación denegado. ATLAS no puede iniciar navegación.'
        : 'La fuente de ubicación no está disponible.');
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
      if (stops.length > 0 && !reroute) {
        const waypoints = [from, ...stops, destination];
        const legs = [];
        for (let index = 1; index < waypoints.length; index += 1) {
          const leg = await calculateGpsRoute(waypoints[index - 1], waypoints[index]);
          const route = leg.routes?.[0];
          if (!route) throw new Error('route_leg_missing');
          legs.push(route);
        }
        const combined: GpsRoute = {
          id: 'multi-stop',
          distance_m: legs.reduce((sum, leg) => sum + leg.distance_m, 0),
          duration_s: legs.reduce((sum, leg) => sum + leg.duration_s, 0),
          geometry: {
            type: 'LineString',
            coordinates: legs.flatMap((leg, index) => index === 0 ? leg.geometry.coordinates : leg.geometry.coordinates.slice(1))
          },
          steps: legs.flatMap((leg) => leg.steps)
        };
        setRoutes([combined]);
        setActiveRouteIndex(0);
        setCurrentStepIndex(0);
        currentStepIndexRef.current = 0;
        spokenStepIdRef.current = '';
        activeRouteRef.current = combined;
        setRouteMessage(`${formatDistance(combined.distance_m)} · ${formatDuration(combined.duration_s)} · ${stops.length} parada${stops.length === 1 ? '' : 's'}`);
        renderRoute(combined);
        setRoutingState('idle');
        return;
      }
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
    navigationEngine.current.reset();
    setNavigationActive(true);
    navigationActiveRef.current = true;
    setCurrentStepIndex(0);
    currentStepIndexRef.current = 0;
    spokenStepIdRef.current = '';
    void acquireWakeLock();
    startGps(true);
  }

  function stopNavigation() {
    setNavigationActive(false);
    navigationActiveRef.current = false;
    navigationEngine.current.reset();
    setDeviationM(null);
    setProgress(0);
    setRemainingM(0);
    setNavigationFixSource('gps');
    setNavigationConfidence(0);
    void releaseWakeLock();
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

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigationActiveRef.current) {
        void acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const mapModeDetail = useMemo(() => {
    if (photorealistic3D) return 'Google Photorealistic 3D Tiles · external-gated';
    if (viewMode === 'street') return 'OpenFreeMap + OpenStreetMap';
    if (viewMode === 'satellite') return 'USGS The National Map imagery · U.S. coverage';
    return 'USGS imagery + Mapterhorn elevation · 3D globe';
  }, [viewMode]);

  return (
    <section className="gps4d-page">
      <header className={`gps4d-header ${navigationActive ? 'gps4d-nav-hidden' : ''}`}>
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

      <nav className={`gps4d-view-modes ${navigationActive ? 'gps4d-nav-hidden' : ''}`} aria-label="GPS map layers">
        <button type="button" aria-pressed={!photorealistic3D && viewMode === 'street'} onClick={() => { setPhotorealistic3D(false); setViewMode('street'); }}>Map</button>
        <button type="button" aria-pressed={!photorealistic3D && viewMode === 'satellite'} onClick={() => { setPhotorealistic3D(false); setViewMode('satellite'); }}>Satellite</button>
        <button type="button" aria-pressed={!photorealistic3D && viewMode === 'terrain3d'} onClick={() => { setPhotorealistic3D(false); setViewMode('terrain3d'); }}>3D</button>
        <button
          type="button"
          aria-pressed={photorealistic3D}
          className={!photorealisticConfigured ? 'gps4d-provider-blocked' : undefined}
          title={photorealisticConfigured ? 'Google Photorealistic 3D Tiles' : 'BLOCKED: VITE_ATLAS_GOOGLE_MAP_TILES_KEY no configurada'}
          onClick={() => {
            if (!photorealisticConfigured) {
              setPhotorealistic3D(false);
              setLayerState('error');
              setLayerMessage('Photorealistic 3D BLOCKED: Google Map Tiles provider no configurado.');
              return;
            }
            setPhotorealistic3D((value) => !value);
          }}
        >
          Photorealistic
        </button>
        <span>{mapModeDetail}</span>
      </nav>

      <div className={`gps4d-toolbar ${navigationActive ? 'gps4d-nav-hidden' : ''}`}>
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
                <div className="gps4d-search-result" key={`${place.lat}-${place.lon}-${index}`}>
                  <button type="button" onClick={() => chooseDestination(place)}>
                    <strong>{place.label}</strong>
                    {place.category && <small>{place.category}</small>}
                  </button>
                  <button type="button" className="gps4d-add-stop" onClick={() => {
                    setStops((items) => [...items, place].slice(0, 8));
                    setSearchResults([]);
                  }}>+ Parada</button>
                </div>
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

      <div className={`gps4d-layout ${navigationActive ? 'gps4d-layout-navigation' : ''}`}>
        <div className={`gps4d-map-wrap ${navigationActive ? 'gps4d-map-wrap-navigation' : ''}`}>
          {navigationActive && (
            <div className="gps4d-drive-view">
              <div ref={driveMapNode} className="gps4d-drive-map" aria-label="ATLAS 3D drive navigation view" />
              <div className="gps4d-drive-brand">ATLAS <span>GPS 4D</span></div>
              <div className="gps4d-drive-chip">
                <strong>{speedMph === null ? '—' : `${Math.round(speedMph)} mph`}</strong>
                <span>{current?.heading_deg === null || current?.heading_deg === undefined ? 'Rumbo —' : `Rumbo ${Math.round(current.heading_deg)}°`}</span>
              </div>
              <div className="gps4d-drive-controls">
                <button type="button" disabled title="Street-level imagery requiere un proveedor autorizado">◉</button>
                <button type="button" onClick={() => setVoiceEnabled((value) => !value)} title={voiceEnabled ? 'Silenciar guía' : 'Activar guía'}>
                  {voiceEnabled ? '🔊' : '🔇'}
                </button>
              </div>
              <div className="gps4d-drive-chevron" aria-hidden="true">
                <span>▲</span><span>▲</span><span>▲</span>
              </div>
              <div className="gps4d-drive-source">3D vector drive view · Street-level imagery BLOCKED</div>
            </div>
          )}
          <Photorealistic3DView
            enabled={photorealistic3D && !navigationActive}
            apiKey={googleMapTilesKey}
            center={selected || current || { lat: ORLANDO[1], lon: ORLANDO[0] }}
            onState={(state, message) => {
              setLayerState(state === 'ready' ? 'ready' : state === 'error' ? 'error' : 'loading');
              setLayerMessage(message);
            }}
          />
          <div
            ref={mapNode}
            className={`gps4d-map ${navigationActive ? 'gps4d-overview-map' : ''} ${photorealistic3D && !navigationActive ? 'gps4d-map-underlay' : ''}`}
            aria-label="ATLAS GPS 4D map"
          />
          {engineState !== 'ready' && (
            <div className="gps4d-overlay">
              {engineState === 'loading' ? 'Cargando motor MapLibre…' : 'Motor MapLibre no disponible.'}
            </div>
          )}
          {engineState === 'ready' && (
            <div className={`gps4d-layer-status ${layerState}`} role="status">
              <strong>MapLibre {engineState === 'ready' ? '✓' : '×'}</strong>
              <span>{layerMessage}</span>
              {layerState === 'error' && <button type="button" onClick={() => setViewMode(viewMode === 'street' ? 'satellite' : 'street')}>Usar otra capa</button>}
            </div>
          )}
          {arrivalState !== 'idle' && (
            <div className={`gps4d-arrival ${arrivalState}`}>
              {arrivalState === 'arrived' ? 'Llegaste a tu destino' : 'Estás llegando · revisa entrada y estacionamiento'}
            </div>
          )}
          {navigationActive && (
            <div className="gps4d-turn-card" role="status">
              <div className="gps4d-turn-icon">{maneuverSymbol(activeStep)}</div>
              <div className="gps4d-turn-copy">
                <span className="gps4d-turn-distance">{activeStep ? formatDistance(activeStep.distance_m) : '—'}</span>
                <strong>{instructionLabel(activeStep)}</strong>
                <span>Carril: {laneLabel(activeStep)}</span>
              </div>
              <div className="gps4d-trip-summary">
                <strong>{etaMinutes ?? '—'} min</strong>
                <span>{remainingM > 0 ? formatDistance(remainingM) : routeMessage}</span>
                <button type="button" onClick={stopNavigation}>× End</button>
              </div>
            </div>
          )}
        </div>

        <aside className={`gps4d-panel ${navigationActive ? 'gps4d-panel-navigation-hidden' : ''}`}>
          <div className="gps4d-panel-heading">
            <h2>ATLAS Navigate</h2>
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
            <div><dt>Fuente ubicación</dt><dd>{locationSourceKind === 'apple-native-bridge' ? 'Apple Core Location bridge' : 'Browser geolocation'}</dd></div>
            <div><dt>Ajuste a ruta</dt><dd>{navigationActive ? (navigationFixSource === 'route-snap' ? 'Activo' : 'GPS crudo') : '—'}</dd></div>
            <div><dt>Confianza</dt><dd>{navigationActive ? `${Math.round(navigationConfidence * 100)}%` : '—'}</dd></div>
          </dl>

          {routes.length > 1 && (
            <div className="gps4d-alternatives">
              <h3>Rutas</h3>
              {routes.map((route, index) => {
                const fastest = Math.min(...routes.map((item) => item.duration_s));
                const shortest = Math.min(...routes.map((item) => item.distance_m));
                const tradeoff = route.duration_s === fastest ? 'Más rápida' : route.distance_m === shortest ? 'Menos distancia' : 'Alternativa';
                return (
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
                  {index === 0 ? 'Principal' : `Alternativa ${index}`} · {tradeoff} · {formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}
                </button>
              )})}
            </div>
          )}

          {stops.length > 0 && (
            <div className="gps4d-stops">
              <h3>Paradas ({stops.length})</h3>
              {stops.map((stop, index) => (
                <div key={`${stop.lat}-${stop.lon}-${index}`}>
                  <span>{index + 1}. {stop.label}</span>
                  <button type="button" onClick={() => setStops((items) => items.filter((_, i) => i !== index))}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => setStops([])}>Limpiar paradas</button>
            </div>
          )}

          <div className="gps4d-actions">
            <button type="button" disabled={!activeRoute || !current || navigationActive} onClick={beginNavigation}>Iniciar navegación</button>
            <button type="button" disabled={!navigationActive} onClick={stopNavigation}>Detener</button>
            <button type="button" disabled={!selected || persistenceState !== 'ready'} onClick={() => void saveSelected()}>Guardar punto</button>
            <button type="button" disabled={!selected} onClick={() => {
              const text = selected ? `ATLAS GPS · ${selected.label} · https://www.atlasenterprisesuite.com/gps?lat=${selected.lat.toFixed(6)}&lon=${selected.lon.toFixed(6)}` : '';
              if (navigator.share && text) void navigator.share({ title: 'ATLAS GPS', text });
              else if (navigator.clipboard && text) void navigator.clipboard.writeText(text);
            }}>Compartir</button>
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

      <section className={`gps4d-capabilities ${navigationActive ? 'gps4d-nav-hidden' : ''}`} aria-labelledby="gps-capabilities-title">
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
