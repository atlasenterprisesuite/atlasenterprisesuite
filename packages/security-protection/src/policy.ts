import type { ProtectedActionCode, ProtectedActionPolicy } from './types';

export const ATLAS_PROTECTED_ACTION_CODES = [
  'account.password.change',
  'account.recovery.change',
  'account.passkey.remove',
  'account.protection.disable',
  'account.delete',
  'admin.role.grant',
  'admin.role.revoke',
  'payout.destination.change',
  'api_key.create_privileged',
  'api_key.revoke_privileged',
  'session.revoke_others',
  'device.trust',
  'device.revoke'
] as const satisfies readonly ProtectedActionCode[];

const DELAYED_ACTIONS = new Set<ProtectedActionCode>([
  'account.recovery.change',
  'account.passkey.remove',
  'account.protection.disable',
  'account.delete',
  'admin.role.grant',
  'payout.destination.change'
]);

const DEFAULT_DELAY_SECONDS = 3600;
const MIN_DELAY_SECONDS = 900;
const MAX_DELAY_SECONDS = 86400;

function buildActionPolicy(action: ProtectedActionCode): ProtectedActionPolicy {
  const delayed = DELAYED_ACTIONS.has(action);
  return {
    action,
    requiresPasskey: true,
    delayOnUntrustedOrHighRisk: delayed,
    defaultDelaySeconds: delayed ? DEFAULT_DELAY_SECONDS : null,
    minDelaySeconds: delayed ? MIN_DELAY_SECONDS : null,
    maxDelaySeconds: delayed ? MAX_DELAY_SECONDS : null
  };
}

const actions = Object.fromEntries(
  ATLAS_PROTECTED_ACTION_CODES.map((action) => [action, buildActionPolicy(action)])
) as Record<ProtectedActionCode, ProtectedActionPolicy>;

export const ATLAS_PROTECTED_ACTION_POLICY_V1 = Object.freeze({
  version: 'security-protection-v1' as const,
  actions: Object.freeze(actions)
});

export function isProtectedActionCode(value: string): value is ProtectedActionCode {
  return (ATLAS_PROTECTED_ACTION_CODES as readonly string[]).includes(value);
}

export function getProtectedActionPolicy(action: ProtectedActionCode): ProtectedActionPolicy {
  return ATLAS_PROTECTED_ACTION_POLICY_V1.actions[action];
}

export function resolveSecurityDelaySeconds(
  policy: ProtectedActionPolicy,
  configuredDelaySeconds?: number
): number | null {
  if (!policy.delayOnUntrustedOrHighRisk || policy.defaultDelaySeconds === null) return null;

  if (configuredDelaySeconds === undefined) return policy.defaultDelaySeconds;
  if (!Number.isFinite(configuredDelaySeconds)) return policy.defaultDelaySeconds;

  const min = policy.minDelaySeconds ?? policy.defaultDelaySeconds;
  const max = policy.maxDelaySeconds ?? policy.defaultDelaySeconds;
  return Math.min(max, Math.max(min, Math.trunc(configuredDelaySeconds)));
}
