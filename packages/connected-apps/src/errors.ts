import type { ConnectedAppSafeError, ConnectedAppSafeErrorCode } from './types';

const SAFE_MESSAGES: Record<ConnectedAppSafeErrorCode, string> = {
  connection_not_authorized: 'The connected app is not authorized.',
  connection_not_verified: 'The connected app is not verified.',
  connection_expired: 'The connected app authorization has expired.',
  scope_missing: 'A required provider scope is missing.',
  capability_not_supported: 'The requested capability is not supported.',
  permission_denied: 'Permission denied.',
  approval_required: 'Approval is required before this action can run.',
  approval_invalid: 'The approval is invalid or no longer matches this action.',
  provider_rate_limited: 'The provider is rate limiting requests.',
  provider_unavailable: 'The provider is currently unavailable.',
  provider_request_failed: 'The provider request failed.',
  credential_unavailable: 'Provider credentials are unavailable.',
  organization_mismatch: 'The connected app does not belong to the active organization.'
};

const SAFE_CODES = new Set<ConnectedAppSafeErrorCode>(
  Object.keys(SAFE_MESSAGES) as ConnectedAppSafeErrorCode[]
);

export function normalizeConnectedAppError(value: unknown): ConnectedAppSafeError {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  const code = SAFE_CODES.has(raw as ConnectedAppSafeErrorCode)
    ? raw as ConnectedAppSafeErrorCode
    : 'provider_request_failed';
  return { code, message: SAFE_MESSAGES[code] };
}
