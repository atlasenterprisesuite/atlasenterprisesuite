
import { describe, expect, it } from 'vitest';
import {
  filingReadiness,
  stepsForReturn,
  type TaxReturnCase
} from '../../packages/tax-forms/src';

function baseCase(): TaxReturnCase {
  return {
    returnId: 'r1',
    taxYear: 2025,
    returnKind: '1040',
    clientDisplayName: 'Client',
    preparerDisplayName: 'Preparer',
    status: 'in_progress',
    currentStepId: 'engagement',
    completedStepIds: [],
    reviewStepIds: [],
    blockedStepIds: [],
    activatedForms: ['Form 1040'],
    missingItems: [],
    diagnostics: []
  };
}

describe('ATLAS Tax professional workflow', () => {
  it('builds the complete 1040 preparation sequence', () => {
    const steps = stepsForReturn('1040');
    expect(steps[0].id).toBe('engagement');
    expect(steps.some((step) => step.id === 'household')).toBe(true);
    expect(steps.some((step) => step.id === 'credits')).toBe(true);
    expect(steps.some((step) => step.id === 'professional-review')).toBe(true);
    expect(steps.some((step) => step.id === 'client-review')).toBe(true);
    expect(steps.some((step) => step.id === 'efile')).toBe(true);
    expect(steps[steps.length - 1].id).toBe('closeout');
  });

  it('removes individual-only steps from entity returns', () => {
    const steps = stepsForReturn('1065');
    expect(steps.some((step) => step.id === 'household')).toBe(false);
    expect(steps.some((step) => step.id === 'deductions')).toBe(false);
    expect(steps.some((step) => step.id === 'credits')).toBe(false);
    expect(steps.some((step) => step.id === 'business-activity')).toBe(true);
  });

  it('does not declare filing readiness before review and client authorization', () => {
    const result = filingReadiness(baseCase());
    expect(result.ready).toBe(false);
    expect(result.professionalReviewComplete).toBe(false);
    expect(result.signatureComplete).toBe(false);
  });

  it('keeps filing blocked by diagnostics even when workflow steps are complete', () => {
    const item = baseCase();
    const required = stepsForReturn(item.returnKind).filter((step) => step.id !== 'closeout');
    item.completedStepIds = required.map((step) => step.id);
    item.diagnostics = ['unresolved-basis'];
    const result = filingReadiness(item);
    expect(result.ready).toBe(false);
    expect(result.blocking).toBe(true);
  });

  it('allows readiness only after all pre-closeout gates are complete with no blockers', () => {
    const item = baseCase();
    const required = stepsForReturn(item.returnKind).filter((step) => step.id !== 'closeout');
    item.completedStepIds = required.map((step) => step.id);
    const result = filingReadiness(item);
    expect(result.ready).toBe(true);
    expect(result.incompleteStepIds).toEqual([]);
  });
});
