import type { IntegrationCapability, ProviderDefinition } from './types';

const microsoftCapabilities = {
  'microsoft.profile.read': ['User.Read'],
  'microsoft.mail.read': ['Mail.Read'],
  'microsoft.calendar.read': ['Calendars.Read'],
  'microsoft.files.read': ['Files.Read']
} as const satisfies Partial<Record<IntegrationCapability, readonly string[]>>;

const providers: Record<string, ProviderDefinition> = {
  microsoft: {
    providerKey: 'microsoft',
    displayName: 'Microsoft',
    connectorClass: 'user_oauth',
    capabilities: microsoftCapabilities
  }
};

export function providerDefinitionFor(providerKey: string): ProviderDefinition {
  const provider = providers[providerKey];
  if (!provider) throw new Error('integration_provider_not_registered');
  return provider;
}

export function requiredProviderScopes(
  providerKey: string,
  capability: IntegrationCapability
): readonly string[] {
  const provider = providerDefinitionFor(providerKey);
  const scopes = provider.capabilities[capability];
  if (!scopes) throw new Error('integration_capability_not_supported');
  return scopes;
}
