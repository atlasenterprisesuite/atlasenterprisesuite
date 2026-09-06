import { describe, expect, it } from 'vitest';
import { toolIds, visibleToolIds, fixedTestCommand, handleMcpRequest } from '../../packages/atlas-mcp/src';
import type { AtlasActor } from '../../packages/governance/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const readActor: AtlasActor = { actorId: 'reader', kind: 'agent', scope, permissions: ['ai.task.read', 'ai.repo.read', 'ai.ci.read', 'ai.audit.read'] };

describe('ATLAS MCP boundary', () => {
  it('publishes the governed tool catalog and filters it by permissions', () => {
    expect(toolIds).toContain('atlas.task.read');
    expect(toolIds).toContain('atlas.deploy.request');
    expect(visibleToolIds(readActor)).toContain('atlas.task.read');
    expect(visibleToolIds(readActor)).not.toContain('atlas.code.propose');
    expect(visibleToolIds(readActor)).not.toContain('atlas.deploy.request');
  });

  it('maps test requests to fixed commands only', () => {
    expect(fixedTestCommand('unit')).toBe('npm run test:unit');
    expect(fixedTestCommand('integration')).toBe('npm run test:integration');
    expect(() => fixedTestCommand('rm -rf /' as never)).toThrow(/Unsupported ATLAS test command/);
  });

  it('answers MCP tools/list without requiring an initialize handshake', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, { actor: readActor });
    expect(response).toMatchObject({ jsonrpc: '2.0', id: 1 });
    expect(JSON.stringify(response)).toContain('atlas.task.read');
    expect(JSON.stringify(response)).not.toContain('atlas.code.propose');
  });

  it('supports legacy initialize for clients that still use it', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} }, { actor: readActor });
    expect(JSON.stringify(response)).toContain('atlas-mcp');
  });
});
