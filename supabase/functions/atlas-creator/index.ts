import { requireCreatorPermission } from '../../../packages/creator/permissions.ts';
import { adaptProviderToCreativeEngine } from '../../../packages/creator/creative_engine.ts';
import { compilePromptExport, PROMPT_EXPORT_ENGINE } from '../../../packages/creator/prompt_engine.ts';
import type { CreativePlan } from '../../../packages/creator/creative_plan.ts';
import type { ContentWorkspaceState } from '../../../packages/creator/content_intelligence.ts';
import type { WebLaunchBlueprint } from '../../../packages/creator/web_launch.ts';
import type { CreatorPermission, ProductionSpec, ProviderId } from '../../../packages/creator/types.ts';
import { validateProductionSpec } from '../../../packages/creator/validator.ts';
import { resolveCreatorContext, type CreatorContext } from './_shared/context.ts';
import {
  createCreatorRecordingDownload,
  creatorRecordingReadiness,
  uploadCreatorRecording
} from './_shared/recordings.ts';
import { creatorError, creatorErrorResponse, optionsResponse, withCors } from './_shared/errors.ts';
import {
  createAssetPreview,
  getContentWorkspace,
  getCreativePlan,
  getWebLaunchBlueprint,
  getProduction,
  listAssets,
  listContentWorkspaces,
  listCreativePlans,
  listWebLaunchBlueprints,
  listProductions,
  listProviderReadiness,
  saveContentWorkspace,
  saveCreativePlan,
  saveWebLaunchBlueprint,
  saveProduction,
  writeCreatorAudit
} from './_shared/repository.ts';

const VERSION = '2026-09-18.3';
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

function creativePlanIdFrom(url: URL, body?: Record<string, any>) {
  return String(body?.creative_plan_id || body?.creativePlanId || url.searchParams.get('creative_plan_id') || url.searchParams.get('id') || '').trim();
}


function webLaunchBlueprintIdFrom(url: URL, body?: Record<string, any>) {
  return String(body?.blueprint_id || body?.blueprintId || url.searchParams.get('blueprint_id') || url.searchParams.get('id') || '').trim();
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

async function handleEngines(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  const providers = await listProviderReadiness(ctx.orgId);
  return json({
    ok: true,
    engines: [PROMPT_EXPORT_ENGINE, ...providers.map(adaptProviderToCreativeEngine)]
  });
}

async function handlePromptExport(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const body = await bodyJson(req);
  let promptPackage;
  try {
    promptPackage = compilePromptExport({
      mediaKind: body.media_kind,
      brief: String(body.brief || ''),
      aspectRatio: body.aspect_ratio ? String(body.aspect_ratio) : undefined,
      destination: body.destination ? String(body.destination) : undefined,
      language: body.language ? String(body.language) : undefined,
      negativeConstraints: Array.isArray(body.negative_constraints)
        ? body.negative_constraints.map((value: unknown) => String(value))
        : undefined
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'creative_brief_too_short') {
      throw creatorError('creative_brief_too_short', 422);
    }
    throw error;
  }
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.prompt.exported', null, {
    media_kind: promptPackage.mediaKind,
    engine_id: promptPackage.engineId
  });
  return json({ ok: true, prompt_package: promptPackage });
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


async function handleWebLaunchBlueprints(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  return json({ ok: true, blueprints: await listWebLaunchBlueprints(ctx.orgId) });
}

async function handleWebLaunchBlueprint(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const blueprintId = webLaunchBlueprintIdFrom(url);
  if (!blueprintId) throw creatorError('web_launch_blueprint_id_required', 422);
  return json({ ok: true, blueprint: await getWebLaunchBlueprint(ctx.orgId, blueprintId) });
}

async function handleWebLaunchBlueprintSave(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const body = await bodyJson(req);
  const blueprint = body.blueprint as WebLaunchBlueprint | undefined;
  if (!blueprint || typeof blueprint !== 'object' || !blueprint.id) {
    throw creatorError('web_launch_blueprint_required', 422);
  }
  const expectedVersion = Number.isInteger(body.expected_version)
    ? Number(body.expected_version)
    : Number(blueprint.version || 0);
  const saved = await saveWebLaunchBlueprint(ctx, blueprint, expectedVersion);
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.web_launch.saved', String(saved.id), {
    blueprint_id: saved.id,
    version: saved.version
  });
  return json({ ok: true, blueprint: saved });
}

async function handleCreativePlans(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  return json({ ok: true, creative_plans: await listCreativePlans(ctx.orgId) });
}

async function handleCreativePlan(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const planId = creativePlanIdFrom(url);
  if (!planId) throw creatorError('creative_plan_id_required', 422);
  return json({ ok: true, creative_plan: await getCreativePlan(ctx.orgId, planId) });
}

async function handleCreativePlanSave(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const body = await bodyJson(req);
  const plan = body.creative_plan as CreativePlan | undefined;
  if (!plan || typeof plan !== 'object' || !plan.id) {
    throw creatorError('creative_plan_required', 422);
  }
  const expectedVersion = Number.isInteger(body.expected_version)
    ? Number(body.expected_version)
    : Number(plan.version || 0);
  const saved = await saveCreativePlan(ctx, plan, expectedVersion);
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.plan.saved', String(saved.id), {
    creative_plan_id: saved.id,
    media_kinds: saved.media_kinds,
    version: saved.version
  });
  return json({ ok: true, creative_plan: saved });
}

async function handleAssets(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const productionId = productionIdFrom(url) || undefined;
  return json({ ok: true, assets: await listAssets(ctx.orgId, productionId) });
}

async function handleAssetPreview(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const assetId = String(url.searchParams.get('asset_id') || '').trim();
  if (!assetId) throw creatorError('asset_id_required', 422);
  const result = await createAssetPreview(ctx.orgId, assetId);
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.asset.previewed', assetId, {
    asset_id: assetId,
    expires_in: result.expiresIn
  });
  return json({
    ok: true,
    asset: result.asset,
    signed_url: result.signedUrl,
    expires_in: result.expiresIn
  });
}

async function handleRecordingReadiness(req: Request) {
  const ctx = await creatorContext(req, 'creator.read');
  const storage = await creatorRecordingReadiness();
  const canUpload = ctx.permissions.includes('creator.admin') || ctx.permissions.includes('creator.write');
  return json({
    ok: true,
    service: 'atlas-creator-recordings',
    organization_id: ctx.orgId,
    connected: storage.connected,
    reason: storage.reason,
    upload_allowed: canUpload,
    bucket: storage.connected ? 'atlas-creator-recordings' : null,
    checked_at: new Date().toISOString()
  });
}

async function handleRecordingUpload(req: Request) {
  const ctx = await creatorContext(req, 'creator.write');
  const form = await req.formData().catch(() => { throw creatorError('invalid_form_data', 400); });
  const files = form.getAll('recording').filter((value): value is File => value instanceof File);
  if (files.length !== 1) throw creatorError('recording_required', 422);
  const language = String(form.get('language') || '').trim();
  if (language !== 'es' && language !== 'en') throw creatorError('recording_language_invalid', 422);
  const durationRaw = String(form.get('duration_seconds') || '').trim();
  const durationSeconds = durationRaw ? Number(durationRaw) : null;
  if (durationSeconds !== null && (!Number.isFinite(durationSeconds) || durationSeconds < 0)) {
    throw creatorError('recording_duration_invalid', 422);
  }
  const recording = await uploadCreatorRecording(ctx, {
    file: files[0],
    language,
    durationSeconds
  });
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.teleprompter.recording_saved', String(recording.id), {
    recording_id: recording.id,
    language,
    mime_type: recording.mime_type,
    file_size_bytes: recording.file_size_bytes,
    duration_seconds: recording.duration_seconds
  });
  return json({ ok: true, recording }, 201);
}

async function handleRecordingDownload(req: Request, url: URL) {
  const ctx = await creatorContext(req, 'creator.read');
  const recordingId = String(url.searchParams.get('recording_id') || '').trim();
  if (!recordingId) throw creatorError('recording_id_required', 422);
  const result = await createCreatorRecordingDownload(ctx, recordingId);
  await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.teleprompter.recording_downloaded', recordingId, {
    recording_id: recordingId,
    expires_in: result.expiresIn
  });
  return json({
    ok: true,
    recording: result.recording,
    signed_url: result.signedUrl,
    expires_in: result.expiresIn
  });
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
  if (api === 'engines' && req.method === 'GET') return handleEngines(req);
  if (api === 'prompt-export' && req.method === 'POST') return handlePromptExport(req);
  if (api === 'productions') return handleProductions(req);
  if (api === 'production') return handleProduction(req, url);
  if (api === 'save') return handleSave(req);
  if (api === 'content-workspaces') return handleContentWorkspaces(req);
  if (api === 'content-workspace') return handleContentWorkspace(req, url);
  if (api === 'content-save') return handleContentSave(req);
  if (api === 'web-launch-blueprints' && req.method === 'GET') return handleWebLaunchBlueprints(req);
  if (api === 'web-launch-blueprint' && req.method === 'GET') return handleWebLaunchBlueprint(req, url);
  if (api === 'web-launch-save' && req.method === 'POST') return handleWebLaunchBlueprintSave(req);
  if (api === 'creative-plans' && req.method === 'GET') return handleCreativePlans(req);
  if (api === 'creative-plan' && req.method === 'GET') return handleCreativePlan(req, url);
  if (api === 'creative-plan-save' && req.method === 'POST') return handleCreativePlanSave(req);
  if (api === 'assets') return handleAssets(req, url);
  if (api === 'asset-preview' && req.method === 'GET') return handleAssetPreview(req, url);
  if (api === 'recording-readiness' && req.method === 'GET') return handleRecordingReadiness(req);
  if (api === 'recording-upload' && req.method === 'POST') return handleRecordingUpload(req);
  if (api === 'recording-download' && req.method === 'GET') return handleRecordingDownload(req, url);
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
