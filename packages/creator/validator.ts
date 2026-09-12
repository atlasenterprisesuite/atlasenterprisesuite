import type {
  ProductionSpec,
  ProviderCapability,
  ValidationIssue,
  ValidationResult,
  ShotSpec
} from './types';

function issue(
  code: string,
  severity: 'warning' | 'blocking',
  section: ValidationIssue['section'],
  message: string,
  targetId: string | null = null
): ValidationIssue {
  return { code, severity, section, message, targetId };
}

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function positiveValues(spec: ProductionSpec): Set<string> {
  const values: string[] = [
    spec.title, spec.brief,
    spec.environment.locationDescription, spec.environment.timeOfDay,
    spec.environment.lightingEnvironment, spec.environment.weatherOrAtmosphere,
    ...spec.environment.backgroundConstraints,
    ...Object.values(spec.visualStyle),
    ...Object.values(spec.cameraDefaults).filter((value): value is string => typeof value === 'string'),
    spec.audioPlan.musicDescription, spec.audioPlan.ambientSound,
    ...spec.audioPlan.soundEffects, ...spec.audioPlan.dialogue, ...spec.audioPlan.syncRules
  ];
  for (const subject of spec.subjects) {
    values.push(subject.label, subject.description, ...subject.appearanceTraits, ...subject.materialTraits, ...subject.allowedTransformations);
  }
  for (const scene of spec.scenes) {
    values.push(scene.title, scene.description);
    for (const shot of scene.shots) {
      values.push(
        shot.title, shot.action, shot.lighting, ...shot.materials, ...shot.continuityNotes,
        shot.camera.framing, shot.camera.angle, shot.camera.position, shot.camera.lens,
        shot.camera.depthOfField, shot.camera.movement, shot.camera.movementSpeed,
        shot.camera.focusTarget, shot.camera.orientationRule,
        shot.motion.direction, shot.motion.speedProfile, shot.motion.physicality,
        shot.transitionIn, shot.transitionOut
      );
    }
  }
  return new Set(values.map(normalized).filter(Boolean));
}

function orderedShots(spec: ProductionSpec): ShotSpec[] {
  return [...spec.scenes]
    .sort((a, b) => a.startSecond - b.startSecond)
    .flatMap(scene => [...scene.shots].sort((a, b) => a.order - b.order));
}

function hasAllowedTransformationNote(shot: ShotSpec, allowed: string[]) {
  const notes = shot.continuityNotes.map(normalized);
  return allowed.some(value => {
    const target = normalized(value);
    return target && notes.some(note => note.includes(target));
  });
}

function validateContinuity(spec: ProductionSpec, issues: ValidationIssue[]) {
  const shots = orderedShots(spec);
  const indexById = new Map(shots.map((shot, index) => [shot.id, index]));
  for (const rule of spec.continuityRules) {
    if (!rule.subjectId || !['identity', 'transformation-continuity'].includes(rule.ruleType)) continue;
    const subject = spec.subjects.find(item => item.id === rule.subjectId);
    if (!subject?.identityLock) continue;
    const start = rule.startShotId ? indexById.get(rule.startShotId) : 0;
    const end = rule.endShotId ? indexById.get(rule.endShotId) : shots.length - 1;
    if (start === undefined || end === undefined || end < start) continue;
    for (const shot of shots.slice(start, end + 1)) {
      if (!shot.subjectIds.includes(subject.id) && !hasAllowedTransformationNote(shot, subject.allowedTransformations)) {
        issues.push(issue(
          'identity_subject_missing',
          rule.severity,
          'continuity',
          'Identity-locked subject disappears inside an active continuity span without an allowed transformation note.',
          shot.id
        ));
      }
    }
  }
}

function countReferences(spec: ProductionSpec) {
  const images = new Set<string>();
  for (const subject of spec.subjects) for (const id of subject.referenceAssetIds) images.add(id);
  for (const id of spec.environment.referenceAssetIds) images.add(id);
  const audio = new Set(spec.audioPlan.voiceReferenceAssetIds);
  return { image: images.size, video: 0, audio: audio.size };
}

export function validateProductionSpec(spec: ProductionSpec, provider?: ProviderCapability): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!spec.brief.trim()) issues.push(issue('brief_required', 'blocking', 'brief', 'Creative brief is required.'));
  if (spec.durationSeconds <= 0) issues.push(issue('duration_invalid', 'blocking', 'brief', 'Duration must be greater than zero.'));

  for (const scene of spec.scenes) {
    if (scene.endSecond <= scene.startSecond) issues.push(issue('scene_timing_invalid', 'blocking', 'shots', 'Scene end must be after scene start.', scene.id));
    if (scene.endSecond > spec.durationSeconds) issues.push(issue('scene_exceeds_production', 'blocking', 'shots', 'Scene exceeds production duration.', scene.id));
    const shots = [...scene.shots].sort((a, b) => a.order - b.order);
    for (let index = 0; index < shots.length; index += 1) {
      const shot = shots[index];
      if (shot.endSecond <= shot.startSecond) issues.push(issue('shot_timing_invalid', 'blocking', 'shots', 'Shot end must be after shot start.', shot.id));
      if (shot.startSecond < scene.startSecond || shot.endSecond > scene.endSecond) issues.push(issue('shot_outside_scene', 'blocking', 'shots', 'Shot timing must stay inside its scene.', shot.id));
      if (shot.endSecond > spec.durationSeconds) issues.push(issue('shot_exceeds_production', 'blocking', 'shots', 'Shot exceeds production duration.', shot.id));
      const previous = shots[index - 1];
      if (previous && shot.startSecond < previous.endSecond) {
        issues.push(issue('shot_overlap', 'blocking', 'shots', 'Shots may not overlap within a scene.', shot.id));
      }
      if (
        previous && shot.transitionIn === 'continuous'
        && previous.camera.orientationRule.trim() && shot.camera.orientationRule.trim()
        && normalized(previous.camera.orientationRule) !== normalized(shot.camera.orientationRule)
      ) {
        issues.push(issue('camera_axis_reversal', 'warning', 'camera', 'Camera orientation changes across a continuous transition.', shot.id));
      }
    }
  }

  validateContinuity(spec, issues);

  const positives = positiveValues(spec);
  for (const constraint of spec.negativeConstraints) {
    if (constraint.severity !== 'blocking') continue;
    const value = normalized(constraint.value);
    if (value && positives.has(value)) {
      issues.push(issue('negative_constraint_conflict', 'blocking', 'continuity', 'A blocking negative constraint exactly conflicts with a positive production field.', constraint.id));
    }
  }

  if (provider) {
    if (provider.connectionState !== 'ready') {
      issues.push(issue('provider_not_ready', 'blocking', 'provider', 'Selected provider is not verified ready.'));
    }
    if (provider.minDurationSeconds !== null && spec.durationSeconds < provider.minDurationSeconds) {
      issues.push(issue('provider_duration_unsupported', 'blocking', 'provider', 'Requested duration is below provider capability.'));
    }
    if (provider.maxDurationSeconds !== null && spec.durationSeconds > provider.maxDurationSeconds) {
      issues.push(issue('provider_duration_unsupported', 'blocking', 'provider', 'Requested duration exceeds provider capability.'));
    }
    if (!provider.aspectRatios.includes(spec.aspectRatio) && spec.aspectRatio !== 'adaptive') {
      issues.push(issue('provider_aspect_ratio_unsupported', 'blocking', 'provider', 'Requested aspect ratio is not supported.'));
    }
    if (spec.resolutionPreference !== 'adaptive' && !provider.resolutions.includes(spec.resolutionPreference)) {
      issues.push(issue('provider_resolution_unsupported', 'blocking', 'provider', 'Requested resolution is not supported.'));
    }
    if (spec.audioEnabled && !provider.audioSupport) {
      issues.push(issue('provider_audio_unsupported', 'warning', 'provider', 'Provider does not support native synchronized audio.'));
    }
    const references = countReferences(spec);
    if (provider.maxImageReferences !== null && references.image > provider.maxImageReferences) {
      issues.push(issue('provider_image_reference_limit', 'blocking', 'provider', 'Image reference count exceeds provider capability.'));
    }
    if (provider.maxVideoReferences !== null && references.video > provider.maxVideoReferences) {
      issues.push(issue('provider_video_reference_limit', 'blocking', 'provider', 'Video reference count exceeds provider capability.'));
    }
    if (provider.maxAudioReferences !== null && references.audio > provider.maxAudioReferences) {
      issues.push(issue('provider_audio_reference_limit', 'blocking', 'provider', 'Audio reference count exceeds provider capability.'));
    }
  }

  const status: ValidationResult['status'] = issues.some(item => item.severity === 'blocking')
    ? 'blocking'
    : issues.length > 0
      ? 'warning'
      : 'pass';
  return { status, issues };
}
