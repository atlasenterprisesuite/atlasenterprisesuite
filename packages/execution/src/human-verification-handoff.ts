import { digestApprovalPayload } from './approvals';
import { evaluateBrowserAction, type BrowserExecutionEnvelope } from './browser-envelope';
import type { BrowserAction, BrowserActionResult } from './browser-executor';

/**
 * Policy-only browser verification handoff. This module NEVER solves CAPTCHAs,
 * transfers cookies, authenticates a user or executes browser actions.
 * Callbacks MUST be server-controlled; neither proof nor a hold is authority by itself.
 */
export type HumanVerificationHold = Readonly<{
  id: string;
  state: 'waiting_human';
  workflowId: string;
  stepId: string;
  tenantId: string;
  organizationId: string;
  domain: string;
  actionDigest: string;
  reason: 'browser_verification_required';
  createdAt: string;
  expiresAt: string;
}>;

export type ProviderVerificationEvidence = Readonly<{
  status: 'verified' | 'unverified';
  evidenceId?: string;
  checkedAt?: string;
  domain?: string;
  workflowId?: string;
  stepId?: string;
  tenantId?: string;
  organizationId?: string;
}>;

export type HandoffDecision =
  | { state: 'blocked'; reason: string }
  | { state: 'ready_for_policy_revalidation'; reason: 'provider_session_verified'; evidenceId: string };

const CHALLENGE_TEXT = /additional verification required|human verification|verify you are human|captcha|cf-mitigated.{0,30}challenge|security check required/i;
const MAX_HOLD_MS = 30 * 60 * 1000;

function hostname(value: string): string | null {
  const clean = value.trim().toLowerCase().replace(/\.$/, '');
  // Accept hostnames only; prevent credentialed URLs, paths, ports, wildcards and embedded origins.
  if (!clean || clean.length > 253 || !/^[a-z0-9.-]+$/.test(clean) || clean.includes('..')) return null;
  return clean;
}

function validTime(value: string | Date): number | null {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function checkEnvelope(envelope: BrowserExecutionEnvelope, action: BrowserAction, now: Date): boolean {
  return evaluateBrowserAction(
    envelope,
    { domain: action.domain, action: action.type },
    now,
    { workflowId: envelope.workflowId, stepId: envelope.stepId }
  ).allowed;
}

function isVerificationChallenge(result: BrowserActionResult): boolean {
  if (result.state === 'waiting_human') return true;
  const details = result.result;
  if (typeof details === 'string') return CHALLENGE_TEXT.test(details.slice(0, 5000));
  if (!details || typeof details !== 'object') return false;
  const record = details as Record<string, unknown>;
  return ['error', 'message', 'title', 'statusText', 'pageText', 'challenge']
    .some((key) => typeof record[key] === 'string' && CHALLENGE_TEXT.test(String(record[key]).slice(0, 5000)));
}

async function digestAction(envelope: BrowserExecutionEnvelope, action: BrowserAction): Promise<string> {
  // Hash binds the exact action including its value, without persisting the value.
  return digestApprovalPayload({
    workflowId: envelope.workflowId,
    stepId: envelope.stepId,
    tenantId: envelope.tenantId,
    organizationId: envelope.organizationId,
    action
  });
}

/** Create a hold for a detected challenge; store it in a tenant-isolated durable store. */
export async function createHumanVerificationHold(input: {
  envelope: BrowserExecutionEnvelope;
  action: BrowserAction;
  result: BrowserActionResult;
  now?: Date;
  id?: string;
}): Promise<HumanVerificationHold | null> {
  if (!isVerificationChallenge(input.result)) return null;
  const now = input.now ?? new Date();
  const nowMs = validTime(now);
  const expiresMs = validTime(input.envelope.expiresAt);
  const domain = hostname(input.action.domain);
  if (nowMs === null || expiresMs === null || !domain || !checkEnvelope(input.envelope, input.action, now)) {
    throw new Error('verification_hold_scope_denied');
  }
  if (!input.envelope.workflowId || !input.envelope.stepId || !input.envelope.tenantId || !input.envelope.organizationId) {
    throw new Error('verification_hold_identity_required');
  }
  const expiresAtMs = Math.min(expiresMs, nowMs + MAX_HOLD_MS);
  if (expiresAtMs <= nowMs) throw new Error('verification_hold_expired');
  const id = input.id ?? crypto.randomUUID();
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(id)) throw new Error('verification_hold_id_invalid');
  return Object.freeze({
    id,
    state: 'waiting_human',
    workflowId: input.envelope.workflowId,
    stepId: input.envelope.stepId,
    tenantId: input.envelope.tenantId,
    organizationId: input.envelope.organizationId,
    domain,
    actionDigest: await digestAction(input.envelope, input.action),
    reason: 'browser_verification_required',
    createdAt: new Date(nowMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString()
  });
}

/**
 * Returns readiness to repeat the normal policy evaluation, NOT permission to
 * execute. The service must supply authenticated, trusted callbacks and atomically
 * consume the hold in tenant-isolated storage. Client-supplied proof is invalid.
 */
export async function evaluateHumanVerificationResume(input: {
  hold: HumanVerificationHold;
  envelope: BrowserExecutionEnvelope;
  action: BrowserAction;
  now?: Date;
  authorizeActor: (hold: HumanVerificationHold) => Promise<boolean>;
  verifyProviderSession: (hold: HumanVerificationHold) => Promise<ProviderVerificationEvidence>;
  consumeHold: (id: string, digest: string) => Promise<boolean>;
}): Promise<HandoffDecision> {
  const { hold, envelope, action } = input;
  const now = input.now ?? new Date();
  const nowMs = validTime(now);
  const startMs = validTime(hold.createdAt);
  const expiresMs = validTime(hold.expiresAt);
  const envelopeExpiresMs = validTime(envelope.expiresAt);
  if (nowMs === null || startMs === null || expiresMs === null || envelopeExpiresMs === null ||
      nowMs < startMs || nowMs >= expiresMs || nowMs >= envelopeExpiresMs ||
      expiresMs - startMs > MAX_HOLD_MS || hold.state !== 'waiting_human') {
    return { state: 'blocked', reason: 'verification_hold_expired_or_invalid' };
  }
  if (!hostname(action.domain) || hostname(action.domain) !== hold.domain ||
      hold.workflowId !== envelope.workflowId || hold.stepId !== envelope.stepId ||
      hold.tenantId !== envelope.tenantId || hold.organizationId !== envelope.organizationId ||
      !checkEnvelope(envelope, action, now)) {
    return { state: 'blocked', reason: 'verification_scope_or_policy_denied' };
  }
  try {
    if (await digestAction(envelope, action) !== hold.actionDigest) {
      return { state: 'blocked', reason: 'verification_action_changed' };
    }
    if (!await input.authorizeActor(hold)) return { state: 'blocked', reason: 'actor_not_authorized' };
    const evidence = await input.verifyProviderSession(hold);
    const checkedMs = evidence.checkedAt ? validTime(evidence.checkedAt) : null;
    if (evidence.status !== 'verified' || !evidence.evidenceId || checkedMs === null ||
        checkedMs < startMs || checkedMs > nowMs ||
        evidence.domain !== hold.domain || evidence.workflowId !== hold.workflowId ||
        evidence.stepId !== hold.stepId || evidence.tenantId !== hold.tenantId ||
        evidence.organizationId !== hold.organizationId) {
      return { state: 'blocked', reason: 'trusted_provider_verification_missing' };
    }
    // Persistent compare-and-set MUST be single-use; false on a replay/concurrent resume.
    if (!await input.consumeHold(hold.id, hold.actionDigest)) {
      return { state: 'blocked', reason: 'verification_hold_not_consumed' };
    }
    return { state: 'ready_for_policy_revalidation', reason: 'provider_session_verified', evidenceId: evidence.evidenceId };
  } catch {
    // Broken auth provider, verifier or backing store must never release a hold.
    return { state: 'blocked', reason: 'verification_dependency_unavailable' };
  }
}
