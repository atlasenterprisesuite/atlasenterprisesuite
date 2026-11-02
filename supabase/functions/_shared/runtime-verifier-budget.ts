/** Pure wall-clock budget calculations for runtime verification.
 * No network requests or production mutations occur in this module.
 */
export const VERIFIER_BUDGET_MS = 90000;
export function remainingBudgetMs(startedAtMs: number, nowMs: number, budgetMs = VERIFIER_BUDGET_MS): number {
  if (![startedAtMs, nowMs, budgetMs].every(Number.isFinite) || budgetMs <= 0 || nowMs < startedAtMs)
    throw new RangeError('invalid_verification_budget');
  return Math.max(0, Math.floor(budgetMs - (nowMs - startedAtMs)));
}
export function boundedTimeoutMs(remainingMs: number, perRequestMs: number, reserveMs = 5000): number {
  if (![remainingMs, perRequestMs, reserveMs].every(Number.isFinite) ||
      remainingMs < 0 || perRequestMs <= 0 || reserveMs < 0)
    throw new RangeError('invalid_timeout');
  const available = Math.floor(remainingMs - reserveMs);
  if (available <= 0) throw new Error('verification_deadline_exceeded');
  return Math.min(Math.floor(perRequestMs), available);
}
