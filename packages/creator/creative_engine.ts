import type { ProviderReadiness } from './types';

export type CreativeMediaKind = 'image' | 'video' | 'music' | 'voice' | 'sfx' | 'graphic' | 'template';

export type CreativeExecutionClass =
  | 'browser-local'
  | 'local-compute'
  | 'self-hosted'
  | 'free-tier'
  | 'byo-provider'
  | 'prompt-export-only'
  | 'paid-provider';

export type CreativeEngineId = string;

export type CreativeEngineConnectionState =
  | 'unconfigured'
  | 'configured-unverified'
  | 'ready'
  | 'unavailable'
  | 'insufficient-credit'
  | 'error';

export type CreativeEngineReadiness = {
  engineId: CreativeEngineId;
  displayName: string;
  executionClass: CreativeExecutionClass;
  connectionState: CreativeEngineConnectionState;
  ready: boolean;
  mediaKinds: CreativeMediaKind[];
  capabilityNotes: string[];
  lastVerifiedAt: string | null;
};

export const CREATIVE_EXECUTION_ORDER: readonly CreativeExecutionClass[] = [
  'browser-local',
  'local-compute',
  'self-hosted',
  'free-tier',
  'byo-provider',
  'prompt-export-only',
  'paid-provider'
];

export function adaptProviderToCreativeEngine(provider: ProviderReadiness): CreativeEngineReadiness {
  return {
    engineId: `provider:${provider.providerId}`,
    displayName: provider.displayName,
    executionClass: 'byo-provider',
    connectionState: provider.connectionState,
    ready: provider.connectionState === 'ready',
    mediaKinds: ['video'],
    capabilityNotes: provider.capability
      ? [
          `modes:${provider.capability.modes.join(',')}`,
          `resolutions:${provider.capability.resolutions.join(',')}`
        ]
      : [],
    lastVerifiedAt: provider.lastVerifiedAt
  };
}

export function adaptNativeReadiness(value: {
  ok: true;
  renderer: 'atlas-native';
  billing_class: 'zero-cost';
  execution: 'self-hosted';
  native: { state: string; capabilities?: string[] };
}): CreativeEngineReadiness {
  const ready = value.native.state === 'ready';
  return {
    engineId: value.renderer,
    displayName: 'ATLAS Native',
    executionClass: 'self-hosted',
    connectionState: ready ? 'ready' : 'unavailable',
    ready,
    mediaKinds: ['video'],
    capabilityNotes: value.native.capabilities ?? [],
    lastVerifiedAt: ready ? new Date().toISOString() : null
  };
}

export function rankCreativeEngines(
  engines: readonly CreativeEngineReadiness[],
  mediaKind: CreativeMediaKind
): CreativeEngineReadiness[] {
  const rank = new Map(CREATIVE_EXECUTION_ORDER.map((value, index) => [value, index]));
  return engines
    .filter(engine => engine.mediaKinds.includes(mediaKind))
    .slice()
    .sort((left, right) => {
      if (left.ready !== right.ready) return left.ready ? -1 : 1;
      return (rank.get(left.executionClass) ?? 99) - (rank.get(right.executionClass) ?? 99);
    });
}
