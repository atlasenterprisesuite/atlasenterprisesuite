export type AtlasProviderState =
  | 'not_configured'
  | 'configured_unverified'
  | 'probing'
  | 'verified'
  | 'degraded'
  | 'unavailable';

export type AtlasProviderRecord = {
  providerId: string;
  organizationId: string;
  state: AtlasProviderState;
  capabilities: string[];
  lastVerifiedAt: string | null;
  lastErrorCode: string | null;
};

export class ProviderRegistry {
  private readonly providers = new Map<string, AtlasProviderRecord>();

  constructor(initial: readonly AtlasProviderRecord[] = []) {
    for (const provider of initial) this.register(provider);
  }

  register(provider: AtlasProviderRecord): void {
    if (!provider.providerId) throw new Error('invalid_provider');
    if (this.providers.has(provider.providerId)) throw new Error('duplicate_provider');
    this.providers.set(provider.providerId, { ...provider, capabilities: [...provider.capabilities] });
  }

  upsert(provider: AtlasProviderRecord): void {
    if (!provider.providerId) throw new Error('invalid_provider');
    this.providers.set(provider.providerId, { ...provider, capabilities: [...provider.capabilities] });
  }

  get(providerId: string): AtlasProviderRecord | null {
    return this.providers.get(providerId) ?? null;
  }

  executableCapabilities(providerId: string): string[] {
    const provider = this.providers.get(providerId);
    if (!provider || provider.state === 'not_configured') throw new Error('provider_not_configured');
    if (provider.state === 'configured_unverified' || provider.state === 'probing') throw new Error('provider_unverified');
    if (provider.state === 'degraded' || provider.state === 'unavailable') throw new Error('provider_unavailable');
    if (provider.state !== 'verified') throw new Error('provider_unverified');
    return [...provider.capabilities];
  }

  assertCapability(providerId: string, capability: string): AtlasProviderRecord {
    const capabilities = this.executableCapabilities(providerId);
    if (!capabilities.includes(capability)) throw new Error('provider_capability_unavailable');
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error('provider_not_configured');
    return provider;
  }

  list(): AtlasProviderRecord[] {
    return [...this.providers.values()].map((provider) => ({ ...provider, capabilities: [...provider.capabilities] }));
  }
}
