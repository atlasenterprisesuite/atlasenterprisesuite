import type { ApplicationStage } from './types';

const terminalStages = new Set<ApplicationStage>(['hired', 'rejected', 'withdrawn']);

const allowedTransitions: Record<ApplicationStage, readonly ApplicationStage[]> = {
  applied: ['screening', 'rejected', 'withdrawn'],
  screening: ['assessment', 'interview', 'rejected', 'withdrawn'],
  assessment: ['interview', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['hired', 'rejected', 'withdrawn'],
  hired: [],
  rejected: [],
  withdrawn: [],
};

export function advanceApplicationStage(
  current: ApplicationStage,
  next: ApplicationStage,
): ApplicationStage {
  if (terminalStages.has(current)) {
    throw new Error(`Application stage ${current} is terminal and cannot be reopened silently.`);
  }

  if (!allowedTransitions[current].includes(next)) {
    throw new Error(`Unsupported application transition: ${current} -> ${next}.`);
  }

  return next;
}

export type AssessmentScoreInput = {
  earned: number;
  possible: number;
  passingPercent?: number;
};

export type AssessmentScore = {
  score: number;
  passed: boolean;
};

export function scoreAssessment(input: AssessmentScoreInput): AssessmentScore {
  const { earned, possible } = input;
  const passingPercent = input.passingPercent ?? 70;

  if (!Number.isFinite(earned) || !Number.isFinite(possible) || !Number.isFinite(passingPercent)) {
    throw new Error('Assessment score values must be finite numbers.');
  }
  if (possible <= 0) throw new Error('Assessment possible score must be greater than zero.');
  if (earned < 0 || earned > possible) throw new Error('Assessment earned score must be between zero and possible score.');
  if (passingPercent < 0 || passingPercent > 100) throw new Error('Assessment passing percent must be between 0 and 100.');

  const score = Math.round((earned / possible) * 10000) / 100;
  return { score, passed: score >= passingPercent };
}
