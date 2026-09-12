import { createInterface } from 'node:readline';
import { getAgent } from '../../../packages/agent-registry/src';
import { handleMcpRequest, type JsonRpcRequest } from '../../../packages/atlas-mcp/src';
import type { AtlasActor } from '../../../packages/governance/src';
import { createAtlasRuntime } from './runtime/container';

const tenantId = process.env.ATLAS_TENANT_ID;
const organizationId = process.env.ATLAS_ORGANIZATION_ID;
const agentId = process.env.ATLAS_MCP_AGENT_ID;
if (!tenantId || !organizationId || !agentId) {
  throw new Error('ATLAS_TENANT_ID, ATLAS_ORGANIZATION_ID, and ATLAS_MCP_AGENT_ID are required');
}

const definition = getAgent(agentId);
const actor: AtlasActor = {
  actorId: definition.id,
  kind: 'agent',
  scope: { tenantId, organizationId },
  permissions: [...definition.permissions]
};
const runtime = createAtlasRuntime();
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

for await (const line of lines) {
  if (!line.trim()) continue;
  let response: Record<string, unknown> | null;
  try {
    const request = JSON.parse(line) as JsonRpcRequest;
    response = await handleMcpRequest(request, { actor, executor: runtime.executor });
  } catch (error) {
    response = {
      jsonrpc: '2.0', id: null,
      error: { code: -32700, message: error instanceof Error ? error.message : 'Invalid JSON-RPC request' }
    };
  }
  if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
}
