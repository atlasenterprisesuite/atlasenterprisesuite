import { describe, expect, it } from 'vitest';
import {
  VIDEO_MODES, VIDEO_PROVIDERS, catalogVideoCandidates, compileVideoUniverseDraft,
  type VideoUniverseDraftInput
} from '../../packages/creator/video_universe';

const input: VideoUniverseDraftInput = {
  mode: 'timeline-edit',
  providerId: 'atlas-native',
  title: 'ATLAS Enterprise video',
  brief: 'Preserve the real interface and animate accurate screenshots.',
  language: 'es',
  aspectRatio: '9:16',
  sourceAssetIds: ['asset_123'],
  subtitles: true,
  transcript: true,
  rightsVerified: false
};

describe('ATLAS Video Universe provider-neutral production planning', () => {
  it('offers broad workflow coverage without duplicate catalog identifiers', () => {
    expect(VIDEO_MODES.length).toBeGreaterThanOrEqual(12);
    expect(VIDEO_PROVIDERS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(VIDEO_MODES.map(x => x.id)).size).toBe(VIDEO_MODES.length);
    expect(new Set(VIDEO_PROVIDERS.map(x => x.id)).size).toBe(VIDEO_PROVIDERS.length);
    expect(VIDEO_PROVIDERS.every(x => x.modes.length > 0 && Boolean(x.reference))).toBe(true);
  });

  it('preserves the exact authored brief, records synthetic disclosure, and never submits', () => {
    const exact = '  Original prompt, exact wording.\nSecond line.  ';
    const plan = compileVideoUniverseDraft({ ...input, brief: exact });
    expect(plan.creativeBrief).toBe(exact);
    expect(plan.status).toBe('planning-only');
    expect(plan.submitted).toBe(false);
    expect(plan.accessibility).toMatchObject({ subtitles: true, transcript: true, discloseSyntheticContent: true });
    expect(plan.canonicalStudioRoute).toBe('/studio/create?type=video');
  });

  it('records consent and tenant/budget/idempotency boundaries for likeness modes', () => {
    const plan = compileVideoUniverseDraft({ ...input, mode: 'avatar-presenter', providerId: 'heygen', sourceAssetIds: [] });
    expect(plan.approvals.consentVerified).toBe(false);
    expect(plan.approvals.spendAuthorized).toBe(false);
    expect(plan.pendingRenderGates).toContain('verified_subject_or_voice_consent_required_before_render');
    expect(plan.pendingRenderGates).toContain('approved_source_media_required_before_render');
    expect(plan.pendingRenderGates).toContain('server_identity_tenant_rbac_provider_budget_and_idempotency_gates_required');
  });

  it('does not confuse a checked rights box with verified downstream permission', () => {
    const plan = compileVideoUniverseDraft({ ...input, rightsVerified: true });
    expect(plan.approvals.rightsMarkedReviewedInDraft).toBe(true);
    expect(plan.pendingRenderGates).toContain('server_identity_tenant_rbac_provider_budget_and_idempotency_gates_required');
  });

  it('blocks unsupported provider-mode combinations', () => {
    expect(() => compileVideoUniverseDraft({ ...input, providerId: 'veo', mode: 'avatar-presenter' }))
      .toThrow('video_provider_unsupported_mode');
  });

  it('rejects invalid titles, prompts, languages, aspect ratios and unknown asset refs', () => {
    expect(() => compileVideoUniverseDraft({ ...input, title: '' })).toThrow('video_title_invalid');
    expect(() => compileVideoUniverseDraft({ ...input, brief: 'few' })).toThrow('video_brief_invalid');
    expect(() => compileVideoUniverseDraft({ ...input, language: 'de' as 'en' })).toThrow('video_language_invalid');
    expect(() => compileVideoUniverseDraft({ ...input, aspectRatio: '21:9' as '9:16' })).toThrow('video_aspect_invalid');
    expect(() => compileVideoUniverseDraft({ ...input, sourceAssetIds: ['invalid asset'] })).toThrow('video_asset_reference_invalid');
  });

  it('keeps external generators non-executable even with a reported provider-ready signal', () => {
    const candidates = catalogVideoCandidates('cinematic', [
      { providerId: 'seedance', connectionState: 'ready', lastVerifiedAt: '2026-11-17T21:00:00Z' }
    ]);
    const candidate = candidates.find(item => item.id === 'seedance');
    expect(candidate?.runtimeObservation).toBe('provider-readiness-reported');
    expect(candidate?.executableFromFoundry).toBe(false);
    expect(candidates.every(item => item.executableFromFoundry === false)).toBe(true);
  });

  it('does not equate native runtime readiness with bypassing Director generation gates', () => {
    const native = catalogVideoCandidates('timeline-edit', [], true).find(x => x.id === 'atlas-native');
    expect(native?.runtimeObservation).toBe('native-runtime-reported-ready');
    expect(native?.executableFromFoundry).toBe(false);
  });

  it('returns independent canonical routes and never includes accounts or credentials', () => {
    const serialized = JSON.stringify(compileVideoUniverseDraft(input));
    expect(serialized).not.toMatch(/api_key|access_token|Bearer|secret/i);
    expect(serialized).toContain('"providerIntegration":"existing-atlas-runtime"');
  });
});
