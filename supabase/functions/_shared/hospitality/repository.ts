import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw new Error('server_secret_not_configured');
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function result<T>(data: T | null, error: unknown): T {
  if (error || data === null) throw new Error('hospitality_persistence_failed');
  return data;
}

const PMS_FIELDS = 'id,org_id,property_id,provider_type,display_name,state,external_property_id,capabilities,configuration_version,last_verified_at,last_sync_at,last_error_code,created_at,updated_at';
const STAY_FIELDS = 'id,org_id,property_id,pms_provider_instance_id,external_reservation_id,external_guest_reference,status,arrival_at,departure_at,checked_in_at,checked_out_at,source_version,last_synced_at,room_assignment_id,created_at,updated_at';
const ASSIGNMENT_FIELDS = 'id,org_id,property_id,stay_id,atlas_room_id,external_pms_room_id,provider_room_mapping_id,starts_at,expires_at,status,assigned_at,superseded_at,created_at,updated_at';
const POLICY_FIELDS = 'id,org_id,property_id,version,enabled,auto_wallet_key_on_checkin,allowed_platforms,allowed_access_scopes,activation_lead_minutes,credential_expiry_offset_minutes,room_change_mode,max_retry_attempts,manual_review_on_failure,emergency_kill_switch,created_by,created_at,updated_at';
const CREDENTIAL_FIELDS = 'id,org_id,property_id,room_id,provider_instance_id,provider_credential_id,assignment_reference,credential_type,starts_at,expires_at,status,issued_by,issued_at,revoked_at,provider_status_code,stay_id,room_assignment_id,wallet_platform,wallet_state,issuance_actor';
const EVENT_FIELDS = 'id,org_id,property_id,pms_provider_instance_id,source_event_id,source_version,event_type,idempotency_key,received_at,processed_at,status,attempt_count,last_error_code,correlation_id,created_at,updated_at';
const SESSION_FIELDS = 'id,org_id,property_id,stay_id,credential_reference_id,wallet_platform,provider_type,state,expires_at,consumed_at,created_at,updated_at';

export async function listPmsProviderInstances(orgId: string, propertyId?: string) {
  let query = adminClient().from('hospitality_pms_provider_instances').select(PMS_FIELDS).eq('org_id', orgId);
  if (propertyId) query = query.eq('property_id', propertyId);
  const { data, error } = await query.order('property_id');
  return result(data, error);
}

export async function loadPmsProviderInstance(orgId: string, propertyId: string, instanceId?: string) {
  let query = adminClient().from('hospitality_pms_provider_instances').select(PMS_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId);
  if (instanceId) query = query.eq('id', instanceId);
  const { data, error } = await query.limit(1).maybeSingle();
  return result(data, error);
}

export async function listStays(orgId: string, propertyId: string) {
  const { data, error } = await adminClient().from('hospitality_stays').select(STAY_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId).order('arrival_at');
  return result(data, error);
}

export async function loadStay(orgId: string, propertyId: string, stayId: string) {
  const { data, error } = await adminClient().from('hospitality_stays').select(STAY_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId).eq('id', stayId).maybeSingle();
  return result(data, error);
}

export async function listRoomAssignments(orgId: string, propertyId: string, stayId?: string) {
  let query = adminClient().from('hospitality_room_assignments').select(ASSIGNMENT_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId);
  if (stayId) query = query.eq('stay_id', stayId);
  const { data, error } = await query.order('assigned_at', { ascending: false });
  return result(data, error);
}

export async function loadActiveRoomAssignment(orgId: string, propertyId: string, stayId: string) {
  const { data, error } = await adminClient().from('hospitality_room_assignments').select(ASSIGNMENT_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId).eq('stay_id', stayId).eq('status', 'active')
    .limit(1).maybeSingle();
  return result(data, error);
}

export async function loadAutomationPolicy(orgId: string, propertyId: string) {
  const { data, error } = await adminClient().from('hospitality_automation_policies').select(POLICY_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId).maybeSingle();
  if (error) throw new Error('hospitality_persistence_failed');
  return data;
}

export async function listWalletCredentials(orgId: string, propertyId: string) {
  const { data, error } = await adminClient().from('hospitality_credential_references').select(CREDENTIAL_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId).order('issued_at', { ascending: false });
  return result(data, error);
}

export async function findActiveWalletCredential(orgId: string, propertyId: string, stayId: string, platform?: string) {
  let query = adminClient().from('hospitality_credential_references').select(CREDENTIAL_FIELDS)
    .eq('org_id', orgId).eq('property_id', propertyId).eq('stay_id', stayId)
    .in('wallet_state', ['eligible', 'provisioning_ready', 'provisioned']);
  if (platform) query = query.eq('wallet_platform', platform);
  const { data, error } = await query.order('issued_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('hospitality_persistence_failed');
  return data;
}

export type IntegrationEventInput = Record<string, unknown> & {
  org_id: string; property_id: string; pms_provider_instance_id: string; idempotency_key: string;
};

export async function insertIntegrationEventOnce(row: IntegrationEventInput) {
  const { data, error } = await adminClient().from('hospitality_integration_events').upsert(row, {
    onConflict: 'org_id,property_id,pms_provider_instance_id,idempotency_key',
    ignoreDuplicates: true
  }).select(EVENT_FIELDS);
  if (error) throw new Error('hospitality_persistence_failed');
  if (data?.length) return { inserted: true, event: data[0] };

  const duplicate = await adminClient().from('hospitality_integration_events').select(EVENT_FIELDS)
    .eq('org_id', row.org_id).eq('property_id', row.property_id)
    .eq('pms_provider_instance_id', row.pms_provider_instance_id)
    .eq('idempotency_key', row.idempotency_key).single();
  return { inserted: false, event: result(duplicate.data, duplicate.error) };
}

async function markIntegrationEvent(orgId: string, propertyId: string, eventId: string, updates: Record<string, unknown>) {
  const { data, error } = await adminClient().from('hospitality_integration_events').update(updates)
    .eq('org_id', orgId).eq('property_id', propertyId).eq('id', eventId).select(EVENT_FIELDS).single();
  return result(data, error);
}

export const markIntegrationEventProcessing = (orgId: string, propertyId: string, eventId: string) =>
  markIntegrationEvent(orgId, propertyId, eventId, { status: 'processing' });
export const markIntegrationEventProcessed = (orgId: string, propertyId: string, eventId: string) =>
  markIntegrationEvent(orgId, propertyId, eventId, { status: 'processed', processed_at: new Date().toISOString() });
export const markIntegrationEventFailed = (orgId: string, propertyId: string, eventId: string, errorCode: string) =>
  markIntegrationEvent(orgId, propertyId, eventId, { status: 'failed', last_error_code: errorCode });

export async function insertWalletProvisioningSession(row: Record<string, unknown>) {
  const { data, error } = await adminClient().from('hospitality_wallet_provisioning_sessions')
    .insert(row).select(SESSION_FIELDS).single();
  return result(data, error);
}

export async function updateWalletProvisioningSession(orgId: string, propertyId: string, sessionId: string, updates: Record<string, unknown>) {
  const { data, error } = await adminClient().from('hospitality_wallet_provisioning_sessions').update(updates)
    .eq('org_id', orgId).eq('property_id', propertyId).eq('id', sessionId).select(SESSION_FIELDS).single();
  return result(data, error);
}

const SAFE_AUDIT_PAYLOAD_KEYS = new Set([
  'property_id', 'stay_id', 'assignment_id', 'room_assignment_id', 'credential_reference_id',
  'provider_instance_id', 'policy_version', 'blocker', 'status', 'source_event_id', 'correlation_id',
  'wallet_platform'
]);

export async function writeHospitalityServiceAudit(orgId: string, action: string, recordId: string | null, payload: Record<string, unknown>) {
  const safePayload = Object.fromEntries(Object.entries(payload).filter(([key]) => SAFE_AUDIT_PAYLOAD_KEYS.has(key)));
  const { error } = await adminClient().from('audit_logs').insert({
    org_id: orgId, user_id: null, action, table_name: 'hospitality_wallet_key', record_id: recordId,
    new_data: { actor_type: 'service', ...safePayload }
  });
  if (error) throw new Error('hospitality_audit_failed');
}
