import { describe, expect, it } from 'vitest';
import { AtlasOrchestrator, InMemoryPersistence } from '../../packages/ai-core/src';
import { ToolExecutor, toolIds, visibleToolIds, fixedTestCommand, handleMcpRequest } from '../../packages/atlas-mcp/src';
import type { AtlasActor } from '../../packages/governance/src';
import type { AtlasTask } from '../../packages/task-protocol/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };
const readActor: AtlasActor = { actorId: 'reader', kind: 'agent', scope, permissions: ['ai.task.read', 'ai.repo.read', 'ai.ci.read', 'ai.audit.read'] };

function verifiedTask(): AtlasTask {
  return {
    schemaVersion: 1,
    taskId: 'ATL-OMNI-READINESS-001',
    objective: 'Expose evidence readiness through MCP',
    requestedBy: 'user',
    scope,
    assignedAgents: [],
    state: 'verified',
    artifacts: [],
    findings: [],
    commits: [],
    tests: [],
    approvals: [],
    events: [],
    traceId: null,
    deployment: null,
    createdAt: '2026-10-06T18:30:00.000Z',
    updatedAt: '2026-10-06T18:30:00.000Z'
  };
}

describe('ATLAS MCP boundary', () => {
  it('publishes the governed tool catalog and filters it by permissions', () => {
    expect(toolIds).toContain('atlas.task.read');
    expect(toolIds).toContain('atlas.task.readiness');
    expect(toolIds).toContain('atlas.deploy.request');
    expect(visibleToolIds(readActor)).toContain('atlas.task.read');
    expect(visibleToolIds(readActor)).toContain('atlas.task.readiness');
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
    expect(JSON.stringify(response)).toContain('atlas.task.readiness');
    expect(JSON.stringify(response)).not.toContain('atlas.code.propose');
  });

  it('returns structured completion blockers through the governed MCP readiness tool', async () => {
    const persistence = new InMemoryPersistence();
    const orchestrator = new AtlasOrchestrator({ persistence });
    const executor = new ToolExecutor({ orchestrator, persistence });
    await orchestrator.createTask(verifiedTask(), { ...readActor, kind: 'human', permissions: [...readActor.permissions, 'ai.task.create'] });

    const response = await handleMcpRequest(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'atlas.task.readiness', arguments: { taskId: 'ATL-OMNI-READINESS-001' } }
      },
      { actor: readActor, executor }
    );

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        structuredContent: {
          taskId: 'ATL-OMNI-READINESS-001',
          state: 'verified',
          readyToComplete: false,
          reasons: ['missing_test_evidence', 'approval_not_satisfied', 'deployment_not_verified']
        }
      }
    });
  });

  it('supports legacy initialize for clients that still use it', async () => {
    const response = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} }, { actor: readActor });
    expect(JSON.stringify(response)).toContain('atlas-mcp');
  });
});
