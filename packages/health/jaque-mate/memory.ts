export interface PathologicalMemoryObservation {
  severity: number;
  observedAt: number;
}

export interface PathologicalMemoryInput {
  observations: PathologicalMemoryObservation[];
  halfLifeMs: number;
  now: number;
}

export interface PathologicalMemoryResult {
  depth: number;
  observationCount: number;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function calculatePathologicalMemory(input: PathologicalMemoryInput): PathologicalMemoryResult {
  if (!Number.isFinite(input.halfLifeMs) || input.halfLifeMs <= 0 || !Number.isFinite(input.now)) {
    throw new Error('pathological_memory_invalid_input');
  }

  if (input.observations.length === 0) {
    return { depth: 0, observationCount: 0 };
  }

  const contributions = input.observations.map((observation) => {
    if (!Number.isFinite(observation.severity) || !Number.isFinite(observation.observedAt)) {
      throw new Error('pathological_memory_invalid_observation');
    }

    const ageMs = Math.max(0, input.now - observation.observedAt);
    const decay = Math.pow(0.5, ageMs / input.halfLifeMs);
    return clamp01(observation.severity) * decay;
  });

  const depth = contributions.reduce((sum, contribution) => sum + contribution, 0) / contributions.length;

  return {
    depth: Math.round(depth * 1_000_000) / 1_000_000,
    observationCount: input.observations.length
  };
}
