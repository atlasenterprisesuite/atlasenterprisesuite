export type AtlasCloudTruthState =
  | 'verified'
  | 'in_progress'
  | 'warning'
  | 'blocked'
  | 'needs_authorization';

export type AtlasCloudTruthBadge = {
  state: AtlasCloudTruthState;
  label: string;
  symbol: string;
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function atlasCloudTruthBadge(readiness: string): AtlasCloudTruthBadge {
  const value = normalize(readiness);

  if (['verified', 'ready', 'active', 'live', 'production', 'complete', 'completed'].includes(value)) {
    return { state: 'verified', label: 'VERIFIED', symbol: '✅' };
  }

  if (['blocked', 'failed', 'error', 'missing'].includes(value)) {
    return { state: 'blocked', label: 'BLOCKED', symbol: '❌' };
  }

  if (['needs_authorization', 'authorization_required', 'approval_required', 'credential_required'].includes(value)) {
    return { state: 'needs_authorization', label: 'NEEDS AUTHORIZATION', symbol: '🔒' };
  }

  if (['warning', 'degraded', 'limited', 'partial'].includes(value)) {
    return { state: 'warning', label: 'WARNING', symbol: '⚠️' };
  }

  return { state: 'in_progress', label: 'IN PROGRESS', symbol: '🟡' };
}
