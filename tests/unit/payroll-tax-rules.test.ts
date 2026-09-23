import { describe, expect, it } from 'vitest';
import { basisPointRuleSet, resolveTaxRuleSet, UnsupportedTaxRuleError } from '../../packages/payroll';

describe('payroll tax rule registry', () => {
  it('blocks unsupported or unvalidated tax rules', () => {
    expect(() => resolveTaxRuleSet([], 'US-FL', '2026-09-15')).toThrow(UnsupportedTaxRuleError);
    const invalid=basisPointRuleSet({jurisdiction:'US-FL',version:'draft',effectiveFrom:'2026-01-01',employeeTaxBps:0,employerTaxBps:0,validated:false});
    expect(() => resolveTaxRuleSet([invalid], 'US-FL', '2026-09-15')).toThrow(UnsupportedTaxRuleError);
  });
  it('selects only an effective validated rule', () => {
    const rule=basisPointRuleSet({jurisdiction:'US-FL',version:'approved',effectiveFrom:'2026-01-01',employeeTaxBps:0,employerTaxBps:0});
    expect(resolveTaxRuleSet([rule],'US-FL','2026-09-15').version).toBe('approved');
  });
});
