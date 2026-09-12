import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { requireCreatorPermission } from '../../../packages/creator/permissions.ts';
import type { ProductionSpec } from '../../../packages/creator/types.ts';
import { validateProductionSpec } from '../../../packages/creator/validator.ts';
import { resolveCreatorContext } from '../atlas-creator/_shared/context.ts';
import { creatorError, creatorErrorResponse } from '../atlas-creator/_shared/errors.ts';
import { getProduction, writeCreatorAudit } from '../atlas-creator/_shared/repository.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const NATIVE_URL = (Deno.env.get('ATLAS_NATIVE_COMPOSER_URL') || '').replace(/\/$/, '');
const NATIVE_TOKEN = Deno.env.get('ATLAS_NATIVE_COMPOSER_TOKEN') || '';
const ASSET_BUCKET = 'creator-assets';
const PROVIDER_ID = 'atlas-native';
const SUPPORTED_RATIOS = new Set(['9:16', '16:9', '1:1']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw creatorError('server_secret_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function bodyJson(req: Request): Promise<Record<string, any>> {
  try {
    const value = await req.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
    return value as Record<string, any>;
  } catch {
    throw creatorError('invalid_json', 400);
  }
}

async function context(req: Request, permission: 'creator.read' | 'creator.generate') {
  const ctx = await resolveCreatorContext(req);
  try {
    requireCreatorPermission(ctx.permissions, permission);
  } catch {
    throw creatorError('authorization_denied', 403);
  }
  return ctx;
}

function assertRuntimeConfigured() {
  if (!NATIVE_URL || !NATIVE_TOKEN) throw creatorError('native_composer_not_configured', 503);
}

async function nativeFetch(path: string, init: RequestInit = {}) {
  assertRuntimeConfigured();
  return fetch(`${NATIVE_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${NATIVE_TOKEN}`,
      ...(init.headers || {})
    }
  });
}

async function probeNative() {
  assertRuntimeConfigured();
  const response = await fetch(`${NATIVE_URL}/health`, { headers: { 'cache-control': 'no-cache' } });
  const data = await response.json().catch(() => ({ ok: false, state: 'error' }));
  if (!response.ok || data?.state !== 'ready') {
    throw creatorError('native_composer_unavailable', 503);
  }
  return data;
}

async function ensureAssetBucket(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.storage.getBucket(ASSET_BUCKET);
  if (data) return;
  const { error } = await sb.storage.createBucket(ASSET_BUCKET, { public: false });
  if (error && !String(error.message || '').toLowerCase().includes('already')) {
    throw creatorError('asset_bucket_unavailable', 500);
  }
}

function scriptFor(spec: ProductionSpec) {
  const dialogue = spec.audioPlan.dialogue.map(value => value.trim()).filter(Boolean).join(' ');
  return dialogue || spec.brief.trim();
}

function normalizedRatio(spec: ProductionSpec) {
  const ratio = spec.aspectRatio === 'adaptive' ? '9:16' : spec.aspectRatio;
  if (!SUPPORTED_RATIOS.has(ratio)) throw creatorError('native_aspect_ratio_unsupported', 409);
  return ratio;
}

async function handleReadiness(req: Request) {
  const ctx = await context(req, 'creator.read');
  const native = await probeNative();
  return json({
    ok: true,
    renderer: PROVIDER_ID,
    billing_class: 'zero-cost',
    execution: 'self-hosted',
    organization_id: ctx.orgId,
    native
  });
}

async function handleGenerate(req: Request) {
  const ctx = await context(req, 'creator.generate');
  const body = await bodyJson(req);
  const productionId = String(body.production_id || '').trim();
  if (!productionId) throw creatorError('production_id_required', 422);
  const expectedVersion = Number(body.expected_version);
  if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    throw creatorError('expected_version_required', 422);
  }

  const row: any = await getProduction(ctx.orgId, productionId);
  if (Number(row.version) !== expectedVersion) throw creatorError('version_conflict', 409);
  const spec = row.production_spec_json as ProductionSpec | undefined;
  if (!spec || typeof spec !== 'object') throw creatorError('production_spec_invalid', 409);
  const validation = validateProductionSpec(spec);
  if (validation.status === 'blocking') throw creatorError('production_blocked', 409);
  if (!spec.audioEnabled) throw creatorError('native_audio_required', 409);
  const script = scriptFor(spec);
  if (!script) throw creatorError('narration_required', 409);
  const aspectRatio = normalizedRatio(spec);
  await probeNative();

  const sb = adminClient();
  const { data: job, error: jobError } = await sb.from('creator_generation_jobs').insert({
    organization_id: ctx.orgId,
    production_id: productionId,
    requested_by: ctx.userId,
    provider_id: PROVIDER_ID,
    status: 'queued',
    compiled_prompt: script,
    normalized_params_json: {
      aspectRatio,
      audioEnabled: true,
      renderer: PROVIDER_ID,
      billingClass: 'zero-cost',
      execution: 'self-hosted',
      productionVersion: expectedVersion
    },
    estimated_cost_json: { currency: 'USD', amount: 0, billing_class: 'zero-cost' }
  }).select('*').single();
  if (jobError || !job) throw creatorError('generation_job_persistence_failed', 500);

  try {
    const renderResponse = await nativeFetch('/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: PROVIDER_ID,
        title: spec.title,
        script,
        aspectRatio,
        voice: String(spec.providerOverrides?.nativeVoice || 'es-la'),
        speechRate: Number(spec.providerOverrides?.nativeSpeechRate || 190),
        captions: Array.isArray(spec.providerOverrides?.nativeCaptions)
          ? spec.providerOverrides.nativeCaptions
          : []
      })
    });
    const render = await renderResponse.json().catch(() => ({ ok: false, error: 'invalid_native_response' }));
    if (!renderResponse.ok || !render?.ok || !render?.assetPath) {
      throw creatorError(String(render?.error || 'native_render_failed'), 502);
    }

    await sb.from('creator_generation_jobs').update({
      status: 'generating',
      provider_job_id: String(render.jobId || '') || null,
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', job.id);

    const assetResponse = await nativeFetch(String(render.assetPath));
    if (!assetResponse.ok) throw creatorError('native_asset_fetch_failed', 502);
    const bytes = new Uint8Array(await assetResponse.arrayBuffer());
    if (!bytes.length) throw creatorError('native_asset_empty', 502);

    await ensureAssetBucket(sb);
    const storagePath = `${ctx.orgId}/${productionId}/${job.id}.mp4`;
    const { error: uploadError } = await sb.storage.from(ASSET_BUCKET).upload(storagePath, bytes, {
      contentType: 'video/mp4', upsert: false
    });
    if (uploadError) throw creatorError('native_asset_upload_failed', 500);

    const { data: asset, error: assetError } = await sb.from('creator_assets').insert({
      organization_id: ctx.orgId,
      production_id: productionId,
      generation_job_id: job.id,
      storage_path: `${ASSET_BUCKET}/${storagePath}`,
      media_type: 'video',
      provider_id: PROVIDER_ID,
      provider_asset_id: String(render.jobId || '') || null,
      mime_type: 'video/mp4',
      width: Number(render.width || 0) || null,
      height: Number(render.height || 0) || null,
      duration_seconds: Number(render.durationSeconds || 0) || null,
      provenance_json: {
        renderer: PROVIDER_ID,
        billing_class: 'zero-cost',
        execution: 'self-hosted',
        production_version: expectedVersion
      }
    }).select('*').single();
    if (assetError || !asset) throw creatorError('native_asset_persistence_failed', 500);

    await sb.from('creator_generation_jobs').update({
      status: 'completed',
      actual_cost_json: { currency: 'USD', amount: 0, billing_class: 'zero-cost' },
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', job.id);
    await sb.from('creator_productions').update({
      status: 'completed', updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', productionId).eq('version', expectedVersion);

    await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.native.completed', productionId, {
      production_id: productionId,
      production_version: expectedVersion,
      generation_job_id: job.id,
      asset_id: asset.id,
      renderer: PROVIDER_ID,
      billing_class: 'zero-cost'
    });
    return json({ ok: true, job, asset, billing_class: 'zero-cost', renderer: PROVIDER_ID }, 201);
  } catch (error) {
    const value = error as { code?: string; message?: string };
    await sb.from('creator_generation_jobs').update({
      status: 'failed',
      error_code: value.code || value.message || 'native_render_failed',
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', job.id);
    await writeCreatorAudit(ctx.orgId, ctx.userId, 'creator.native.failed', productionId, {
      production_id: productionId,
      production_version: expectedVersion,
      generation_job_id: job.id,
      error_code: value.code || value.message || 'native_render_failed'
    });
    throw error;
  }
}

async function route(req: Request) {
  const api = String(new URL(req.url).searchParams.get('api') || '').trim();
  if (api === 'readiness' && req.method === 'GET') return handleReadiness(req);
  if (api === 'generate' && req.method === 'POST') return handleGenerate(req);
  return json({ ok: false, error: 'not_found' }, 404);
}

Deno.serve(async (req: Request) => {
  try {
    return await route(req);
  } catch (error) {
    return creatorErrorResponse(error);
  }
});
