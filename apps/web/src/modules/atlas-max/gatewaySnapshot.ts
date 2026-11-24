import type { AssistantStatusResponse, AssistantUsageSummary } from '../../assistant/client';

const KNOWN_PROVIDER_IDS = new Set([
  'atlas-local', 'openai', 'bedrock', 'gemini', 'anthropic',
  'grok', 'deepseek', 'mistral', 'qwen', 'codex-sovereign'
]);

export type AtlasMaxGatewaySnapshot =
  | { state: 'unavailable'; verifiedProviders: readonly string[]; requests: null; usageScope: null; checkedAt: null }
  | { state: 'ready'; verifiedProviders: readonly string[]; requests: number | null; usageScope: 'organization' | 'actor' | null; checkedAt: string };

const UNAVAILABLE: AtlasMaxGatewaySnapshot = Object.freeze({
  state: 'unavailable', verifiedProviders: [], requests: null, usageScope: null, checkedAt: null
});

/**
 * Authenticated read-only atlas-copilot status, NOT an ATLAS MAX subscription,
 * entitlement, quota or permission decision.
 */
export function deriveAtlasMaxGatewaySnapshot(
  organizationId: string,
  status: AssistantStatusResponse,
  usage?: AssistantUsageSummary | null,
  checkedAt = new Date().toISOString()
): AtlasMaxGatewaySnapshot {
  if (!organizationId || status?.ok !== true || status.authenticated !== true || status.organization !== organizationId) {
    return UNAVAILABLE;
  }

  const verifiedProviders = Array.isArray(status.providers)
    ? [...new Set(status.providers
      .filter((provider) => provider.verified === true && provider.state === 'verified' && KNOWN_PROVIDER_IDS.has(provider.id))
      .map((provider) => provider.id))]
    : [];

  const usageValid = usage?.ok === true
    && usage.days === 30
    && (usage.scope === 'organization' || usage.scope === 'actor')
    && Number.isSafeInteger(usage.total_requests)
    && usage.total_requests >= 0
    && Number.isFinite(Date.parse(usage.period_start))
    && Number.isFinite(Date.parse(usage.period_end));

  return {
    state: 'ready',
    verifiedProviders,
    requests: usageValid ? usage.total_requests : null,
    usageScope: usageValid ? usage.scope : null,
    checkedAt
  };
}
