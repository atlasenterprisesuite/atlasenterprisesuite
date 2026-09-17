import { createServer } from 'node:http';
import { handleMcpRequest, type JsonRpcRequest } from '../../../packages/atlas-mcp/src';
import { createAtlasRuntime } from './runtime/container';
import { resolveHttpActor } from './runtime/auth';
import { resolvePersistence } from './runtime/persistence';
import { readiness } from './runtime/readiness';

const runtime = createAtlasRuntime({ persistence: resolvePersistence(process.env) });
const port = Number(process.env.ATLAS_MCP_PORT ?? 8788);
const tenantId = process.env.ATLAS_TENANT_ID;
const organizationId = process.env.ATLAS_ORGANIZATION_ID;

if (!tenantId || !organizationId) {
  throw new Error('ATLAS_TENANT_ID and ATLAS_ORGANIZATION_ID are required');
}

const scope = { tenantId, organizationId };

function json(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 1_048_576) throw new Error('ATLAS MCP request exceeds 1 MiB');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      return json(res, 200, { status: 'ok', service: 'atlas-orchestrator', durable: runtime.persistence.durable });
    }
    if (req.method === 'GET' && req.url === '/readyz') {
      const state = readiness(runtime.persistence);
      return json(res, state.ready ? 200 : 503, state);
    }
    if (req.method !== 'POST' || req.url !== '/mcp') {
      return json(res, 404, { error: 'not_found' });
    }

    const actor = resolveHttpActor(req.headers.authorization, scope, process.env);
    const request = await readJson(req) as JsonRpcRequest;
    const response = await handleMcpRequest(request, { actor, executor: runtime.executor });
    if (response === null) {
      res.statusCode = 202;
      return res.end();
    }
    return json(res, 200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ATLAS MCP request failed';
    const status = /Unauthorized/.test(message) ? 401 : 400;
    return json(res, status, { error: message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.error(`ATLAS MCP HTTP listening on http://127.0.0.1:${port}/mcp`);
  if (!runtime.persistence.durable) console.error('ATLAS MCP readiness blocked: persistence_not_durable');
});
