export type IdentitySessionState = 'current' | 'expired' | 'unknown' | 'unavailable' | 'error';
export type IdentityDiagnosticsState = 'verified' | 'unverified' | 'expired' | 'unavailable' | 'error';

export type IdentityDiagnosticsInput = {
  authenticated: boolean | null;
  organizationResolved: boolean | null;
  sessionState: IdentitySessionState;
  identityProvider?: string | null;
  role?: string | null;
  organizationId?: string | null;
};

export type SafeIdentityDiagnostics = {
  state: IdentityDiagnosticsState;
  authenticated: boolean | null;
  organizationResolved: boolean | null;
  identityProvider: string | null;
  role: string | null;
  organizationId: string | null;
};

export function classifyIdentityDiagnostics(input: IdentityDiagnosticsInput): IdentityDiagnosticsState {
  if (input.sessionState === 'expired') return 'expired';
  if (input.sessionState === 'unavailable') return 'unavailable';
  if (input.sessionState === 'error') return 'error';
  if (
    input.sessionState === 'current'
    && input.authenticated === true
    && input.organizationResolved === true
  ) return 'verified';
  return 'unverified';
}

function safeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null;
}

export function serializeIdentityDiagnostics(input: IdentityDiagnosticsInput): SafeIdentityDiagnostics {
  return {
    state: classifyIdentityDiagnostics(input),
    authenticated: typeof input.authenticated === 'boolean' ? input.authenticated : null,
    organizationResolved: typeof input.organizationResolved === 'boolean' ? input.organizationResolved : null,
    identityProvider: safeText(input.identityProvider),
    role: safeText(input.role),
    organizationId: safeText(input.organizationId)
  };
}
