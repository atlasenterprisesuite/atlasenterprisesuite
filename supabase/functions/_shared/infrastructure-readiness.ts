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
  if (
    cloudflareIncident?.active &&
    cloudflareIncident.scope === 'dashboard' &&
    providers.production.state === 'ready'
  ) {
    diagnostics.push({
      provider: 'cloudflare',
      cause: 'provider',
      scope: 'dashboard',
      blocking: false,
      summary: 'Cloudflare has an active dashboard incident, but ATLAS production is reachable.'
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
