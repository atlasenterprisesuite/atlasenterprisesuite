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

export type ProductionSpecInput = Partial<ProductionSpec>;

function sanitizeProductionSpec(
  input: ProductionSpecInput,
  orgId: string,
  userId: string,
  existingCreatedBy?: string
): ProductionSpec {
  return {
    id: input.id || crypto.randomUUID(),
    organizationId: orgId,
    createdByUserId: existingCreatedBy || userId,
    title: String(input.title || ''),
    brief: String(input.brief || ''),
    status: 'draft',
    durationSeconds: typeof input.durationSeconds === 'number' ? input.durationSeconds : 0,
    aspectRatio: input.aspectRatio || 'adaptive',
    resolutionPreference: input.resolutionPreference || 'adaptive',
    audioEnabled: Boolean(input.audioEnabled),
    subjects: Array.isArray(input.subjects) ? input.subjects : [],
    environment: input.environment || {
      locationDescription: '',
      timeOfDay: '',
      lightingEnvironment: '',
      weatherOrAtmosphere: '',
      backgroundConstraints: [],
      referenceAssetIds: []
    },
    scenes: Array.isArray(input.scenes) ? input.scenes : [],
    continuityRules: Array.isArray(input.continuityRules) ? input.continuityRules : [],
    visualStyle: input.visualStyle || {
      photorealismLevel: '',
      cinematicStyle: '',
      textureStyle: '',
      colorPalette: '',
      contrastStyle: '',
      filmLook: '',
      grain: '',
      halation: '',
      surfaceDetail: '',
      lightingStyle: ''
    },
    cameraDefaults: input.cameraDefaults || {
      framing: '',
      angle: '',
      position: '',
      lens: '',
      focalLengthMm: null,
      depthOfField: '',
      movement: '',
      movementSpeed: '',
      focusTarget: '',
      orientationRule: ''
    },
    motionRules: Array.isArray(input.motionRules) ? input.motionRules : [],
    audioPlan: input.audioPlan || {
      musicDescription: '',
      ambientSound: '',
      soundEffects: [],
      dialogue: [],
      voiceReferenceAssetIds: [],
      syncRules: []
    },
    negativeConstraints: Array.isArray(input.negativeConstraints) ? input.negativeConstraints : [],
    providerPreference: input.providerPreference || null,
    providerOverrides: typeof input.providerOverrides === 'object' && input.providerOverrides ? input.providerOverrides : {},
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: typeof input.version === 'number' ? input.version : 1
  };
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

export async function saveProduction(ctx: CreatorContext, spec: ProductionSpecInput, expectedVersion?: number) {
  const sb = adminClient();
  const { data: existing, error: existingError } = await sb
    .from('creator_productions')
    .select('id,version,created_by,status')
    .eq('organization_id', ctx.orgId)
    .eq('id', spec.id)
    .maybeSingle();
  if (existingError) throw creatorError('persistence_failed', 500);

  const trustedSpec = sanitizeProductionSpec(
    spec,
    ctx.orgId,
    ctx.userId,
    existing ? String(existing.created_by) : undefined
  );

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
