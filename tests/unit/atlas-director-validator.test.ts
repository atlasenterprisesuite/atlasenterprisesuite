import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec, createEmptyScene, createEmptyShot, createEmptySubject } from '../../packages/creator/defaults';
import { validateProductionSpec } from '../../packages/creator/validator';
import type { ProviderCapability } from '../../packages/creator/types';

function validBase() {
  const spec = createEmptyProductionSpec();
  spec.title = 'Launch spot';
  spec.brief = 'A governed cinematic ATLAS launch sequence.';
  spec.durationSeconds = 10;
  const scene = createEmptyScene();
  scene.title = 'Launch';
  scene.startSecond = 0;
  scene.endSecond = 10;
  const shot = createEmptyShot({ order: 1 });
  shot.title = 'Opening';
  shot.startSecond = 0;
  shot.endSecond = 5;
  shot.action = 'ATLAS mark emerges from darkness.';
  scene.shots = [shot];
  spec.scenes = [scene];
  return spec;
}

function capability(overrides: Partial<ProviderCapability> = {}): ProviderCapability {
  return {
    providerId: 'seedance', connectionState: 'ready', modes: ['text2video'],
    minDurationSeconds: 1, maxDurationSeconds: 30,
    aspectRatios: ['adaptive', '16:9', '9:16'], resolutions: ['adaptive', '720p', '1080p'],
    audioSupport: true, imageReferenceSupport: true, videoReferenceSupport: false, audioReferenceSupport: true,
    maxImageReferences: 30, maxVideoReferences: 0, maxAudioReferences: 10,
    startFrameSupport: false, endFrameSupport: false, costEstimatorAvailable: false, lastVerifiedAt: '2026-09-12T12:00:00.000Z',
    ...overrides
  };
}

describe('ATLAS Director validator', () => {
  it('blocks invalid production duration', () => {
    const spec = validBase(); spec.durationSeconds = 0;
    expect(validateProductionSpec(spec).issues.some(i => i.code === 'duration_invalid')).toBe(true);
  });

  it('blocks overlapping shots', () => {
    const spec = validBase();
    const second = createEmptyShot({ order: 2 }); second.startSecond = 4; second.endSecond = 8; second.action = 'Continue.';
    spec.scenes[0].shots.push(second);
    expect(validateProductionSpec(spec).issues.some(i => i.code === 'shot_overlap')).toBe(true);
  });

  it('blocks a shot that exceeds production duration', () => {
    const spec = validBase(); spec.scenes[0].shots[0].endSecond = 12;
    const result = validateProductionSpec(spec);
    expect(result.status).toBe('blocking');
    expect(result.issues.some(issue => issue.code === 'shot_exceeds_production')).toBe(true);
  });

  it('warns on an unexplained axis reversal across a continuous transition', () => {
    const spec = validBase();
    spec.scenes[0].shots[0].camera.orientationRule = 'front-facing';
    const second = createEmptyShot({ order: 2 }); second.startSecond = 5; second.endSecond = 10; second.action = 'Continue forward motion.';
    second.camera.orientationRule = 'rear-facing'; second.transitionIn = 'continuous'; spec.scenes[0].shots.push(second);
    expect(validateProductionSpec(spec).issues.some(issue => issue.code === 'camera_axis_reversal')).toBe(true);
  });

  it('warns when an identity-locked subject disappears inside an identity continuity span', () => {
    const spec = validBase();
    const subject = createEmptySubject({ id: 'subject-1' }); subject.label = 'Hero'; spec.subjects = [subject];
    spec.scenes[0].shots[0].subjectIds = ['subject-1'];
    const second = createEmptyShot({ id: 'shot-2', order: 2 }); second.startSecond = 5; second.endSecond = 10; second.action = 'Camera continues.';
    spec.scenes[0].shots.push(second);
    spec.continuityRules.push({ id: 'rule-1', ruleType: 'identity', subjectId: 'subject-1', description: 'Hero remains present.', startShotId: spec.scenes[0].shots[0].id, endShotId: 'shot-2', severity: 'warning' });
    expect(validateProductionSpec(spec).issues.some(i => i.code === 'identity_subject_missing')).toBe(true);
  });

  it('blocks exact positive versus blocking negative conflicts only deterministically', () => {
    const spec = validBase();
    spec.scenes[0].shots[0].lighting = 'cyan light';
    spec.negativeConstraints.push({ id: 'neg-1', scope: 'production', value: ' CYAN LIGHT ', severity: 'blocking' });
    expect(validateProductionSpec(spec).issues.some(i => i.code === 'negative_constraint_conflict')).toBe(true);
  });

  it('blocks a provider that is not ready and provider duration overflow', () => {
    const spec = validBase();
    const result = validateProductionSpec(spec, capability({ connectionState: 'configured-unverified', maxDurationSeconds: 5 }));
    expect(result.issues.some(i => i.code === 'provider_not_ready')).toBe(true);
    expect(result.issues.some(i => i.code === 'provider_duration_unsupported')).toBe(true);
  });

  it('warns on unsupported audio and blocks reference limits', () => {
    const spec = validBase();
    const subject = createEmptySubject({ id: 'subject-1' }); subject.referenceAssetIds = ['img-1', 'img-2']; spec.subjects = [subject];
    spec.audioPlan.voiceReferenceAssetIds = ['audio-1', 'audio-2'];
    const result = validateProductionSpec(spec, capability({ audioSupport: false, maxImageReferences: 1, maxAudioReferences: 1 }));
    expect(result.issues.some(i => i.code === 'provider_audio_unsupported')).toBe(true);
    expect(result.issues.some(i => i.code === 'provider_image_reference_limit')).toBe(true);
    expect(result.issues.some(i => i.code === 'provider_audio_reference_limit')).toBe(true);
  });
});
