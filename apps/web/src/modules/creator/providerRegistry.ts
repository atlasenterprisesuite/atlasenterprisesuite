export type CreatorCapability = 'image' | 'video' | 'music' | 'voice';
export type CreatorProviderState = 'ready' | 'configuration-required' | 'resource-blocked' | 'unavailable';
export type CreatorBillingClass = 'zero-cost' | 'metered' | 'subscription';
export type CreatorExecution = 'self-hosted' | 'external';

export interface CreatorProvider {
  id: string;
  name: string;
  capabilities: CreatorCapability[];
  capabilityLabel: string;
  billingClass: CreatorBillingClass;
  execution: CreatorExecution;
  license: string;
  commercialUse: boolean;
  state: CreatorProviderState;
  reason?: string;
}

export const creatorProviders: CreatorProvider[] = [
  {
    id: 'flux-schnell-local',
    name: 'FLUX.1 Schnell (Local)',
    capabilities: ['image'],
    capabilityLabel: 'Self-hosted image generation',
    billingClass: 'zero-cost',
    execution: 'self-hosted',
    license: 'Apache-2.0',
    commercialUse: true,
    state: 'configuration-required',
    reason: 'ATLAS_FLUX_LOCAL_URL has not been verified by the server runtime.'
  },
  {
    id: 'openai-images',
    name: 'OpenAI Images',
    capabilities: ['image'],
    capabilityLabel: 'Optional external image generation',
    billingClass: 'metered',
    execution: 'external',
    license: 'Provider terms',
    commercialUse: true,
    state: 'configuration-required'
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    capabilities: ['image', 'video'],
    capabilityLabel: 'Optional external multimodal generation',
    billingClass: 'metered',
    execution: 'external',
    license: 'Provider terms',
    commercialUse: true,
    state: 'configuration-required'
  },
  {
    id: 'visual-location',
    name: 'Visual location provider',
    capabilities: ['image'],
    capabilityLabel: 'Opt-in visual location estimation',
    billingClass: 'metered',
    execution: 'external',
    license: 'Provider terms',
    commercialUse: true,
    state: 'configuration-required'
  }
];

export function eligibleProviders(
  capability: CreatorCapability,
  zeroCostMode = true,
  providers: CreatorProvider[] = creatorProviders
): CreatorProvider[] {
  return providers.filter(provider => {
    if (!provider.capabilities.includes(capability)) return false;
    if (provider.state !== 'ready') return false;
    if (!provider.commercialUse) return false;
    if (zeroCostMode && provider.billingClass !== 'zero-cost') return false;
    return true;
  });
}

export function selectAtlasAutoProvider(
  capability: CreatorCapability,
  zeroCostMode = true,
  providers: CreatorProvider[] = creatorProviders
): CreatorProvider | null {
  const eligible = eligibleProviders(capability, zeroCostMode, providers);
  return eligible.find(provider => provider.execution === 'self-hosted') ?? eligible[0] ?? null;
}
