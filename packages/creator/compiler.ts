import type { CompiledProviderRequest, ProductionSpec, ProviderCapability, ProviderId } from './types';
import { providerPromptDialect } from './providers';

function clean(values: string[]) {
  return values.map(value => value.trim()).filter(Boolean);
}

function renderObjective(spec: ProductionSpec) {
  return clean([spec.title, spec.brief]).join('\n');
}

function renderOutput(spec: ProductionSpec) {
  return [
    `Duration: ${spec.durationSeconds}s`,
    `Aspect ratio: ${spec.aspectRatio}`,
    `Resolution: ${spec.resolutionPreference}`,
    `Synchronized audio requested: ${spec.audioEnabled ? 'yes' : 'no'}`
  ].join('\n');
}

function renderSubjects(spec: ProductionSpec) {
  return spec.subjects.map((subject, index) => {
    const lines = [
      `${index + 1}. ${subject.label || 'Unnamed subject'}${subject.identityLock ? ' [identity locked]' : ''}`,
      subject.description,
      subject.appearanceTraits.length ? `Appearance: ${subject.appearanceTraits.join('; ')}` : '',
      subject.materialTraits.length ? `Materials: ${subject.materialTraits.join('; ')}` : '',
      subject.allowedTransformations.length ? `Allowed transformations: ${subject.allowedTransformations.join('; ')}` : '',
      subject.forbiddenChanges.length ? `Forbidden changes: ${subject.forbiddenChanges.join('; ')}` : ''
    ];
    return clean(lines).join('\n');
  }).join('\n\n');
}

function renderEnvironment(spec: ProductionSpec) {
  return clean([
    spec.environment.locationDescription,
    spec.environment.timeOfDay ? `Time: ${spec.environment.timeOfDay}` : '',
    spec.environment.lightingEnvironment ? `Lighting: ${spec.environment.lightingEnvironment}` : '',
    spec.environment.weatherOrAtmosphere ? `Atmosphere: ${spec.environment.weatherOrAtmosphere}` : '',
    spec.environment.backgroundConstraints.length ? `Background constraints: ${spec.environment.backgroundConstraints.join('; ')}` : ''
  ]).join('\n');
}

function sortedScenes(spec: ProductionSpec) {
  return [...spec.scenes].sort((a, b) => a.startSecond - b.startSecond || a.endSecond - b.endSecond);
}

function renderScenes(spec: ProductionSpec) {
  return sortedScenes(spec).map((scene, index) => clean([
    `Scene ${index + 1}: ${scene.title || 'Untitled'} [${scene.startSecond}-${scene.endSecond}s]`,
    scene.description
  ]).join('\n')).join('\n\n');
}

function renderShots(spec: ProductionSpec) {
  const lines: string[] = [];
  for (const [sceneIndex, scene] of sortedScenes(spec).entries()) {
    for (const shot of [...scene.shots].sort((a, b) => a.order - b.order)) {
      lines.push(clean([
        `Scene ${sceneIndex + 1} / Shot ${shot.order}: ${shot.title || 'Untitled'} [${shot.startSecond}-${shot.endSecond}s]`,
        shot.action,
        shot.subjectIds.length ? `Subject refs: ${shot.subjectIds.join(', ')}` : '',
        shot.lighting ? `Lighting: ${shot.lighting}` : '',
        shot.materials.length ? `Materials: ${shot.materials.join('; ')}` : '',
        shot.transitionIn ? `Transition in: ${shot.transitionIn}` : '',
        shot.transitionOut ? `Transition out: ${shot.transitionOut}` : ''
      ]).join('\n'));
    }
  }
  return lines.join('\n\n');
}

function renderVisualStyle(spec: ProductionSpec) {
  return clean([
    spec.visualStyle.photorealismLevel && `Photorealism: ${spec.visualStyle.photorealismLevel}`,
    spec.visualStyle.cinematicStyle && `Cinematic style: ${spec.visualStyle.cinematicStyle}`,
    spec.visualStyle.textureStyle && `Texture: ${spec.visualStyle.textureStyle}`,
    spec.visualStyle.colorPalette && `Palette: ${spec.visualStyle.colorPalette}`,
    spec.visualStyle.contrastStyle && `Contrast: ${spec.visualStyle.contrastStyle}`,
    spec.visualStyle.filmLook && `Film look: ${spec.visualStyle.filmLook}`,
    spec.visualStyle.grain && `Grain: ${spec.visualStyle.grain}`,
    spec.visualStyle.halation && `Halation: ${spec.visualStyle.halation}`,
    spec.visualStyle.surfaceDetail && `Surface detail: ${spec.visualStyle.surfaceDetail}`,
    spec.visualStyle.lightingStyle && `Lighting style: ${spec.visualStyle.lightingStyle}`
  ]).join('\n');
}

function renderCameraMotion(spec: ProductionSpec) {
  const camera = spec.cameraDefaults;
  const lines = clean([
    camera.framing && `Framing: ${camera.framing}`,
    camera.angle && `Angle: ${camera.angle}`,
    camera.position && `Position: ${camera.position}`,
    camera.lens && `Lens: ${camera.lens}`,
    camera.focalLengthMm !== null ? `Focal length: ${camera.focalLengthMm}mm` : '',
    camera.depthOfField && `Depth of field: ${camera.depthOfField}`,
    camera.movement && `Movement: ${camera.movement}`,
    camera.movementSpeed && `Movement speed: ${camera.movementSpeed}`,
    camera.focusTarget && `Focus: ${camera.focusTarget}`,
    camera.orientationRule && `Orientation: ${camera.orientationRule}`
  ]);
  for (const rule of spec.motionRules) {
    lines.push(clean([
      `Motion rule: ${rule.movementDescription}`,
      rule.direction && `Direction: ${rule.direction}`,
      rule.speedProfile && `Speed: ${rule.speedProfile}`,
      rule.physicality && `Physicality: ${rule.physicality}`,
      rule.mustRemainContinuous ? 'Must remain continuous.' : ''
    ]).join(' '));
  }
  return lines.join('\n');
}

function renderAudio(spec: ProductionSpec) {
  if (!spec.audioEnabled) return 'Synchronized audio disabled.';
  return clean([
    spec.audioPlan.musicDescription && `Music: ${spec.audioPlan.musicDescription}`,
    spec.audioPlan.ambientSound && `Ambience: ${spec.audioPlan.ambientSound}`,
    spec.audioPlan.soundEffects.length ? `SFX: ${spec.audioPlan.soundEffects.join('; ')}` : '',
    spec.audioPlan.dialogue.length ? `Dialogue: ${spec.audioPlan.dialogue.join('; ')}` : '',
    spec.audioPlan.syncRules.length ? `Sync: ${spec.audioPlan.syncRules.join('; ')}` : ''
  ]).join('\n');
}

function renderContinuity(spec: ProductionSpec) {
  return spec.continuityRules.map((rule, index) => `${index + 1}. [${rule.severity}] ${rule.ruleType}: ${rule.description}`).join('\n');
}

function renderNegativeConstraints(spec: ProductionSpec) {
  const production = spec.negativeConstraints.map((constraint, index) => `${index + 1}. [${constraint.severity}] ${constraint.value}`);
  const shotConstraints = sortedScenes(spec).flatMap(scene => [...scene.shots].sort((a, b) => a.order - b.order))
    .flatMap(shot => shot.negativeConstraints.map(value => `Shot ${shot.order}: ${value}`));
  return [...production, ...shotConstraints].join('\n');
}

function renderOutputRestrictions(spec: ProductionSpec) {
  const restrictions = spec.subjects.flatMap(subject => subject.forbiddenChanges);
  return restrictions.length ? restrictions.map(value => `- ${value}`).join('\n') : '';
}

export function compileNeutralProduction(spec: ProductionSpec): string {
  const sections: Array<[string, string]> = [
    ['OBJECTIVE', renderObjective(spec)],
    ['OUTPUT', renderOutput(spec)],
    ['SUBJECT IDENTITY', renderSubjects(spec)],
    ['ENVIRONMENT', renderEnvironment(spec)],
    ['SCENE PLAN', renderScenes(spec)],
    ['SHOT PLAN', renderShots(spec)],
    ['VISUAL STYLE', renderVisualStyle(spec)],
    ['CAMERA & MOTION', renderCameraMotion(spec)],
    ['AUDIO', renderAudio(spec)],
    ['CONTINUITY CONTRACT', renderContinuity(spec)],
    ['NEGATIVE CONSTRAINTS', renderNegativeConstraints(spec)],
    ['OUTPUT RESTRICTIONS', renderOutputRestrictions(spec)]
  ];
  return sections.map(([heading, body]) => `${heading}\n${body || 'Not specified.'}`).join('\n\n');
}

function formatForDialect(prompt: string, dialect: 'cinematic-structured' | 'shot-structured') {
  // The canonical prompt is already structured. Dialect selection is kept explicit
  // so future adapters can wrap syntax without mutating production meaning.
  return dialect === 'cinematic-structured' ? prompt : prompt;
}

function referenceCounts(spec: ProductionSpec) {
  const image = new Set<string>();
  for (const subject of spec.subjects) for (const id of subject.referenceAssetIds) image.add(id);
  for (const id of spec.environment.referenceAssetIds) image.add(id);
  return { image: image.size, video: 0, audio: new Set(spec.audioPlan.voiceReferenceAssetIds).size };
}

export function compileProviderRequest(
  spec: ProductionSpec,
  providerId: ProviderId,
  capability?: ProviderCapability
): CompiledProviderRequest {
  const unsupportedFeatures: string[] = [];
  const adaptationNotes: string[] = [];

  if (capability) {
    if (capability.minDurationSeconds !== null && spec.durationSeconds < capability.minDurationSeconds) {
      unsupportedFeatures.push('duration_below_provider_minimum');
      adaptationNotes.push('Requested duration requires an explicit user-approved adaptation.');
    }
    if (capability.maxDurationSeconds !== null && spec.durationSeconds > capability.maxDurationSeconds) {
      unsupportedFeatures.push('duration_above_provider_maximum');
      adaptationNotes.push('Requested duration requires an explicit user-approved adaptation.');
    }
    if (spec.aspectRatio !== 'adaptive' && !capability.aspectRatios.includes(spec.aspectRatio)) {
      unsupportedFeatures.push('aspect_ratio_unsupported');
      adaptationNotes.push('Requested aspect ratio requires an explicit user-approved adaptation.');
    }
    if (spec.resolutionPreference !== 'adaptive' && !capability.resolutions.includes(spec.resolutionPreference)) {
      unsupportedFeatures.push('resolution_unsupported');
      adaptationNotes.push('Requested resolution requires an explicit user-approved adaptation.');
    }
    if (spec.audioEnabled && !capability.audioSupport) {
      unsupportedFeatures.push('native_audio_unsupported');
      adaptationNotes.push('Native synchronized audio is unavailable; ATLAS will not disable audio silently.');
    }
    const refs = referenceCounts(spec);
    if (capability.maxImageReferences !== null && refs.image > capability.maxImageReferences) unsupportedFeatures.push('image_reference_limit_exceeded');
    if (capability.maxVideoReferences !== null && refs.video > capability.maxVideoReferences) unsupportedFeatures.push('video_reference_limit_exceeded');
    if (capability.maxAudioReferences !== null && refs.audio > capability.maxAudioReferences) unsupportedFeatures.push('audio_reference_limit_exceeded');
  }

  return {
    providerId,
    prompt: formatForDialect(compileNeutralProduction(spec), providerPromptDialect(providerId)),
    normalizedParams: {
      durationSeconds: spec.durationSeconds,
      aspectRatio: spec.aspectRatio,
      resolutionPreference: spec.resolutionPreference,
      audioEnabled: spec.audioEnabled
    },
    unsupportedFeatures,
    adaptationNotes,
    readinessClaim: capability?.connectionState === 'ready'
  };
}
