
export type ProductiveTaxFact = {
  taxFactKey: string;
  subjectKey: string;
  jurisdiction: string;
  value: unknown;
  isCurrent: boolean;
  reviewState?: 'unreviewed' | 'review' | 'approved' | 'rejected' | 'overridden';
};

export type PersonalLineRollup = {
  line1aW2Wages: number;
  line1cTips: number;
  line2aTaxExemptInterest: number;
  line2bTaxableInterest: number;
  line3aQualifiedDividends: number;
  line3bOrdinaryDividends: number;
  line25aW2Withholding: number;
  line25b1099Withholding: number;
};

export type BookToTaxAdjustment = {
  id: string;
  label: string;
  amount: number;
  classification: 'permanent' | 'temporary' | 'reclass' | 'other';
  evidenceReference?: string;
};

export type BookToTaxBridge = {
  bookNetIncome: number;
  permanentAdjustments: number;
  temporaryAdjustments: number;
  reclassAdjustments: number;
  otherAdjustments: number;
  totalAdjustments: number;
  taxIncomeBeforeReturnSpecificItems: number;
  adjustments: BookToTaxAdjustment[];
};

export type ReconciliationResult = {
  sourceTotal: number;
  returnTotal: number;
  variance: number;
  tolerance: number;
  status: 'reconciled' | 'review' | 'blocked';
};

export type CarryforwardApplication = {
  openingAmount: number;
  appliedAmount: number;
  remainingAmount: number;
  status: 'available' | 'partially_used' | 'used';
};

export type TaxRulePack = {
  jurisdiction: string;
  taxYear: number;
  version: string;
  status: 'draft' | 'proposed' | 'final' | 'transitional' | 'superseded';
  sourceVerified: boolean;
  approvedForProduction: boolean;
};

function finite(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'amount' in value) {
    const amount = Number((value as { amount?: unknown }).amount);
    return Number.isFinite(amount) ? amount : null;
  }
  return null;
}

export function sumCurrentNumericFacts(
  facts: readonly ProductiveTaxFact[],
  taxFactKey: string,
  jurisdiction?: string
): number {
  return facts.reduce((sum, fact) => {
    if (!fact.isCurrent || fact.taxFactKey !== taxFactKey) return sum;
    if (jurisdiction && fact.jurisdiction !== jurisdiction) return sum;
    if (fact.reviewState === 'rejected') return sum;
    const amount = finite(fact.value);
    return amount === null ? sum : sum + amount;
  }, 0);
}

export function buildPersonalLineRollup(facts: readonly ProductiveTaxFact[]): PersonalLineRollup {
  return {
    line1aW2Wages: sumCurrentNumericFacts(facts, 'w2Wages'),
    line1cTips: sumCurrentNumericFacts(facts, 'allocatedAndUnreportedTips'),
    line2aTaxExemptInterest:
      sumCurrentNumericFacts(facts, 'taxExemptInterest') +
      sumCurrentNumericFacts(facts, 'exemptInterestDividends'),
    line2bTaxableInterest:
      sumCurrentNumericFacts(facts, 'taxableInterest') +
      sumCurrentNumericFacts(facts, 'usTreasuryInterest') +
      sumCurrentNumericFacts(facts, 'partnershipInterestIncome'),
    line3aQualifiedDividends:
      sumCurrentNumericFacts(facts, 'qualifiedDividends') +
      sumCurrentNumericFacts(facts, 'partnershipQualifiedDividends'),
    line3bOrdinaryDividends:
      sumCurrentNumericFacts(facts, 'ordinaryDividends') +
      sumCurrentNumericFacts(facts, 'partnershipOrdinaryDividends'),
    line25aW2Withholding: sumCurrentNumericFacts(facts, 'federalIncomeTaxWithheldW2'),
    line25b1099Withholding: sumCurrentNumericFacts(facts, 'federalWithholding1099')
  };
}

export function buildBookToTaxBridge(
  bookNetIncome: number,
  adjustments: readonly BookToTaxAdjustment[]
): BookToTaxBridge {
  if (!Number.isFinite(bookNetIncome)) throw new Error('book_net_income_must_be_finite');
  for (const adjustment of adjustments) {
    if (!Number.isFinite(adjustment.amount)) throw new Error('book_to_tax_adjustment_must_be_finite');
  }

  const total = (classification: BookToTaxAdjustment['classification']) =>
    adjustments.filter((item) => item.classification === classification).reduce((sum, item) => sum + item.amount, 0);

  const permanentAdjustments = total('permanent');
  const temporaryAdjustments = total('temporary');
  const reclassAdjustments = total('reclass');
  const otherAdjustments = total('other');
  const totalAdjustments = permanentAdjustments + temporaryAdjustments + reclassAdjustments + otherAdjustments;

  return {
    bookNetIncome,
    permanentAdjustments,
    temporaryAdjustments,
    reclassAdjustments,
    otherAdjustments,
    totalAdjustments,
    taxIncomeBeforeReturnSpecificItems: bookNetIncome + totalAdjustments,
    adjustments: [...adjustments]
  };
}

export function reconcileTaxAmounts(
  sourceTotal: number,
  returnTotal: number,
  tolerance = 0.01
): ReconciliationResult {
  if (![sourceTotal, returnTotal, tolerance].every(Number.isFinite) || tolerance < 0) {
    throw new Error('invalid_reconciliation_amount');
  }
  const variance = Number((returnTotal - sourceTotal).toFixed(2));
  const absolute = Math.abs(variance);
  return {
    sourceTotal,
    returnTotal,
    variance,
    tolerance,
    status: absolute <= tolerance ? 'reconciled' : absolute <= Math.max(tolerance * 100, 1) ? 'review' : 'blocked'
  };
}

export function applyCarryforward(openingAmount: number, requestedAmount: number): CarryforwardApplication {
  if (![openingAmount, requestedAmount].every(Number.isFinite) || openingAmount < 0 || requestedAmount < 0) {
    throw new Error('invalid_carryforward_amount');
  }
  const appliedAmount = Math.min(openingAmount, requestedAmount);
  const remainingAmount = Number((openingAmount - appliedAmount).toFixed(2));
  return {
    openingAmount,
    appliedAmount,
    remainingAmount,
    status: remainingAmount === 0 ? 'used' : appliedAmount === 0 ? 'available' : 'partially_used'
  };
}

export function rulePackCanCalculateInProduction(rulePack: TaxRulePack): boolean {
  return (
    rulePack.status === 'final' &&
    rulePack.sourceVerified &&
    rulePack.approvedForProduction &&
    rulePack.version.trim().length > 0 &&
    rulePack.jurisdiction.trim().length > 0
  );
}

export function requireProductionRulePack(rulePack: TaxRulePack): void {
  if (!rulePackCanCalculateInProduction(rulePack)) {
    throw new Error('tax_rule_pack_not_approved_for_production');
  }
}
