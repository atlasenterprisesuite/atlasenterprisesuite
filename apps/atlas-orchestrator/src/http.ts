import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createGitHubInstallationToken } from './github/appAuth';
import {
  loadGitHubAppCredentials,
  storeGitHubAppCredentials,
  storeGitHubInstallation,
} from './github/credentials';
import {
  ATLAS_GITHUB_APP_REPOSITORY,
  ATLAS_GITHUB_APP_REPOSITORY_ID,
  buildGitHubAppManifest,
  createGitHubSetupState,
  exchangeGitHubAppManifestCode,
  renderGitHubManifestRegistrationForm,
  verifyGitHubSetupState,
} from './github/manifest';
import {
  GitHubWebhookError,
  assertGitHubWebhookRepositoryScope,
  ingestGitHubWebhook,
} from './webhooks/github';
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

function githubSetupSecret(): string {
  return String(process.env.ATLAS_GITHUB_SETUP_SECRET || '').trim();
}

function githubPublicUrl(): string {
  const value = String(process.env.ATLAS_PUBLIC_ORCHESTRATOR_URL || '').trim().replace(/\/+$/, '');
  if (!value.startsWith('https://')) throw new Error('ATLAS_PUBLIC_ORCHESTRATOR_URL must be configured with HTTPS');
  return value;
}

async function resolveGitHubWebhookSecret(): Promise<string | undefined> {
  const envSecret = String(process.env.ATLAS_GITHUB_WEBHOOK_SECRET || '').trim();
  if (envSecret) return envSecret;
  const stored = await loadGitHubAppCredentials({ env: process.env });
  return stored?.webhookSecret;
}

function html(res: import('node:http').ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

function redirect(res: import('node:http').ServerResponse, location: string): void {
  res.statusCode = 303;
  res.setHeader('location', location);
  res.setHeader('cache-control', 'no-store');
  res.end();
}

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
    if (req.method === 'GET' && req.url?.startsWith('/github-app/setup?')) {
      const url = new URL(req.url, githubPublicUrl());
      const token = url.searchParams.get('token');
      if (!verifyGitHubSetupState(githubSetupSecret(), token)) {
        return json(res, 403, { error: 'github_app_setup_authorization_required' });
      }

      const state = createGitHubSetupState(githubSetupSecret());
      const manifest = buildGitHubAppManifest(githubPublicUrl());
      return html(res, 200, renderGitHubManifestRegistrationForm({ state, manifest }));
    }

    if (req.method === 'GET' && req.url?.startsWith('/github-app/setup/callback')) {
      const url = new URL(req.url, githubPublicUrl());
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!verifyGitHubSetupState(githubSetupSecret(), state)) {
        return json(res, 403, { error: 'github_app_setup_state_invalid' });
      }
      if (!code) return json(res, 400, { error: 'github_app_manifest_code_required' });

      const converted = await exchangeGitHubAppManifestCode({ code });
      await storeGitHubAppCredentials({
        env: process.env,
        credentials: {
          appId: converted.appId,
          privateKey: converted.privateKey,
          webhookSecret: converted.webhookSecret,
          clientId: converted.clientId,
          clientSecret: converted.clientSecret,
        },
      });

      if (converted.slug) {
        return redirect(res, `https://github.com/apps/${encodeURIComponent(converted.slug)}/installations/new`);
      }

      return html(res, 200, `<!doctype html><html><body><h1>ATLAS GitHub App created</h1><p>Credentials were stored securely. Open the GitHub App settings and install it on ${ATLAS_GITHUB_APP_REPOSITORY}.</p></body></html>`);
    }

    if (req.method === 'GET' && req.url?.startsWith('/github-app/setup/installed')) {
      const url = new URL(req.url, githubPublicUrl());
      const installationId = Number(url.searchParams.get('installation_id'));
      if (!Number.isSafeInteger(installationId) || installationId <= 0) {
        return json(res, 400, { error: 'github_app_installation_id_invalid' });
      }

      const credentials = await loadGitHubAppCredentials({ env: process.env });
      if (!credentials) return json(res, 503, { error: 'github_app_credentials_not_ready' });

      const installation = await createGitHubInstallationToken({
        credentials,
        installationId,
        repositoryIds: [ATLAS_GITHUB_APP_REPOSITORY_ID],
        permissions: {
          actions: 'read',
          checks: 'read',
          contents: 'write',
          deployments: 'read',
          issues: 'write',
          pull_requests: 'write',
          statuses: 'read',
        },
      });

      const repositoryVerified = installation.repositories.some(
        (repository) => repository.id === ATLAS_GITHUB_APP_REPOSITORY_ID
          || repository.fullName === ATLAS_GITHUB_APP_REPOSITORY,
      );
      if (!repositoryVerified) {
        return json(res, 403, { error: 'github_app_canonical_repository_not_installed' });
      }

      await storeGitHubInstallation({
        env: process.env,
        installationId,
        repository: ATLAS_GITHUB_APP_REPOSITORY,
      });

      return html(res, 200, `<!doctype html><html><body><h1>ATLAS GitHub App connected</h1><p>Installation verified for ${ATLAS_GITHUB_APP_REPOSITORY}. Webhooks remain governed by ATLAS Director, MCP, CI, and release gates.</p></body></html>`);
    }

    if (req.method === 'POST' && req.url === '/webhooks/github') {
      const body = await readBody(req, 2_097_152);
      try {
        const envelope = ingestGitHubWebhook({
          headers: req.headers,
          body,
          secret: await resolveGitHubWebhookSecret(),
        });
        assertGitHubWebhookRepositoryScope(envelope, process.env.ATLAS_GITHUB_REPOSITORY);

        const claimed = await runtime.persistence.claimGitHubWebhookDelivery(scope, {
          deliveryId: envelope.deliveryId,
          event: envelope.event,
          action: envelope.action,
          installationId: envelope.installationId,
          repository: envelope.repository,
          receivedAt: new Date().toISOString(),
        });

        return json(res, 202, {
          status: claimed ? 'accepted' : 'duplicate',
          deliveryId: envelope.deliveryId,
          event: envelope.event,
          action: envelope.action,
          installationId: envelope.installationId,
          repository: envelope.repository,
          duplicate: !claimed,
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
