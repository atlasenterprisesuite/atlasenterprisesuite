import { describe, expect, it } from 'vitest';
import {
  avatar6RenderBlockers,
  buildAvatar6V3Request,
  compileAvatar6Handoff,
  type Avatar6HandoffInput,
  type Avatar6TrustedGate
} from '../../packages/creator/avatar6';

const draft: Avatar6HandoffInput = {
  title: 'ATLAS launch',
  script: 'Hola, soy un presentador virtual de ATLAS. Este video usa inteligencia artificial.',
  engine: 'turbo',
  aspectRatio: '9:16',
  language: 'es',
  motionPrompt: 'Calm delivery with natural, occasional open-hand gestures.'
};
const trustedGate: Avatar6TrustedGate = {
  identityAuthorized: true,
  creatorPermissionVerified: true,
  sameTenantAvatarVerified: true,
  providerConsentVerified: true,
  providerReady: true,
  budgetApprovedForThisRender: true,
  idempotencyReservationVerified: true
};

describe('ATLAS Avatar 6 governed handoff', () => {
  it('preserves the exact original script and keeps the result planning-only', () => {
    const original = '  Primera línea.\nSegunda línea.  ';
    const result = compileAvatar6Handoff({ ...draft, script: original });
    expect(result.script).toBe(original);
    expect(result.readiness).toBe('handoff-only');
    expect(result.accessibility).toEqual({ captions: 'srt', transcript: 'script', discloseAiPresenter: true });
    expect(JSON.stringify(result)).not.toContain('x-api-key');
  });

  it('rejects an empty script, unsupported engine, unsupported language and excessive motion', () => {
    expect(() => compileAvatar6Handoff({ ...draft, script: '  ' })).toThrow('avatar6_script_invalid');
    expect(() => compileAvatar6Handoff({ ...draft, engine: 'not-a-model' as 'turbo' })).toThrow('avatar6_engine_invalid');
    expect(() => compileAvatar6Handoff({ ...draft, language: 'fr' as 'es' })).toThrow('avatar6_language_invalid');
    expect(() => compileAvatar6Handoff({ ...draft, motionPrompt: 'x'.repeat(501) })).toThrow('avatar6_motion_invalid');
  });

  it('fails closed when the trust boundary is not verified', () => {
    const gate: Avatar6TrustedGate = {
      ...trustedGate,
      providerConsentVerified: false,
      sameTenantAvatarVerified: false,
      budgetApprovedForThisRender: false
    };
    expect(avatar6RenderBlockers(gate)).toEqual([
      'tenant_scoped_avatar_required',
      'provider_verified_consent_required',
      'per_render_spend_approval_required'
    ]);
    expect(() => buildAvatar6V3Request(compileAvatar6Handoff(draft), 'look_123', gate))
      .toThrow('tenant_scoped_avatar_required');
  });

  it('enforces a durable reservation and provider proof before any paid render', () => {
    expect(avatar6RenderBlockers({ ...trustedGate, idempotencyReservationVerified: false }))
      .toContain('idempotency_reservation_required');
    expect(avatar6RenderBlockers({ ...trustedGate, providerReady: false }))
      .toContain('heygen_provider_not_verified');
  });

  it('compiles only a v3 avatar request with captions and approved motion parameters', () => {
    const handoff = compileAvatar6Handoff(draft);
    expect(buildAvatar6V3Request(handoff, 'look_123', trustedGate)).toEqual({
      type: 'avatar',
      avatar_id: 'look_123',
      title: 'ATLAS launch',
      script: draft.script,
      aspect_ratio: '9:16',
      engine: { type: 'heygen-avatar-6-turbo' },
      motion_prompt: draft.motionPrompt,
      caption: { file_format: 'srt' },
      output_format: 'mp4'
    });
    expect(buildAvatar6V3Request(compileAvatar6Handoff({ ...draft, engine: 'pro', motionPrompt: '' }), 'look_123', trustedGate))
      .toMatchObject({ engine: { type: 'heygen-avatar-6' } });
    expect(() => buildAvatar6V3Request(handoff, '', trustedGate)).toThrow('avatar6_avatar_id_invalid');
  });
});
