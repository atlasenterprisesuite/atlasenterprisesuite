import { describe, expect, it } from 'vitest';
import { evaluateDelegation } from '../../packages/agent-registry/src/delegationPolicy';
import type { AtlasAgentDefinition } from '../../packages/agent-registry/src/types';

function agent(overrides: Partial<AtlasAgentDefinition> = {}): AtlasAgentDefinition {
  return {
    id: 'parent',
    providerId: 'openai',
    role: 'Coordinator',
    capabilities: ['plan'],
    permissions: ['ai.task.read', 'ai.task.update', 'ai.delegate', 'ai.repo.read'],
    allowedTools: ['atlas.task.read', 'atlas.agent.delegate'],
    allowedStates: ['planning'],
    allowedEnvironments: ['development'],
    maxDelegationDepth: 2,
    ...overrides,
  };
}

describe('ATLAS multi-agent delegation policy', () => {
  it('allows independent bounded delegation when the parent owns every delegated permission', () => {
    const decision = evaluateDelegation({
      parent: agent(),
      child: agent({ id: 'child', permissions: ['ai.task.read', 'ai.repo.read'], maxDelegationDepth: 0 }),
      depth: 1,
      resourceKeys: { parent: ['docs/spec.md'], child: ['src/adapter.ts'] },
    });

    expect(decision).toEqual({ allowed: true, reason: 'delegation_allowed' });
  });

  it('denies delegation beyond the parent maximum depth', () => {
    const decision = evaluateDelegation({
      parent: agent({ maxDelegationDepth: 1 }),
      child: agent({ id: 'child', maxDelegationDepth: 0 }),
      depth: 2,
      resourceKeys: { parent: [], child: [] },
    });

    expect(decision).toEqual({ allowed: false, reason: 'delegation_depth_exceeded' });
  });

  it('denies delegation when the parent lacks ai.delegate', () => {
    const decision = evaluateDelegation({
      parent: agent({ permissions: ['ai.task.read', 'ai.repo.read'] }),
      child: agent({ id: 'child', permissions: ['ai.task.read'], maxDelegationDepth: 0 }),
      depth: 1,
      resourceKeys: { parent: [], child: [] },
    });

    expect(decision).toEqual({ allowed: false, reason: 'delegation_permission_missing' });
  });

  it('denies privilege amplification when the child requires a permission the parent does not own', () => {
    const decision = evaluateDelegation({
      parent: agent(),
      child: agent({ id: 'child', permissions: ['ai.task.read', 'ai.code.write'], maxDelegationDepth: 0 }),
      depth: 1,
      resourceKeys: { parent: [], child: [] },
    });

    expect(decision).toEqual({ allowed: false, reason: 'delegation_privilege_amplification' });
  });

  it('denies concurrent mutation of the same resource while allowing read-only overlap', () => {
    const denied = evaluateDelegation({
      parent: agent({ permissions: ['ai.task.read', 'ai.task.update', 'ai.delegate', 'ai.repo.read', 'ai.code.write'] }),
      child: agent({ id: 'child', permissions: ['ai.task.read', 'ai.repo.read', 'ai.code.write'], maxDelegationDepth: 0 }),
      depth: 1,
      resourceKeys: { parent: ['src/router.ts'], child: ['src/router.ts'] },
    });
    const allowedReadOnly = evaluateDelegation({
      parent: agent(),
      child: agent({ id: 'reviewer', permissions: ['ai.task.read', 'ai.repo.read'], maxDelegationDepth: 0 }),
      depth: 1,
      resourceKeys: { parent: ['src/router.ts'], child: ['src/router.ts'] },
    });

    expect(denied).toEqual({ allowed: false, reason: 'delegation_resource_conflict' });
    expect(allowedReadOnly).toEqual({ allowed: true, reason: 'delegation_allowed' });
  });
});
