import { resolveCapability } from './capability-registry';
import type {
  AtlasCapabilityDefinition,
  AtlasCapabilityRuntimeState,
  AtlasProviderBinding
} from './capability-types';
import type { ExecutionActor } from './types';

export const DEFAULT_PROVIDER_READINESS_TTL_MS = 5 * 60 * 1000;

export interface CapabilityPolicyContext {
  actor: ExecutionActor;
  environment: string;
  jurisdiction?: string;
  approved: boolean;
  runtimeProviderStates: Readonly<
    Record<string, { state: AtlasCapabilityRuntimeState; verifiedAt: string | null }>
  >;
  now: string;
}

export type CapabilityPolicyDecision =
  | { allowed: true; capability: AtlasCapabilityDefinition; provider: AtlasProviderBinding | null }
  | { allowed: false; capability: AtlasCapabilityDefinition; blocker: string };

function isFreshVerifiedState(
  state: { state: AtlasCapabilityRuntimeState; verifiedAt: string | null },
  now: string
): boolean {
  if (state.state !== 'verified' || !state.verifiedAt) return false;
  const nowMs = Date.parse(now);
  const verifiedMs = Date.parse(state.verifiedAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(verifiedMs)) return false;
  const age = nowMs - verifiedMs;
  return age >= 0 && age <= DEFAULT_PROVIDER_READINESS_TTL_MS;
}

export function evaluateCapabilityPolicy(
  capabilityId: string,
  context: CapabilityPolicyContext
): CapabilityPolicyDecision {
  const capability = resolveCapability(capabilityId);

  for (const permission of capability.permissions) {
    if (!context.actor.permissions.includes(permission)) {
      return { allowed: false, capability, blocker: `missing_permission:${permission}` };
    }
  }

  if (!capability.allowedEnvironments.includes(context.environment)) {
    return { allowed: false, capability, blocker: 'environment_not_allowed' };
  }

  if (capability.requiresApproval && !context.approved) {
    return { allowed: false, capability, blocker: 'approval_required' };
  }

  if (capability.providerBindings.length === 0) {
    return { allowed: true, capability, provider: null };
  }

  const eligibleBindings = capability.providerBindings
    .filter((binding) => binding.environments.includes(context.environment))
    .sort((a, b) => a.priority - b.priority || a.provider.localeCompare(b.provider));

  if (eligibleBindings.length === 0) {
    return { allowed: false, capability, blocker: 'provider_binding_unavailable' };
  }

  const configuredBindings = eligibleBindings.filter(
    (binding) => context.runtimeProviderStates[binding.provider] !== undefined
  );
  if (configuredBindings.length === 0) {
    return { allowed: false, capability, blocker: 'provider_not_configured' };
  }

  const verifiedBinding = configuredBindings.find((binding) =>
    isFreshVerifiedState(context.runtimeProviderStates[binding.provider], context.now)
  );
  if (!verifiedBinding) {
    return { allowed: false, capability, blocker: 'provider_not_verified' };
  }

  return { allowed: true, capability, provider: verifiedBinding };
}
