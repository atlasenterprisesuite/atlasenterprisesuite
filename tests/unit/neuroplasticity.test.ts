import { describe, expect, it } from 'vitest';
import {
  buildNeuroplasticityPlan,
  completionPercent,
  nextReviewDate,
  validateProfile
} from '../../packages/learning/neuroplasticity';
import type { NeuroplasticityProfile } from '../../packages/learning/neuroplasticity';

const profile: NeuroplasticityProfile = {
  goal: 'professional',
  minutesPerDay: 30,
  experienceLevel: 'beginner',
  sleepHours: 8,
  exerciseDaysPerWeek: 3,
  hasNeurologicalCondition: false
};

describe('ATLAS neuroplasticity plan engine', () => {
  it('builds a bounded deterministic plan with cross-module ownership', () => {
    const first = buildNeuroplasticityPlan(profile);
    const second = buildNeuroplasticityPlan(profile);
    expect(first).toEqual(second);
    expect(first.totalMinutes).toBe(30);
    expect(first.blocks.some((block) => block.owner === 'health')).toBe(true);
    expect(first.blocks.some((block) => block.owner === 'learning')).toBe(true);
    expect(first.reviewDays).toEqual([1, 3, 7, 14]);
  });

  it('rejects unsafe or invalid assessment ranges', () => {
    expect(validateProfile({ ...profile, minutesPerDay: 500 })).toContain('Daily practice must be between 15 and 120 minutes.');
    expect(() => buildNeuroplasticityPlan({ ...profile, sleepHours: 25 })).toThrow();
  });

  it('recommends professional tailoring for neurological conditions', () => {
    const plan = buildNeuroplasticityPlan({ ...profile, hasNeurologicalCondition: true });
    expect(plan.professionalReviewRecommended).toBe(true);
    expect(plan.safetyMessage).toMatch(/neurologist or rehabilitation professional/i);
  });

  it('calculates review dates and progress without duplicate inflation', () => {
    const plan = buildNeuroplasticityPlan(profile);
    expect(nextReviewDate('2026-09-06', 7)).toBe('2026-09-13');
    expect(completionPercent([plan.blocks[0].id, plan.blocks[0].id], plan.blocks)).toBe(Math.round(100 / plan.blocks.length));
  });
});
