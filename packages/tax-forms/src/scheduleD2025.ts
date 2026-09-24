import type { FilingStatus2025 } from './individual1040Engine';

export type CapitalTransaction2025 = {
  id: string;
  term: 'short' | 'long';
  proceeds: number;
  basis: number;
  adjustment?: number;
  adjustmentCode?: string;
  reviewed: boolean;
};

export type ScheduleDInputs2025 = {
  filingStatus: FilingStatus2025;
  transactions: readonly CapitalTransaction2025[];
  shortTermCarryover?: number;
  longTermCarryover?: number;
  otherShortTermGainLoss?: number;
  otherLongTermGainLoss?: number;
  capitalGainDistributions?: number;
  collectibles28PercentGain?: number;
  unrecapturedSection1250Gain?: number;
};

export type ScheduleDResult2025 = {
  taxYear: 2025;
  status: 'calculated' | 'blocked';
  shortTermNet: number | null;
  longTermNet: number | null;
  combinedNet: number | null;
  form1040Line7a: number | null;
  capitalLossDeductionLimit: number;
  carryforwardCandidate: boolean;
  line18_28PercentRateGain: number;
  line19Unrecaptured1250Gain: number;
  transactions: Array<CapitalTransaction2025 & { gainLoss: number | null }>;
  blockers: string[];
  reviewFlags: string[];
};

const finite = (value: number | undefined, code: string) => {
  const result = value ?? 0;
  if (!Number.isFinite(result)) throw new Error(code);
  return result;
};

export function buildScheduleD2025(input: ScheduleDInputs2025): ScheduleDResult2025 {
  const blockers: string[] = [];
  const reviewFlags: string[] = [];

  const calculated = input.transactions.map((tx) => {
    if (!Number.isFinite(tx.proceeds) || tx.proceeds < 0 || !Number.isFinite(tx.basis) || tx.basis < 0) {
      blockers.push('Transaction ' + tx.id + ' has invalid proceeds or basis.');
      return { ...tx, gainLoss: null };
    }
    if (!tx.reviewed) {
      blockers.push('Transaction ' + tx.id + ' must be reviewed before Schedule D aggregation.');
      return { ...tx, gainLoss: null };
    }
    const adjustment = finite(tx.adjustment, 'invalid_capital_adjustment');
    return { ...tx, gainLoss: Number((tx.proceeds - tx.basis + adjustment).toFixed(2)) };
  });

  const lossLimit = input.filingStatus === 'married-filing-separately' ? 1500 : 3000;
  if (blockers.length) {
    return {
      taxYear: 2025,
      status: 'blocked',
      shortTermNet: null,
      longTermNet: null,
      combinedNet: null,
      form1040Line7a: null,
      capitalLossDeductionLimit: lossLimit,
      carryforwardCandidate: false,
      line18_28PercentRateGain: Math.max(0, finite(input.collectibles28PercentGain, 'invalid_collectibles_gain')),
      line19Unrecaptured1250Gain: Math.max(0, finite(input.unrecapturedSection1250Gain, 'invalid_1250_gain')),
      transactions: calculated,
      blockers,
      reviewFlags
    };
  }

  const shortTx = calculated.filter((tx) => tx.term === 'short').reduce((sum, tx) => sum + (tx.gainLoss ?? 0), 0);
  const longTx = calculated.filter((tx) => tx.term === 'long').reduce((sum, tx) => sum + (tx.gainLoss ?? 0), 0);

  const shortTermNet = Number((
    shortTx +
    finite(input.otherShortTermGainLoss, 'invalid_other_short_gain_loss') -
    Math.abs(finite(input.shortTermCarryover, 'invalid_short_carryover'))
  ).toFixed(2));

  const longTermNet = Number((
    longTx +
    finite(input.otherLongTermGainLoss, 'invalid_other_long_gain_loss') +
    Math.max(0, finite(input.capitalGainDistributions, 'invalid_capital_gain_distributions')) -
    Math.abs(finite(input.longTermCarryover, 'invalid_long_carryover'))
  ).toFixed(2));

  const combinedNet = Number((shortTermNet + longTermNet).toFixed(2));
  const form1040Line7a = combinedNet >= 0 ? combinedNet : -Math.min(Math.abs(combinedNet), lossLimit);
  const carryforwardCandidate = combinedNet < -lossLimit;

  const line18 = Math.max(0, finite(input.collectibles28PercentGain, 'invalid_collectibles_gain'));
  const line19 = Math.max(0, finite(input.unrecapturedSection1250Gain, 'invalid_1250_gain'));

  if (carryforwardCandidate) {
    reviewFlags.push('Capital loss exceeds the 2025 deductible limit; create a 2026 capital-loss carryforward workpaper.');
  }
  if (line18 > 0 || line19 > 0) {
    reviewFlags.push('Special-rate capital gain is present; Schedule D Tax Worksheet is required when the Schedule D gain conditions are met.');
  }

  return {
    taxYear: 2025,
    status: 'calculated',
    shortTermNet,
    longTermNet,
    combinedNet,
    form1040Line7a: Number(form1040Line7a.toFixed(2)),
    capitalLossDeductionLimit: lossLimit,
    carryforwardCandidate,
    line18_28PercentRateGain: Number(line18.toFixed(2)),
    line19Unrecaptured1250Gain: Number(line19.toFixed(2)),
    transactions: calculated,
    blockers,
    reviewFlags
  };
}
