import type { CnrInput } from './types';

function assertSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} must be a safe integer`);
}

export function applyBasisPoints(amountMinor: number, bps: number): number {
  assertSafeInteger(amountMinor, 'amountMinor');
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new Error('bps must be an integer from 0 to 10000');
  const raw = amountMinor * bps / 10_000;
  return raw >= 0 ? Math.floor(raw + 0.5) : Math.ceil(raw - 0.5);
}

export function calculateCnrMinor(input: CnrInput): number {
  for (const [key, value] of Object.entries(input)) assertSafeInteger(value, key);
  return input.cashCollectedMinor - input.taxesMinor - input.refundsMinor - input.chargebacksMinor - input.creditsMinor - input.passThroughFeesMinor;
}
