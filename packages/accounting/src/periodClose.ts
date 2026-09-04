export type CloseCheck = {
  requiredJournalsPosted: boolean;
  reconciliationsComplete: boolean;
  arApReviewed: boolean;
  authorized: boolean;
};

export function canClosePeriod(check: CloseCheck): boolean {
  return check.requiredJournalsPosted
    && check.reconciliationsComplete
    && check.arApReviewed
    && check.authorized;
}
