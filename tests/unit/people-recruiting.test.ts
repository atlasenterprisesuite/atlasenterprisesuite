import { describe, expect, it } from 'vitest';
import {
  advanceApplicationStage,
  scoreAssessment,
} from '../../packages/people/src';

describe('ATLAS People recruiting rules', () => {
  it('allows documented forward recruiting transitions', () => {
    expect(advanceApplicationStage('applied', 'screening')).toBe('screening');
    expect(advanceApplicationStage('screening', 'assessment')).toBe('assessment');
    expect(advanceApplicationStage('assessment', 'interview')).toBe('interview');
    expect(advanceApplicationStage('interview', 'offer')).toBe('offer');
    expect(advanceApplicationStage('offer', 'hired')).toBe('hired');
  });

  it('prevents reopening terminal outcomes silently', () => {
    expect(() => advanceApplicationStage('hired', 'screening')).toThrow(/terminal/i);
    expect(() => advanceApplicationStage('rejected', 'interview')).toThrow(/terminal/i);
    expect(() => advanceApplicationStage('withdrawn', 'screening')).toThrow(/terminal/i);
  });

  it('allows explicit rejection or withdrawal before a terminal outcome', () => {
    expect(advanceApplicationStage('screening', 'rejected')).toBe('rejected');
    expect(advanceApplicationStage('assessment', 'withdrawn')).toBe('withdrawn');
  });

  it('scores an assessment from explicit evidence only', () => {
    expect(scoreAssessment({ earned: 42, possible: 50 })).toEqual({ score: 84, passed: true });
    expect(scoreAssessment({ earned: 34, possible: 50 })).toEqual({ score: 68, passed: false });
  });

  it('rejects impossible assessment evidence', () => {
    expect(() => scoreAssessment({ earned: 51, possible: 50 })).toThrow();
    expect(() => scoreAssessment({ earned: 1, possible: 0 })).toThrow();
  });
});
