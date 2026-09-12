import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { hospitalityError } from './errors.ts';

const URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw hospitalityError('server_secret_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export type ProviderInstanceRecord = {
  id: string;
  org_id: string;
  property_id: string;
  provider_type: string;
  display_name: string;
  state: string;
  provider_property_id: string | null;
  capabilities: string[];
  configuration_version: number;
  last_verified_at: string | null;
  last_error_code: string | null;
};

export async function listProviderInstances(orgId: string, propertyId?: string) {
  let query = adminClient()
    .from('hospitality_provider_instances')
    .select('id,org_id,property_id,provider_type,display_name,state,provider_property_id,capabilities,configuration_version,last_verified_at,last_error_code')
    .eq('org_id', orgId)
    .order('property_id')
    .order('display_name');

  if (propertyId) query = query.eq('property_id', propertyId);
  const { data, error } = await query;
  if (error) throw hospitalityError('persistence_failed', 500);
  return (data || []) as ProviderInstanceRecord[];
}

export async function loadProviderInstance(orgId: string, propertyId: string, providerInstanceId?: string) {
  let query = adminClient()
    .from('hospitality_provider_instances')
    .select('id,org_id,property_id,provider_type,display_name,state,provider_property_id,capabilities,configuration_version,last_verified_at,last_error_code')
    .eq('org_id', orgId)
    .eq('property_id', propertyId);

  if (providerInstanceId) query = query.eq('id', providerInstanceId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw hospitalityError('persistence_failed', 500);
  if (!data) throw hospitalityError('provider_not_configured', 404);
  return data as ProviderInstanceRecord;
}

export async function listRoomMappings(orgId: string, propertyId: string) {
  const { data, error } = await adminClient()
    .from('hospitality_room_mappings')
    .select('id,org_id,property_id,provider_instance_id,atlas_room_id,provider_room_id,provider_lock_id,status,last_verified_at')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .order('atlas_room_id');
  if (error) throw hospitalityError('persistence_failed', 500);
  return data || [];
}

export async function loadRoomMapping(
  orgId: string,
  propertyId: string,
  roomId: string,
  providerInstanceId: string
) {
  const { data, error } = await adminClient()
    .from('hospitality_room_mappings')
    .select('id,org_id,property_id,provider_instance_id,atlas_room_id,provider_room_id,provider_lock_id,status,last_verified_at')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .eq('provider_instance_id', providerInstanceId)
    .eq('atlas_room_id', roomId)
    .limit(1)
    .maybeSingle();
  if (error) throw hospitalityError('persistence_failed', 500);
  if (!data) throw hospitalityError('room_mapping_missing', 404);
  if (String(data.status) !== 'verified') throw hospitalityError('room_mapping_invalid', 409);
  return data;
}

export async function listCredentialReferences(orgId: string, propertyId: string) {
  const { data, error } = await adminClient()
    .from('hospitality_credential_references')
    .select('id,org_id,property_id,room_id,provider_instance_id,provider_credential_id,assignment_reference,credential_type,starts_at,expires_at,status,issued_by,issued_at,revoked_at,provider_status_code')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .order('issued_at', { ascending: false });
  if (error) throw hospitalityError('persistence_failed', 500);
  return data || [];
}

export async function loadCredentialReference(orgId: string, propertyId: string, credentialId: string) {
  const { data, error } = await adminClient()
    .from('hospitality_credential_references')
    .select('id,org_id,property_id,room_id,provider_instance_id,provider_credential_id,assignment_reference,credential_type,starts_at,expires_at,status,issued_by,issued_at,revoked_at,provider_status_code')
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .eq('id', credentialId)
    .limit(1)
    .maybeSingle();
  if (error) throw hospitalityError('persistence_failed', 500);
  if (!data) throw hospitalityError('credential_not_found', 404);
  return data;
}

export async function insertCredentialReference(row: Record<string, unknown>) {
  const { data, error } = await adminClient()
    .from('hospitality_credential_references')
    .insert(row)
    .select('id,provider_credential_id,status,provider_status_code')
    .single();
  if (error || !data) throw hospitalityError('persistence_failed', 500);
  return data;
}

export async function updateCredentialReferenceStatus(
  orgId: string,
  propertyId: string,
  credentialId: string,
  status: string,
  updates: Record<string, unknown> = {}
) {
  const { data, error } = await adminClient()
    .from('hospitality_credential_references')
    .update({ status, updated_at: new Date().toISOString(), ...updates })
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .eq('id', credentialId)
    .select('id,provider_credential_id,status,provider_status_code,revoked_at')
    .single();
  if (error || !data) throw hospitalityError('persistence_failed', 500);
  return data;
}

export async function writeHospitalityAudit(
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
    table_name: 'hospitality_room_access',
    record_id: recordId,
    new_data: payload
  });
  if (error) throw hospitalityError('audit_failed', 500);
}

export async function listHospitalityAudit(orgId: string, propertyId: string) {
  const { data, error } = await adminClient()
    .from('audit_logs')
    .select('id,org_id,user_id,action,table_name,record_id,new_data,created_at')
    .eq('org_id', orgId)
    .eq('table_name', 'hospitality_room_access')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw hospitalityError('persistence_failed', 500);

  return (data || []).filter((row: any) => String(row?.new_data?.property_id || '') === propertyId);
}
