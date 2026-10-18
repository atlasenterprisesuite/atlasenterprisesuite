export interface ProviderCandidate {
  id: string;
  healthy: boolean;
  capabilities: readonly string[];
  privacyClasses: readonly string[];
  cost: number;
  latency: number;
  quality: number;
}
export interface RoutingInput {
  providers: readonly ProviderCandidate[];
  capability: string;
  privacyClass: string;
  maxCost: number;
}
export type RoutingDecision =
  | { status: 'routed'; providerId: string }
  | { status: 'denied'; reason: 'no_policy_compliant_provider' };

export function routeIntelligenceTask(input: RoutingInput): RoutingDecision {
  const eligible = input.providers
    .filter((provider) => provider.healthy)
    .filter((provider) => provider.capabilities.includes(input.capability))
    .filter((provider) => provider.privacyClasses.includes(input.privacyClass))
    .filter((provider) => provider.cost <= input.maxCost)
    .sort((a, b) => (b.quality - a.quality) || (a.latency - b.latency) || (a.cost - b.cost));
  return eligible[0] ? { status: 'routed', providerId: eligible[0].id } : { status: 'denied', reason: 'no_policy_compliant_provider' };
}
