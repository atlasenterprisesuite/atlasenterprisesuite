import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { CreativeEngineReadiness } from '../../../../packages/creator/creative_engine.ts';
import type { ImageEditRequest } from '../../../../packages/creator/image_edit.ts';
import type { CreatorContext } from './context.ts';
import { creatorError } from './errors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const OPENAI_BASE = (Deno.env.get('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '');
const IMAGE_MODEL = Deno.env.get('ATLAS_IMAGE_MODEL') || 'gpt-image-2.5-sunburst';
const ASSET_BUCKET = 'creator-assets';
const PROVIDER_ID = 'openai-image';

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw creatorError('server_secret_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function writeImageAudit(
  sb: ReturnType<typeof createClient>,
  ctx: CreatorContext,
  action: string,
  recordId: string | null,
  payload: Record<string, unknown>
) {
  const { error } = await sb.from('audit_logs').insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action,
    table_name: 'creator_director',
    record_id: recordId,
    new_data: payload
  });
  if (error) throw creatorError('audit_failed', 500);
}

function unconfiguredEngine(): CreativeEngineReadiness {
  return {
    engineId: PROVIDER_ID,
    displayName: 'OpenAI Image',
    executionClass: 'paid-provider',
    connectionState: 'unconfigured',
    ready: false,
    mediaKinds: ['image'],
    capabilityNotes: ['server-side image editing', `model:${IMAGE_MODEL}`],
    lastVerifiedAt: null
  };
}

export async function openAiImageEngineReadiness(): Promise<CreativeEngineReadiness> {
  if (!OPENAI_API_KEY) return unconfiguredEngine();
  try {
    const response = await fetch(`${OPENAI_BASE}/models/${encodeURIComponent(IMAGE_MODEL)}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      return {
        ...unconfiguredEngine(),
        connectionState: response.status === 401 || response.status === 403 ? 'error' : 'unavailable'
      };
    }
    return {
      engineId: PROVIDER_ID,
      displayName: 'OpenAI Image',
      executionClass: 'paid-provider',
      connectionState: 'ready',
      ready: true,
      mediaKinds: ['image'],
      capabilityNotes: ['verified model access', 'server-side image editing', `model:${IMAGE_MODEL}`],
      lastVerifiedAt: new Date().toISOString()
    };
  } catch {
    return { ...unconfiguredEngine(), connectionState: 'unavailable' };
  }
}

function compiledPrompt(request: ImageEditRequest) {
  const pointInstructions = request.points
    .filter(point => point.instruction.trim())
    .map((point, index) => {
      const x = Math.round(point.x * 1000) / 10;
      const y = Math.round(point.y * 1000) / 10;
      return `Target ${index + 1} near ${x}% from the left and ${y}% from the top: ${point.instruction.trim()}`;
    });
  return [
    request.globalInstruction.trim(),
    request.preserveIdentity
      ? 'Preserve every untargeted face, facial likeness, identity, skin tone, expression, body proportions, and defining personal features. Do not replace or redesign untargeted people.'
      : '',
    `Requested output aspect ratio: ${request.aspectRatio}.`,
    ...pointInstructions,
    'Make only the requested edits. Preserve all unrelated composition, lighting, background details, text, and objects unless the instruction explicitly changes them.'
  ].filter(Boolean).join('\n');
}

async function ensureAssetBucket(sb: ReturnType<typeof createClient>) {
  const { data } = await sb.storage.getBucket(ASSET_BUCKET);
  if (data) return;
  const { error } = await sb.storage.createBucket(ASSET_BUCKET, { public: false });
  if (error && !String(error.message || '').toLowerCase().includes('already')) {
    throw creatorError('asset_bucket_unavailable', 500);
  }
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function requestOpenAiEdit(source: File, prompt: string) {
  if (!OPENAI_API_KEY) throw creatorError('image_engine_not_ready', 409);
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('image', source, source.name || 'source-image');
  form.append('prompt', prompt);
  form.append('quality', 'high');
  form.append('size', 'auto');
  form.append('output_format', 'png');

  const response = await fetch(`${OPENAI_BASE}/images/edits`, {
    method: 'POST',
    headers: { authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok) {
    const providerCode = String(payload?.error?.code || payload?.error?.type || 'image_provider_failed');
    throw creatorError(providerCode, response.status >= 500 ? 502 : 409);
  }
  const b64 = String(payload?.data?.[0]?.b64_json || '');
  if (!b64) throw creatorError('image_provider_empty_output', 502);
  return decodeBase64(b64);
}

export async function executeOpenAiImageEdit(ctx: CreatorContext, source: File, request: ImageEditRequest) {
  const readiness = await openAiImageEngineReadiness();
  if (!readiness.ready) throw creatorError('image_engine_not_ready', 409);

  const sb = adminClient();
  const prompt = compiledPrompt(request);
  const { data: production, error: productionError } = await sb.from('creator_productions').insert({
    organization_id: ctx.orgId,
    created_by: ctx.userId,
    title: 'Image Lab Edit',
    brief: prompt,
    status: 'generating',
    duration_seconds: 0,
    aspect_ratio: request.aspectRatio,
    resolution_preference: 'adaptive',
    audio_enabled: false,
    production_spec_json: {
      kind: 'image-edit',
      preserveIdentity: request.preserveIdentity,
      visibility: request.visibility,
      points: request.points,
      sourceMimeType: source.type,
      sourceSizeBytes: source.size,
      provider: PROVIDER_ID,
      model: IMAGE_MODEL
    },
    version: 1
  }).select('*').single();
  if (productionError || !production) throw creatorError('image_production_persistence_failed', 500);

  const { data: job, error: jobError } = await sb.from('creator_generation_jobs').insert({
    organization_id: ctx.orgId,
    production_id: production.id,
    requested_by: ctx.userId,
    provider_id: PROVIDER_ID,
    status: 'generating',
    compiled_prompt: prompt,
    normalized_params_json: {
      mediaKind: 'image',
      model: IMAGE_MODEL,
      aspectRatio: request.aspectRatio,
      preserveIdentity: request.preserveIdentity,
      pointCount: request.points.length,
      visibility: request.visibility,
      billingClass: 'paid-provider'
    },
    estimated_cost_json: null
  }).select('*').single();
  if (jobError || !job) {
    await sb.from('creator_productions').update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('organization_id', ctx.orgId).eq('id', production.id);
    throw creatorError('generation_job_persistence_failed', 500);
  }

  try {
    const bytes = await requestOpenAiEdit(source, prompt);
    if (!bytes.length) throw creatorError('image_provider_empty_output', 502);
    await ensureAssetBucket(sb);
    const storagePath = `${ctx.orgId}/${production.id}/${job.id}.png`;
    const { error: uploadError } = await sb.storage.from(ASSET_BUCKET).upload(storagePath, bytes, {
      contentType: 'image/png',
      upsert: false
    });
    if (uploadError) throw creatorError('image_asset_upload_failed', 500);

    const { data: asset, error: assetError } = await sb.from('creator_assets').insert({
      organization_id: ctx.orgId,
      production_id: production.id,
      generation_job_id: job.id,
      storage_path: `${ASSET_BUCKET}/${storagePath}`,
      media_type: 'image',
      provider_id: PROVIDER_ID,
      provider_asset_id: null,
      mime_type: 'image/png',
      width: null,
      height: null,
      duration_seconds: null,
      provenance_json: {
        provider: PROVIDER_ID,
        model: IMAGE_MODEL,
        billing_class: 'paid-provider',
        source_mime_type: source.type,
        source_size_bytes: source.size,
        preserve_identity: request.preserveIdentity,
        point_count: request.points.length,
        visibility: request.visibility
      }
    }).select('*').single();
    if (assetError || !asset) throw creatorError('image_asset_persistence_failed', 500);

    const { data: signed, error: signedError } = await sb.storage.from(ASSET_BUCKET).createSignedUrl(storagePath, 3600);
    if (signedError || !signed?.signedUrl) throw creatorError('image_asset_preview_failed', 500);

    await sb.from('creator_generation_jobs').update({
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', job.id);
    await sb.from('creator_productions').update({
      status: 'completed',
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', production.id);

    await writeImageAudit(sb, ctx, 'creator.image.edit.completed', String(production.id), {
      production_id: production.id,
      generation_job_id: job.id,
      asset_id: asset.id,
      provider: PROVIDER_ID,
      model: IMAGE_MODEL,
      billing_class: 'paid-provider'
    });

    return { production, job, asset, signedUrl: signed.signedUrl, engine: readiness };
  } catch (error) {
    const value = error as { code?: string; message?: string };
    const errorCode = value.code || value.message || 'image_edit_failed';
    await sb.from('creator_generation_jobs').update({
      status: 'failed',
      error_code: errorCode,
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', job.id);
    await sb.from('creator_productions').update({
      status: 'failed',
      updated_at: new Date().toISOString()
    }).eq('organization_id', ctx.orgId).eq('id', production.id);
    await writeImageAudit(sb, ctx, 'creator.image.edit.failed', String(production.id), {
      production_id: production.id,
      generation_job_id: job.id,
      provider: PROVIDER_ID,
      model: IMAGE_MODEL,
      error_code: errorCode
    });
    throw error;
  }
}
