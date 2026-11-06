import { describe, expect, it } from 'vitest';
import {
  evaluateProactiveOpportunity,
  type AtlasProactiveOpportunityInput
} from '../../packages/agent-registry/src';

const baseline: AtlasProactiveOpportunityInput = {
  agentId: 'atlas-architect',
  agentState: 'idle',
  context: {
    source: 'server',
    scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
    authorizedModules: ['academy']
  },
  hasPriorityWork: false,
  dailyProposalCount: 0,
  dailyProposalLimit: 2,
  lastProposalAtMs: null,
  nowMs: 1_762_500_000_000,
  cooldownMs: 3_600_000,
  existingFingerprints: [],
  opportunity: {
    scope: { tenantId: 'tenant-a', organizationId: 'org-a' },
    repository: 'atlasenterprisesuite/atlasenterprisesuite',
    sourceSha: 'a'.repeat(40),
    moduleId: 'academy',
    findingId: 'KNOW-01',
    summary: 'Inspect an existing regression gap',
    evidenceRef: 'github:issue-1006',
    requestedCapabilities: [],
    paidCost: 0,
    mutation: false,
    externalAction: false
  }
};

describe('ATLAS Virtual Enterprise V7 proactive proposal policy', () => {
  it('can only create a review-required proposal with no execution authority', () => {
    const result = evaluateProactiveOpportunity(baseline);
    expect(result.outcome).toBe('propose');
    if (result.outcome !== 'propose') throw new Error('expected_proposal');
    expect(result.proposal.status).toBe('review_required');
    expect(result.proposal.executable).toBe(false);
    expect(result.proposal.requestedCapabilities).toEqual([]);
    expect(result.proposal.fingerprint).toContain('KNOW-01');
  });

  it('preempts discovery when assigned or priority work exists', () => {
    expect(evaluateProactiveOpportunity({ ...baseline, agentState: 'assigned' })).toEqual({
      outcome: 'defer', reason: 'assigned_work_preempts_discovery'
    });
    expect(evaluateProactiveOpportunity({ ...baseline, hasPriorityWork: true })).toEqual({
      outcome: 'defer', reason: 'assigned_work_preempts_discovery'
    });
  });

  it('fails closed for untrusted context and cross-tenant opportunity', () => {
    expect(evaluateProactiveOpportunity({
      ...baseline, context: { ...baseline.context, source: 'client' as 'server' }
    })).toEqual({ outcome: 'defer', reason: 'proactive_context_untrusted' });
    expect(evaluateProactiveOpportunity({
      ...baseline,
      opportunity: {
        ...baseline.opportunity,
        scope: { tenantId: 'tenant-b', organizationId: 'org-a' }
      }
    })).toEqual({ outcome: 'defer', reason: 'proactive_scope_mismatch' });
  });

  it('fails closed for a module outside the server-authorized office boundary', () => {
    expect(evaluateProactiveOpportunity({
      ...baseline,
      opportunity: { ...baseline.opportunity, moduleId: 'finance' }
    })).toEqual({ outcome: 'defer', reason: 'proactive_module_scope_denied' });
    expect(evaluateProactiveOpportunity({
      ...baseline,
      context: { ...baseline.context, authorizedModules: [] }
    })).toEqual({ outcome: 'defer', reason: 'proactive_module_scope_denied' });
  });

  it('never treats suggested capabilities as self-granted authority', () => {
    expect(evaluateProactiveOpportunity({
      ...baseline,
      opportunity: { ...baseline.opportunity, requestedCapabilities: ['academy.write'] }
    })).toEqual({ outcome: 'defer', reason: 'proactive_capability_grant_forbidden' });
  });

  it('cannot propose paid, mutating, or external actions as safe discovery', () => {
    for (const opportunity of [
      { ...baseline.opportunity, paidCost: 1 },
      { ...baseline.opportunity, mutation: true },
      { ...baseline.opportunity, externalAction: true }
    ]) {
      expect(evaluateProactiveOpportunity({ ...baseline, opportunity }).outcome).toBe('defer');
    }
  });

  it('requires complete verifiable provenance', () => {
    expect(evaluateProactiveOpportunity({
      ...baseline, opportunity: { ...baseline.opportunity, sourceSha: 'not-a-sha' }
    })).toEqual({ outcome: 'defer', reason: 'proactive_source_evidence_required' });
    expect(evaluateProactiveOpportunity({
      ...baseline, opportunity: { ...baseline.opportunity, evidenceRef: '' }
    })).toEqual({ outcome: 'defer', reason: 'proactive_source_evidence_required' });
  });

  it('deduplicates findings in the same repository, SHA and tenant scope', () => {
    const first = evaluateProactiveOpportunity(baseline);
    if (first.outcome !== 'propose') throw new Error('expected_proposal');
    expect(evaluateProactiveOpportunity({
      ...baseline, existingFingerprints: [first.proposal.fingerprint]
    })).toEqual({ outcome: 'defer', reason: 'proactive_duplicate_finding' });
  });

  it('enforces cooldown and per-day quota before new proposals', () => {
    expect(evaluateProactiveOpportunity({
      ...baseline, lastProposalAtMs: baseline.nowMs - 1_000
    })).toEqual({ outcome: 'defer', reason: 'proactive_cooldown_active' });
    expect(evaluateProactiveOpportunity({
      ...baseline, dailyProposalCount: 2
    })).toEqual({ outcome: 'defer', reason: 'proactive_daily_quota_exceeded' });
  });

  it('rejects missing registry identity and invalid operating budgets', () => {
    expect(evaluateProactiveOpportunity({ ...baseline, agentId: 'invented-employee' })).toEqual({
      outcome: 'defer', reason: 'proactive_agent_unregistered'
    });
    expect(evaluateProactiveOpportunity({ ...baseline, dailyProposalLimit: -1 })).toEqual({
      outcome: 'defer', reason: 'proactive_quota_invalid'
    });
  });
});
