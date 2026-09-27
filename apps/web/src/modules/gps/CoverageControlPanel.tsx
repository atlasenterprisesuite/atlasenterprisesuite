import { useEffect, useMemo, useState } from 'react';
import {
  listGpsCoverageRuns,
  type GpsCoverageRun,
  type GpsPoint
} from './gpsApi';
import {
  executeCoverageBatch,
  restoreCoverageOrchestrator
} from './coverageRunner';
import { coverageCheckpoint } from './coverageOrchestrator';

type Props = {
  center: Pick<GpsPoint, 'lat' | 'lon'> | null;
};

function boundsAround(center: Pick<GpsPoint, 'lat' | 'lon'>, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const lonScale = Math.max(0.15, Math.cos(center.lat * Math.PI / 180));
  const lonDelta = radiusKm / (111.32 * lonScale);
  return {
    south: Math.max(-85, center.lat - latDelta),
    west: Math.max(-180, center.lon - lonDelta),
    north: Math.min(85, center.lat + latDelta),
    east: Math.min(180, center.lon + lonDelta)
  };
}

export function CoverageControlPanel({ center }: Props) {
  const [runs, setRuns] = useState<GpsCoverageRun[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'running' | 'error'>('loading');
  const [message, setMessage] = useState('Cargando progreso…');
  const [radiusKm, setRadiusKm] = useState(1);

  const localBounds = useMemo(
    () => center ? boundsAround(center, radiusKm) : null,
    [center, radiusKm]
  );

  async function refresh() {
    setState('loading');
    try {
      const result = await listGpsCoverageRuns();
      setRuns(result.runs || []);
      setState('idle');
      setMessage(result.runs?.length
        ? 'Progreso persistente disponible.'
        : 'No hay barridos guardados todavía.');
    } catch {
      setState('error');
      setMessage('Persistencia de cobertura no disponible.');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function runBatch() {
    if (!center || !localBounds) return;
    setState('running');
    setMessage('Procesando sectores y geometría vial…');

    const coverageKey = [
      'local-road-grid',
      center.lat.toFixed(4),
      center.lon.toFixed(4),
      radiusKm.toFixed(1)
    ].join(':');

    const existing = runs.find((run) => run.coverage_key === coverageKey) || null;
    const restored = existing ? restoreCoverageOrchestrator(existing) : null;

    try {
      const result = await executeCoverageBatch({
        state: restored,
        coverageKey,
        label: `Road coverage · ${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}`,
        bounds: localBounds,
        targetSectorKm: 0.8,
        maxSectorsPerBatch: 4,
        spacingM: 25
      });

      const checkpoint = coverageCheckpoint(result.state);
      setMessage(
        `${result.processedSectors} sectores · ${result.locatedProbes} puntos de geometría · ${checkpoint.progress_pct}%` +
        (result.blockedSectors ? ` · ${result.blockedSectors} bloqueados` : '') +
        (result.complete ? ' · COMPLETO' : '')
      );
      setState('idle');
      await refresh();
    } catch {
      setState('error');
      setMessage('El barrido se detuvo de forma segura. No se marcó cobertura no verificada.');
    }
  }

  const latest = runs[0] || null;

  return (
    <section className="gps4d-coverage-panel" aria-labelledby="gps4d-coverage-title">
      <div className="gps4d-coverage-heading">
        <div>
          <p className="eyebrow">Street Coverage Engine</p>
          <h3 id="gps4d-coverage-title">Cobertura progresiva</h3>
        </div>
        <span className="status-chip neutral">ROAD GEOMETRY</span>
      </div>

      <p className="muted">
        Recorre sectores con geometría vial verificable. No declara Street View, tráfico ni imágenes donde no existan proveedores autorizados.
      </p>

      <label className="gps4d-coverage-radius">
        Radio local
        <select
          value={radiusKm}
          onChange={(event) => setRadiusKm(Number(event.target.value))}
          disabled={state === 'running'}
        >
          <option value={0.5}>0.5 km</option>
          <option value={1}>1 km</option>
          <option value={2}>2 km</option>
          <option value={3}>3 km</option>
        </select>
      </label>

      <div className="gps4d-coverage-metrics">
        <span>Centro</span>
        <strong>{center ? `${center.lat.toFixed(5)}, ${center.lon.toFixed(5)}` : 'Selecciona o activa ubicación'}</strong>
        <span>Último guardado</span>
        <strong>{latest ? `${latest.progress_pct}% · ${latest.status}` : '—'}</strong>
      </div>

      <div className="gps4d-coverage-actions">
        <button
          type="button"
          disabled={!center || state === 'running' || state === 'loading'}
          onClick={() => void runBatch()}
        >
          {state === 'running' ? 'Procesando…' : 'Procesar siguiente lote'}
        </button>
        <button
          type="button"
          disabled={state === 'running'}
          onClick={() => void refresh()}
        >
          Actualizar
        </button>
      </div>

      <p className={state === 'error' ? 'gps4d-coverage-error' : 'muted'} role="status">
        {message}
      </p>
    </section>
  );
}
