import { evaluateGenesisCovenant, isGenesisProtectedAction } from './genesis-humanity-covenant.mjs';

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
      // Preflight-only verbs must never be able to trigger a side-effect callback.
      if (!isGenesisProtectedAction(request.action)) {
        return { status: 'blocked', reason: 'EXECUTION_ACTION_REQUIRED' };
      }
      // Only allowlisted fields enter the trusted authority; no user-supplied context.
      const input = Object.freeze({
        organizationId: request.organizationId, actorId: request.actorId,
        action: request.action, purpose: request.purpose, claimsHuman: request.claimsHuman,
        claimsDivineAuthority: request.claimsDivineAuthority
      });
      let callbackCalls = 0;
      let callbackResult;
      try {
        const transactionResult = await transact(async transaction => {
          if (++callbackCalls !== 1) throw new Error('TRANSACTION_CALLBACK_REPLAY');
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
          if (!decision.allowed) {
            callbackResult = Object.freeze({ status: 'blocked', reason: decision.reason });
            return callbackResult;
          }
          // The transaction provider is responsible for atomic audit + effect,
          // concurrency fencing, rollback, and revocation consistency.
          const result = await effect(Object.freeze(input), transaction);
          if (result?.status !== 'completed') throw new Error('EFFECT_NOT_COMMITTED');
          callbackResult = Object.freeze({ status: 'completed', result });
          return callbackResult;
        });
        // A transaction adapter must return the exact awaited callback result;
        // never accept a fabricated 'completed' response without invoking it.
        if (callbackCalls !== 1 || !callbackResult || transactionResult !== callbackResult) {
          return { status: 'blocked', reason: 'TRANSACTION_RESULT_UNVERIFIED' };
        }
        return callbackResult;
      } catch {
        return { status: 'blocked', reason: 'TRANSACTION_OR_AUTHORITY_FAILED' };
      }
    }
  });
}
