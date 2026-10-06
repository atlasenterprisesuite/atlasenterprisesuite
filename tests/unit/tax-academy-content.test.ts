import { describe, expect, it } from 'vitest';
import { TAX_FORM_CATALOG } from '../../packages/tax-forms/src';
import { ACADEMY_2026_CASES, canUseAcademyRulePackForProduction, expandedPracticeExerciseCount } from '../../packages/tax-academy/src';

describe('ATLAS Tax Academy 2026 content', () => {
  it('provides at least 30 complete practical cases and 300 generated practice exercises', () => {
    expect(ACADEMY_2026_CASES.length).toBeGreaterThanOrEqual(30);
    expect(expandedPracticeExerciseCount(ACADEMY_2026_CASES)).toBeGreaterThanOrEqual(300);
  });

  it('covers all five filing statuses', () => {
    expect(new Set(ACADEMY_2026_CASES.map(c => c.filingStatus))).toEqual(new Set(['single','mfj','mfs','hoh','qss']));
  });

  it('keeps golden-derived content deidentified and free of full SSN/bank patterns', () => {
    const golden=ACADEMY_2026_CASES.filter(c => c.goldenDerived);
    expect(golden.length).toBeGreaterThan(0);
    expect(golden.every(c => c.deidentified)).toBe(true);
    const text=JSON.stringify(ACADEMY_2026_CASES);
    expect(text).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
    expect(text).not.toMatch(/\b\d{9,17}\b/);
  });

  it('references catalogued forms or explicitly documented review-only gaps', () => {
    const ids=new Set(TAX_FORM_CATALOG.map(f=>f.id));
    for (const c of ACADEMY_2026_CASES) for (const f of [...c.requiredForms,...c.conditionalForms]) {
      expect(ids.has(f.formId) || (f.reviewOnly && Boolean(f.catalogGap))).toBe(true);
    }
  });

  it('fails closed for production until production certified', () => {
    expect(canUseAcademyRulePackForProduction('training_current')).toBe(false);
    expect(canUseAcademyRulePackForProduction('final_form_verified')).toBe(false);
    expect(canUseAcademyRulePackForProduction('production_certified')).toBe(true);
  });
});
