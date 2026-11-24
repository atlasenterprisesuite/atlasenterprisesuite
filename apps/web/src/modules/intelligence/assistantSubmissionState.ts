import type { AssistantMode, AssistantStatusResponse } from '../../assistant/client';

/**
 * The composer stays actionable so the user receives an explicit error
 * instead of an inert Send button when a provider cannot run.
 * This does not override backend provider, permissions, or cost gates.
 */
export function unavailableAssistantRouteError(
  mode: AssistantMode,
  status: AssistantStatusResponse | null
): string {
  if (!status) return 'status_unavailable';
  if (mode === 'auto') return 'no_provider_selected';
  if (mode === 'council') {
    return status.cost_policy?.allow_council !== true
      ? 'paid_provider_blocked_by_zero_cost_policy'
      : 'no_provider_selected';
  }
  const provider = status.providers?.find((entry) => entry.id === mode);
  if (!provider || !provider.configured) return 'provider_not_configured';
  return 'provider_unavailable';
}
