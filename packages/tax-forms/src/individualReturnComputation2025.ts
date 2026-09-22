import {
  buildForm1040Core2025,
  calculateOrdinaryRateScheduleTax2025,
  type Form1040CoreInputs2025,
  type Form1040CoreResult2025
} from './individual1040Engine';
import {
  calculateSocialSecurityBenefits2025,
  type SocialSecurityWorksheetInputs2025,
  type SocialSecurityWorksheetResult2025
} from './socialSecurity2025';
import {
  buildScheduleD2025,
  type ScheduleDInputs2025,
  type ScheduleDResult2025
} from './scheduleD2025';
import {
  resolveLine16Method2025,
  type Line16MethodResult2025
} from './line16Method2025';

export type IndividualReturnComputationInputs2025 = Omit<
  Form1040CoreInputs2025,
  'taxableSocialSecurityBenefits' | 'scheduleDNetCapitalGainLoss'
> & {
  socialSecurity?: SocialSecurityWorksheetInputs2025;
  scheduleD?: ScheduleDInputs2025;
  line16?: {
    form4952Line4g?: number;
    form8615Required?: boolean;
    scheduleJElected?: boolean;
    form2555Filed?: boolean;
  };
};

export type IndividualReturnComputationResult2025 = {
  taxYear: 2025;
  socialSecurity: SocialSecurityWorksheetResult2025 | null;
  scheduleD: ScheduleDResult2025 | null;
  form1040: Form1040CoreResult2025;
  line16: Line16MethodResult2025 | null;
  line16Tax: number | null;
  status: 'calculated' | 'review' | 'blocked';
  blockers: string[];
  reviewFlags: string[];
};

export function buildIndividualReturnComputation2025(
  input: IndividualReturnComputationInputs2025
): IndividualReturnComputationResult2025 {
  const blockers: string[] = [];
  const reviewFlags: string[] = [];

  const socialSecurity = input.socialSecurity
    ? calculateSocialSecurityBenefits2025(input.socialSecurity)
    : null;

  if (socialSecurity?.status === 'blocked') {
    blockers.push(...socialSecurity.blockers);
  } else if (socialSecurity?.status === 'review') {
    reviewFlags.push(...socialSecurity.reviewFlags);
  }

  const scheduleD = input.scheduleD ? buildScheduleD2025(input.scheduleD) : null;
  if (scheduleD?.status === 'blocked') {
    blockers.push(...scheduleD.blockers);
  } else if (scheduleD) {
    reviewFlags.push(...scheduleD.reviewFlags);
  }

  const form1040 = buildForm1040Core2025({
    ...input,
    taxableSocialSecurityBenefits:
      socialSecurity?.status === 'calculated' ? socialSecurity.taxableBenefits ?? undefined : undefined,
    scheduleDNetCapitalGainLoss:
      scheduleD?.status === 'calculated' ? scheduleD.form1040Line7a ?? undefined : undefined
  });

  blockers.push(...form1040.blockers);
  reviewFlags.push(...form1040.reviewFlags);

  const taxableIncome = form1040.lines.line15TaxableIncome;
  let line16: Line16MethodResult2025 | null = null;
  let line16Tax: number | null = null;

  if (taxableIncome !== null && blockers.length === 0) {
    line16 = resolveLine16Method2025({
      filingStatus: input.filingStatus,
      taxableIncome,
      qualifiedDividends: form1040.lines.line3aQualifiedDividends,
      scheduleDRequired: Boolean(scheduleD),
      scheduleDLine15: scheduleD?.longTermNet ?? undefined,
      scheduleDLine16: scheduleD?.combinedNet ?? undefined,
      scheduleDLine18: scheduleD?.line18_28PercentRateGain,
      scheduleDLine19: scheduleD?.line19Unrecaptured1250Gain,
      form4952Line4g: input.line16?.form4952Line4g,
      form8615Required: input.line16?.form8615Required,
      scheduleJElected: input.line16?.scheduleJElected,
      form2555Filed: input.line16?.form2555Filed
    });

    if (line16.method === 'tax-computation-worksheet' && line16.canCalculateWithCurrentCore) {
      line16Tax = calculateOrdinaryRateScheduleTax2025(taxableIncome, input.filingStatus);
    } else if (!line16.canCalculateWithCurrentCore) {
      blockers.push(...line16.blockers);
      if (line16.blockers.length === 0) {
        reviewFlags.push('Line 16 requires the selected IRS worksheet before the filed tax amount can be finalized: ' + line16.method + '.');
      }
    }
  }

  const uniqueBlockers = Array.from(new Set(blockers));
  const uniqueReviewFlags = Array.from(new Set(reviewFlags));

  return {
    taxYear: 2025,
    socialSecurity,
    scheduleD,
    form1040,
    line16,
    line16Tax,
    status: uniqueBlockers.length ? 'blocked' : uniqueReviewFlags.length ? 'review' : 'calculated',
    blockers: uniqueBlockers,
    reviewFlags: uniqueReviewFlags
  };
}
