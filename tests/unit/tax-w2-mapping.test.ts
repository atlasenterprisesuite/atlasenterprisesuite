
import { describe, expect, it } from 'vitest';
import { mapW2ToReturn } from '../../packages/tax-forms/src';

describe('ATLAS Tax W-2 mapping engine', () => {
  it('maps ordinary W-2 wages and withholding to the federal return', () => {
    const result = mapW2ToReturn({ taxYear: 2025, box1Wages: 62000, box2FederalWithholding: 6400 });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'W-2 box 1', destinationForm: 'Form 1040/1040-SR', destinationLine: '1a', amount: 62000 }),
      expect.objectContaining({ source: 'W-2 box 2', destinationForm: 'Form 1040/1040-SR', destinationLine: '25a', amount: 6400 })
    ]));
  });

  it('routes statutory employee box 1 wages to Schedule C instead of 1040 line 1a', () => {
    const result = mapW2ToReturn({ taxYear: 2025, box1Wages: 50000, box13StatutoryEmployee: true });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'W-2 box 1', destinationForm: 'Schedule C (Form 1040)', destinationLine: '1' })
    ]));
    expect(result.mappings.some((item) => item.destinationForm === 'Form 1040/1040-SR' && item.destinationLine === '1a')).toBe(false);
  });

  it('activates Form 4137 for allocated tips and Form 2441 for dependent care benefits', () => {
    const result = mapW2ToReturn({ taxYear: 2025, box8AllocatedTips: 1200, box10DependentCareBenefits: 5000 });
    expect(result.activatedForms).toContain('Form 4137 + Form 1040/1040-SR');
    expect(result.activatedForms).toContain('Form 2441');
    expect(result.reviewFlags.length).toBeGreaterThan(0);
  });

  it('dispatches common Box 12 codes instead of treating them as generic wages', () => {
    const result = mapW2ToReturn({ taxYear: 2025, box12: [{ code: 'W', amount: 3000 }, { code: 'DD', amount: 8500 }] });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ destinationForm: 'Form 8889', destinationField: 'employerHsaContributions' }),
      expect.objectContaining({ destinationField: 'employerSponsoredHealthCoverage', treatment: 'informational' })
    ]));
  });

  it('keeps state and local values jurisdiction scoped', () => {
    const result = mapW2ToReturn({ taxYear: 2025, box15State: 'FL', box16StateWages: 40000, box20LocalityName: 'Example' });
    expect(result.mappings).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'W-2 box 15 state', jurisdiction: 'state' }),
      expect.objectContaining({ source: 'W-2 box 16', jurisdiction: 'state' }),
      expect.objectContaining({ source: 'W-2 box 20', jurisdiction: 'local' })
    ]));
  });

  it('keeps an empty W-2 graph empty', () => {
    expect(mapW2ToReturn({ taxYear: 2025 }).mappings).toEqual([]);
  });

  it('gates destination revisions for tax year 2026 until final return instructions are approved', () => {
    expect(mapW2ToReturn({ taxYear: 2026, box1Wages: 1 }).revisionStatus).toBe('destination-review-gated');
  });
});
