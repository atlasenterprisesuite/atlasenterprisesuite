import { sameScope } from '../core/src/scope';
import { requireIntegrationPermission } from './permissions';
import { requiredProviderScopes } from './provider-registry';
import type {
  CapabilityDecision,
  CapabilityRequest,
  IntegrationActorContext,
  IntegrationConnection,
  IntegrationGrant
} from './types';

type CapabilityEvaluationInput = {
  actor: IntegrationActorContext;
  connection: IntegrationConnection;
  grant: IntegrationGrant | null;
  request: CapabilityRequest;
};

function grantMatches(
  actor: IntegrationActorContext,
  grant: IntegrationGrant | null,
  connection: IntegrationConnection,
  request: CapabilityRequest
) {
  if (!grant) return false;
  if (grant.connectionId !== connection.id) return false;
  if (grant.module !== request.module || grant.capability !== request.capability) return false;

  if (grant.principalType === 'user') return grant.principalId === actor.userId;
  if (grant.principalType === 'role') return grant.principalId === actor.role;
  return grant.principalId === request.module;
}

export function evaluateCapabilityRequest({
  actor,
  connection,
  grant,
  request
}: CapabilityEvaluationInput): CapabilityDecision {
  if (!sameScope(actor, connection)) {
    throw new Error('integration_scope_mismatch');
  }

  requireIntegrationPermission(actor, 'integrations.use');

  if (connection.status !== 'verified') {
    throw new Error('integration_not_verified');
  }

  if (!grantMatches(actor, grant, connection, request)) {
    throw new Error('integration_grant_missing');
  }

  const requiredScopes = requiredProviderScopes(connection.providerKey, request.capability);
  const hasRequiredScopes = requiredScopes.every((scope) => connection.grantedScopes.includes(scope));
  if (!hasRequiredScopes) {
    throw new Error('integration_provider_scope_missing');
  }

  return { allowed: true };
}
