import {
  evaluateConnectedAppPolicy,
  normalizeConnectedAppState,
  requiredScopesForCapability,
  type ConnectedAppAccessDecision,
  type ConnectedAppActorKind,
  type ConnectedAppPolicy,
  type ProviderManifest
} from '../../../../packages/connected-apps/src/index.ts';

type AccessContext = {
  actorPermission: boolean;
  activeMembership: boolean;
  organizationId: string;
  connectionOrganizationId: string;
  connectionState: string;
  authorized: boolean;
  providerVerified: boolean;
  grantedScopes: readonly string[];
  manifest: ProviderManifest;
  capabilityCode: string;
  actorKind: Exclude<ConnectedAppActorKind, 'any'>;
  policies: readonly ConnectedAppPolicy[];
  owningModulePermission: boolean;
};

function deny(reason: string): ConnectedAppAccessDecision {
  return { effect: 'deny', reason };
}

export async function evaluateConnectedAppAccess(context: AccessContext): Promise<ConnectedAppAccessDecision> {
  if (!context.activeMembership || !context.actorPermission) return deny('permission_denied');
  if (context.organizationId !== context.connectionOrganizationId) return deny('organization_mismatch');

  const state = normalizeConnectedAppState(context.connectionState as Parameters<typeof normalizeConnectedAppState>[0]);
  if (state === 'expired') return deny('connection_expired');
  if (state !== 'connected') return deny('connection_not_authorized');
  if (!context.authorized) return deny('connection_not_authorized');
  if (!context.providerVerified) return deny('connection_not_verified');

  let requiredScopes: readonly string[];
  try {
    requiredScopes = requiredScopesForCapability(context.manifest, context.capabilityCode);
  } catch {
    return deny('capability_not_supported');
  }
  const granted = new Set(context.grantedScopes);
  if (requiredScopes.some((scope) => !granted.has(scope))) return deny('scope_missing');
  if (!context.owningModulePermission) return deny('permission_denied');

  const capability = context.manifest.capabilities.find((item) => item.code === context.capabilityCode);
  if (!capability) return deny('capability_not_supported');
  return evaluateConnectedAppPolicy({
    capabilityCode: context.capabilityCode,
    accessLevel: capability.accessLevel,
    actorKind: context.actorKind,
    policies: context.policies
  });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export async function digestConnectedAppAction(input: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(input)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function approvalMatchesAction(
  approval: { status: string; payloadDigest: string; expiresAt: string | null },
  digest: string,
  now: number
): boolean {
  if (approval.status !== 'approved' || approval.payloadDigest !== digest) return false;
  if (approval.expiresAt && Date.parse(approval.expiresAt) <= now) return false;
  return true;
}

const SECRET_KEY = /(authorization|token|secret|password|credential|cookie|ciphertext|\biv\b)/i;
const SECRET_VALUE = /(bearer\s+|basic\s+|sk-[a-z0-9_-]{6,}|authorization:)/i;

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(key)) continue;
      output[key] = sanitize(item);
    }
    return output;
  }
  if (typeof value === 'string' && SECRET_VALUE.test(value)) return '[REDACTED]';
  return value;
}

export function sanitizeConnectedAppMetadata(value: unknown): Record<string, unknown> {
  const sanitized = sanitize(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? sanitized as Record<string, unknown>
    : {};
}
