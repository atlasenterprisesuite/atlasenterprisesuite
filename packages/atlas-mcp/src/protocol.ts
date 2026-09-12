import type { AtlasActor } from '../../governance/src';
import { toolIds, visibleToolIds, type AtlasToolId } from './toolIds';
import type { ToolExecutor } from './toolExecutor';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface AtlasMcpContext {
  actor: AtlasActor;
  executor?: ToolExecutor;
}

const descriptions: Record<AtlasToolId, string> = {
  'atlas.task.create': 'Create a governed ATLAS collaboration task.',
  'atlas.task.read': 'Read one ATLAS task in the caller scope.',
  'atlas.task.update': 'Move an ATLAS task through an allowed governed state transition.',
  'atlas.task.claim': 'Claim an ATLAS task when the claim workflow is enabled.',
  'atlas.agent.delegate': 'Delegate work to an authorized registered ATLAS agent.',
  'atlas.agent.respond': 'Record an agent response when the response workflow is enabled.',
  'atlas.repo.inspect': 'Inspect authorized repository content.',
  'atlas.code.propose': 'Propose code changes without bypassing repository governance.',
  'atlas.test.run': 'Run one fixed ATLAS verification command.',
  'atlas.review.request': 'Request governed review.',
  'atlas.pr.create': 'Create a governed pull request.',
  'atlas.ci.verify': 'Read verified ATLAS CI evidence.',
  'atlas.deploy.request': 'Create a deployment request; this never deploys by itself.',
  'atlas.audit.read': 'Read redacted audit events for one task.'
};

function toolSchema(name: AtlasToolId): Record<string, unknown> {
  if (name === 'atlas.task.read' || name === 'atlas.audit.read' || name === 'atlas.deploy.request') {
    return { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'], additionalProperties: false };
  }
  if (name === 'atlas.test.run') {
    return { type: 'object', properties: { kind: { type: 'string', enum: ['unit', 'integration', 'typecheck', 'build'] } }, required: ['kind'], additionalProperties: false };
  }
  return { type: 'object', additionalProperties: true };
}

function ok(id: JsonRpcRequest['id'], result: unknown): Record<string, unknown> {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function error(id: JsonRpcRequest['id'], code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export async function handleMcpRequest(request: JsonRpcRequest, context: AtlasMcpContext): Promise<Record<string, unknown> | null> {
  if (request.method === 'notifications/initialized') return null;
  if (request.method === 'initialize') {
    return ok(request.id, {
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: { name: 'atlas-mcp', version: '0.1.0' }
    });
  }
  if (request.method === 'ping') return ok(request.id, {});
  if (request.method === 'tools/list') {
    const visible = visibleToolIds(context.actor);
    return ok(request.id, {
      tools: visible.map((name) => ({ name, description: descriptions[name], inputSchema: toolSchema(name) }))
    });
  }
  if (request.method === 'tools/call') {
    if (!context.executor) return error(request.id, -32000, 'ATLAS tool executor is not configured');
    const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
    if (typeof params.name !== 'string' || !toolIds.includes(params.name as AtlasToolId)) {
      return error(request.id, -32602, 'Unknown ATLAS tool');
    }
    if (!visibleToolIds(context.actor).includes(params.name as AtlasToolId)) {
      return error(request.id, -32001, 'ATLAS tool is not authorized for this actor');
    }
    try {
      const value = await context.executor.execute(params.name as AtlasToolId, params.arguments, context.actor);
      return ok(request.id, { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value });
    } catch (cause) {
      return error(request.id, -32002, cause instanceof Error ? cause.message : 'ATLAS tool execution failed');
    }
  }
  return error(request.id, -32601, `Method not found: ${request.method}`);
}
