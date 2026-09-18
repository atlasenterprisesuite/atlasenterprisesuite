import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import type { ContentWorkspaceState } from '../../../../packages/creator/content_intelligence.ts';
import type { CreativePlan } from '../../../../packages/creator/creative_plan.ts';
import type { WebLaunchBlueprint } from '../../../../packages/creator/web_launch.ts';
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
  const { data: existing, error: existingError } = await sb
    .from('creator_productions')
    .select('id,version,created_by,status')
    .eq('organization_id', ctx.orgId)
    .eq('id', spec.id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  const trustedSpec: ProductionSpec = {
    ...spec,
    organizationId: ctx.orgId,
    createdByUserId: existing ? String(existing.created_by) : ctx.userId,
    status: 'draft'
  };
  const baseRow = {
    organization_id: ctx.orgId,
    title: trustedSpec.title,
    brief: trustedSpec.brief,
    status: 'draft',
    duration_seconds: trustedSpec.durationSeconds,
    aspect_ratio: trustedSpec.aspectRatio,
    resolution_preference: trustedSpec.resolutionPreference,
    audio_enabled: trustedSpec.audioEnabled,
    production_spec_json: trustedSpec,
    updated_at: new Date().toISOString()
  };

  if (!existing) {
    const { data, error } = await sb
      .from('creator_productions')
      .insert({ ...baseRow, id: trustedSpec.id, created_by: ctx.userId, version: 1 })
      .select('*')
      .single();
    if (error || !data) throw creatorError('persistence_failed', 500);
    return data;
  }

  const version = expectedVersion ?? trustedSpec.version;
  const { data, error } = await sb
    .from('creator_productions')
    .update({ ...baseRow, version: version + 1 })
    .eq('organization_id', ctx.orgId)
    .eq('id', trustedSpec.id)
    .eq('version', version)
    .select('*')
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('version_conflict', 409);
  return data;
}

export async function listContentWorkspaces(orgId: string) {
  const { data, error } = await adminClient()
    .from('creator_content_workspaces')
    .select('id,organization_id,created_by,title,state_json,version,created_at,updated_at')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw creatorError('persistence_failed', 500);
  return data || [];
}

export async function getContentWorkspace(orgId: string, workspaceId: string) {
  const { data, error } = await adminClient()
    .from('creator_content_workspaces')
    .select('id,organization_id,created_by,title,state_json,version,created_at,updated_at')
    .eq('organization_id', orgId)
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('content_workspace_not_found', 404);
  return data;
}

export async function saveContentWorkspace(
  ctx: CreatorContext,
  state: ContentWorkspaceState,
  expectedVersion: number
) {
  const id = String(state?.id || '').trim();
  if (!id) throw creatorError('workspace_id_required', 422);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw creatorError('expected_version_required', 422);
  }

  const sb = adminClient();
  const { data: existing, error: existingError } = await sb
    .from('creator_content_workspaces')
    .select('id,version,created_by,created_at')
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  const now = new Date().toISOString();
  const nextVersion = existing ? expectedVersion + 1 : 1;
  const trustedState: ContentWorkspaceState = {
    ...state,
    id,
    title: String(state.title || 'Untitled content workspace'),
    version: nextVersion,
    createdAt: existing ? String(existing.created_at || state.createdAt || now) : now,
    updatedAt: now
  };
  const baseRow = {
    organization_id: ctx.orgId,
    title: trustedState.title,
    state_json: trustedState,
    updated_at: now
  };

  if (!existing) {
    if (expectedVersion !== 0) throw creatorError('version_conflict', 409);
    const { data, error } = await sb
      .from('creator_content_workspaces')
      .insert({ ...baseRow, id, created_by: ctx.userId, version: 1, created_at: now })
      .select('*')
      .single();
    if (error || !data) throw creatorError('persistence_failed', 500);
    return data;
  }

  const { data, error } = await sb
    .from('creator_content_workspaces')
    .update({ ...baseRow, version: expectedVersion + 1 })
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('version_conflict', 409);
  return data;
}


export async function listWebLaunchBlueprints(orgId: string) {
  const { data, error } = await adminClient()
    .from('creator_web_launch_blueprints')
    .select('id,organization_id,created_by,title,state_json,version,created_at,updated_at')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw creatorError('persistence_failed', 500);
  return data || [];
}

export async function getWebLaunchBlueprint(orgId: string, blueprintId: string) {
  const { data, error } = await adminClient()
    .from('creator_web_launch_blueprints')
    .select('id,organization_id,created_by,title,state_json,version,created_at,updated_at')
    .eq('organization_id', orgId)
    .eq('id', blueprintId)
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('web_launch_blueprint_not_found', 404);
  return data;
}

export async function saveWebLaunchBlueprint(
  ctx: CreatorContext,
  state: WebLaunchBlueprint,
  expectedVersion: number
) {
  const id = String(state?.id || '').trim();
  if (!id) throw creatorError('web_launch_blueprint_id_required', 422);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw creatorError('expected_version_required', 422);
  }

  const sb = adminClient();
  const { data: existing, error: existingError } = await sb
    .from('creator_web_launch_blueprints')
    .select('id,version,created_by,created_at')
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  const now = new Date().toISOString();
  const nextVersion = existing ? expectedVersion + 1 : 1;
  const trustedState: WebLaunchBlueprint = {
    ...state,
    id,
    title: String(state.title || 'Untitled web launch'),
    version: nextVersion,
    createdAt: existing ? String(existing.created_at || state.createdAt || now) : now,
    updatedAt: now
  };
  const baseRow = {
    organization_id: ctx.orgId,
    title: trustedState.title,
    state_json: trustedState,
    updated_at: now
  };

  if (!existing) {
    if (expectedVersion !== 0) throw creatorError('version_conflict', 409);
    const { data, error } = await sb
      .from('creator_web_launch_blueprints')
      .insert({ ...baseRow, id, created_by: ctx.userId, version: 1, created_at: now })
      .select('*')
      .single();
    if (error || !data) throw creatorError('persistence_failed', 500);
    return data;
  }

  const { data, error } = await sb
    .from('creator_web_launch_blueprints')
    .update({ ...baseRow, version: nextVersion })
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('version_conflict', 409);
  return data;
}

export async function listCreativePlans(orgId: string) {
  const { data, error } = await adminClient()
    .from('creator_creative_plans')
    .select('id,organization_id,created_by,title,source_brief,media_kinds,plan_json,version,created_at,updated_at')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw creatorError('persistence_failed', 500);
  return data || [];
}

export async function getCreativePlan(orgId: string, planId: string) {
  const { data, error } = await adminClient()
    .from('creator_creative_plans')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', planId)
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('creative_plan_not_found', 404);
  return data;
}

export async function saveCreativePlan(
  ctx: CreatorContext,
  plan: CreativePlan,
  expectedVersion: number
) {
  const id = String(plan?.id || '').trim();
  if (!id) throw creatorError('creative_plan_id_required', 422);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw creatorError('expected_version_required', 422);
  }

  const sb = adminClient();
  const { data: existing, error: existingError } = await sb
    .from('creator_creative_plans')
    .select('id,version,created_by,created_at')
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  const now = new Date().toISOString();
  const nextVersion = existing ? expectedVersion + 1 : 1;
  const trustedPlan: CreativePlan = {
    ...plan,
    id,
    organizationId: ctx.orgId,
    createdByUserId: existing ? String(existing.created_by) : ctx.userId,
    version: nextVersion,
    createdAt: existing ? String(existing.created_at || plan.createdAt || now) : now,
    updatedAt: now
  };

  const baseRow = {
    organization_id: ctx.orgId,
    title: trustedPlan.title,
    source_brief: trustedPlan.sourceBrief,
    media_kinds: trustedPlan.mediaKinds,
    plan_json: trustedPlan,
    updated_at: now
  };

  if (!existing) {
    if (expectedVersion !== 0) throw creatorError('version_conflict', 409);
    const { data, error } = await sb
      .from('creator_creative_plans')
      .insert({ ...baseRow, id, created_by: ctx.userId, version: 1, created_at: now })
      .select('*')
      .single();
    if (error || !data) throw creatorError('persistence_failed', 500);
    return data;
  }

  const { data, error } = await sb
    .from('creator_creative_plans')
    .update({ ...baseRow, version: nextVersion })
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*')
    .maybeSingle();
  if (error) throw creatorError('persistence_failed', 500);
  if (!data) throw creatorError('version_conflict', 409);
  return data;
}

function nullableNumber(value: unknown) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isProviderCapabilityShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Array.isArray(item.modes)
    && Array.isArray(item.aspectRatios)
    && Array.isArray(item.resolutions)
    && typeof item.audioSupport === 'boolean'
    && typeof item.imageReferenceSupport === 'boolean'
    && typeof item.videoReferenceSupport === 'boolean'
    && typeof item.audioReferenceSupport === 'boolean'
    && typeof item.startFrameSupport === 'boolean'
    && typeof item.endFrameSupport === 'boolean'
    && nullableNumber(item.minDurationSeconds)
    && nullableNumber(item.maxDurationSeconds)
    && nullableNumber(item.maxImageReferences)
    && nullableNumber(item.maxVideoReferences)
    && nullableNumber(item.maxAudioReferences);
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
    const capabilityValid = isProviderCapabilityShape(row.capability_json);
    let connectionState = persistedState === 'ready' && !lastVerifiedAt
      ? 'configured-unverified'
      : persistedState;
    if (connectionState === 'ready' && !capabilityValid) connectionState = 'configured-unverified';
    const capability = capabilityValid
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
