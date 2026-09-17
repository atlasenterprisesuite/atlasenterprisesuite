export interface SurveillanceCostInput {
  sampleRateHz: number;
  computeMsPerSample: number;
  activeNodes: number;
  energyMwPerNode: number;
}

export interface SurveillanceCostResult {
  computeMsPerSecond: number;
  computeUtilizationRatio: number;
  energyMw: number;
  activeNodes: number;
}

export function calculateSurveillanceCost(input: SurveillanceCostInput): SurveillanceCostResult {
  const { sampleRateHz, computeMsPerSample, activeNodes, energyMwPerNode } = input;
  if (![sampleRateHz, computeMsPerSample, activeNodes, energyMwPerNode].every(Number.isFinite)) {
    throw new Error('surveillance_cost_invalid_input');
  }
  if (sampleRateHz < 0 || computeMsPerSample < 0 || energyMwPerNode < 0 || !Number.isInteger(activeNodes) || activeNodes < 0) {
    throw new Error('surveillance_cost_invalid_input');
  }

  const computeMsPerSecond = sampleRateHz * computeMsPerSample * activeNodes;
  const computeUtilizationRatio = computeMsPerSecond / 1_000;
  const energyMw = energyMwPerNode * activeNodes;

  return {
    computeMsPerSecond: Math.round(computeMsPerSecond * 1_000_000) / 1_000_000,
    computeUtilizationRatio: Math.round(computeUtilizationRatio * 1_000_000) / 1_000_000,
    energyMw: Math.round(energyMw * 1_000_000) / 1_000_000,
    activeNodes
  };
}
