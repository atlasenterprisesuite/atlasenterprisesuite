import { describe, expect, it } from 'vitest';
import {
  evaluateAgentMandate,
  type AgentMandate,
  type AtlasActor
} from '../../packages/governance/src';
import { evaluateAtlasPolicy } from '../../packages/execution/src/policy-fabric';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const actor: AtlasActor = {
  actorId: 'atlas-agent-1',
  kind: 'agent',
  scope,
  permissions: ['ai.code.write']
};
const mandate: AgentMandate = {
  mandateId: 'mandate-1',
  agentId: 'atlas-agent-1',
  principalId: 'principal-1',
  scope,
  permissions: ['ai.code.write'],
  allowedActions: ['code.propose'],
  issuedAt: '2026-11-14T00:00:00.000Z',
  expiresAt: '2026-11-16T00:00:00.000Z',
  principalVerification: { verified: true, evidenceRef: 'identity-evidence-1' }
};
const validInput = {
  actor,
  targetScope: scope,
  mandate,
  permission: 'ai.code.write' as const,
  actionId: 'code.propose',
  now: new Date('2026-11-14T19:00:00.000Z')
};

describe('ATLAS KYA server-resolved agent mandates', () => {
  it('allows a verified agent acting within its exact mandate and tenant', () => {
    expect(evaluateAgentMandate(validInput)).toEqual({
      allowed: true, mandateId: 'mandate-1', principalId: 'principal-1'
    });
  });

  it('fails closed for absent mandates, spoofed agents, and human actors', () => {
    expect(evaluateAgentMandate({ ...validInput, mandate: null })).toMatchObject({
      allowed: false, reason: 'mandate_required'
    });
    expect(evaluateAgentMandate({ ...validInput, actor: { ...actor, actorId: 'agent-other' } })).toMatchObject({
      allowed: false, reason: 'agent_mismatch'
    });
    expect(evaluateAgentMandate({ ...validInput, actor: { ...actor, kind: 'human' } })).toMatchObject({
      allowed: false, reason: 'agent_actor_required'
    });
  });

  it('refuses cross-tenant or cross-organization use', () => {
    expect(evaluateAgentMandate({
      ...validInput, targetScope: { tenantId: 'tenant-b', organizationId: 'org-a' }
    })).toMatchObject({ allowed: false, reason: 'scope_mismatch' });
    expect(evaluateAgentMandate({
      ...validInput, mandate: { ...mandate, scope: { tenantId: 'tenant-a', organizationId: 'org-b' } }
    })).toMatchObject({ allowed: false, reason: 'scope_mismatch' });
  });

  it('requires both actor and mandate permissions and explicit action inclusion', () => {
    expect(evaluateAgentMandate({ ...validInput, actor: { ...actor, permissions: [] } }))
      .toMatchObject({ allowed: false, reason: 'permission_denied' });
    expect(evaluateAgentMandate({ ...validInput, mandate: { ...mandate, permissions: [] } }))
      .toMatchObject({ allowed: false, reason: 'permission_denied' });
    expect(evaluateAgentMandate({ ...validInput, actionId: 'production.deploy' }))
      .toMatchObject({ allowed: false, reason: 'action_denied' });
  });

  it('requires trusted identity evidence and nonempty mandate IDs', () => {
    expect(evaluateAgentMandate({
      ...validInput, mandate: { ...mandate, principalVerification: { verified: false, evidenceRef: '' } }
    })).toMatchObject({ allowed: false, reason: 'principal_unverified' });
    expect(evaluateAgentMandate({ ...validInput, mandate: { ...mandate, mandateId: '' } }))
      .toMatchObject({ allowed: false, reason: 'invalid_mandate' });
  });

  it('denies not-yet-active, expired, revoked, and malformed mandates', () => {
    expect(evaluateAgentMandate({
      ...validInput, now: new Date('2026-11-13T00:00:00.000Z')
    })).toMatchObject({ allowed: false, reason: 'mandate_not_active' });
    expect(evaluateAgentMandate({
      ...validInput, now: new Date('2026-11-16T00:00:00.000Z')
    })).toMatchObject({ allowed: false, reason: 'mandate_expired' });
    expect(evaluateAgentMandate({
      ...validInput, mandate: { ...mandate, revokedAt: '2026-11-14T18:00:00.000Z' }
    })).toMatchObject({ allowed: false, reason: 'mandate_revoked' });
    expect(evaluateAgentMandate({
      ...validInput, mandate: { ...mandate, expiresAt: 'not-a-date' }
    })).toMatchObject({ allowed: false, reason: 'invalid_mandate' });
  });

  it('blocks unauthorized costs, mismatched currency, and invalid amount', () => {
    expect(evaluateAgentMandate({ ...validInput, amount: 1, currency: 'USD' }))
      .toMatchObject({ allowed: false, reason: 'spending_not_authorized' });
    const withLimit = { ...mandate, maxAmount: 100, currency: 'USD' };
    expect(evaluateAgentMandate({
      ...validInput, mandate: withLimit, amount: 101, currency: 'USD'
    })).toMatchObject({ allowed: false, reason: 'spending_limit_exceeded' });
    expect(evaluateAgentMandate({
      ...validInput, mandate: withLimit, amount: 1, currency: 'EUR'
    })).toMatchObject({ allowed: false, reason: 'currency_mismatch' });
    expect(evaluateAgentMandate({ ...validInput, amount: Number.NaN }))
      .toMatchObject({ allowed: false, reason: 'invalid_amount' });
  });

  it('the execution policy refuses a required mandate when context is absent', () => {
    const result = evaluateAtlasPolicy({
      requestId: 'request-1',
      permissions: ['ai.code.write'],
      requiredPermissions: ['ai.code.write'],
      requireAgentMandate: true,
      action: {
        autonomyLevel: 'guided', sensitivity: 'low', reversible: true,
        mutation: true, paidCost: 0, budgetLimit: 0, envelopeAllowed: true, regulated: false
      }
    });
    expect(result).toMatchObject({
      outcome: 'deny', reason: 'agent_mandate:mandate_required'
    });
  });

  it('the execution policy permits an authorized reversible action but rejects revoked mandates', () => {
    const base = {
      requestId: 'request-2',
      permissions: ['ai.code.write'],
      requiredPermissions: ['ai.code.write'],
      requireAgentMandate: true,
      action: {
        autonomyLevel: 'guided' as const, sensitivity: 'low' as const, reversible: true,
        mutation: true, paidCost: 0, budgetLimit: 0, envelopeAllowed: true, regulated: false
      }
    };
    expect(evaluateAtlasPolicy({ ...base, agentMandate: validInput }).outcome).toBe('allow');
    expect(evaluateAtlasPolicy({
      ...base, agentMandate: { ...validInput, mandate: { ...mandate, revokedAt: '2026-11-14T18:00:00.000Z' } }
    })).toMatchObject({ outcome: 'deny', reason: 'agent_mandate:mandate_revoked' });
  });
});
