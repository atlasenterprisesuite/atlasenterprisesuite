import type { AiPermission } from '../../governance/src';
import type { AtlasAgentDefinition } from './types';

export interface DelegationResourceKeys {
  parent?: string[];
  child?: string[];
}

export interface DelegationDecision {
  allowed: boolean;
  reason:
    | 'delegation_allowed'
    | 'delegation_depth_exceeded'
    | 'delegation_permission_missing'
    | 'delegation_privilege_amplification'
    | 'delegation_resource_conflict'
    | 'delegation_invalid';
}

const MUTATING_PERMISSIONS = new Set<AiPermission>([
  'ai.task.create',
  'ai.task.update',
  'ai.code.write',
  'ai.pr.create',
  'ai.deploy.request',
]);

function hasMutationPermission(agent: AtlasAgentDefinition): boolean {
  return agent.permissions.some(permission => MUTATING_PERMISSIONS.has(permission));
}

function normalizedResources(values: string[] | undefined): Set<string> {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  );
}

function hasOverlap(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) if (right.has(value)) return true;
  return false;
}

export function evaluateDelegation({
  parent,
  child,
  depth,
  resourceKeys = {},
}: {
  parent: AtlasAgentDefinition;
  child: AtlasAgentDefinition;
  depth: number;
  resourceKeys?: DelegationResourceKeys;
}): DelegationDecision {
  if (!parent || !child || !Number.isInteger(depth) || depth < 1) {
    return { allowed: false, reason: 'delegation_invalid' };
  }

  if (!parent.permissions.includes('ai.delegate')) {
    return { allowed: false, reason: 'delegation_permission_missing' };
  }

  if (depth > parent.maxDelegationDepth) {
    return { allowed: false, reason: 'delegation_depth_exceeded' };
  }

  const parentPermissions = new Set(parent.permissions);
  if (child.permissions.some(permission => !parentPermissions.has(permission))) {
    return { allowed: false, reason: 'delegation_privilege_amplification' };
  }

  if (hasMutationPermission(parent) && hasMutationPermission(child)) {
    const parentResources = normalizedResources(resourceKeys.parent);
    const childResources = normalizedResources(resourceKeys.child);
    if (hasOverlap(parentResources, childResources)) {
      return { allowed: false, reason: 'delegation_resource_conflict' };
    }
  }

  return { allowed: true, reason: 'delegation_allowed' };
}
