import { evaluateGenesisCovenant } from './genesis-humanity-covenant.mjs';

/**
 * Server-side composition boundary only. Dependencies MUST be injected by a trusted
 * server bootstrap, never taken from an HTTP body, agent output or tool payload.
 * transact must serialize authorization, revocation check, audit and effect atomically.
 * This module does not by itself establish that all external effects use this gateway.
 */
export function createGenesisEnforcementGateway({ trustedAuthority, transact, clock }) {
  if (typeof trustedAuthority !== 'function' || typeof transact !== 'function' || typeof clock !== 'function') {
    throw new TypeError('TRUSTED_DEPENDENCIES_REQUIRED');
  }
  return Object.freeze({
    async execute(request, effect) {
      if (!request || typeof effect !== 'function' || typeof request.organizationId !== 'string' ||
          typeof request.actorId !== 'string' || typeof request.action !== 'string') {
        return { status: 'blocked', reason: 'INVALID_REQUEST' };
      }
      // Only allowlisted fields enter the trusted authority; no user-supplied context.
      const input = Object.freeze({
        organizationId: request.organizationId, actorId: request.actorId,
        action: request.action, purpose: request.purpose, claimsHuman: request.claimsHuman,
        claimsDivineAuthority: request.claimsDivineAuthority
      });
      try {
        return await transact(async transaction => {
          // Authority must read permissions/approval/consent from transaction-scoped trusted state.
          const state = await trustedAuthority(input, transaction);
          const nowMs = clock();
          const context = {
            organizationId: state?.organizationId, actorId: state?.actorId,
            emergencyStop: state?.emergencyStop, auditAvailable: state?.auditAvailable,
            policyAvailable: state?.policyAvailable, permissions: state?.permissions,
            humanApproval: state?.humanApproval, consent: state?.consent,
            auditReceipt: state?.auditReceipt, nowMs,
            enforcementGate: 'trusted-server-boundary'
          };
          const decision = evaluateGenesisCovenant(input, context);
          if (!decision.allowed) return { status: 'blocked', reason: decision.reason };
          // The transaction provider is responsible for atomic audit + effect,
          // concurrency fencing, rollback, and revocation consistency.
          const result = await effect(Object.freeze(input), transaction);
          if (result?.status !== 'completed') throw new Error('EFFECT_NOT_COMMITTED');
          return { status: 'completed', result };
        });
      } catch {
        return { status: 'blocked', reason: 'TRANSACTION_OR_AUTHORITY_FAILED' };
      }
    }
  });
}
