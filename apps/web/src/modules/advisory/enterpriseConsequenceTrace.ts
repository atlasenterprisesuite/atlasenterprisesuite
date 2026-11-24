import {
  type FifthDimensionFutureId,
  evaluateFifthDimensionFutures
} from './enterpriseFifthDimensionModel';
import {
  type SixDimensionPathId
} from './enterpriseSixDimensionModel';

export const CONSEQUENCE_FUTURES: readonly { id: FifthDimensionFutureId; label: string }[] = [
  { id: 'lean', label: 'Lower demand' },
  { id: 'baseline', label: 'Current plan' },
  { id: 'surge', label: 'Demand surge' }
];

export const CONSEQUENCE_PATHS: readonly { id: SixDimensionPathId; label: string }[] = [
  { id: 'manual', label: 'Manual baseline' },
  { id: 'assisted', label: 'Human-assisted' },
  { id: 'governed-rpa', label: 'Governed RPA pilot' }
];

/** A read-only adapter around the existing 5D/6D hypothetical planning models. */
export function buildConsequenceTrace(
  result: ReturnType<typeof evaluateFifthDimensionFutures>,
  futureId: FifthDimensionFutureId,
  pathId: SixDimensionPathId
) {
  if (result.executionStatus !== 'simulation_only') return null;
  const future = result.futures.find((item) => item.id === futureId);
  if (!future || future.evaluation.executionStatus !== 'simulation_only') return null;
  const path = future.evaluation.paths.find((item) => item.id === pathId);
  if (!path || !Number.isFinite(path.operatingCost) || !Number.isFinite(path.humanHours)) return null;
  const manual = future.evaluation.paths.find((item) => item.id === 'manual');
  if (!manual || !Number.isFinite(manual.operatingCost)) return null;
  return {
    futureLabel: future.label,
    path,
    totalItems: future.evaluation.totalItems,
    differenceFromManual: manual.operatingCost - path.operatingCost,
    restrictedProcesses: future.evaluation.restrictedProcesses.map((process) => process.id),
    humanApprovalRequired: true as const,
    executionStatus: 'simulation_only' as const
  };
}
