export const ATLAS_INTEGRATION_PROVIDERS = [
  { id: 'google', label: 'Google Workspace', area: 'productivity', authKind: 'oauth2' },
  { id: 'hubspot', label: 'HubSpot', area: 'crm', authKind: 'oauth2' },
  { id: 'salesforce', label: 'Salesforce', area: 'crm', authKind: 'oauth2' },
  { id: 'cloudflare', label: 'Cloudflare', area: 'platform', authKind: 'service_token' },
  { id: 'stripe', label: 'Stripe', area: 'payments', authKind: 'api_key' },
  { id: 'authorize_net', label: 'Authorize.Net', area: 'payments', authKind: 'api_key' },
  { id: 'openai', label: 'OpenAI', area: 'intelligence', authKind: 'api_key' },
  { id: 'peach', label: 'Peach WhatsApp Business', area: 'communications', authKind: 'opaque_reference' },
  { id: 'salto', label: 'Salto', area: 'hospitality', authKind: 'api_key' },
  { id: 'vingcard', label: 'Vingcard', area: 'hospitality', authKind: 'api_key' },
  { id: 'dormakaba', label: 'dormakaba', area: 'hospitality', authKind: 'api_key' },
  { id: 'onity', label: 'Onity', area: 'hospitality', authKind: 'api_key' },
  { id: 'generic_certified', label: 'Certified provider', area: 'external', authKind: 'opaque_reference' }
] as const;

export type IntegrationProvider = typeof ATLAS_INTEGRATION_PROVIDERS[number]['id'];

export type IntegrationProviderDefinition = typeof ATLAS_INTEGRATION_PROVIDERS[number];

const INTEGRATION_PROVIDER_IDS = new Set<string>(
  ATLAS_INTEGRATION_PROVIDERS.map((provider) => provider.id)
);

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return INTEGRATION_PROVIDER_IDS.has(value);
}

export function integrationProviderDefinition(
  provider: IntegrationProvider
): IntegrationProviderDefinition {
  const definition = ATLAS_INTEGRATION_PROVIDERS.find((item) => item.id === provider);
  if (!definition) throw new Error('unsupported_integration_provider');
  return definition;
}

export type IntegrationConnectionState =
  | 'unconfigured'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'revoked'
  | 'error';

export type IntegrationAuthKind =
  | 'oauth2'
  | 'oidc'
  | 'api_key'
  | 'service_token'
  | 'service_jwt'
  | 'signed_token'
  | 'opaque_reference'
  | 'password';

export type LegacyAuthException = {
  reason: string;
  approvedByActorId: string;
  approvedAt: string;
};

export type IntegrationAuthPolicy = {
  kind: IntegrationAuthKind;
  legacyException?: LegacyAuthException;
};

export function validateIntegrationAuthPolicy(policy: IntegrationAuthPolicy) {
  if (policy.kind !== 'password') return { ok: true as const };

  return policy.legacyException
    ? { ok: true as const }
    : { ok: false as const, reason: 'legacy_auth_not_approved' as const };
}

export function canReportConnected(input: {
  authorized: boolean;
  providerVerified: boolean;
}) {
  return input.authorized && input.providerVerified;
}

export type IntegrationExecutionBlocker =
  | 'authorization_required'
  | 'credentials_required'
  | 'provider_verification_required'
  | 'connection_not_connected'
  | 'capability_missing';

export function evaluateIntegrationExecutionGate(input: {
  state: IntegrationConnectionState;
  authorized: boolean;
  credentialsConfigured: boolean;
  providerVerified: boolean;
  requiredCapabilities?: readonly string[];
  grantedCapabilities?: readonly string[];
}) {
  const blockers: IntegrationExecutionBlocker[] = [];

  if (!input.authorized) blockers.push('authorization_required');
  if (!input.credentialsConfigured) blockers.push('credentials_required');
  if (!input.providerVerified) blockers.push('provider_verification_required');
  if (input.state !== 'connected') blockers.push('connection_not_connected');

  const granted = new Set(input.grantedCapabilities ?? []);
  const missingCapabilities = [...new Set(input.requiredCapabilities ?? [])]
    .filter((capability) => !granted.has(capability));

  if (missingCapabilities.length) blockers.push('capability_missing');

  return {
    allowed: blockers.length === 0,
    blockers,
    missingCapabilities
  };
}

export * from './evidence';
export * from './crm';
