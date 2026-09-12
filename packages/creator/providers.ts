import type { ProviderId } from './types';

const PROVIDERS: Record<ProviderId, { label: string; promptDialect: 'cinematic-structured' | 'shot-structured' }> = {
  seedance: { label: 'Seedance', promptDialect: 'cinematic-structured' },
  veo: { label: 'Veo', promptDialect: 'cinematic-structured' },
  kling: { label: 'Kling', promptDialect: 'shot-structured' },
  wan: { label: 'Wan', promptDialect: 'shot-structured' },
  minimax: { label: 'MiniMax', promptDialect: 'cinematic-structured' }
};

export function providerLabel(providerId: ProviderId) {
  return PROVIDERS[providerId].label;
}

export function providerPromptDialect(providerId: ProviderId) {
  return PROVIDERS[providerId].promptDialect;
}
