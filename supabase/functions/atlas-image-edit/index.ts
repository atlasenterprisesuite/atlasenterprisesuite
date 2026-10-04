import { requireCreatorPermission } from '../../../packages/creator/permissions.ts';
import { validateImageEditRequest, type ImageEditRequest } from '../../../packages/creator/image_edit.ts';
import { resolveCreatorContext } from '../atlas-creator/_shared/context.ts';
import { creatorError, creatorErrorResponse, optionsResponse, withCors } from '../atlas-creator/_shared/errors.ts';
import { executeOpenAiImageEdit, openAiImageEngineReadiness } from '../atlas-creator/_shared/openai_image.ts';

const VERSION = '2026-10-04.1';
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
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

async function handleReadiness(req: Request) {
  const ctx = await context(req, 'creator.read');
  const engine = await openAiImageEngineReadiness();
  return json({
    ok: true,
    service: 'atlas-image-edit',
    version: VERSION,
    organization_id: ctx.orgId,
    engine,
    checked_at: new Date().toISOString()
  });
}

async function handleEdit(req: Request) {
  const ctx = await context(req, 'creator.generate');
  const form = await req.formData().catch(() => { throw creatorError('invalid_form_data', 400); });
  const files = form.getAll('source').filter((value): value is File => value instanceof File);
  if (files.length !== 1) throw creatorError('image_source_required', 422);
  const source = files[0];
  if (!ACCEPTED_IMAGE_TYPES.has(source.type)) throw creatorError('image_source_type_invalid', 415);
  if (source.size <= 0 || source.size > MAX_IMAGE_BYTES) throw creatorError('image_source_size_invalid', 413);

  const requestRaw = String(form.get('request') || '').trim();
  if (!requestRaw) throw creatorError('image_edit_request_required', 422);
  let parsed: unknown;
  try {
    parsed = JSON.parse(requestRaw) as unknown;
  } catch {
    throw creatorError('image_edit_request_invalid', 422);
  }

  const validation = validateImageEditRequest(parsed);
  if (!validation.ok) throw creatorError(validation.error, 422);
  const request = parsed as ImageEditRequest;

  const readiness = await openAiImageEngineReadiness();
  if (!readiness.ready) throw creatorError('image_engine_not_ready', 409);

  const result = await executeOpenAiImageEdit(ctx, source, request);
  return json({
    ok: true,
    asset: result.asset,
    signed_url: result.signedUrl,
    production_id: result.production.id,
    generation_job_id: result.job.id,
    engine: result.engine
  }, 201);
}

async function route(req: Request) {
  const api = String(new URL(req.url).searchParams.get('api') || '').trim();
  if (api === 'readiness' && req.method === 'GET') return handleReadiness(req);
  if (api === 'edit' && req.method === 'POST') return handleEdit(req);
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
