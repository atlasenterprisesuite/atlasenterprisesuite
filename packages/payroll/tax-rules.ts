export type TaxRuleSet = {
  jurisdiction: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  validated: boolean;
  calculateEmployeeTaxes: (taxableWageBaseCents: number) => number;
  calculateEmployerTaxes: (taxableWageBaseCents: number) => number;
};

export class UnsupportedTaxRuleError extends Error {
  constructor(jurisdiction: string, effectiveDate: string) {
    super(`unsupported_tax_rule:${jurisdiction}:${effectiveDate}`);
    this.name = 'UnsupportedTaxRuleError';
  }
}

export function resolveTaxRuleSet(
  registry: readonly TaxRuleSet[],
  jurisdiction: string,
  effectiveDate: string
): TaxRuleSet {
  const match = registry.find((rule) =>
    rule.validated === true &&
    rule.jurisdiction === jurisdiction &&
    rule.effectiveFrom <= effectiveDate &&
    (!rule.effectiveTo || rule.effectiveTo >= effectiveDate)
  );
  if (!match) throw new UnsupportedTaxRuleError(jurisdiction, effectiveDate);
  return match;
}

export function basisPointRuleSet(input: {
  jurisdiction: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  employeeTaxBps: number;
  employerTaxBps: number;
  validated?: boolean;
}): TaxRuleSet {
  const tax = (cents: number, bps: number) => Math.round((Math.max(0, cents) * bps) / 10_000);
  return {
    jurisdiction: input.jurisdiction,
    version: input.version,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    validated: input.validated ?? true,
    calculateEmployeeTaxes: (cents) => tax(cents, input.employeeTaxBps),
    calculateEmployerTaxes: (cents) => tax(cents, input.employerTaxBps)
  };
}
