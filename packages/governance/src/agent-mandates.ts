import { sameScope, type TenantScope } from '../../core/src/index';
import { authorize, type AiPermission, type AtlasActor } from './permissions';

/**
 * A server-resolved authorization record. Never construct this from a client,
 * model output, tool arguments, or unverified third-party risk signals.
 * The principalVerification evidence must come from a trusted identity service.
 */
export type AgentMandate = {
  mandateId: string;
  agentId: string;
  principalId: string;
  scope: TenantScope;
  permissions: readonly AiPermission[];
  allowedActions: readonly string[];
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  principalVerification: {
    verified: boolean;
    evidenceRef: string;
  };
  maxAmount?: number | null;
  currency?: string | null;
};

export type AgentMandateInput = {
  actor: AtlasActor;
  /** Server-resolved registration state; never trust a client-declared value. */
  agentRegistered: boolean;
  targetScope: TenantScope;
  mandate: AgentMandate | null;
  permission: AiPermission;
  actionId: string;
  amount?: number;
  currency?: string;
  now?: Date;
};

export type AgentMandateDecision =
  | { allowed: true; mandateId: string; principalId: string }
  | { allowed: false; reason:
      | 'agent_actor_required'
      | 'mandate_required'
      | 'agent_unregistered'
      | 'invalid_mandate'
      | 'agent_mismatch'
      | 'scope_mismatch'
      | 'permission_denied'
      | 'action_denied'
      | 'principal_unverified'
      | 'mandate_not_active'
      | 'mandate_expired'
      | 'mandate_revoked'
      | 'invalid_amount'
      | 'spending_not_authorized'
      | 'spending_limit_exceeded'
      | 'currency_mismatch' };

const deny = (reason: Extract<AgentMandateDecision, { allowed: false }>['reason']): AgentMandateDecision =>
  ({ allowed: false, reason });

/** Checks explicit, scoped, revocable, time-bound authority before an agent action. */
export function evaluateAgentMandate(input: AgentMandateInput): AgentMandateDecision {
  const { actor, targetScope, mandate, permission, actionId } = input;
  if (actor.kind !== 'agent') return deny('agent_actor_required');
  if (input.agentRegistered !== true) return deny('agent_unregistered');
  if (!mandate) return deny('mandate_required');
  if (!mandate.mandateId?.trim() || !mandate.agentId?.trim() || !mandate.principalId?.trim()) {
    return deny('invalid_mandate');
  }
  if (actor.actorId !== mandate.agentId) return deny('agent_mismatch');
  if (!sameScope(actor.scope, targetScope) || !sameScope(mandate.scope, targetScope)) {
    return deny('scope_mismatch');
  }
  if (!authorize(actor, permission, targetScope).allowed || !mandate.permissions.includes(permission)) {
    return deny('permission_denied');
  }
  if (!actionId?.trim() || !mandate.allowedActions.includes(actionId)) return deny('action_denied');
  if (!mandate.principalVerification?.verified || !mandate.principalVerification.evidenceRef?.trim()) {
    return deny('principal_unverified');
  }

  const now = (input.now ?? new Date()).getTime();
  const issuedAt = Date.parse(mandate.issuedAt);
  const expiresAt = Date.parse(mandate.expiresAt);
  if (![now, issuedAt, expiresAt].every(Number.isFinite) || issuedAt >= expiresAt) {
    return deny('invalid_mandate');
  }
  if (mandate.revokedAt != null) return deny('mandate_revoked');
  if (now < issuedAt) return deny('mandate_not_active');
  if (now >= expiresAt) return deny('mandate_expired');

  const amount = input.amount ?? 0;
  if (!Number.isFinite(amount) || amount < 0) return deny('invalid_amount');
  if (amount > 0) {
    if (mandate.maxAmount == null || !Number.isFinite(mandate.maxAmount) || mandate.maxAmount < 0) {
      return deny('spending_not_authorized');
    }
    if (!input.currency || !mandate.currency ||
        input.currency.toUpperCase() !== mandate.currency.toUpperCase()) {
      return deny('currency_mismatch');
    }
    if (amount > mandate.maxAmount) return deny('spending_limit_exceeded');
  }
  return { allowed: true, mandateId: mandate.mandateId, principalId: mandate.principalId };
}
