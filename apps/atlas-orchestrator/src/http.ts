import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { GitHubWebhookError, ingestGitHubWebhook } from './webhooks/github';
import { handleMcpRequest, type JsonRpcRequest } from '../../../packages/atlas-mcp/src';
import { createAtlasRuntime } from './runtime/container';
import { resolveHttpActor } from './runtime/auth';
import { resolvePersistence } from './runtime/persistence';
import { verifyReadiness } from './runtime/readiness';

const runtime = createAtlasRuntime({ persistence: resolvePersistence(process.env) });
const port = Number(process.env.PORT ?? process.env.ATLAS_MCP_PORT ?? 8788);
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

async function readBody(req: import('node:http').IncomingMessage, maxBytes = 1_048_576): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) throw new Error('ATLAS request exceeds allowed size');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(req: import('node:http').IncomingMessage): Promise<unknown> {
  return JSON.parse((await readBody(req)).toString('utf8'));
}

function localAiAuthorized(authorization: string | undefined): boolean {
  const expected = String(process.env.ATLAS_ORCHESTRATOR_PERSISTENCE_TOKEN || '').trim();
  if (!expected || !authorization?.startsWith('Bearer ')) return false;
  const supplied = authorization.slice('Bearer '.length).trim();
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

async function proxyLocalAi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): Promise<void> {
  if (!localAiAuthorized(req.headers.authorization)) {
    return json(res, 401, { error: 'local_ai_authentication_required' });
  }

  const internal = String(process.env.ATLAS_LOCAL_AI_INTERNAL_URL || '').trim().replace(/\/+$/, '');
  if (!internal.startsWith('http://127.0.0.1:')) {
    return json(res, 503, { error: 'local_ai_not_ready' });
  }

  const isHealth = req.method === 'GET' && req.url === '/local-ai/health';
  const isResponses = req.method === 'POST' && req.url === '/local-ai/v1/responses';
  if (!isHealth && !isResponses) return json(res, 404, { error: 'not_found' });

  const target = isHealth ? `${internal}/health` : `${internal}/v1/responses`;
  const body = isResponses ? await readBody(req, 262_144) : undefined;
  const upstream = await fetch(target, {
    method: isHealth ? 'GET' : 'POST',
    headers: isResponses ? { 'content-type': 'application/json' } : undefined,
    body,
    signal: AbortSignal.timeout(isHealth ? 10_000 : 120_000),
  });
  const payload = Buffer.from(await upstream.arrayBuffer());
  res.statusCode = upstream.status;
  res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      return json(res, 200, { status: 'ok', service: 'atlas-orchestrator', durable: runtime.persistence.durable });
    }
    if (req.method === 'GET' && req.url === '/readyz') {
      const state = await verifyReadiness(runtime.persistence, scope);
      return json(res, state.ready ? 200 : 503, state);
    }
    if (req.method === 'POST' && req.url === '/webhooks/github') {
      const body = await readBody(req, 2_097_152);
      try {
        const envelope = ingestGitHubWebhook({
          headers: req.headers,
          body,
          secret: process.env.ATLAS_GITHUB_WEBHOOK_SECRET,
        });
        return json(res, 202, {
          status: 'accepted',
          deliveryId: envelope.deliveryId,
          event: envelope.event,
          action: envelope.action,
          installationId: envelope.installationId,
          repository: envelope.repository,
          executionAuthorized: false,
        });
      } catch (error) {
        if (error instanceof GitHubWebhookError) {
          return json(res, error.status, { error: error.code });
        }
        throw error;
      }
    }
    if (req.url === '/local-ai/health' || req.url === '/local-ai/v1/responses') {
      return await proxyLocalAi(req, res);
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

server.listen(port, '0.0.0.0', () => {
  console.error(`ATLAS MCP HTTP listening on port ${port}`);
  if (!runtime.persistence.durable) console.error('ATLAS MCP readiness blocked: persistence_not_durable');
});
