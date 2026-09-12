import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { providerLabel } from '../../../../packages/creator/providers.ts';
import type {
  ProductionSpec,
  ProviderCapability,
  ProviderId,
  ProviderReadiness
} from '../../../../packages/creator/types.ts';
import type { CreatorContext } from './context.ts';
import { creatorError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PROVIDER_IDS: ProviderId[] = ['seedance', 'veo', 'kling', 'wan', 'minimax'];

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw creatorError('server_secret_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function listProductions(orgId: string) {
  const { data, error } = await adminClient()
    .from('creator_productions')
    .select('id,organization_id,created_by,title,brief,status,duration_seconds,aspect_ratio,resolution_preference,audio_enabled,version,created_at,updated_at')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw creatorError('persistence_failed', 500);
  return data || [];
}

export async function getProduction(orgId: string, productionId: string) {
  const { data, error } = await adminClient()
    .from('creator_productions')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', productionId)
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('production_not_found', 404);
  return data;
}

export async function saveProduction(ctx: CreatorContext, spec: ProductionSpec, expectedVersion?: number) {
  const sb = adminClient();
  const baseRow = {
    organization_id: ctx.orgId,
    title: spec.title,
    brief: spec.brief,
    status: spec.status,
    duration_seconds: spec.durationSeconds,
    aspect_ratio: spec.aspectRatio,
    resolution_preference: spec.resolutionPreference,
    audio_enabled: spec.audioEnabled,
    production_spec_json: spec,
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: existingError } = await sb
    .from('creator_productions')
    .select('id,version')
    .eq('organization_id', ctx.orgId)
    .eq('id', spec.id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  if (!existing) {
    const { data, error } = await sb
      .from('creator_productions')
      .insert({ ...baseRow, id: spec.id, created_by: ctx.userId, version: 1 })
      .select('*')
      .single();
    if (error || !data) throw creatorError('persistence_failed', 500);
    return data;
  }

  const version = expectedVersion ?? spec.version;
  const { data, error } = await sb
    .from('creator_productions')
    .update({ ...baseRow, version: version + 1 })
    .eq('organization_id', ctx.orgId)
    .eq('id', spec.id)
    .eq('version', version)
    .select('*')
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('version_conflict', 409);
  return data;
}

export async function listProviderReadiness(orgId: string): Promise<ProviderReadiness[]> {
  const { data, error } = await adminClient()
    .from('creator_provider_instances')
    .select('provider_id,display_name,state,capability_json,cost_estimator_available,last_verified_at,last_error_code')
    .eq('organization_id', orgId);
  if (error) throw creatorError('persistence_failed', 500);

  const byProvider = new Map((data || []).map((row: any) => [String(row.provider_id), row]));
  return PROVIDER_IDS.map(providerId => {
    const row: any = byProvider.get(providerId);
    if (!row) {
      return {
        providerId,
        displayName: providerLabel(providerId),
        connectionState: 'unconfigured',
        capability: null,
        estimatedCost: null,
        lastVerifiedAt: null
      };
    }

    const lastVerifiedAt = row.last_verified_at ? String(row.last_verified_at) : null;
    const persistedState = String(row.state || 'unconfigured');
    const connectionState = persistedState === 'ready' && !lastVerifiedAt
      ? 'configured-unverified'
      : persistedState;
    const capability = row.capability_json && typeof row.capability_json === 'object'
      ? {
          ...(row.capability_json as Record<string, unknown>),
          providerId,
          connectionState,
          costEstimatorAvailable: Boolean(row.cost_estimator_available),
          lastVerifiedAt
        } as ProviderCapability
      : null;

    return {
      providerId,
      displayName: String(row.display_name || providerLabel(providerId)),
      connectionState: connectionState as ProviderReadiness['connectionState'],
      capability,
      estimatedCost: null,
      lastVerifiedAt
    };
  });
}

export async function listAssets(orgId: string, productionId?: string) {
  let query = adminClient()
    .from('creator_assets')
    .select('id,organization_id,production_id,generation_job_id,storage_path,media_type,provider_id,provider_asset_id,mime_type,width,height,duration_seconds,provenance_json,created_at,updated_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  if (productionId) query = query.eq('production_id', productionId);
  const { data, error } = await query;
  if (error) throw creatorError('persistence_failed', 500);
  return data || [];
}

export async function writeCreatorAudit(
  orgId: string,
  userId: string,
  action: string,
  recordId: string | null,
  payload: Record<string, unknown>
) {
  const { error } = await adminClient().from('audit_logs').insert({
    org_id: orgId,
    user_id: userId,
    action,
    table_name: 'creator_director',
    record_id: recordId,
    new_data: payload
  });
  if (error) throw creatorError('audit_failed', 500);
}
