import type { CreativeEngineReadiness, CreativeMediaKind } from './creative_engine';

export type AIUniverseModality = 'text' | CreativeMediaKind;
export type AIUniversePriority = 'cost' | 'latency' | 'quality';
export type AIUniverseCostClass =
  | 'zero-cost'
  | 'local-or-self-hosted'
  | 'free-tier'
  | 'byo-provider'
  | 'paid-provider'
  | 'planning-only'
  | 'unknown';

export type AIUniverseAssistantProvider = {
  id: string;
  state: string;
  configured: boolean;
  verified: boolean;
  model: string | null;
  capabilities: string[];
  profiles: string[];
};

export type AIUniverseCatalogEntry = {
  id: string;
  source: 'assistant' | 'creator';
  providerId: string;
  displayName: string;
  model: string | null;
  configured: boolean;
  verified: boolean;
  connectionState: string;
  capabilities: string[];
  modalities: AIUniverseModality[];
  profiles: string[];
  executionClass: string;
  costClass: AIUniverseCostClass;
  executionAvailable: boolean;
  lastVerifiedAt: string | null;
};

export type AIUniverseProviderObservation = {
  provider: string;
  requests: number;
  completed: number;
  failed: number;
  average_latency_ms: number | null;
  automatic_api_cost_usd: number;
};

export type AIUniverseRecommendation = {
  entry: AIUniverseCatalogEntry;
  score: number;
  reasons: string[];
  observedRequests: number;
  observedSuccessRate: number | null;
  observedAverageLatencyMs: number | null;
};

export type AIUniverseTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
  modalities: AIUniverseModality[];
  brief: string;
  source: 'atlas-original';
};

const creativeCostClass = (engine: CreativeEngineReadiness): AIUniverseCostClass => {
  switch (engine.executionClass) {
    case 'browser-local':
    case 'local-compute':
    case 'self-hosted':
      return 'local-or-self-hosted';
    case 'free-tier':
      return 'free-tier';
    case 'byo-provider':
      return 'byo-provider';
    case 'paid-provider':
      return 'paid-provider';
    case 'prompt-export-only':
      return 'planning-only';
    default:
      return 'unknown';
  }
};

export function buildAIUniverseCatalog(input: {
  assistantProviders?: AIUniverseAssistantProvider[];
  creativeEngines?: CreativeEngineReadiness[];
  zeroCostProviderIds?: string[];
}): AIUniverseCatalogEntry[] {
  const zeroCost = new Set(input.zeroCostProviderIds || []);
  const assistant = (input.assistantProviders || []).map<AIUniverseCatalogEntry>(provider => ({
    id: `assistant:${provider.id}`,
    source: 'assistant',
    providerId: provider.id,
    displayName: provider.id === 'atlas-local' ? 'ATLAS Local' : provider.id,
    model: provider.model,
    configured: provider.configured,
    verified: provider.verified && provider.state === 'verified',
    connectionState: provider.state,
    capabilities: provider.capabilities || [],
    modalities: ['text'],
    profiles: provider.profiles || [],
    executionClass: 'intelligence-provider',
    costClass: zeroCost.has(provider.id) ? 'zero-cost' : 'unknown',
    executionAvailable: provider.verified && provider.state === 'verified',
    lastVerifiedAt: null
  }));

  const creative = (input.creativeEngines || []).map<AIUniverseCatalogEntry>(engine => {
    const costClass = creativeCostClass(engine);
    return {
      id: `creator:${engine.engineId}`,
      source: 'creator',
      providerId: engine.engineId.startsWith('provider:') ? engine.engineId.slice('provider:'.length) : engine.engineId,
      displayName: engine.displayName,
      model: null,
      configured: engine.connectionState !== 'unconfigured',
      verified: engine.ready && engine.connectionState === 'ready',
      connectionState: engine.connectionState,
      capabilities: engine.capabilityNotes || [],
      modalities: [...engine.mediaKinds],
      profiles: [],
      executionClass: engine.executionClass,
      costClass,
      executionAvailable: engine.ready && engine.connectionState === 'ready' && costClass !== 'planning-only',
      lastVerifiedAt: engine.lastVerifiedAt
    };
  });

  return [...assistant, ...creative].sort((left, right) => {
    if (left.verified !== right.verified) return left.verified ? -1 : 1;
    if (left.executionAvailable !== right.executionAvailable) return left.executionAvailable ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });
}

function costScore(entry: AIUniverseCatalogEntry) {
  switch (entry.costClass) {
    case 'zero-cost': return 40;
    case 'local-or-self-hosted': return 36;
    case 'free-tier': return 30;
    case 'byo-provider': return 15;
    case 'planning-only': return 5;
    case 'paid-provider': return -10;
    default: return 0;
  }
}

export function recommendAIUniverseEntries(
  catalog: readonly AIUniverseCatalogEntry[],
  input: { modality: AIUniverseModality; priority: AIUniversePriority; allowPlanningFallback?: boolean },
  observations: readonly AIUniverseProviderObservation[] = []
): AIUniverseRecommendation[] {
  const observed = new Map(observations.map(value => [value.provider, value]));
  let candidates = catalog.filter(entry => entry.modalities.includes(input.modality) && entry.verified);
  const executable = candidates.filter(entry => entry.executionAvailable);
  if (executable.length) candidates = executable;
  else if (input.allowPlanningFallback === false) candidates = [];

  const knownLatencies = candidates
    .map(entry => observed.get(entry.providerId)?.average_latency_ms)
    .filter((value): value is number => Number.isFinite(value));
  const minLatency = knownLatencies.length ? Math.min(...knownLatencies) : null;
  const maxLatency = knownLatencies.length ? Math.max(...knownLatencies) : null;

  return candidates.map(entry => {
    const observation = observed.get(entry.providerId);
    const requests = observation?.requests || 0;
    const successRate = requests ? (observation?.completed || 0) / requests : null;
    const latency = observation?.average_latency_ms ?? null;
    let score = 100;
    const reasons = ['Verified for the requested modality'];

    if (entry.executionAvailable) {
      score += 25;
      reasons.push('Executable now');
    } else {
      reasons.push('Planning-only fallback');
    }

    if (input.priority === 'cost') {
      const value = costScore(entry);
      score += value;
      reasons.push(`Cost policy fit: ${entry.costClass}`);
    }

    if (input.priority === 'latency') {
      if (latency !== null && minLatency !== null && maxLatency !== null) {
        const span = Math.max(1, maxLatency - minLatency);
        score += 35 * (1 - (latency - minLatency) / span);
        reasons.push(`Observed latency: ${Math.round(latency)} ms`);
      } else {
        reasons.push('No observed latency yet');
      }
    }

    if (input.priority === 'quality') {
      if (successRate !== null) {
        score += successRate * 30;
        reasons.push(`Observed completion rate: ${Math.round(successRate * 100)}%`);
      } else {
        reasons.push('No observed completion history yet');
      }
      score += Math.min(10, entry.capabilities.length);
      reasons.push('Quality proxy uses completion history and capability fit, not subjective output scoring');
    }

    return {
      entry,
      score: Number(score.toFixed(2)),
      reasons,
      observedRequests: requests,
      observedSuccessRate: successRate,
      observedAverageLatencyMs: latency
    };
  }).sort((left, right) =>
    right.score - left.score ||
    right.observedRequests - left.observedRequests ||
    left.entry.displayName.localeCompare(right.entry.displayName)
  );
}

export const ATLAS_AI_UNIVERSE_TEMPLATES: readonly AIUniverseTemplate[] = [
  {
    id: 'atlas-launch-system',
    title: 'Launch System',
    category: 'Launch',
    description: 'A coordinated text, image and video launch package with one consistent narrative.',
    modalities: ['text', 'image', 'video'],
    brief: 'Create a premium launch campaign with a clear promise, proof, hero visual, short video concept and channel-ready copy.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-executive-update',
    title: 'Executive Update',
    category: 'Business',
    description: 'Convert operating facts into concise leadership communication and supporting visuals.',
    modalities: ['text', 'graphic'],
    brief: 'Turn verified operating facts into an executive update with headline, key changes, risks, next actions and a clean supporting graphic.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-social-story',
    title: 'Social Story',
    category: 'Social',
    description: 'One idea adapted into feed, story/reel and short-form script directions.',
    modalities: ['text', 'image', 'video'],
    brief: 'Create a social story system with one core message, a feed concept, a vertical story/reel concept and platform-specific copy variants.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-product-demo',
    title: 'Product Demo',
    category: 'Product',
    description: 'Explain a product workflow through a governed demo narrative.',
    modalities: ['text', 'video', 'voice'],
    brief: 'Build a concise product demonstration with problem, workflow, visible proof, narration and a clear next action.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-training-module',
    title: 'Training Module',
    category: 'Learning',
    description: 'Transform a process into teachable steps, narration and visual support.',
    modalities: ['text', 'voice', 'graphic'],
    brief: 'Create a training module with objective, ordered steps, examples, knowledge check, narration and accessible visual support.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-campaign-refresh',
    title: 'Campaign Refresh',
    category: 'Marketing',
    description: 'Refresh an existing campaign while preserving verified claims and brand continuity.',
    modalities: ['text', 'image', 'video'],
    brief: 'Refresh an existing campaign using only supplied claims and assets, preserving identity while improving clarity, hooks and visual direction.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-audio-identity',
    title: 'Audio Identity',
    category: 'Audio',
    description: 'Plan a repeatable sonic identity across voice, music and sound cues.',
    modalities: ['voice', 'music', 'sfx'],
    brief: 'Create an audio identity brief covering voice character, music direction, signature sound cues, prohibited traits and reuse rules.',
    source: 'atlas-original'
  },
  {
    id: 'atlas-accessible-content',
    title: 'Accessible Content Pack',
    category: 'Accessibility',
    description: 'Create a multimodal package with captions, transcript, alt text and audio-description planning.',
    modalities: ['text', 'image', 'video', 'voice'],
    brief: 'Create an accessible content pack with plain-language copy, alt text, captions, transcript and audio-description requirements.',
    source: 'atlas-original'
  }
];
