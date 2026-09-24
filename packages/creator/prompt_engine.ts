import type { CreativeEngineReadiness, CreativeMediaKind } from './creative_engine';
import type { CreativePlan, CreativePromptArtifact } from './creative_plan';

export type PromptExportRequest = {
  mediaKind: CreativeMediaKind;
  brief: string;
  aspectRatio?: string;
  destination?: string;
  language?: string;
  negativeConstraints?: string[];
};

export type PromptExportPackage = {
  status: 'prompt-ready';
  engineId: 'prompt-export';
  mediaKind: CreativeMediaKind;
  prompt: string;
  parameters: Record<string, string | string[]>;
  adaptationNotes: string[];
};

export const PROMPT_EXPORT_ENGINE: CreativeEngineReadiness = {
  engineId: 'prompt-export',
  displayName: 'Prompt Export',
  executionClass: 'prompt-export-only',
  connectionState: 'ready',
  ready: true,
  mediaKinds: ['image', 'video', 'music', 'voice', 'sfx', 'graphic', 'template'],
  capabilityNotes: ['planning-only', 'no-media-generation', 'portable-output'],
  lastVerifiedAt: null
};

export function compilePromptExport(request: PromptExportRequest): PromptExportPackage {
  const brief = request.brief.trim();
  if (brief.length < 8) throw new Error('creative_brief_too_short');

  const lines = [
    `MEDIA: ${request.mediaKind}`,
    `OBJECTIVE: ${brief}`,
    request.destination ? `DESTINATION: ${request.destination.trim()}` : '',
    request.aspectRatio ? `ASPECT RATIO: ${request.aspectRatio.trim()}` : '',
    `LANGUAGE: ${(request.language || 'English').trim()}`,
    request.negativeConstraints?.length
      ? `NEGATIVE CONSTRAINTS: ${request.negativeConstraints.map(value => value.trim()).filter(Boolean).join('; ')}`
      : '',
    'OUTPUT: Produce only the requested media result. Preserve the stated brand, accessibility, and composition constraints.'
  ].filter(Boolean);

  return {
    status: 'prompt-ready',
    engineId: 'prompt-export',
    mediaKind: request.mediaKind,
    prompt: lines.join('\n'),
    parameters: {
      ...(request.aspectRatio ? { aspectRatio: request.aspectRatio } : {}),
      ...(request.destination ? { destination: request.destination } : {}),
      language: request.language || 'English',
      negativeConstraints: request.negativeConstraints ?? []
    },
    adaptationNotes: [
      'No media was generated. Use this package with a compatible authorized engine.'
    ]
  };
}


export function compileSpecializedPrompt(
  plan: CreativePlan,
  mediaKind: CreativeMediaKind
): CreativePromptArtifact {
  const artifact = plan.promptSet.find(item => item.mediaKind === mediaKind);
  if (!artifact) throw new Error('creative_prompt_not_found');
  return {
    ...artifact,
    parameters: { ...artifact.parameters },
    adaptationNotes: [...artifact.adaptationNotes]
  };
}
