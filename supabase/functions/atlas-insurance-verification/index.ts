import {
  canResend,
  challengeState,
  nextAttemptState,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS
} from '../../../packages/insurance/verification.ts';
import type { InsuranceVerificationScope } from '../../../packages/insurance/types.ts';
import { resolveInsuranceContext, type InsuranceRequestContext } from './_shared/context.ts';
import { generateVerificationCode, hashVerificationCode, verifyVerificationCode } from './_shared/crypto.ts';
import { deliverVerificationCode, maskEmail } from './_shared/delivery.ts';
import { errorResponse, insuranceError, normalizeInsuranceError, json, optionsResponse } from './_shared/errors.ts';
import {
  consumeChallengeAndCreateGrant,
  createChallenge,
  deleteChallenge,
  loadChallenge,
  registerFailedAttempt,
  restoreChallengeRotation,
  rotateChallenge,
  type ChallengeRecord,
  writeInsuranceAudit
} from './_shared/repository.ts';

function clean(value: unknown, max = 256) {
  return String(value ?? '').trim().slice(0, max);
}

async function parseBody(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_request');
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_request') throw insuranceError('invalid_request', 400);
    throw insuranceError('invalid_request', 400);
  }
}

function parseScope(body: Record<string, unknown>) {
  const raw = clean(body.scope, 40);
  if (raw !== 'insurance_access' && raw !== 'member_policy') throw insuranceError('invalid_scope', 422);
  const scope = raw as InsuranceVerificationScope;
  const suppliedResource = body.resource_id == null ? '' : clean(body.resource_id, 256);

  if (scope === 'insurance_access') {
    if (suppliedResource) throw insuranceError('invalid_resource', 422);
    return { scope, resourceId: null };
  }

  if (!suppliedResource || suppliedResource.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(suppliedResource)) {
    throw insuranceError('invalid_resource', 422);
  }
  return { scope, resourceId: suppliedResource };
}

function challengeId(body: Record<string, unknown>) {
  const id = clean(body.challenge_id, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw insuranceError('invalid_resource', 422);
  }
  return id;
}

function ensureUsableChallenge(challenge: ChallengeRecord) {
  const state = challengeState({
    now: new Date(),
    expiresAt: new Date(challenge.expires_at),
    consumedAt: challenge.consumed_at ? new Date(challenge.consumed_at) : null,
    attemptCount: Number(challenge.attempt_count)
  });
  if (state === 'expired') throw insuranceError('challenge_expired', 410);
  if (state === 'consumed') throw insuranceError('challenge_consumed', 409);
  if (state === 'locked') throw insuranceError('challenge_locked', 423);
}

function safeChallengeResponse(challenge: ChallengeRecord) {
  return {
    ok: true as const,
    challenge_id: challenge.id,
    scope: challenge.scope,
    resource_id: challenge.resource_id,
    delivery_channel: challenge.delivery_channel,
    delivery_target_masked: challenge.delivery_target_masked,
    expires_at: challenge.expires_at,
    resend_available_at: new Date(new Date(challenge.last_sent_at).getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000).toISOString()
  };
}

async function auditDeliveryFailure(ctx: InsuranceRequestContext, challenge: ChallengeRecord, error: unknown) {
  const normalized = normalizeInsuranceError(error);
  const action = normalized.code === 'delivery_not_configured'
    ? 'delivery_configuration_failure'
    : 'delivery_failure';
  try {
    await writeInsuranceAudit(ctx.admin, {
      orgId: ctx.orgId,
      userId: ctx.userId,
      challengeId: challenge.id,
      scope: challenge.scope,
      resourceId: challenge.resource_id,
      action,
      errorCode: normalized.code
    });
  } catch {
    // Preserve the original delivery error; failed audit is not a reason to expose OTP material.
  }
}

async function issue(ctx: InsuranceRequestContext, body: Record<string, unknown>) {
  const { scope, resourceId } = parseScope(body);
  const id = crypto.randomUUID();
  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(id, code);
  const now = new Date();
  const target = maskEmail(ctx.email);
  const challenge = await createChallenge(ctx.admin, {
    id,
    org_id: ctx.orgId,
    user_id: ctx.userId,
    scope,
    resource_id: resourceId,
    code_hash: codeHash,
    delivery_channel: 'email',
    delivery_target_masked: target,
    expires_at: new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString(),
    attempt_count: 0,
    resend_count: 0,
    last_sent_at: now.toISOString()
  });

  try {
    await deliverVerificationCode({ email: ctx.email, code, expiresInSeconds: OTP_TTL_SECONDS });
  } catch (error) {
    await auditDeliveryFailure(ctx, challenge, error);
    try { await deleteChallenge(ctx.admin, ctx.orgId, ctx.userId, challenge.id); } catch { /* cleanup is best effort */ }
    throw error;
  }

  await writeInsuranceAudit(ctx.admin, {
    orgId: ctx.orgId,
    userId: ctx.userId,
    challengeId: challenge.id,
    scope,
    resourceId,
    action: 'issue'
  });
  return safeChallengeResponse(challenge);
}

async function verify(ctx: InsuranceRequestContext, body: Record<string, unknown>) {
  const id = challengeId(body);
  const code = clean(body.code, 16);
  if (!/^\d{6}$/.test(code)) throw insuranceError('invalid_code_format', 422);

  const challenge = await loadChallenge(ctx.admin, ctx.orgId, ctx.userId, id);
  ensureUsableChallenge(challenge);
  const valid = await verifyVerificationCode(challenge.id, code, challenge.code_hash);

  if (!valid) {
    const next = nextAttemptState(challenge.attempt_count);
    const updated = await registerFailedAttempt(ctx.admin, challenge, next.attemptCount);
    const locked = Number(updated.attempt_count) >= 5;
    await writeInsuranceAudit(ctx.admin, {
      orgId: ctx.orgId,
      userId: ctx.userId,
      challengeId: challenge.id,
      scope: challenge.scope,
      resourceId: challenge.resource_id,
      action: locked ? 'lockout' : 'verify_failure',
      errorCode: locked ? 'challenge_locked' : 'invalid_code'
    });
    if (locked) throw insuranceError('challenge_locked', 423);
    throw insuranceError('invalid_code', 422);
  }

  const grant = await consumeChallengeAndCreateGrant(ctx.admin, challenge);
  await writeInsuranceAudit(ctx.admin, {
    orgId: ctx.orgId,
    userId: ctx.userId,
    challengeId: challenge.id,
    scope: challenge.scope,
    resourceId: challenge.resource_id,
    action: 'verify_success'
  });
  return { ok: true as const, grant };
}

async function resend(ctx: InsuranceRequestContext, body: Record<string, unknown>) {
  const id = challengeId(body);
  const challenge = await loadChallenge(ctx.admin, ctx.orgId, ctx.userId, id);
  ensureUsableChallenge(challenge);

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(challenge.last_sent_at).getTime()) / 1000));
  const decision = canResend({ elapsedSeconds, resendCount: Number(challenge.resend_count) });
  if (!decision.allowed) {
    if (decision.reason === 'resend_cooldown') {
      throw insuranceError('resend_cooldown', 429, Math.max(1, OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds));
    }
    throw insuranceError('resend_limit_reached', 429);
  }

  const code = generateVerificationCode();
  const codeHash = await hashVerificationCode(challenge.id, code);
  const now = new Date();
  const rotated = await rotateChallenge(ctx.admin, challenge, {
    codeHash,
    deliveryTargetMasked: maskEmail(ctx.email),
    expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString(),
    lastSentAt: now.toISOString(),
    resendCount: Number(challenge.resend_count) + 1
  });

  if (!rotated) {
    const latest = await loadChallenge(ctx.admin, ctx.orgId, ctx.userId, id);
    ensureUsableChallenge(latest);
    const latestElapsed = Math.max(0, Math.floor((Date.now() - new Date(latest.last_sent_at).getTime()) / 1000));
    const latestDecision = canResend({ elapsedSeconds: latestElapsed, resendCount: Number(latest.resend_count) });
    if (!latestDecision.allowed && latestDecision.reason === 'resend_limit_reached') throw insuranceError('resend_limit_reached', 429);
    throw insuranceError('resend_cooldown', 429, Math.max(1, OTP_RESEND_COOLDOWN_SECONDS - latestElapsed));
  }

  try {
    await deliverVerificationCode({ email: ctx.email, code, expiresInSeconds: OTP_TTL_SECONDS });
  } catch (error) {
    try { await restoreChallengeRotation(ctx.admin, challenge, rotated); } catch { /* preserve delivery error */ }
    await auditDeliveryFailure(ctx, rotated, error);
    throw error;
  }

  await writeInsuranceAudit(ctx.admin, {
    orgId: ctx.orgId,
    userId: ctx.userId,
    challengeId: rotated.id,
    scope: rotated.scope,
    resourceId: rotated.resource_id,
    action: 'resend'
  });
  return safeChallengeResponse(rotated);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return optionsResponse(origin);
  if (req.method !== 'POST') return errorResponse(insuranceError('invalid_request', 405), origin);

  try {
    const body = await parseBody(req);
    const operation = clean(body.operation, 24);
    const ctx = await resolveInsuranceContext(req);

    let response: unknown;
    if (operation === 'issue') response = await issue(ctx, body);
    else if (operation === 'verify') response = await verify(ctx, body);
    else if (operation === 'resend') response = await resend(ctx, body);
    else throw insuranceError('invalid_request', 400);

    return json(response, 200, origin);
  } catch (error) {
    return errorResponse(error, origin);
  }
});
