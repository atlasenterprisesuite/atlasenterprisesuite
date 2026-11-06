import { describe, expect, it } from 'vitest';
import { prepareManusV2Dispatch } from '../../apps/atlas-orchestrator/src/providers/manus-v2';

const base = {
  requestId: 'request-1',
  taskId: 'task-1',
  idempotencyKey: 'tenant-a:task-1:source-1',
  actorScope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  taskScope: { tenantId: 'tenant-a', organizationId: 'org-a' },
  sourceSha: 'a'.repeat(40),
  approvedSha: 'a'.repeat(40),
  prompt: 'Summarize public project documentation without accessing external accounts.',
  requestedCapabilities: ['research.readonly'],
  grantedCapabilities: ['research.readonly'],
  grantedPermissions: ['execution.delegate.manus'],
  approved: true,
  providerEnabled: true,
  budgetApproved: true,
  durableClaimVerified: true,
  executionEnabled: true
} as const;

describe('Manus API v2 dispatch preflight (no live requests)', () => {
  it('builds only a private, connector-free, bounded text task on the canonical host', () => {
    const decision = prepareManusV2Dispatch(base);
    expect(decision.state).toBe('ready');
    if (decision.state !== 'ready') return;
    expect(decision.url).toBe('https://api.manus.ai/v2/task.create');
    expect(decision.method).toBe('POST');
    expect(decision.body).toMatchObject({
      clear_connectors: true, share_visibility: 'private', interactive_mode: true,
      message: { content: [{ type: 'text', visibility: 'visible', text: base.prompt }] }
    });
    expect(JSON.stringify(decision.body)).not.toMatch(/api.key|secret|project_id|website|enable_skills|force_skills/i);
    expect(decision).not.toHaveProperty('headers');
  });

  it('disables external execution by default if the execution gate is absent', () => {
    const decision = prepareManusV2Dispatch({ ...base, executionEnabled: undefined });
    expect(decision).toMatchObject({ state: 'blocked', reason: 'external_execution_disabled' });
  });

  it('requires server-granted provider rights, consent and approved cost', () => {
    for (const change of [
      { approved: false }, { providerEnabled: false },
      { budgetApproved: false }, { durableClaimVerified: false },
      { grantedPermissions: [] }
    ]) {
      expect(prepareManusV2Dispatch({ ...base, ...change }).state).toBe('blocked');
    }
  });

  it('forbids extra requested capabilities even when the provider is enabled', () => {
    expect(prepareManusV2Dispatch({ ...base, requestedCapabilities: ['research.readonly', 'secrets.read'] })).toMatchObject({
      state: 'blocked', reason: 'capability_not_allowed'
    });
    expect(prepareManusV2Dispatch({ ...base, requestedCapabilities: [] })).toMatchObject({
      state: 'blocked', reason: 'capability_not_allowed'
    });
    expect(prepareManusV2Dispatch({ ...base, grantedCapabilities: [] })).toMatchObject({
      state: 'blocked', reason: 'capability_not_allowed'
    });
  });

  it('rejects cross-tenant scope and out-of-lineage exact SHA', () => {
    expect(prepareManusV2Dispatch({ ...base, taskScope: { tenantId: 'tenant-b', organizationId: 'org-a' } })).toMatchObject({
      state: 'blocked', reason: 'scope_mismatch'
    });
    expect(prepareManusV2Dispatch({ ...base, approvedSha: 'b'.repeat(40) })).toMatchObject({
      state: 'blocked', reason: 'sha_not_approved'
    });
    expect(prepareManusV2Dispatch({ ...base, sourceSha: 'invalid' })).toMatchObject({
      state: 'blocked', reason: 'sha_not_approved'
    });
  });

  it('refuses malformed task identity, duplicate-unsafe key and oversized instructions', () => {
    for (const change of [
      { taskId: '' }, { requestId: '' }, { idempotencyKey: 'invalid key' },
      { prompt: '' }, { prompt: 'x'.repeat(4097) }, { prompt: 'ok\u0000hidden' }
    ]) {
      expect(prepareManusV2Dispatch({ ...base, ...change }).state).toBe('blocked');
    }
  });

  it('does not forward any client-provided connectors, hidden metadata or untrusted tool options', () => {
    const decision = prepareManusV2Dispatch({
      ...base, connectors: ['bank'], force_skills: ['privileged'], share_visibility: 'public',
      website: { website_id: 'attacker' }, apiKey: 'fake-secret'
    } as typeof base);
    expect(decision.state).toBe('ready');
    if (decision.state !== 'ready') return;
    expect(decision.body).toEqual({
      message: { content: [{ type: 'text', text: base.prompt, visibility: 'visible' }] },
      clear_connectors: true,
      share_visibility: 'private',
      interactive_mode: true,
      agent_profile: 'lite'
    });
  });
});
