import type {
  PracticalScore,
  PracticalScoreInput,
  WrittenExamBlueprint,
  WrittenExamScore,
  WrittenExamSubmission,
} from './types';

const roundScore = (value: number) => Math.round(value * 100) / 100;

export function scoreWrittenExam(
  submission: WrittenExamSubmission,
  blueprint: WrittenExamBlueprint
): WrittenExamScore {
  const total = blueprint.questions.length;
  let correct = 0;
  const failedCriticalQuestionIds: string[] = [];

  for (const question of blueprint.questions) {
    const isCorrect = submission.answers[question.id] === question.correctAnswer;
    if (isCorrect) {
      correct += 1;
    } else if (question.critical) {
      failedCriticalQuestionIds.push(question.id);
    }
  }

  return {
    score: total === 0 ? 0 : roundScore((correct / total) * 100),
    correct,
    total,
    failedCriticalQuestionIds,
  };
}

export function scorePracticalReturn(input: PracticalScoreInput): PracticalScore {
  const weightedScore = roundScore(
    input.components.reduce((total, component) => total + component.score * component.weight, 0)
  );
  const criticalFailures = [...new Set(input.criticalFailures ?? [])];

  return {
    weightedScore,
    criticalFailures,
    passed: weightedScore >= input.passingScore && criticalFailures.length === 0,
  };
}
