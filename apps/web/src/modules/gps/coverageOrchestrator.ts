import {
  buildCoverageGrid,
  nextCoverageSector,
  summarizeCoverageGrid,
  updateCoverageSector,
  type CoverageBounds,
  type CoverageGrid,
  type CoverageSector
} from './globalCoverage';
import {
  buildStreetCoveragePlan,
  nextStreetCoverageProbe,
  resolveStreetCoverageProbe,
  summarizeStreetCoverage,
  type StreetCoveragePlan,
  type StreetCoverageProbe,
  type StreetCoverageSegment
} from './streetCoverage';

export type CoverageOrchestratorState = {
  coverageKey: string;
  label: string;
  grid: CoverageGrid;
  activeSectorId: string | null;
  activeStreetPlan: StreetCoveragePlan | null;
  lastProbeId: string | null;
};

export function createCoverageOrchestratorState(input: {
  coverageKey: string;
  label: string;
  bounds: CoverageBounds;
  targetSectorKm?: number;
  maxSectors?: number;
}): CoverageOrchestratorState {
  return {
    coverageKey: input.coverageKey,
    label: input.label,
    grid: buildCoverageGrid(
      input.coverageKey,
      input.bounds,
      input.targetSectorKm ?? 2,
      input.maxSectors ?? 10_000
    ),
    activeSectorId: null,
    activeStreetPlan: null,
    lastProbeId: null
  };
}

export function selectCoverageSector(state: CoverageOrchestratorState): {
  state: CoverageOrchestratorState;
  sector: CoverageSector | null;
} {
  const sector = nextCoverageSector(state.grid);
  if (!sector) return { state, sector: null };

  const grid = sector.status === 'pending'
    ? updateCoverageSector(state.grid, sector.id, { status: 'in-progress' })
    : state.grid;

  return {
    state: {
      ...state,
      grid,
      activeSectorId: sector.id,
      activeStreetPlan: state.activeSectorId === sector.id ? state.activeStreetPlan : null,
      lastProbeId: state.activeSectorId === sector.id ? state.lastProbeId : null
    },
    sector: {
      ...sector,
      status: sector.status === 'pending' ? 'in-progress' : sector.status
    }
  };
}

export function attachStreetSegments(
  state: CoverageOrchestratorState,
  sectorId: string,
  segments: StreetCoverageSegment[],
  spacingM = 25,
  maxProbes = 20_000
): CoverageOrchestratorState {
  if (state.activeSectorId !== sectorId) {
    throw new Error('coverage_sector_not_active');
  }

  const plan = buildStreetCoveragePlan(segments, spacingM, maxProbes);
  const grid = updateCoverageSector(state.grid, sectorId, {
    status: plan.probes.length ? 'in-progress' : 'blocked',
    completedStreetSegments: 0,
    totalStreetSegments: segments.length
  });

  return {
    ...state,
    grid,
    activeStreetPlan: plan,
    lastProbeId: null
  };
}

export function currentCoverageProbe(
  state: CoverageOrchestratorState
): StreetCoverageProbe | null {
  if (!state.activeStreetPlan) return null;
  return nextStreetCoverageProbe(state.activeStreetPlan, state.lastProbeId);
}

export function resolveCoverageProbe(
  state: CoverageOrchestratorState,
  probeId: string,
  status: 'located' | 'unlocated' | 'blocked',
  details: { provider?: string | null; reason?: string | null } = {}
): CoverageOrchestratorState {
  if (!state.activeStreetPlan || !state.activeSectorId) {
    throw new Error('coverage_probe_without_active_sector');
  }

  const plan = resolveStreetCoverageProbe(
    state.activeStreetPlan,
    probeId,
    status,
    details
  );
  const summary = summarizeStreetCoverage(plan);

  if (!summary.complete) {
    return {
      ...state,
      activeStreetPlan: plan,
      lastProbeId: probeId
    };
  }

  const segmentIds = new Set(
    plan.probes
      .filter((probe) => probe.status !== 'pending')
      .map((probe) => probe.segmentId)
  );

  const grid = updateCoverageSector(state.grid, state.activeSectorId, {
    status: 'complete',
    completedStreetSegments: segmentIds.size,
    totalStreetSegments:
      state.grid.sectors.find((sector) => sector.id === state.activeSectorId)
        ?.totalStreetSegments ?? segmentIds.size
  });

  return {
    ...state,
    grid,
    activeStreetPlan: plan,
    lastProbeId: probeId
  };
}

export function advanceCoverageSector(
  state: CoverageOrchestratorState
): CoverageOrchestratorState {
  if (!state.activeSectorId) return state;

  const current = state.grid.sectors.find((sector) => sector.id === state.activeSectorId);
  if (current && current.status === 'in-progress') {
    throw new Error('coverage_sector_still_in_progress');
  }

  return {
    ...state,
    activeSectorId: null,
    activeStreetPlan: null,
    lastProbeId: null
  };
}

export type CoverageCheckpoint = {
  coverage_key: string;
  label: string;
  status: 'pending' | 'in-progress' | 'complete' | 'blocked';
  progress_pct: number;
  last_probe_id: string | null;
  last_sector_id: string | null;
  state: {
    grid: CoverageGrid;
    activeStreetPlan: StreetCoveragePlan | null;
  };
  metadata: {
    street_summary: ReturnType<typeof summarizeStreetCoverage> | null;
    grid_summary: ReturnType<typeof summarizeCoverageGrid>;
  };
};

export function coverageCheckpoint(state: CoverageOrchestratorState): CoverageCheckpoint {
  const gridSummary = summarizeCoverageGrid(state.grid);
  const streetSummary = state.activeStreetPlan
    ? summarizeStreetCoverage(state.activeStreetPlan)
    : null;

  return {
    coverage_key: state.coverageKey,
    label: state.label,
    status: gridSummary.complete
      ? 'complete'
      : state.activeSectorId
        ? 'in-progress'
        : 'pending',
    progress_pct: gridSummary.completionPct,
    last_probe_id: state.lastProbeId,
    last_sector_id: state.activeSectorId,
    state: {
      grid: state.grid,
      activeStreetPlan: state.activeStreetPlan
    },
    metadata: {
      street_summary: streetSummary,
      grid_summary: gridSummary
    }
  };
}
