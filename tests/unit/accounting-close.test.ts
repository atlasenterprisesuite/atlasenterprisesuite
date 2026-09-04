import { describe, expect, it } from 'vitest';
import { canClosePeriod } from '../../packages/accounting/src';

describe('period close guard', () => {
  it('requires every close condition', () => {
    expect(canClosePeriod({
      requiredJournalsPosted: true,
      reconciliationsComplete: true,
      arApReviewed: true,
      authorized: true,
    })).toBe(true);

    expect(canClosePeriod({
      requiredJournalsPosted: true,
      reconciliationsComplete: false,
      arApReviewed: true,
      authorized: true,
    })).toBe(false);
  });
});
