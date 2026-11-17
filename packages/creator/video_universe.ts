/**
 * ATLAS Video Universe: first-party, provider-neutral capability registry.
 * Feature claims are discovery metadata, NOT verified account entitlements.
 * Nothing in this module executes, bills, trains an avatar or stores media.
 */

export type VideoMode =
  | 'avatar-presenter' | 'cinematic' | 'image-to-video' | 'reference-to-video'
  | 'translate-dub' | 'lip-sync' | 'social-clips' | 'voiceover'
  | 'motion-transfer' | 'timeline-edit' | 'template-batch' | 'captions';

export type VideoProviderId =
  | 'atlas-native' | 'heygen' | 'runway' | 'veo' | 'seedance' | 'kling'
  | 'adobe-firefly' | 'descript' | 'wan22' | 'ltx' | 'hunyuan'
  | 'capcut' | 'canva' | 'openart';

export type VideoProviderKind = 'first-party' | 'cloud-api' | 'local-model' | 'editor' | 'aggregator';

export type VideoModeDefinition = {
  id: VideoMode;
  label: string;
  description: string;
  biometricConsent: boolean;
  sourceMediaExpected: boolean;
};

export type VideoProviderDefinition = {
  id: VideoProviderId;
  label: string;
  kind: VideoProviderKind;
  modes: readonly VideoMode[];
  reference: string; // official documentation or provider product overview
  integration: 'existing-atlas-runtime' | 'candidate-adapter' | 'editor-handoff';
  note: string;
};

export const VIDEO_MODES: readonly VideoModeDefinition[] = [
  { id: 'avatar-presenter', label: 'Personal presenter', description: 'A consenting digital twin or synthetic presenter reads a script.', biometricConsent: true, sourceMediaExpected: true },
  { id: 'cinematic', label: 'Cinematic generation', description: 'Generate film-style moving scenes from original creative direction.', biometricConsent: false, sourceMediaExpected: false },
  { id: 'image-to-video', label: 'Image to video', description: 'Animate an approved still image with controlled camera and motion.', biometricConsent: false, sourceMediaExpected: true },
  { id: 'reference-to-video', label: 'Reference-driven video', description: 'Control visual continuity with approved reference footage or images.', biometricConsent: false, sourceMediaExpected: true },
  { id: 'translate-dub', label: 'Translation & dubbing', description: 'Localize a source video with licensed dialogue and optional lip sync.', biometricConsent: true, sourceMediaExpected: true },
  { id: 'lip-sync', label: 'Lip synchronization', description: 'Align approved speech to a consenting video presenter.', biometricConsent: true, sourceMediaExpected: true },
  { id: 'social-clips', label: 'Intelligent social clips', description: 'Extract shareable short sequences from an approved long-form video.', biometricConsent: false, sourceMediaExpected: true },
  { id: 'voiceover', label: 'Narration & voiceover', description: 'Produce narration with a licensed synthetic or consenting personal voice.', biometricConsent: true, sourceMediaExpected: false },
  { id: 'motion-transfer', label: 'Motion transfer', description: 'Drive an approved character with reference movement.', biometricConsent: true, sourceMediaExpected: true },
  { id: 'timeline-edit', label: 'Timeline and motion design', description: 'Edit scenes, transitions and motion while preserving exact product UI.', biometricConsent: false, sourceMediaExpected: true },
  { id: 'template-batch', label: 'Templates and batches', description: 'Create reusable brand-compliant variants of an approved production.', biometricConsent: false, sourceMediaExpected: false },
  { id: 'captions', label: 'Captions & accessibility', description: 'Prepare transcript/caption assets and accessible formats.', biometricConsent: false, sourceMediaExpected: true }
];

export const VIDEO_PROVIDERS: readonly VideoProviderDefinition[] = [
  { id: 'atlas-native', label: 'ATLAS Native Composer', kind: 'first-party', modes: ['timeline-edit', 'captions', 'template-batch'], reference: '/studio/create?type=video', integration: 'existing-atlas-runtime', note: 'Existing Director, native render and Creator Library. Execution still requires verified runtime, organization, saved-version and permission gates.' },
  { id: 'heygen', label: 'HeyGen / Avatar 6', kind: 'cloud-api', modes: ['avatar-presenter', 'cinematic', 'image-to-video', 'reference-to-video', 'translate-dub', 'lip-sync', 'social-clips', 'voiceover', 'template-batch', 'captions'], reference: 'https://developers.heygen.com/', integration: 'candidate-adapter', note: 'HeyGen platform tools include avatars, Video 1, Video Agent, voice, translation, clipping, templates, brand kits and batches. ATLAS API v3 adapter is not connected.' },
  { id: 'runway', label: 'Runway', kind: 'cloud-api', modes: ['cinematic', 'image-to-video', 'reference-to-video', 'voiceover'], reference: 'https://docs.dev.runwayml.com/api/', integration: 'candidate-adapter', note: 'Text/image/video generation and cinematic motion options; model versions and prices must be verified per request.' },
  { id: 'veo', label: 'Google Veo', kind: 'cloud-api', modes: ['cinematic', 'image-to-video', 'reference-to-video'], reference: 'https://ai.google.dev/gemini-api/docs/video', integration: 'candidate-adapter', note: 'Video generation with native audio and reference/extension features; verify the currently offered model ID before wiring.' },
  { id: 'seedance', label: 'Seedance', kind: 'cloud-api', modes: ['cinematic', 'image-to-video', 'reference-to-video'], reference: 'https://docs.dev.runwayml.com/guides/models/', integration: 'candidate-adapter', note: 'Multimodal reference-driven video generation. ATLAS provider readiness alone does not establish an executable adapter.' },
  { id: 'kling', label: 'Kling', kind: 'cloud-api', modes: ['cinematic', 'image-to-video', 'reference-to-video'], reference: 'https://docs.dev.runwayml.com/guides/models/', integration: 'candidate-adapter', note: 'Video/reference model family through authorized platforms; model and rights depend on actual contract.' },
  { id: 'adobe-firefly', label: 'Adobe Firefly / Premiere', kind: 'editor', modes: ['cinematic', 'image-to-video', 'timeline-edit', 'captions', 'template-batch'], reference: 'https://helpx.adobe.com/firefly/web/work-with-audio-and-video/work-with-video/generate-videos-using-non-adobe-models.html', integration: 'editor-handoff', note: 'Hybrid workflows preserve exact product UI pixels in conventional animation, and use generative models selectively.' },
  { id: 'descript', label: 'Descript', kind: 'editor', modes: ['social-clips', 'timeline-edit', 'voiceover', 'captions'], reference: 'https://www.descript.com/', integration: 'editor-handoff', note: 'Speech-oriented editing and short-form content; connected app and export permissions must be checked separately.' },
  { id: 'wan22', label: 'Wan2.2 / Wan-Animate', kind: 'local-model', modes: ['cinematic', 'image-to-video', 'motion-transfer', 'voiceover'], reference: 'https://github.com/Wan-Video/Wan2.2', integration: 'candidate-adapter', note: 'Open model family with animation and speech-driven variants; requires licensed weights, suitable GPU, workload isolation and benchmarks.' },
  { id: 'ltx', label: 'LTX Video', kind: 'local-model', modes: ['cinematic', 'image-to-video', 'reference-to-video', 'timeline-edit'], reference: 'https://docs.ltx.video/', integration: 'candidate-adapter', note: 'Local/cloud video model options. Audit its model weight license and compute capacity before production use.' },
  { id: 'hunyuan', label: 'HunyuanVideo', kind: 'local-model', modes: ['cinematic', 'image-to-video'], reference: 'https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5', integration: 'candidate-adapter', note: 'Self-host candidate with separate model license and GPU requirements.' },
  { id: 'capcut', label: 'CapCut', kind: 'editor', modes: ['timeline-edit', 'social-clips', 'captions'], reference: 'https://www.capcut.com/', integration: 'editor-handoff', note: 'Editorial/social workflow reference only; not a connected ATLAS export adapter.' },
  { id: 'canva', label: 'Canva', kind: 'editor', modes: ['template-batch', 'timeline-edit', 'captions'], reference: 'https://www.canva.com/', integration: 'editor-handoff', note: 'Reusable branded design and templates; provider-specific automation needs permission and capability verification.' },
  { id: 'openart', label: 'OpenArt', kind: 'aggregator', modes: ['cinematic', 'image-to-video', 'reference-to-video'], reference: 'https://openart.ai/', integration: 'candidate-adapter', note: 'Multimodel video workspace; exact model, limits, and billing are not inferred from its catalog.' }
];

export type VideoRuntimeSignal = {
  providerId: string;
  connectionState: string;
  lastVerifiedAt: string | null;
};

/** A runtime signal is evidence only, not permission to send a paid generation job. */
export function catalogVideoCandidates(
  mode: VideoMode,
  signals: readonly VideoRuntimeSignal[] = [],
  nativeRuntimeVerified = false
) {
  if (!VIDEO_MODES.some(item => item.id === mode)) throw new Error('video_mode_invalid');
  return VIDEO_PROVIDERS.filter(provider => provider.modes.includes(mode)).map(provider => {
    const signal = signals.find(item => item.providerId === provider.id);
    const signalVerified = Boolean(signal?.connectionState === 'ready' && signal.lastVerifiedAt);
    return {
      ...provider,
      runtimeObservation: provider.id === 'atlas-native'
        ? (nativeRuntimeVerified ? 'native-runtime-reported-ready' : 'native-runtime-not-verified')
        : (signalVerified ? 'provider-readiness-reported' : 'no-executable-adapter-verified'),
      executableFromFoundry: false as const
    };
  });
}

export type VideoUniverseDraftInput = {
  mode: VideoMode;
  providerId: VideoProviderId;
  title: string;
  brief: string;
  language: 'es' | 'en';
  aspectRatio: '9:16' | '16:9' | '1:1';
  sourceAssetIds?: readonly string[];
  subtitles: boolean;
  transcript: boolean;
  rightsVerified: boolean;
};

export function compileVideoUniverseDraft(input: VideoUniverseDraftInput) {
  const mode = VIDEO_MODES.find(item => item.id === input.mode);
  const provider = VIDEO_PROVIDERS.find(item => item.id === input.providerId);
  if (!mode) throw new Error('video_mode_invalid');
  if (!provider || !provider.modes.includes(mode.id)) throw new Error('video_provider_unsupported_mode');
  if (typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.length > 140) throw new Error('video_title_invalid');
  if (typeof input.brief !== 'string' || input.brief.trim().length < 8 || input.brief.length > 12000) throw new Error('video_brief_invalid');
  if (input.language !== 'es' && input.language !== 'en') throw new Error('video_language_invalid');
  if (!['9:16', '16:9', '1:1'].includes(input.aspectRatio)) throw new Error('video_aspect_invalid');
  const sourceAssets = input.sourceAssetIds || [];
  if (!Array.isArray(sourceAssets) || sourceAssets.length > 20 || sourceAssets.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(id))) {
    throw new Error('video_asset_reference_invalid');
  }
  const blockers = [
    ...(mode.sourceMediaExpected && sourceAssets.length === 0 ? ['approved_source_media_required_before_render'] : []),
    ...(mode.biometricConsent ? ['verified_subject_or_voice_consent_required_before_render'] : []),
    ...(!input.rightsVerified ? ['source_rights_review_required_before_render'] : []),
    'server_identity_tenant_rbac_provider_budget_and_idempotency_gates_required'
  ];
  return {
    schemaVersion: 1 as const,
    kind: 'atlas-video-universe-draft' as const,
    status: 'planning-only' as const,
    submitted: false as const,
    title: input.title.trim(),
    creativeBrief: input.brief,
    mode: mode.id,
    preferredProvider: provider.id,
    providerIntegration: provider.integration,
    language: input.language,
    aspectRatio: input.aspectRatio,
    referenceAssetIds: [...sourceAssets],
    accessibility: { subtitles: input.subtitles, transcript: input.transcript, discloseSyntheticContent: true },
    approvals: { rightsMarkedReviewedInDraft: input.rightsVerified, consentVerified: false, spendAuthorized: false },
    pendingRenderGates: blockers,
    canonicalStudioRoute: '/studio/create?type=video',
    providerDocumentation: provider.reference
  };
}
