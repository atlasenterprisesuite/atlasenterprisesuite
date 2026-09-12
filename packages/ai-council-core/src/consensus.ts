import type { CouncilConsensusState } from './task';

export type CouncilStance =
  | 'support'
  | 'oppose'
  | 'conditional'
  | 'abstain'
  | 'failed'
  | 'unavailable';

export type CouncilProviderOutcome = Readonly<{
  executionId: string;
  provider: string;
  stance: CouncilStance;
  veto?: boolean;
  evidenceRefs?: readonly string[];
  conditions?: readonly string[];
}>;

export type CouncilConsensusDecision = Readonly<{
  state: Exclude<CouncilConsensusState, 'pending'>;
  ruleVersion: 'ai-council-consensus-v1';
  executionIds: readonly string[];
  conditions: readonly string[];
}>;

function decision(
  state: CouncilConsensusDecision['state'],
  executionIds: readonly string[],
  conditions: readonly string[],
): CouncilConsensusDecision {
  return Object.freeze({
    state,
    ruleVersion: 'ai-council-consensus-v1' as const,
    executionIds: Object.freeze([...executionIds]),
    conditions: Object.freeze([...conditions]),
  });
}

export function evaluateCouncilConsensus(
  outcomes: readonly CouncilProviderOutcome[],
): CouncilConsensusDecision {
  const executionIds = outcomes.map((outcome) => outcome.executionId);
  const conditions = outcomes.flatMap((outcome) => outcome.conditions ?? []);

  if (outcomes.some((outcome) => outcome.veto === true)) {
    return decision('blocked', executionIds, conditions);
  }

  if (outcomes.length === 0) {
    return decision('insufficient_evidence', executionIds, conditions);
  }

  if (outcomes.some((outcome) => outcome.stance === 'oppose')) {
    return decision('needs_human_review', executionIds, conditions);
  }

  if (outcomes.some((outcome) => ['abstain', 'failed', 'unavailable'].includes(outcome.stance))) {
    return decision('insufficient_evidence', executionIds, conditions);
  }

  if (outcomes.some((outcome) => outcome.stance === 'conditional')) {
    return decision('approved_with_conditions', executionIds, conditions);
  }

  return decision('approved', executionIds, conditions);
}
