import { describe, expect, it, vi } from 'vitest';
import { createHumanVerificationHold, evaluateHumanVerificationResume } from '../../packages/execution/src/human-verification-handoff';
import type { BrowserExecutionEnvelope } from '../../packages/execution/src/browser-envelope';
import type { BrowserAction } from '../../packages/execution/src/browser-executor';

const at = new Date('2026-11-07T15:00:00.000Z');
const envelope: BrowserExecutionEnvelope = {
  workflowId: 'workflow-1', stepId: 'step-1', tenantId: 'tenant-1', organizationId: 'org-1',
  allowedDomains: ['secure.indeed.com'], allowedActions: ['navigate'], deniedActions: ['submit'],
  autonomyLevel: 'guided', expiresAt: '2026-11-07T15:30:00.000Z'
};
const action: BrowserAction = { type: 'navigate', domain: 'secure.indeed.com', target: '/account/login' };
const challenge = { state: 'failed' as const, result: { title: 'Additional Verification Required', cookie: 'NEVER_LOG' } };

async function makeHold() {
  const hold = await createHumanVerificationHold({ envelope, action, result: challenge, now: at, id: 'hold-0001' });
  if (!hold) throw new Error('missing_hold');
  return hold;
}

function trustedVerifier(hold: Awaited<ReturnType<typeof makeHold>>) {
  return vi.fn(async () => ({
    status: 'verified' as const, evidenceId: 'provider-evidence-123', checkedAt: '2026-11-07T15:01:00.000Z',
    domain: hold.domain, workflowId: hold.workflowId, stepId: hold.stepId,
    tenantId: hold.tenantId, organizationId: hold.organizationId
  }));
}

async function resume(overrides: Record<string, unknown> = {}) {
  const hold = await makeHold();
  return evaluateHumanVerificationResume({
    hold, envelope, action, now: new Date('2026-11-07T15:02:00Z'),
    authorizeActor: async () => true, verifyProviderSession: trustedVerifier(hold),
    consumeHold: async () => true, ...overrides
  });
}

describe('ATLAS human verification handoff (fail closed)', () => {
  it('pauses on an Indeed security challenge without retaining cookies or page content', async () => {
    const hold = await makeHold();
    expect(hold.state).toBe('waiting_human');
    expect(hold.domain).toBe('secure.indeed.com');
    expect(JSON.stringify(hold)).not.toMatch(/NEVER_LOG|cookie|account\/login/i);
  });

  it('recognizes native waiting_human but does not hold ordinary successful browsing', async () => {
    expect(await createHumanVerificationHold({ envelope, action, now: at,
      result: { state: 'waiting_human', result: {} } })).not.toBeNull();
    expect(await createHumanVerificationHold({ envelope, action, now: at,
      result: { state: 'completed', result: { page: 'dashboard' } } })).toBeNull();
  });

  it('denies out-of-envelope actions and credentialed domains before creating a hold', async () => {
    await expect(createHumanVerificationHold({ envelope, action: { ...action, domain: 'evil.indeed.com' },
      result: challenge, now: at })).rejects.toThrow('verification_hold_scope_denied');
    await expect(createHumanVerificationHold({ envelope, action: { ...action, domain: 'secure.indeed.com@evil.test' },
      result: challenge, now: at })).rejects.toThrow('verification_hold_scope_denied');
  });

  it('releases only a trusted exact-scope check and still requires full policy revalidation', async () => {
    expect(await resume()).toEqual({ state: 'ready_for_policy_revalidation', reason: 'provider_session_verified',
      evidenceId: 'provider-evidence-123' });
  });

  it('does not treat a human acknowledgement as trusted provider evidence', async () => {
    expect(await resume({ verifyProviderSession: async () => ({ status: 'verified' }) })).toMatchObject({
      state: 'blocked', reason: 'trusted_provider_verification_missing'
    });
  });

  it('prevents altered action, cross-tenant and expired hold resumes', async () => {
    expect(await resume({ action: { ...action, target: '/other' } })).toMatchObject({ state: 'blocked', reason: 'verification_action_changed' });
    expect(await resume({ envelope: { ...envelope, tenantId: 'another-tenant' } })).toMatchObject({ state: 'blocked', reason: 'verification_scope_or_policy_denied' });
    expect(await resume({ now: new Date('2026-11-07T15:31:00Z') })).toMatchObject({ state: 'blocked', reason: 'verification_hold_expired_or_invalid' });
  });

  it('denies revoked authorization, unverified sessions and failed atomic consume', async () => {
    expect(await resume({ authorizeActor: async () => false })).toMatchObject({ state: 'blocked', reason: 'actor_not_authorized' });
    expect(await resume({ verifyProviderSession: async () => ({ status: 'unverified' }) })).toMatchObject({ state: 'blocked' });
    expect(await resume({ consumeHold: async () => false })).toMatchObject({ state: 'blocked', reason: 'verification_hold_not_consumed' });
  });

  it('fails closed on unavailable auth, provider or store', async () => {
    expect(await resume({ verifyProviderSession: async () => { throw new Error('offline'); } })).toMatchObject({ state: 'blocked', reason: 'verification_dependency_unavailable' });
  });

  it('blocks a stale verification proof even if it claims success', async () => {
    const hold = await makeHold();
    expect(await resume({ verifyProviderSession: async () => ({
      ...await trustedVerifier(hold)(), checkedAt: '2026-11-07T14:59:00.000Z'
    }) })).toMatchObject({ state: 'blocked', reason: 'trusted_provider_verification_missing' });
  });
});
