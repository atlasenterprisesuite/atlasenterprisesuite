import {
  lookupGpsStreetCoverage,
  saveGpsCoverageRun,
  type GpsCoverageRun
} from './gpsApi';
import {
  advanceCoverageSector,
  attachStreetSegments,
  coverageCheckpoint,
  createCoverageOrchestratorState,
  currentCoverageProbe,
  resolveCoverageProbe,
  selectCoverageSector,
  type CoverageOrchestratorState
} from './coverageOrchestrator';
import type { CoverageBounds } from './globalCoverage';

export type CoverageBatchResult = {
  state: CoverageOrchestratorState;
  processedSectors: number;
  blockedSectors: number;
  locatedProbes: number;
  complete: boolean;
};

export function restoreCoverageOrchestrator(run: GpsCoverageRun): CoverageOrchestratorState | null {
  const raw = run.state as any;
  if (!raw?.grid || !Array.isArray(raw.grid.sectors)) return null;
  return {
    coverageKey: run.coverage_key,
    label: run.label,
    grid: raw.grid,
    activeSectorId: run.last_sector_id || null,
    activeStreetPlan: raw.activeStreetPlan || null,
    lastProbeId: run.last_probe_id || null
  };
}

export async function executeCoverageBatch(input: {
  state?: CoverageOrchestratorState | null;
  coverageKey: string;
  label: string;
  bounds: CoverageBounds;
  targetSectorKm?: number;
  maxSectorsPerBatch?: number;
  spacingM?: number;
}): Promise<CoverageBatchResult> {
  let state = input.state || createCoverageOrchestratorState({
    coverageKey: input.coverageKey,
    label: input.label,
    bounds: input.bounds,
    targetSectorKm: input.targetSectorKm ?? 2
  });

  const sectorLimit = Math.min(25, Math.max(1, Math.floor(input.maxSectorsPerBatch ?? 4)));
  const spacingM = Math.min(100, Math.max(10, Math.floor(input.spacingM ?? 25)));

  let processedSectors = 0;
  let blockedSectors = 0;
  let locatedProbes = 0;

  while (processedSectors < sectorLimit) {
    const selected = selectCoverageSector(state);
    state = selected.state;
    const sector = selected.sector;
    if (!sector) break;

    if (!state.activeStreetPlan) {
      const lookup = await lookupGpsStreetCoverage(sector.bounds);
      state = attachStreetSegments(
        state,
        sector.id,
        lookup.segments,
        spacingM,
        20_000
      );

      if (lookup.segments.length === 0) {
        blockedSectors += 1;
        processedSectors += 1;
        const checkpoint = coverageCheckpoint(state);
        await saveGpsCoverageRun({
          coverage_key: checkpoint.coverage_key,
          label: checkpoint.label,
          scope: 'region',
          status: checkpoint.status,
          state: checkpoint.state,
          progress_pct: checkpoint.progress_pct,
          last_probe_id: checkpoint.last_probe_id,
          last_sector_id: checkpoint.last_sector_id,
          metadata: {
            ...checkpoint.metadata,
            truth: 'road-geometry coverage only; no street imagery claim'
          }
        });
        state = advanceCoverageSector(state);
        continue;
      }
    }

    while (true) {
      const probe = currentCoverageProbe(state);
      if (!probe) break;
      state = resolveCoverageProbe(state, probe.id, 'located', {
        provider: 'openstreetmap-overpass',
        reason: 'coordinate_derived_from_verified_road_geometry'
      });
      locatedProbes += 1;
    }

    processedSectors += 1;
    const checkpoint = coverageCheckpoint(state);
    await saveGpsCoverageRun({
      coverage_key: checkpoint.coverage_key,
      label: checkpoint.label,
      scope: 'region',
      status: checkpoint.status,
      state: checkpoint.state,
      progress_pct: checkpoint.progress_pct,
      last_probe_id: checkpoint.last_probe_id,
      last_sector_id: checkpoint.last_sector_id,
      metadata: {
        ...checkpoint.metadata,
        truth: 'road-geometry coverage only; no street imagery claim'
      }
    });
    state = advanceCoverageSector(state);
  }

  const finalCheckpoint = coverageCheckpoint(state);
  return {
    state,
    processedSectors,
    blockedSectors,
    locatedProbes,
    complete: finalCheckpoint.status === 'complete'
  };
}
