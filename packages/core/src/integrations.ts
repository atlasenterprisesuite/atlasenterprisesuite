export type IntegrationConnectionState =
  | 'unconfigured'
  | 'authorizing'
  | 'connected'
  | 'degraded'
  | 'expired'
  | 'revoked'
  | 'error';

export type IntegrationAuthKind =
  | 'oauth2'
  | 'oidc'
  | 'service_jwt'
  | 'signed_token'
  | 'password';

export type LegacyAuthException = {
  reason: string;
  approvedByActorId: string;
  approvedAt: string;
};

export type IntegrationAuthPolicy = {
  kind: IntegrationAuthKind;
  legacyException?: LegacyAuthException;
};

export function validateIntegrationAuthPolicy(policy: IntegrationAuthPolicy) {
  if (policy.kind !== 'password') return { ok: true as const };

  return policy.legacyException
    ? { ok: true as const }
    : { ok: false as const, reason: 'legacy_auth_not_approved' as const };
}

export function canReportConnected(input: {
  authorized: boolean;
  providerVerified: boolean;
}) {
  return input.authorized && input.providerVerified;
}
