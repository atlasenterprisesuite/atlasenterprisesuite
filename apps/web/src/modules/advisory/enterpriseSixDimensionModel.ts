import {
  AUTOMATION_PROCESSES,
  calculateAutomationScenario,
  type AutomationInput
} from './enterpriseAutomationModel';

/**
 * ATLAS "sixth dimension" is an operational decision metaphor, not a claim that
 * physical extra dimensions or future outcomes can be observed.
 *
 * This is a pure, client-side, hypothetical calculator. It never calls an RPA
 * runner, makes accounting changes, or authorizes payments.
 */
export type SixDimensionAssumptions = {
  rpaCoveragePercent: number;
  rpaTimeReductionPercent: number;
  exceptionRatePercent: number;
  reviewMinutesPerException: number;
};

export const DEFAULT_SIX_DIMENSION_ASSUMPTIONS: SixDimensionAssumptions = {
  rpaCoveragePercent: 60,
  rpaTimeReductionPercent: 45,
  exceptionRatePercent: 4,
  reviewMinutesPerException: 8
};

export const SIX_DIMENSIONS = [
  { id: 'volume', label: 'Volume', unit: 'work items per month', description: 'AP/AR, bank, close, people, inventory, purchasing and admin workload' },
  { id: 'time', label: 'Human time', unit: 'hours per month', description: 'Time remaining after hypothetical automation and exception review' },
  { id: 'cost', label: 'Operating cost', unit: 'USD per month', description: 'Modeled labor cost plus the entered monthly platform assumption' },
  { id: 'capacity', label: 'Recovered capacity', unit: 'hours per month', description: 'Modeled freed hours, not automatically realizable cash savings' },
  { id: 'exceptions', label: 'Exception queue', unit: 'cases per month', description: 'Hypothetical RPA exceptions requiring human handling, not detected real incidents' },
  { id: 'controls', label: 'Approval gates', unit: 'restricted process types', description: 'Sensitive operations never auto-executed from this simulator' }
] as const;

const PILOT_ELIGIBLE = new Set<string>(['ar', 'inventory', 'operations', 'admin']);
export type SixDimensionPathId = 'manual' | 'assisted' | 'governed-rpa';

export type SixDimensionPath = {
  id: SixDimensionPathId;
  label: string;
  humanHours: number;
  operatingCost: number;
  capacityRecovered: number;
  projectedExceptions: number | null;
  restrictedProcessTypes: number;
  monthlyCostDifferenceFromManual: number;
};

function validate(assumptions: SixDimensionAssumptions) {
  for (const key of ['rpaCoveragePercent', 'rpaTimeReductionPercent', 'exceptionRatePercent'] as const) {
    if (!Number.isFinite(assumptions[key]) || assumptions[key] < 0 || assumptions[key] > 100) {
      throw new Error(`The ${key} assumption must be between 0 and 100.`);
    }
  }
  if (!Number.isFinite(assumptions.reviewMinutesPerException) || assumptions.reviewMinutesPerException < 0 || assumptions.reviewMinutesPerException > 1000000) {
    throw new Error('Exception-review minutes must be a finite, non-negative number.');
  }
}

export function evaluateSixDimensionPaths(
  input: AutomationInput,
  assumptions: SixDimensionAssumptions = DEFAULT_SIX_DIMENSION_ASSUMPTIONS
) {
  validate(assumptions);
  const base = calculateAutomationScenario(input);
  const eligibleRows = base.rows.filter((row) => PILOT_ELIGIBLE.has(row.id));
  const restrictedProcesses = AUTOMATION_PROCESSES.filter((process) => !PILOT_ELIGIBLE.has(process.id));
  const totalItems = base.rows.reduce((sum, row) => sum + row.volume, 0);
  const coveredShare = assumptions.rpaCoveragePercent / 100;
  const eligibleVolume = eligibleRows.reduce((sum, row) => sum + row.volume, 0);
  const expectedExceptions = eligibleVolume * coveredShare * assumptions.exceptionRatePercent / 100;
  const projectedRpaTimeReduction = eligibleRows.reduce((sum, row) => sum + row.assistedHours, 0)
    * coveredShare * assumptions.rpaTimeReductionPercent / 100;
  const exceptionReviewHours = expectedExceptions * assumptions.reviewMinutesPerException / 60;
  const governedHours = base.assistedHours - projectedRpaTimeReduction + exceptionReviewHours;
  const manualCost = base.manualHours * input.hourlyCost;

  function path(
    id: SixDimensionPathId,
    label: string,
    humanHours: number,
    platformCost: number,
    projectedExceptions: number | null
  ): SixDimensionPath {
    const operatingCost = humanHours * input.hourlyCost + platformCost;
    return {
      id, label, humanHours, operatingCost,
      capacityRecovered: base.manualHours - humanHours,
      projectedExceptions,
      restrictedProcessTypes: restrictedProcesses.length,
      monthlyCostDifferenceFromManual: manualCost - operatingCost
    };
  }

  const paths = [
    path('manual', 'Manual baseline', base.manualHours, 0, null),
    path('assisted', 'Human-assisted', base.assistedHours, input.monthlyPlatformCost, null),
    path('governed-rpa', 'Governed RPA pilot', governedHours, input.monthlyPlatformCost, expectedExceptions)
  ];
  // Lowest *estimated* monthly operating cost wins. In a tie, keep the
  // less autonomous path; no automated execution follows this ranking.
  const recommendedId = [...paths].sort((a, b) => a.operatingCost - b.operatingCost)[0].id;

  return {
    dimensions: SIX_DIMENSIONS,
    assumptions: { ...assumptions },
    paths,
    recommendedId,
    totalItems,
    eligibleVolume,
    exceptionReviewHours,
    restrictedProcesses,
    executionStatus: 'simulation_only' as const
  };
}
