
import { describe, expect, it } from 'vitest';
import {
  applyCarryforward,
  buildBookToTaxBridge,
  buildPersonalLineRollup,
  reconcileTaxAmounts,
  requireProductionRulePack,
  rulePackCanCalculateInProduction,
  type ProductiveTaxFact
} from '../../packages/tax-forms/src';

const fact = (taxFactKey: string, amount: number, subjectKey = taxFactKey): ProductiveTaxFact => ({
  taxFactKey,
  subjectKey,
  jurisdiction: 'federal',
  value: { amount },
  isCurrent: true
});

describe('ATLAS Tax productive calculations', () => {
  it('aggregates multiple source documents into deterministic 1040 line rollups', () => {
    const facts: ProductiveTaxFact[] = [
      fact('w2Wages', 50000, 'w2-a'),
      fact('w2Wages', 12000, 'w2-b'),
      fact('taxableInterest', 500),
      fact('usTreasuryInterest', 250),
      fact('ordinaryDividends', 800),
      fact('qualifiedDividends', 600),
      fact('federalIncomeTaxWithheldW2', 6100, 'w2-a-wh'),
      fact('federalIncomeTaxWithheldW2', 900, 'w2-b-wh'),
      fact('federalWithholding1099', 100)
    ];

    const rollup = buildPersonalLineRollup(facts);
    expect(rollup.line1aW2Wages).toBe(62000);
    expect(rollup.line2bTaxableInterest).toBe(750);
    expect(rollup.line3bOrdinaryDividends).toBe(800);
    expect(rollup.line3aQualifiedDividends).toBe(600);
    expect(rollup.line25aW2Withholding).toBe(7000);
    expect(rollup.line25b1099Withholding).toBe(100);
  });

  it('ignores superseded and rejected facts', () => {
    const facts: ProductiveTaxFact[] = [
      fact('w2Wages', 40000, 'current'),
      { ...fact('w2Wages', 10000, 'old'), isCurrent: false },
      { ...fact('w2Wages', 5000, 'rejected'), reviewState: 'rejected' }
    ];
    expect(buildPersonalLineRollup(facts).line1aW2Wages).toBe(40000);
  });

  it('builds a business book-to-tax bridge without inventing tax-rate logic', () => {
    const bridge = buildBookToTaxBridge(100000, [
      { id: 'perm-1', label: 'Permanent adjustment', amount: 5000, classification: 'permanent' },
      { id: 'temp-1', label: 'Temporary adjustment', amount: -2000, classification: 'temporary' },
      { id: 'reclass-1', label: 'Reclass', amount: 1000, classification: 'reclass' }
    ]);
    expect(bridge.totalAdjustments).toBe(4000);
    expect(bridge.taxIncomeBeforeReturnSpecificItems).toBe(104000);
  });

  it('classifies reconciliations by variance', () => {
    expect(reconcileTaxAmounts(100, 100).status).toBe('reconciled');
    expect(reconcileTaxAmounts(100, 100.5).status).toBe('review');
    expect(reconcileTaxAmounts(100, 105).status).toBe('blocked');
  });

  it('applies carryforwards without exceeding the opening balance', () => {
    expect(applyCarryforward(10000, 4000)).toEqual({
      openingAmount: 10000,
      appliedAmount: 4000,
      remainingAmount: 6000,
      status: 'partially_used'
    });
    expect(applyCarryforward(10000, 20000).remainingAmount).toBe(0);
  });

  it('fails closed when a legal rule pack is draft, unverified or unapproved', () => {
    const draft = {
      jurisdiction: 'US-FED',
      taxYear: 2026,
      version: '2026-draft-1',
      status: 'draft' as const,
      sourceVerified: true,
      approvedForProduction: false
    };
    expect(rulePackCanCalculateInProduction(draft)).toBe(false);
    expect(() => requireProductionRulePack(draft)).toThrow('tax_rule_pack_not_approved_for_production');

    const final = { ...draft, version: '2025-final-1', taxYear: 2025, status: 'final' as const, approvedForProduction: true };
    expect(rulePackCanCalculateInProduction(final)).toBe(true);
    expect(() => requireProductionRulePack(final)).not.toThrow();
  });
});
