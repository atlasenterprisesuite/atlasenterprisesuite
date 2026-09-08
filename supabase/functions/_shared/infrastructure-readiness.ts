export type ProviderName = 'github' | 'supabase' | 'cloudflare' | 'production' | 'vercel';

export type ProviderSnapshot = {
  state: string;
  required: boolean;
};

export type InfrastructureBlocker = {
  provider: ProviderName;
  reason: string;
  nextAction: string;
};

export type InfrastructureEvaluation = {
  status: 'ready' | 'partial';
  providers: Record<ProviderName, ProviderSnapshot>;
  blockers: InfrastructureBlocker[];
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

  return {
    status: blockers.length === 0 ? 'ready' : 'partial',
    providers,
    blockers,
    requiredPath
  };
}
