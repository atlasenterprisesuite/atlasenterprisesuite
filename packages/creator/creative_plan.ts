import { rankCreativeEngines, type CreativeEngineReadiness, type CreativeMediaKind } from './creative_engine';

export type CreativeAccessibilityPlan = {
  captions: boolean;
  transcript: boolean;
  altText: boolean;
  audioDescription: boolean;
};

export type CreativePlanInput = {
  title: string;
  brief: string;
  mediaKinds: CreativeMediaKind[];
  destinations: string[];
  audience: string;
  aspectRatio: string;
  language: string;
  accessibility: CreativeAccessibilityPlan;
  negativeConstraints: string[];
  brandProfileId?: string | null;
  referenceAssetIds?: string[];
};

export type CreativeDeliverable = {
  id: string;
  mediaKind: CreativeMediaKind;
  title: string;
  purpose: string;
};

export type CreativePromptArtifact = {
  id: string;
  creativePlanId: string;
  mediaKind: CreativeMediaKind;
  providerOrEngineId: string;
  prompt: string;
  parameters: Record<string, string | string[] | boolean>;
  adaptationNotes: string[];
  version: number;
  createdAt: string;
};

export type CreativePlan = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  sourceBrief: string;
  normalizedObjective: string;
  mediaKinds: CreativeMediaKind[];
  targetDestinations: string[];
  audience: string;
  aspectRatio: string;
  language: string;
  brandProfileId: string | null;
  referenceAssetIds: string[];
  deliverables: CreativeDeliverable[];
  promptSet: CreativePromptArtifact[];
  audioPlan: {
    voiceScript: string;
    musicBrief: string;
    soundEffectCues: string[];
  };
  accessibilityPlan: CreativeAccessibilityPlan;
  negativeConstraints: string[];
  enginePreference: Partial<Record<CreativeMediaKind, string>>;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreativePlanIdentity = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  now: string;
  version?: number;
  createdAt?: string;
};

function deliverablePurpose(kind: CreativeMediaKind) {
  switch (kind) {
    case 'image': return 'Primary still-image creative';
    case 'video': return 'ATLAS Director production handoff';
    case 'music': return 'Music bed or score planning';
    case 'voice': return 'Voice script and narration planning';
    case 'sfx': return 'Sound-effect cue planning';
    case 'graphic': return 'Branded graphic composition';
    case 'template': return 'Reusable creative template';
  }
}

function kindInstruction(kind: CreativeMediaKind) {
  switch (kind) {
    case 'image': return 'IMAGE COMPOSITION: Define subject, environment, lighting, framing, materials and visual hierarchy.';
    case 'video': return 'VIDEO DIRECTOR HANDOFF: Convert this plan into ATLAS Director scenes and shots; do not duplicate Director state here.';
    case 'music': return 'MUSIC BRIEF: Define mood, tempo intent, instrumentation, energy arc and intended use.';
    case 'voice': return 'VOICE SCRIPT: Produce a clear narration script with tone, pacing, pronunciation and transcript intent.';
    case 'sfx': return 'SOUND EFFECT: Define cue, texture, intensity, timing and duration intent.';
    case 'graphic': return 'GRAPHIC: Define hierarchy, typography intent, composition, brand-safe layout and output purpose.';
    case 'template': return 'TEMPLATE: Define reusable slots, locked brand elements, editable regions and target format.';
  }
}

function buildPrompt(
  planId: string,
  kind: CreativeMediaKind,
  input: CreativePlanInput,
  normalizedObjective: string,
  engineId: string,
  now: string,
  version: number
): CreativePromptArtifact {
  const constraints = input.negativeConstraints.map(value => value.trim()).filter(Boolean);
  const accessibility = [
    input.accessibility.captions ? 'captions' : '',
    input.accessibility.transcript ? 'transcript' : '',
    input.accessibility.altText ? 'alt-text' : '',
    input.accessibility.audioDescription ? 'audio-description' : ''
  ].filter(Boolean);

  const lines = [
    `MEDIA: ${kind.toUpperCase()}`,
    `OBJECTIVE: ${normalizedObjective}`,
    input.audience.trim() ? `AUDIENCE: ${input.audience.trim()}` : '',
    input.destinations.length ? `DESTINATIONS: ${input.destinations.join(', ')}` : '',
    input.aspectRatio.trim() ? `ASPECT RATIO: ${input.aspectRatio.trim()}` : '',
    `LANGUAGE: ${input.language.trim() || 'English'}`,
    kindInstruction(kind),
    accessibility.length ? `ACCESSIBILITY: ${accessibility.join(', ')}` : '',
    constraints.length ? `NEGATIVE CONSTRAINTS: ${constraints.join('; ')}` : ''
  ].filter(Boolean);

  return {
    id: `${planId}:${kind}:v${version}`,
    creativePlanId: planId,
    mediaKind: kind,
    providerOrEngineId: engineId,
    prompt: lines.join('\n'),
    parameters: {
      aspectRatio: input.aspectRatio || 'adaptive',
      language: input.language || 'English',
      audience: input.audience || '',
      destinations: input.destinations,
      accessibility
    },
    adaptationNotes: engineId === 'prompt-export'
      ? ['Planning-only fallback. No media was generated.']
      : [`Preferred verified engine: ${engineId}`],
    version,
    createdAt: now
  };
}

export function buildCreativePlan(
  input: CreativePlanInput,
  engines: readonly CreativeEngineReadiness[],
  identity: CreativePlanIdentity
): CreativePlan {
  const sourceBrief = input.brief;
  const normalizedObjective = sourceBrief.trim();
  if (normalizedObjective.length < 8) throw new Error('creative_brief_too_short');
  if (!input.mediaKinds.length) throw new Error('creative_media_kind_required');

  const mediaKinds = [...new Set(input.mediaKinds)];
  const version = identity.version ?? 1;
  const enginePreference: Partial<Record<CreativeMediaKind, string>> = {};

  for (const kind of mediaKinds) {
    const selected = rankCreativeEngines(engines, kind).find(engine => engine.ready);
    if (selected) enginePreference[kind] = selected.engineId;
  }

  const deliverables = mediaKinds.map((mediaKind, index) => ({
    id: `${identity.id}:deliverable:${index + 1}`,
    mediaKind,
    title: `${mediaKind.toUpperCase()} deliverable`,
    purpose: deliverablePurpose(mediaKind)
  }));

  const promptSet = mediaKinds.map(kind => buildPrompt(
    identity.id,
    kind,
    input,
    normalizedObjective,
    enginePreference[kind] || 'prompt-export',
    identity.now,
    version
  ));

  return {
    id: identity.id,
    organizationId: identity.organizationId,
    createdByUserId: identity.createdByUserId,
    title: input.title.trim() || 'Untitled creative plan',
    sourceBrief,
    normalizedObjective,
    mediaKinds,
    targetDestinations: input.destinations.map(value => value.trim()).filter(Boolean),
    audience: input.audience.trim(),
    aspectRatio: input.aspectRatio.trim() || 'adaptive',
    language: input.language.trim() || 'English',
    brandProfileId: input.brandProfileId ?? null,
    referenceAssetIds: input.referenceAssetIds ?? [],
    deliverables,
    promptSet,
    audioPlan: {
      voiceScript: mediaKinds.includes('voice') ? normalizedObjective : '',
      musicBrief: mediaKinds.includes('music') ? normalizedObjective : '',
      soundEffectCues: mediaKinds.includes('sfx') ? [normalizedObjective] : []
    },
    accessibilityPlan: { ...input.accessibility },
    negativeConstraints: input.negativeConstraints.map(value => value.trim()).filter(Boolean),
    enginePreference,
    createdAt: identity.createdAt ?? identity.now,
    updatedAt: identity.now,
    version
  };
}
