import type { FilingStatus2025 } from './individual1040Engine';

export type SocialSecurityWorksheetInputs2025 = {
  filingStatus: FilingStatus2025;
  grossBenefits: number;
  otherIncomeLines1z2b3b4b5b7a8: number;
  taxExemptInterestLine2a?: number;
  schedule1AdjustmentsLines11To20_23_25?: number;
  marriedFilingSeparatelyLivedWithSpouse?: boolean;
  traditionalIraCircularCalculationRequired?: boolean;
  repaymentsExceedBenefits?: boolean;
  pub915RequiredForExcludedIncome?: boolean;
  lumpSumPriorYearPayment?: boolean;
};

export type SocialSecurityWorksheetResult2025 = {
  taxYear: 2025;
  status: 'calculated' | 'blocked' | 'review';
  taxableBenefits: number | null;
  lines: Record<string, number | null>;
  blockers: string[];
  reviewFlags: string[];
};

const money = (value: number | undefined, code: string) => {
  const result = value ?? 0;
  if (!Number.isFinite(result) || result < 0) throw new Error(code);
  return result;
};

export function calculateSocialSecurityBenefits2025(
  input: SocialSecurityWorksheetInputs2025
): SocialSecurityWorksheetResult2025 {
  const blockers: string[] = [];
  const reviewFlags: string[] = [];
  const line1 = money(input.grossBenefits, 'invalid_social_security_benefits');
  const line3 = money(input.otherIncomeLines1z2b3b4b5b7a8, 'invalid_social_security_other_income');
  const line4 = money(input.taxExemptInterestLine2a, 'invalid_social_security_tax_exempt_interest');
  const line6 = money(input.schedule1AdjustmentsLines11To20_23_25, 'invalid_social_security_adjustments');

  if (input.traditionalIraCircularCalculationRequired) {
    blockers.push('Use Pub. 590-A worksheets because traditional IRA deduction and taxable Social Security are interdependent.');
  }
  if (input.repaymentsExceedBenefits) {
    blockers.push('Benefits repayments exceed current-year benefits; the standard Form 1040 Social Security Benefits Worksheet cannot be used.');
  }
  if (input.pub915RequiredForExcludedIncome) {
    blockers.push('Pub. 915 worksheet required because Form 2555, 4563, 8815, adoption-benefit exclusion, or Puerto Rico source-income rules apply.');
  }

  if (blockers.length) {
    return {
      taxYear: 2025,
      status: 'blocked',
      taxableBenefits: null,
      lines: { line1, line2: line1 * 0.5, line3, line4, line5: null, line6, line7: null, line8: null, line9: null, line10: null, line11: null, line12: null, line13: null, line14: null, line15: null, line16: null, line17: line1 * 0.85, line18: null },
      blockers,
      reviewFlags
    };
  }

  const line2 = line1 * 0.5;
  const line5 = line2 + line3 + line4;

  if (line6 >= line5) {
    return {
      taxYear: 2025,
      status: input.lumpSumPriorYearPayment ? 'review' : 'calculated',
      taxableBenefits: 0,
      lines: { line1, line2, line3, line4, line5, line6, line7: 0, line8: null, line9: 0, line10: null, line11: 0, line12: 0, line13: 0, line14: 0, line15: 0, line16: 0, line17: line1 * 0.85, line18: 0 },
      blockers,
      reviewFlags: input.lumpSumPriorYearPayment ? ['Prior-year lump-sum benefit is present; Pub. 915 election may reduce taxable benefits.'] : []
    };
  }

  const line7 = line5 - line6;
  let line8: number | null = null;
  let line9: number;
  let line10: number | null = null;
  let line11: number | null = null;
  let line12: number | null = null;
  let line13: number | null = null;
  let line14: number | null = null;
  let line15: number | null = null;
  let line16: number;

  if (input.filingStatus === 'married-filing-separately' && input.marriedFilingSeparatelyLivedWithSpouse) {
    line9 = line7;
    line16 = line7 * 0.85;
  } else {
    line8 = input.filingStatus === 'married-filing-jointly' ? 32000 : 25000;
    if (line7 <= line8) {
      const taxableBenefits = 0;
      if (input.lumpSumPriorYearPayment) {
        reviewFlags.push('Prior-year lump-sum benefit is present; Pub. 915 lump-sum election may reduce taxable benefits.');
      }
      return {
        taxYear: 2025,
        status: input.lumpSumPriorYearPayment ? 'review' : 'calculated',
        taxableBenefits,
        lines: { line1, line2, line3, line4, line5, line6, line7, line8, line9: 0, line10: null, line11: 0, line12: 0, line13: 0, line14: 0, line15: 0, line16: 0, line17: line1 * 0.85, line18: 0 },
        blockers,
        reviewFlags
      };
    }
    line9 = line7 - line8;
    line10 = input.filingStatus === 'married-filing-jointly' ? 12000 : 9000;
    line11 = Math.max(0, line9 - line10);
    line12 = Math.min(line9, line10);
    line13 = line12 * 0.5;
    line14 = Math.min(line2, line13);
    line15 = line11 * 0.85;
    line16 = line14 + line15;
  }

  const line17 = line1 * 0.85;
  const line18 = Math.min(line16, line17);

  if (input.lumpSumPriorYearPayment) {
    reviewFlags.push('Prior-year lump-sum benefit is present; Pub. 915 lump-sum election may reduce taxable benefits.');
  }

  return {
    taxYear: 2025,
    status: reviewFlags.length ? 'review' : 'calculated',
    taxableBenefits: Number(line18.toFixed(2)),
    lines: {
      line1: Number(line1.toFixed(2)),
      line2: Number(line2.toFixed(2)),
      line3: Number(line3.toFixed(2)),
      line4: Number(line4.toFixed(2)),
      line5: Number(line5.toFixed(2)),
      line6: Number(line6.toFixed(2)),
      line7: Number(line7.toFixed(2)),
      line8: line8 === null ? null : Number(line8.toFixed(2)),
      line9: Number(line9.toFixed(2)),
      line10: line10 === null ? null : Number(line10.toFixed(2)),
      line11: line11 === null ? null : Number(line11.toFixed(2)),
      line12: line12 === null ? null : Number(line12.toFixed(2)),
      line13: line13 === null ? null : Number(line13.toFixed(2)),
      line14: line14 === null ? null : Number(line14.toFixed(2)),
      line15: line15 === null ? null : Number(line15.toFixed(2)),
      line16: Number(line16.toFixed(2)),
      line17: Number(line17.toFixed(2)),
      line18: Number(line18.toFixed(2))
    },
    blockers,
    reviewFlags
  };
}
