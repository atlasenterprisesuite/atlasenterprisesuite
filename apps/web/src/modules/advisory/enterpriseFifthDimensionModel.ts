import {
  type AutomationInput
} from './enterpriseAutomationModel';
import {
  evaluateSixDimensionPaths,
  type SixDimensionAssumptions,
  type SixDimensionPathId,
  DEFAULT_SIX_DIMENSION_ASSUMPTIONS
} from './enterpriseSixDimensionModel';

/**
 * 5D is a metaphor for exploring alternative business scenarios; 6D provides
 * one governed, explainable scorecard for each scenario. Neither is a forecast
 * or a scheduler, and neither invokes an integration or writes business state.
 */
export type FifthDimensionAssumptions = {
  demandShiftPercent: number;
  exceptionShiftPercent: number;
  productivityShiftPercent: number;
};

export const DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS: FifthDimensionAssumptions = {
  demandShiftPercent: 25,
  exceptionShiftPercent: 50,
  productivityShiftPercent: 15
};

export const FIFTH_DIMENSION_LENSES = [
  { id: 'demand', label: 'Demand', description: 'How many monthly work items arrive?' },
  { id: 'futures', label: 'Futures', description: 'What if incoming operations change?' },
  { id: 'routes', label: 'Routes', description: 'Which operational path handles the work?' },
  { id: 'cost', label: 'Cost', description: 'What is the modeled monthly expense?' },
  { id: 'resilience', label: 'Resilience', description: 'Which strategy tolerates the modeled surge?' }
] as const;

export type FifthDimensionFutureId = 'lean' | 'baseline' | 'surge';

const FUTURES: readonly {
  id: FifthDimensionFutureId;
  label: string;
  description: string;
  direction: -1 | 0 | 1;
}[] = [
  { id: 'lean', label: 'Lower demand', description: 'Fewer variable work items and easier RPA assumptions', direction: -1 },
  { id: 'baseline', label: 'Current plan', description: 'Use the submitted workload and 6D assumptions as entered', direction: 0 },
  { id: 'surge', label: 'Demand surge', description: 'More variable work, more RPA exceptions, less potential automation benefit', direction: 1 }
];

const STRATEGY_ORDER: readonly SixDimensionPathId[] = ['manual', 'assisted', 'governed-rpa'];

function validate(assumptions: FifthDimensionAssumptions) {
  for (const key of ['demandShiftPercent', 'exceptionShiftPercent', 'productivityShiftPercent'] as const) {
    if (!Number.isFinite(assumptions[key]) || assumptions[key] < 0 || assumptions[key] > 100) {
      throw new Error(`The ${key} assumption must be between 0 and 100.`);
    }
  }
}

function variation(input: AutomationInput, factor: number): AutomationInput {
  // Legal entity count, bank accounts, staffing and fixed monthly closes
  // are held constant rather than being falsely modeled as demand-dependent.
  return {
    ...input,
    documentsPerCompany: input.documentsPerCompany * factor,
    inventoryMovesPerCompany: input.inventoryMovesPerCompany * factor,
    requestsPerCompany: input.requestsPerCompany * factor,
    adminDocumentsPerCompany: input.adminDocumentsPerCompany * factor
  };
}

export function evaluateFifthDimensionFutures(
  input: AutomationInput,
  assumptions: FifthDimensionAssumptions = DEFAULT_FIFTH_DIMENSION_ASSUMPTIONS,
  sixAssumptions: SixDimensionAssumptions = DEFAULT_SIX_DIMENSION_ASSUMPTIONS
) {
  validate(assumptions);
  // Always validate base user inputs and RPA assumptions through the shared
  // canonical 6D evaluator, even if a variation can reduce a count to zero.
  evaluateSixDimensionPaths(input, sixAssumptions);

  const futures = FUTURES.map(({ id, label, description, direction }) => {
    const factor = 1 + direction * assumptions.demandShiftPercent / 100;
    const scenarioInput = variation(input, factor);
    const scenarioRpa: SixDimensionAssumptions = {
      ...sixAssumptions,
      exceptionRatePercent: Math.min(
        100,
        sixAssumptions.exceptionRatePercent * (1 + direction * assumptions.exceptionShiftPercent / 100)
      ),
      rpaTimeReductionPercent: Math.min(
        100,
        sixAssumptions.rpaTimeReductionPercent * (1 - direction * assumptions.productivityShiftPercent / 100)
      )
    };
    const evaluation = evaluateSixDimensionPaths(scenarioInput, scenarioRpa);
    return {
      id, label, description,
      input: scenarioInput,
      scenarioRpa,
      evaluation
    };
  });

  // Simple minimax cost robustness: lowest maximum modeled monthly operating
  // cost across three hypothetical scenarios. No probability or certainty.
  const robustness = STRATEGY_ORDER.map((pathId) => {
    const monthlyCosts = futures.map((future) => {
      const path = future.evaluation.paths.find((row) => row.id === pathId);
      if (!path) throw new Error('Missing canonical strategy in future scenario.');
      return path.operatingCost;
    });
    return {
      pathId,
      worstCaseMonthlyCost: Math.max(...monthlyCosts),
      bestCaseMonthlyCost: Math.min(...monthlyCosts),
      baselineMonthlyCost: monthlyCosts[1]
    };
  });
  const robustPathId = [...robustness].sort((a, b) => a.worstCaseMonthlyCost - b.worstCaseMonthlyCost)[0].pathId;

  return {
    lenses: FIFTH_DIMENSION_LENSES,
    assumptions: { ...assumptions },
    futures,
    robustness,
    robustPathId,
    executionStatus: 'simulation_only' as const,
    probabilitiesEstimated: false as const
  };
}
