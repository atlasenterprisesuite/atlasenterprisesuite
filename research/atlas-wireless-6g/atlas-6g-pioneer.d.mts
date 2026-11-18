export interface ScenarioInput {
  offeredMbps: number;
  capacityMbps: number;
  baseLatencyMs: number;
  jitterMs?: number;
  durationSeconds?: number;
}
export interface SimulationOutput {
  provenance: 'synthetic_model';
  networkGeneration: 'unspecified';
  model: 'simple_capacity_v1';
  observed: false;
  durationSeconds: number;
  offeredMbps: number;
  capacityMbps: number;
  deliveredMbps: number;
  estimatedLossPercent: number;
  modeledLatencyMs: number;
  warning: string;
}
export type EvidenceEntry = { verified: boolean; reference: string; verifiedAt: string };
export interface ReadinessOutput {
  mode: 'research_only';
  evidenceComplete: boolean;
  service6gReady: false;
  commercialActivationAllowed: false;
  checks: { requirement: string; verified: boolean; evidenceReference: string | null }[];
}
export const REQUIREMENTS: readonly string[];
export function evaluateReadiness(evidence?: Record<string, EvidenceEntry>): ReadinessOutput;
export function simulateScenario(scenario: ScenarioInput): SimulationOutput;
