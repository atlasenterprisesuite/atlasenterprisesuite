import { requireCreatorPermission } from '../../../packages/creator/permissions.ts';
import type { ContentWorkspaceState } from '../../../packages/creator/content_intelligence.ts';
import type { CreatorPermission, ProductionSpec, ProviderId } from '../../../packages/creator/types.ts';
import { validateProductionSpec } from '../../../packages/creator/validator.ts';
import { resolveCreatorContext, type CreatorContext } from './_shared/context.ts';
import { creatorError, creatorErrorResponse, optionsResponse, withCors } from './_shared/errors.ts';
import {
  getContentWorkspace,
  getProduction,
  listAssets,
  listContentWorkspaces,
  listProductions,
  listProviderReadiness,
  saveContentWorkspace,
  saveProduction,
  writeCreatorAudit
} from './_shared/repository.ts';

const VERSION = '2026-09-15.1';
const PROVIDER_IDS = new Set<ProviderId>(['seedance', 'veo', 'kling', 'wan', 'minimax']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function bodyJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    return body as Record<string, any>;
  } catch {
    throw creatorError('invalid_json', 400);
  }
}

function requirePermission(ctx: CreatorContext, permission: CreatorPermission) {
  try {
    requireCreatorPermission(ctx.permissions, permission);
  } catch {
    throw creatorError('authorization_denied', 403);
  }
}

function productionIdFrom(url: URL, body?: Record<string, any>) {
  return String(body?.production_id || body?.productionId || url.searchParams.get('production_id') || url.searchParams.get('id') || '').trim();
}

function workspaceIdFrom(url: URL, body?: Record<string, any>) {
  return String(body?.workspace_id || body?.workspaceId || url.searchParams.get('workspace_id') || url.searchParams.get('id') || '').trim();
}

async function creatorContext(req: Request, permission: CreatorPermission) {
  const ctx = await resolveCreatorContext(req);
  requirePermission(ctx, permission);
  return ctx;
}

async function handleReadiness(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  const providers = await listProviderReadiness(ctx.orgId);
  return json({
    ok: true,
    service: 'atlas-creator',
    version: VERSION,
    organization_id: ctx.orgId,
    role: ctx.role,
    permissions: ctx.permissions,
    providers,
    generation_enabled: providers.some(provider => provider.connectionState === 'ready'),
    checked_at: new Date().toISOString()
  });
}

async function handleProviders(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  return json({ ok: true, providers: await listProviderReadiness(ctx.orgId) });
}

async function handleProductions(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  return json({ ok: true, productions: await listProductions(ctx.orgId) });
}

async function handleProduction(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const productionId = productionIdFrom(url);
  if (!productionId) throw creatorError('production_id_required', 422);
  return json({ ok: true, production: await getProduction(ctx.orgId, productionId) });
}

async function handleSave(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const body = await bodyJson(req);
  const spec = body.spec as ProductionSpec | undefined;
  if (!spec || typeof spec !== 'object' || !spec.id) throw creatorError('production_spec_required', 422);
  const normalizedSpec: ProductionSpec = {
    ...spec,
    organizationId: ctx.orgId,
    createdByUserId: spec.createdByUserId || ctx.userId
  };
  const expectedVersion = Number.isInteger(body.expected_version) ? Number(body.expected_version) : undefined;
  const saved = await saveProduction(ctx, normalizedSpec, expectedVersion);
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.director.saved', String(saved.id), {
    production_id: saved.id,
    status: saved.status,
    version: saved.version
  });
  return json({ ok: true, production: saved });
}

async function handleContentWorkspaces(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  return json({ ok: true, workspaces: await listContentWorkspaces(ctx.orgId) });
}

async function handleContentWorkspace(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const workspaceId = workspaceIdFrom(url);
  if (!workspaceId) throw creatorError('workspace_id_required', 422);
  return json({ ok: true, workspace: await getContentWorkspace(ctx.orgId, workspaceId) });
}

async function handleContentSave(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const body = await bodyJson(req);
  const workspace = body.workspace as ContentWorkspaceState | undefined;
  if (!workspace || typeof workspace !== 'object' || !workspace.id) {
    throw creatorError('content_workspace_required', 422);
  }
  const expectedVersion = Number.isInteger(body.expected_version)
    ? Number(body.expected_version)
    : Number(workspace.version || 0);
  const saved = await saveContentWorkspace(ctx, workspace, expectedVersion);
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.content.saved', String(saved.id), {
    workspace_id: saved.id,
    version: saved.version
  });
  return json({ ok: true, workspace: saved });
}

async function handleAssets(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const productionId = productionIdFrom(url) || undefined;
  return json({ ok: true, assets: await listAssets(ctx.orgId, productionId) });
}

async function handleSubmit(req: Request): Promise<never> {
  const ctx = await creatorContext(req, 'creator.generate');
  const body = await bodyJson(req);
  const productionId = productionIdFrom(new URL(req.url), body);
  if (!productionId) throw creatorError('production_id_required', 422);
  const row: any = await getProduction(ctx.orgId, productionId);
  const spec = row.production_spec_json as ProductionSpec | undefined;
  if (!spec || typeof spec !== 'object') throw creatorError('production_spec_invalid', 409);

  const requestedProvider = String(body.provider_id || spec.providerPreference || '').trim() as ProviderId;
  if (!PROVIDER_IDS.has(requestedProvider)) throw creatorError('provider_required', 422);
  const providers = await listProviderReadiness(ctx.orgId);
  const provider = providers.find(item => item.providerId === requestedProvider) || null;
  if (!provider || provider.connectionState !== 'ready' || !provider.capability) {
    throw creatorError('provider_not_ready', 409);
  }
  const validation = validateProductionSpec(spec, provider.capability);
  if (validation.status === 'blocking') {
    throw creatorError('production_blocked', 409);
  }
  throw creatorError('provider_adapter_not_configured', 503);
}

async function route(req: Request) {
  const url = new URL(req.url);
  const api = String(url.searchParams.get('api') || '').trim();
  if (api === 'readiness') return handleReadiness(req);
  if (api === 'providers') return handleProviders(req);
  if (api === 'productions') return handleProductions(req);
  if (api === 'production') return handleProduction(req, url);
  if (api === 'save') return handleSave(req);
  if (api === 'content-workspaces') return handleContentWorkspaces(req);
  if (api === 'content-workspace') return handleContentWorkspace(req, url);
  if (api === 'content-save') return handleContentSave(req);
  if (api === 'assets') return handleAssets(req, url);
  if (api === 'submit') return handleSubmit(req);
  return json({ ok: false, error: 'not_found' }, 404);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return optionsResponse(origin);
  try {
    return withCors(await route(req), origin);
  } catch (error) {
    return withCors(creatorErrorResponse(error), origin);
  }
});
