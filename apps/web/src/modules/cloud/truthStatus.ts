export type AtlasCloudTruthState =
  | 'live'
  | 'beta'
  | 'implementing'
  | 'blocked'
  | 'simulation'
  | 'planned'
  | 'degraded'
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
    return { state: 'live', label: 'LIVE', symbol: '●' };
  }

  if (value === 'implemented' || ['implementing', 'in_progress', 'inprogress'].includes(value)) {
    return { state: 'implementing', label: 'IMPLEMENTING', symbol: '◐' };
  }

  if (value === 'partial' || ['beta', 'preview', 'limited'].includes(value)) {
    return { state: 'beta', label: 'BETA', symbol: 'β' };
  }

  if (value === 'external_gated' || ['blocked', 'failed', 'error', 'missing'].includes(value)) {
    return { state: 'blocked', label: 'BLOCKED', symbol: '×' };
  }

  if (['simulation', 'simulated', 'sandbox'].includes(value)) {
    return { state: 'simulation', label: 'SIMULATION', symbol: '◇' };
  }

  if (['planned', 'roadmap', 'not_started'].includes(value)) {
    return { state: 'planned', label: 'PLANNED', symbol: '○' };
  }

  if (['warning', 'degraded'].includes(value)) {
    return { state: 'degraded', label: 'DEGRADED', symbol: '!' };
  }

  if (['needs_authorization', 'authorization_required', 'approval_required', 'credential_required'].includes(value)) {
    return { state: 'needs_authorization', label: 'NEEDS AUTHORIZATION', symbol: '⌁' };
  }

  return { state: 'implementing', label: 'IMPLEMENTING', symbol: '◐' };
}
