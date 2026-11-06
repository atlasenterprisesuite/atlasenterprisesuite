import type { TenantScope } from '../../core/src/index';
import { getAgent } from './registry';

/**
 * V7's deterministic, proposal-only safety boundary.
 *
 * Callers must supply an authenticated, server-resolved context and authoritative
 * backlog/quota/dedup snapshots. The function never dispatches a tool, grants
 * capabilities, persists a work order, authorizes payment, or approves itself.
 * Runtime authorization and durable idempotency remain independent P0 gates.
 */
export interface AtlasProactiveOpportunityInput {
  agentId: string;
  agentState: 'idle' | 'assigned' | 'blocked';
  context: { source: 'server'; scope: TenantScope; authorizedModules: readonly string[] };
  hasPriorityWork: boolean;
  dailyProposalCount: number;
  dailyProposalLimit: number;
  lastProposalAtMs: number | null;
  nowMs: number;
  cooldownMs: number;
  existingFingerprints: readonly string[];
  opportunity: {
    scope: TenantScope;
    repository: string;
    sourceSha: string;
    moduleId: string;
    findingId: string;
    summary: string;
    evidenceRef: string;
    requestedCapabilities: readonly string[];
    paidCost: number;
    mutation: boolean;
    externalAction: boolean;
  };
}

export type AtlasProactiveDecision =
  | { outcome: 'defer'; reason: string }
  | {
      outcome: 'propose';
      proposal: {
        fingerprint: string;
        agentId: string;
        scope: TenantScope;
        moduleId: string;
        summary: string;
        evidenceRef: string;
        sourceSha: string;
        status: 'review_required';
        requestedCapabilities: [];
        executable: false;
      };
    };

const defer = (reason: string): AtlasProactiveDecision => ({ outcome: 'defer', reason });
const nonempty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function evaluateProactiveOpportunity(input: AtlasProactiveOpportunityInput): AtlasProactiveDecision {
  if (input.agentState !== 'idle' || input.hasPriorityWork !== false) {
    return defer('assigned_work_preempts_discovery');
  }
  if (input.context?.source !== 'server') return defer('proactive_context_untrusted');

  const trustedScope = input.context.scope;
  const foundScope = input.opportunity?.scope;
  if (
    !nonempty(trustedScope?.tenantId)
    || !nonempty(trustedScope?.organizationId)
    || trustedScope.tenantId !== foundScope?.tenantId
    || trustedScope.organizationId !== foundScope?.organizationId
  ) return defer('proactive_scope_mismatch');

  let agent;
  try {
    agent = getAgent(input.agentId);
  } catch {
    return defer('proactive_agent_unregistered');
  }
  if (
    !agent.permissions.includes('ai.task.read')
    || !agent.permissions.includes('ai.repo.read')
    || !agent.allowedTools.includes('atlas.repo.inspect')
  ) return defer('proactive_agent_read_scope_required');

  const op = input.opportunity;
  // Only server-authorized modules may receive a proposal. A registered agent
  // must not manufacture a new departmental assignment while it is idle.
  if (
    !Array.isArray(input.context.authorizedModules)
    || !input.context.authorizedModules.includes(op.moduleId)
  ) return defer('proactive_module_scope_denied');
  if (
    !nonempty(op.repository)
    || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(op.repository)
    || !nonempty(op.sourceSha)
    || !/^[a-f0-9]{40}$/i.test(op.sourceSha)
    || !nonempty(op.moduleId)
    || !nonempty(op.findingId)
    || !nonempty(op.summary)
    || !nonempty(op.evidenceRef)
  ) return defer('proactive_source_evidence_required');

  if (!Array.isArray(op.requestedCapabilities) || op.requestedCapabilities.length !== 0) {
    return defer('proactive_capability_grant_forbidden');
  }
  if (
    op.paidCost !== 0
    || op.mutation !== false
    || op.externalAction !== false
  ) return defer('proactive_effect_requires_authorization');

  const { dailyProposalCount, dailyProposalLimit, nowMs, lastProposalAtMs, cooldownMs } = input;
  if (
    !Number.isInteger(dailyProposalCount)
    || dailyProposalCount < 0
    || !Number.isInteger(dailyProposalLimit)
    || dailyProposalLimit < 1
    || dailyProposalLimit > 10
    || !Number.isSafeInteger(nowMs)
    || nowMs < 0
    || !Number.isSafeInteger(cooldownMs)
    || cooldownMs < 0
    || (lastProposalAtMs !== null && (
      !Number.isSafeInteger(lastProposalAtMs) || lastProposalAtMs < 0
    ))
  ) return defer('proactive_quota_invalid');

  if (dailyProposalCount >= dailyProposalLimit) return defer('proactive_daily_quota_exceeded');
  if (
    lastProposalAtMs !== null
    && (lastProposalAtMs > nowMs || nowMs - lastProposalAtMs < cooldownMs)
  ) return defer('proactive_cooldown_active');

  const fingerprint = JSON.stringify([
    trustedScope.tenantId,
    trustedScope.organizationId,
    op.repository,
    op.sourceSha.toLowerCase(),
    op.moduleId,
    op.findingId
  ]);
  if (!Array.isArray(input.existingFingerprints)) return defer('proactive_fingerprint_index_required');
  if (input.existingFingerprints.includes(fingerprint)) return defer('proactive_duplicate_finding');

  return {
    outcome: 'propose',
    proposal: {
      fingerprint,
      agentId: agent.id,
      scope: { tenantId: trustedScope.tenantId, organizationId: trustedScope.organizationId },
      moduleId: op.moduleId,
      summary: op.summary.trim(),
      evidenceRef: op.evidenceRef.trim(),
      sourceSha: op.sourceSha.toLowerCase(),
      status: 'review_required',
      requestedCapabilities: [],
      executable: false
    }
  };
}
