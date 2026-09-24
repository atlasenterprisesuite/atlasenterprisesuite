export interface SentinelFitnessInput {
  baseline: number;
  current: number;
  tolerance: number;
}

export interface SentinelFitnessResult {
  fitness: number;
  deviation: number;
  diagnosticConclusion: null;
}

export function calculateSentinelFitness(input: SentinelFitnessInput): SentinelFitnessResult {
  const { baseline, current, tolerance } = input;
  if (![baseline, current, tolerance].every(Number.isFinite) || tolerance <= 0) {
    throw new Error('sentinel_fitness_invalid_input');
  }

  const deviation = Math.abs(current - baseline);
  const fitness = Math.max(0, Math.min(1, 1 - deviation / tolerance));

  return {
    fitness: Math.round(fitness * 1_000_000) / 1_000_000,
    deviation: Math.round(deviation * 1_000_000) / 1_000_000,
    diagnosticConclusion: null
  };
}
