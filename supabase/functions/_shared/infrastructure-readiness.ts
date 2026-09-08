export type ProviderName = 'github' | 'supabase' | 'cloudflare' | 'production' | 'vercel';
export type ProviderIncidentScope = 'dashboard' | 'edge' | 'mixed' | 'unknown';

export type ProviderIncident = {
  source: 'cloudflare_status';
  active: boolean;
  scope: ProviderIncidentScope;
  impact: string;
  name?: string;
};

export type ProviderSnapshot = {
  state: string;
  required: boolean;
  incident?: ProviderIncident | null;
};

export type InfrastructureBlocker = {
  provider: ProviderName;
  reason: string;
  nextAction: string;
};

export type InfrastructureDiagnostic = {
  provider: ProviderName;
  cause: 'provider' | 'atlas_or_unknown';
  scope: ProviderIncidentScope | 'production';
  blocking: boolean;
  summary: string;
};

export type InfrastructureEvaluation = {
  status: 'ready' | 'partial';
  providers: Record<ProviderName, ProviderSnapshot>;
  blockers: InfrastructureBlocker[];
  diagnostics: InfrastructureDiagnostic[];
  requiredPath: ProviderName[];
};

const PROVIDER_ORDER: ProviderName[] = ['github', 'supabase', 'cloudflare', 'production', 'vercel'];
const OPTIONAL_UNCONFIGURED_STATES = new Set([
  'not_configured',
  'project_not_configured',
  'authorization_missing'
]);

export function evaluateInfrastructure(
  input: Record<ProviderName, ProviderSnapshot>
): InfrastructureEvaluation {
  const providers = Object.fromEntries(
    PROVIDER_ORDER.map((provider) => [provider, { ...input[provider] }])
  ) as Record<ProviderName, ProviderSnapshot>;

  if (!providers.vercel.required && OPTIONAL_UNCONFIGURED_STATES.has(providers.vercel.state)) {
    providers.vercel.state = 'optional_provider_unconfigured';
  }

  const requiredPath = PROVIDER_ORDER.filter((provider) => providers[provider].required);
  const blockers = requiredPath
    .filter((provider) => providers[provider].state !== 'ready')
    .map((provider) => ({
      provider,
      reason: providers[provider].state,
      nextAction: `verify_or_repair_${provider}`
    }));

  const diagnostics: InfrastructureDiagnostic[] = [];
  const cloudflareIncident = providers.cloudflare.incident;
  const productionReady = providers.production.state === 'ready';

  if (cloudflareIncident?.active && cloudflareIncident.scope === 'dashboard') {
    diagnostics.push({
      provider: 'cloudflare',
      cause: 'provider',
      scope: 'dashboard',
      blocking: false,
      summary: productionReady
        ? 'Cloudflare has an active dashboard incident, but ATLAS production is reachable.'
        : 'Cloudflare reports a dashboard incident; it does not by itself explain the ATLAS production outage.'
    });
  }

  const matchingCloudflareEdgeIncident = Boolean(
    cloudflareIncident?.active &&
      (cloudflareIncident.scope === 'edge' || cloudflareIncident.scope === 'mixed')
  );

  if (!productionReady && matchingCloudflareEdgeIncident) {
    diagnostics.push({
      provider: 'cloudflare',
      cause: 'provider',
      scope: cloudflareIncident!.scope,
      blocking: true,
      summary:
        cloudflareIncident!.scope === 'edge'
          ? 'ATLAS production is unreachable while Cloudflare reports an active edge incident.'
          : 'ATLAS production is unreachable while Cloudflare reports an active incident affecting dashboard and edge services.'
    });
  } else if (!productionReady) {
    diagnostics.push({
      provider: 'production',
      cause: 'atlas_or_unknown',
      scope: 'production',
      blocking: true,
      summary: 'ATLAS production is unreachable and no matching Cloudflare provider incident is active.'
    });
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'partial',
    providers,
    blockers,
    diagnostics,
    requiredPath
  };
}
