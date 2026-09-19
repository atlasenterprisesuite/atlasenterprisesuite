export type AviationInvestmentStatus =
  | 'active'
  | 'paused'
  | 'closed'
  | 'unavailable'
  | 'unknown'
  | 'not_configured';

export type AviationInvestmentProfile = {
  status: AviationInvestmentStatus;
  sharePriceUsd: number | null;
  minimumInvestmentUsd: number | null;
  valuationUsd: number | null;
  officialSourceUrl: string | null;
  officialSourceVerified: boolean;
  lastVerifiedAt: string | null;
};

export type AviationInvestmentFreshness = 'ready' | 'stale' | 'not_configured';

const DEFAULT_STALE_AFTER_DAYS = 30;

export function classifyInvestmentFreshness(
  profile: AviationInvestmentProfile,
  now = new Date(),
  staleAfterDays = DEFAULT_STALE_AFTER_DAYS
): AviationInvestmentFreshness {
  if (profile.status === 'not_configured' || !profile.lastVerifiedAt) return 'not_configured';

  const verifiedAt = Date.parse(profile.lastVerifiedAt);
  if (!Number.isFinite(verifiedAt)) return 'stale';

  const freshnessWindowMs = staleAfterDays * 24 * 60 * 60 * 1000;
  return now.getTime() - verifiedAt > freshnessWindowMs ? 'stale' : 'ready';
}

export function getOfficialInvestmentAction(profile: AviationInvestmentProfile): string | null {
  if (profile.status !== 'active' || !profile.officialSourceVerified || !profile.officialSourceUrl) {
    return null;
  }

  try {
    const url = new URL(profile.officialSourceUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
