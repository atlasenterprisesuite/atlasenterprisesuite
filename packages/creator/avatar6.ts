/**
 * Provider-neutral preparation and fail-closed submission contract for HeyGen Avatar 6.
 *
 * This file makes no network requests. Production callers MUST derive all release-gate
 * facts from trusted server-side identity, provider and billing systems; browser
 * booleans and uploaded metadata are not evidence of verified likeness consent.
 */
export type Avatar6Engine = 'turbo' | 'pro';
export type Avatar6AspectRatio = 'auto' | '16:9' | '9:16' | '1:1' | '4:5' | '5:4';

export type Avatar6HandoffInput = {
  title: string;
  script: string;
  engine: Avatar6Engine;
  aspectRatio: Avatar6AspectRatio;
  language: 'es' | 'en';
  motionPrompt?: string;
};

export type Avatar6Handoff = {
  schemaVersion: 1;
  provider: 'heygen';
  endpoint: 'POST /v3/videos';
  engine: 'heygen-avatar-6-turbo' | 'heygen-avatar-6';
  title: string;
  script: string;
  aspectRatio: Avatar6AspectRatio;
  language: 'es' | 'en';
  motionPrompt: string | null;
  accessibility: { captions: 'srt'; transcript: 'script'; discloseAiPresenter: true };
  readiness: 'handoff-only';
};

export type Avatar6TrustedGate = {
  identityAuthorized: boolean;
  creatorPermissionVerified: boolean;
  sameTenantAvatarVerified: boolean;
  providerConsentVerified: boolean;
  providerReady: boolean;
  budgetApprovedForThisRender: boolean;
  idempotencyReservationVerified: boolean;
};

const ENGINES: Record<Avatar6Engine, Avatar6Handoff['engine']> = {
  turbo: 'heygen-avatar-6-turbo',
  pro: 'heygen-avatar-6'
};

const RATIOS: readonly Avatar6AspectRatio[] = ['auto', '16:9', '9:16', '1:1', '4:5', '5:4'];

export function compileAvatar6Handoff(input: Avatar6HandoffInput): Avatar6Handoff {
  if (!input || typeof input.script !== 'string' || input.script.trim().length < 3 || input.script.length > 10000) {
    throw new Error('avatar6_script_invalid');
  }
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 140) {
    throw new Error('avatar6_title_invalid');
  }
  if (input.engine !== 'turbo' && input.engine !== 'pro') throw new Error('avatar6_engine_invalid');
  if (!RATIOS.includes(input.aspectRatio)) throw new Error('avatar6_aspect_ratio_invalid');
  if (input.language !== 'es' && input.language !== 'en') throw new Error('avatar6_language_invalid');
  if (input.motionPrompt !== undefined && (typeof input.motionPrompt !== 'string' || input.motionPrompt.length > 500)) {
    throw new Error('avatar6_motion_invalid');
  }

  return {
    schemaVersion: 1,
    provider: 'heygen',
    endpoint: 'POST /v3/videos',
    engine: ENGINES[input.engine],
    title: input.title.trim(),
    script: input.script, // preserve exact supplied words
    aspectRatio: input.aspectRatio,
    language: input.language,
    motionPrompt: input.motionPrompt?.trim() || null,
    accessibility: { captions: 'srt', transcript: 'script', discloseAiPresenter: true },
    readiness: 'handoff-only' // NEVER infer a live connection from this object
  };
}

export function avatar6RenderBlockers(gate: Avatar6TrustedGate): string[] {
  const checks: Array<[keyof Avatar6TrustedGate, string]> = [
    ['identityAuthorized', 'identity_authorization_required'],
    ['creatorPermissionVerified', 'creator_generate_permission_required'],
    ['sameTenantAvatarVerified', 'tenant_scoped_avatar_required'],
    ['providerConsentVerified', 'provider_verified_consent_required'],
    ['providerReady', 'heygen_provider_not_verified'],
    ['budgetApprovedForThisRender', 'per_render_spend_approval_required'],
    ['idempotencyReservationVerified', 'idempotency_reservation_required']
  ];
  return checks.filter(([key]) => gate[key] !== true).map(([, error]) => error);
}

/**
 * Only call in a trusted server context AFTER verifying the provider's consent state,
 * organization ownership, spend approval, and a durable idempotency reservation.
 * Compilation never submits to HeyGen and never implies a completed render.
 */
export function buildAvatar6V3Request(handoff: Avatar6Handoff, avatarLookId: string, gate: Avatar6TrustedGate) {
  const blockers = avatar6RenderBlockers(gate);
  if (blockers.length) throw new Error(blockers.join(','));
  if (handoff?.provider !== 'heygen' || handoff?.readiness !== 'handoff-only') {
    throw new Error('avatar6_handoff_invalid');
  }
  if (typeof avatarLookId !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(avatarLookId)) {
    throw new Error('avatar6_avatar_id_invalid');
  }
  return {
    type: 'avatar' as const,
    avatar_id: avatarLookId,
    title: handoff.title,
    script: handoff.script,
    aspect_ratio: handoff.aspectRatio,
    engine: { type: handoff.engine },
    ...(handoff.motionPrompt ? { motion_prompt: handoff.motionPrompt } : {}),
    caption: { file_format: 'srt' as const },
    output_format: 'mp4' as const
  };
}
