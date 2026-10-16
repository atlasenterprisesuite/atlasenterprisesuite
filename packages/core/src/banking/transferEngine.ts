/**
 * ATLAS Banking Core — provider-independent transfer intent policy.
 * NO BANK EXECUTION. A network/bank authorization adapter is required.
 */
export type TransferStatus = 'draft' | 'awaiting_authorization' | 'authorized' | 'submitted' | 'settled' | 'returned' | 'failed';
export type TransferIntent = Readonly<{
  orgId: string;
  actorId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: 'USD';
  idempotencyKey: string;
  ownerVerified: boolean;
  consentVerified: boolean;
  stepUpVerified: boolean;
  bankRailEnabled: boolean;
  availableCents: number | null;
  spotMeCents?: number;
}>;
export type Decision = { allowed: true; status: 'authorized' } | { allowed: false; status: 'awaiting_authorization'; reasons: string[] };
export function authorizeTransfer(t: TransferIntent): Decision {
  const reasons: string[] = [];
  if (!t.orgId || !t.actorId) reasons.push('missing_identity');
  if (!t.sourceAccountId || !t.destinationAccountId || t.sourceAccountId === t.destinationAccountId) reasons.push('invalid_accounts');
  if (!Number.isSafeInteger(t.amountCents) || t.amountCents <= 0 || t.currency !== 'USD') reasons.push('invalid_amount');
  if (!t.idempotencyKey || t.idempotencyKey.length < 16) reasons.push('missing_idempotency_key');
  if (!t.ownerVerified) reasons.push('ownership_unverified');
  if (!t.consentVerified) reasons.push('consent_missing');
  if (!t.stepUpVerified) reasons.push('step_up_required');
  if (!t.bankRailEnabled) reasons.push('bank_rail_unavailable');
  // SpotMe/overdraft credit must never increase transferable funds.
  if (t.availableCents === null || !Number.isSafeInteger(t.availableCents) || t.availableCents < t.amountCents) reasons.push('insufficient_verified_funds');
  return reasons.length ? { allowed: false, status: 'awaiting_authorization', reasons } : { allowed: true, status: 'authorized' };
}
export const TRANSFER_TRANSITIONS: Readonly<Record<TransferStatus, readonly TransferStatus[]>> = {
  draft: ['awaiting_authorization'],
  awaiting_authorization: ['authorized', 'failed'],
  authorized: ['submitted', 'failed'],
  submitted: ['settled', 'returned', 'failed'],
  settled: ['returned'],
  returned: [],
  failed: []
};
export function canTransition(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSFER_TRANSITIONS[from].includes(to);
}
