import { describe, expect, it } from 'vitest';
import { ToolRegistry } from '../../packages/execution/src/index';

describe('execution tool registry', () => {
  const tool = (id: string, capabilityId: string) => ({
    id, capabilityId, executionClass: 'observe' as const, permission: 'workflow.read' as const, risk: 'low' as const,
    providerId: null, providerCapability: null, idempotency: 'none' as const, evidenceTypes: [],
    async execute() { return { ok: true, resultRefs: [], evidence: [] }; }
  });

  it('rejects duplicate capability IDs', () => {
    const registry = new ToolRegistry();
    registry.register(tool('one', 'workflow.inspect'));
    expect(() => registry.register(tool('two', 'workflow.inspect'))).toThrow('duplicate_tool');
  });

  it('returns a registered tool by capability', () => {
    const registry = new ToolRegistry([tool('one', 'workflow.inspect')]);
    expect(registry.getByCapability('workflow.inspect')?.id).toBe('one');
  });
});
