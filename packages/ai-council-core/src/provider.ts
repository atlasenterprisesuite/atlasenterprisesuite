import type { CouncilTask } from './task';

export type CouncilProviderHealthState = 'configured' | 'degraded' | 'unavailable' | 'verified';
export type CouncilConfidenceState = 'unknown' | 'low' | 'medium' | 'high';

export type CouncilResponseEnvelope = Readonly<{
  provider: string;
  model: string;
  role: string;
  summary: string;
  analysisOrRecommendation: string;
  evidenceRefs: readonly string[];
  confidenceState: CouncilConfidenceState;
  limitations: readonly string[];
  requestedActions: readonly string[];
  executionId: string;
}>;

export type CouncilProviderHealth = Readonly<{
  state: CouncilProviderHealthState;
  checkedAt: string;
  evidenceRef?: string;
  detail?: string;
}>;

export type CouncilProviderCapabilities = Readonly<{
  reasoning: boolean;
  review: boolean;
  implementation: boolean;
  cancellation: boolean;
}>;

export type CouncilProviderInvocationContext = Readonly<{
  task: CouncilTask;
  prompt: string;
  policyContext: Readonly<Record<string, unknown>>;
}>;

export interface CouncilProviderAdapter<RawResponse = unknown> {
  readonly providerId: string;
  health(): Promise<CouncilProviderHealth>;
  capabilities(): CouncilProviderCapabilities;
  invoke(context: CouncilProviderInvocationContext): Promise<RawResponse>;
  cancel(executionId: string): Promise<void>;
  normalize(rawResponse: RawResponse, executionId: string): CouncilResponseEnvelope;
}

export function createCouncilResponseEnvelope(input: {
  provider: string;
  model: string;
  role: string;
  summary: string;
  analysisOrRecommendation: string;
  evidenceRefs?: readonly string[];
  confidenceState?: CouncilConfidenceState;
  limitations?: readonly string[];
  requestedActions?: readonly string[];
  executionId: string;
}): CouncilResponseEnvelope {
  return Object.freeze({
    provider: input.provider,
    model: input.model,
    role: input.role,
    summary: input.summary,
    analysisOrRecommendation: input.analysisOrRecommendation,
    evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]),
    confidenceState: input.confidenceState ?? 'unknown',
    limitations: Object.freeze([...(input.limitations ?? [])]),
    requestedActions: Object.freeze([...(input.requestedActions ?? [])]),
    executionId: input.executionId,
  });
}
