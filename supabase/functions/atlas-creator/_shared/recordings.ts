import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { CreatorContext } from './context.ts';
import { creatorError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export const CREATOR_RECORDING_BUCKET = 'atlas-creator-recordings' as const;
export const CREATOR_RECORDING_MAX_BYTES = 536870912;

const ALLOWED_MIME_TYPES = new Set(['video/webm', 'video/mp4', 'video/quicktime']);

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw creatorError('server_secret_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function baseMimeType(value: string) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function extensionFor(mimeType: string) {
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'webm';
}

export async function creatorRecordingReadiness() {
  if (!URL || !SERVICE_ROLE) {
    return { connected: false, reason: 'server_secret_not_configured' as const };
  }
  const { data, error } = await adminClient().storage.getBucket(CREATOR_RECORDING_BUCKET);
  if (error || !data || data.public) {
    return { connected: false, reason: 'private_recording_bucket_unavailable' as const };
  }
  return { connected: true, reason: null };
}

export async function uploadCreatorRecording(
  ctx: CreatorContext,
  input: { file: File; language: 'es' | 'en'; durationSeconds: number | null }
) {
  const mimeType = baseMimeType(input.file.type);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) throw creatorError('recording_type_not_allowed', 415);
  if (!input.file.size || input.file.size > CREATOR_RECORDING_MAX_BYTES) {
    throw creatorError('recording_size_not_allowed', 413);
  }

  const id = crypto.randomUUID();
  const path = `${ctx.orgId}/${ctx.userId}/teleprompter/${id}.${extensionFor(mimeType)}`;
  const sb = adminClient();
  const { error: uploadError } = await sb.storage
    .from(CREATOR_RECORDING_BUCKET)
    .upload(path, input.file, { contentType: mimeType, upsert: false });
  if (uploadError) throw creatorError('recording_upload_failed', 502);

  const durationSeconds = input.durationSeconds === null
    ? null
    : Math.max(0, Math.round(input.durationSeconds));

  const { data, error } = await sb
    .from('creator_recordings')
    .insert({
      id,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      language: input.language,
      storage_bucket: CREATOR_RECORDING_BUCKET,
      storage_path: path,
      mime_type: mimeType,
      file_size_bytes: input.file.size,
      duration_seconds: durationSeconds,
      source: 'teleprompter'
    })
    .select('*')
    .single();

  if (error || !data) {
    await sb.storage.from(CREATOR_RECORDING_BUCKET).remove([path]).catch(() => undefined);
    throw creatorError('recording_persistence_failed', 500);
  }
  return data;
}

export async function createCreatorRecordingDownload(ctx: CreatorContext, recordingId: string) {
  const sb = adminClient();
  const { data: row, error } = await sb
    .from('creator_recordings')
    .select('id,organization_id,storage_bucket,storage_path,mime_type,created_at')
    .eq('organization_id', ctx.orgId)
    .eq('id', recordingId)
    .maybeSingle();

  if (error) throw creatorError('recording_persistence_failed', 500);
  if (!row) throw creatorError('recording_not_found', 404);
  if (row.storage_bucket !== CREATOR_RECORDING_BUCKET) throw creatorError('recording_storage_invalid', 409);

  const { data, error: signedError } = await sb.storage
    .from(CREATOR_RECORDING_BUCKET)
    .createSignedUrl(String(row.storage_path), 900);
  if (signedError || !data?.signedUrl) throw creatorError('recording_download_unavailable', 503);

  return { recording: row, signedUrl: data.signedUrl, expiresIn: 900 };
}
