import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';
import type { LaunchEvidenceDimension } from '../../../../packages/advisory/src';

export type AdvisoryFirmRow = {
  id: string;
  org_id: string;
  slug: string;
  firm_number: string;
  name: string;
  status: 'active' | 'inactive';
  platform: 'ATLAS Advisory Office';
};

export type AdvisoryClientRow = {
  id: string;
  org_id: string;
  firm_id: string;
  display_name: string;
  client_type: 'person' | 'business';
  email: string | null;
  phone: string | null;
  status: 'prospect' | 'active' | 'inactive';
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvisoryEngagementRow = {
  id: string;
  org_id: string;
  firm_id: string;
  client_id: string;
  service_id: string;
  title: string;
  status: 'lead' | 'open' | 'review' | 'billing' | 'closed';
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvisoryLaunchIntakeRow = {
  id: string;
  org_id: string;
  firm_id: string;
  service_id: 'business-launch-360';
  reference: string;
  full_name: string;
  business_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  business_stage: string | null;
  goals: string | null;
  status: 'new' | 'quoted' | 'converted' | 'invoiced' | 'closed';
  quote_amount: number | null;
  quote_currency: string;
  quote_note: string | null;
  advisory_client_id: string | null;
  engagement_id: string | null;
  receivable_customer_id: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvisoryLaunchEvidenceRow = {
  id: string;
  org_id: string;
  firm_id: string;
  engagement_id: string;
  dimension: LaunchEvidenceDimension;
  status: 'pending' | 'verified' | 'rejected';
  evidence_reference: string | null;
  note: string | null;
  verified_at: string | null;
  updated_at: string;
};

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text || 'Invalid response' };
  }
  if (!response.ok) {
    const data = payload as { message?: string; error?: string; error_description?: string };
    throw new Error(data.message || data.error_description || data.error || 'Advisory request failed (' + response.status + ')');
  }
  return payload as T;
}

async function rpcRows<T>(name: string, body: Record<string, unknown>): Promise<T[]> {
  const response = await authorizedAtlasFetch('/rest/v1/rpc/' + name, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return parseJson<T[]>(response);
}

export async function bootstrapAdvisoryFirm(): Promise<AdvisoryFirmRow> {
  const organization = await getActiveAtlasOrganization();
  if (!organization.id) throw new Error('no_active_organization');
  const rows = await rpcRows<AdvisoryFirmRow>('advisory_bootstrap_default_firm', {});
  if (!rows[0]) throw new Error('advisory_firm_unavailable');
  return rows[0];
}

export async function listAdvisoryClients(): Promise<AdvisoryClientRow[]> {
  const organization = await getActiveAtlasOrganization();
  const firm = await bootstrapAdvisoryFirm();
  const response = await authorizedAtlasFetch(
    '/rest/v1/advisory_clients?org_id=eq.' + encodeURIComponent(organization.id) +
    '&firm_id=eq.' + encodeURIComponent(firm.id) +
    '&select=id,org_id,firm_id,display_name,client_type,email,phone,status,owner_id,created_at,updated_at&order=display_name.asc',
    { method: 'GET' }
  );
  return parseJson<AdvisoryClientRow[]>(response);
}

export async function createAdvisoryClient(input: {
  displayName: string;
  email?: string;
  phone?: string;
  clientType?: 'person' | 'business';
}): Promise<AdvisoryClientRow> {
  const firm = await bootstrapAdvisoryFirm();
  const rows = await rpcRows<AdvisoryClientRow>('advisory_create_client', {
    p_firm_id: firm.id,
    p_display_name: input.displayName,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_client_type: input.clientType || 'business'
  });
  if (!rows[0]) throw new Error('advisory_client_create_failed');
  return rows[0];
}

export async function listAdvisoryEngagements(): Promise<AdvisoryEngagementRow[]> {
  const organization = await getActiveAtlasOrganization();
  const firm = await bootstrapAdvisoryFirm();
  const response = await authorizedAtlasFetch(
    '/rest/v1/advisory_engagements?org_id=eq.' + encodeURIComponent(organization.id) +
    '&firm_id=eq.' + encodeURIComponent(firm.id) +
    '&select=id,org_id,firm_id,client_id,service_id,title,status,owner_id,created_at,updated_at&order=created_at.desc',
    { method: 'GET' }
  );
  return parseJson<AdvisoryEngagementRow[]>(response);
}

export async function createAdvisoryEngagement(input: {
  clientId: string;
  serviceId: string;
  title: string;
}): Promise<AdvisoryEngagementRow> {
  const firm = await bootstrapAdvisoryFirm();
  const rows = await rpcRows<AdvisoryEngagementRow>('advisory_create_engagement', {
    p_firm_id: firm.id,
    p_client_id: input.clientId,
    p_service_id: input.serviceId,
    p_title: input.title
  });
  if (!rows[0]) throw new Error('advisory_engagement_create_failed');
  return rows[0];
}

export async function listAdvisoryLaunchEvidence(engagementId: string): Promise<AdvisoryLaunchEvidenceRow[]> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    '/rest/v1/advisory_launch_deliverables?org_id=eq.' + encodeURIComponent(organization.id) +
    '&engagement_id=eq.' + encodeURIComponent(engagementId) +
    '&select=id,org_id,firm_id,engagement_id,dimension,status,evidence_reference,note,verified_at,updated_at&order=dimension.asc',
    { method: 'GET' }
  );
  return parseJson<AdvisoryLaunchEvidenceRow[]>(response);
}

export async function updateAdvisoryLaunchEvidence(input: {
  engagementId: string;
  dimension: LaunchEvidenceDimension;
  status: 'pending' | 'verified' | 'rejected';
  evidenceReference?: string;
  note?: string;
}): Promise<AdvisoryLaunchEvidenceRow> {
  const rows = await rpcRows<AdvisoryLaunchEvidenceRow>('advisory_set_launch_evidence', {
    p_engagement_id: input.engagementId,
    p_dimension: input.dimension,
    p_status: input.status,
    p_evidence_reference: input.evidenceReference || null,
    p_note: input.note || null
  });
  if (!rows[0]) throw new Error('advisory_evidence_update_failed');
  return rows[0];
}


export async function listAdvisoryLaunchIntakes(): Promise<AdvisoryLaunchIntakeRow[]> {
  const organization = await getActiveAtlasOrganization();
  const firm = await bootstrapAdvisoryFirm();
  const response = await authorizedAtlasFetch(
    '/rest/v1/advisory_launch_intakes?org_id=eq.' + encodeURIComponent(organization.id) +
    '&firm_id=eq.' + encodeURIComponent(firm.id) +
    '&select=id,org_id,firm_id,service_id,reference,full_name,business_name,email,phone,website,business_stage,goals,status,quote_amount,quote_currency,quote_note,advisory_client_id,engagement_id,receivable_customer_id,invoice_id,created_at,updated_at&order=created_at.desc',
    { method: 'GET' }
  );
  const rows = await parseJson<any[]>(response);
  return rows.map((row) => ({
    ...row,
    quote_amount: row.quote_amount == null ? null : Number(row.quote_amount)
  })) as AdvisoryLaunchIntakeRow[];
}

export async function setAdvisoryLaunchQuote(input: {
  intakeId: string;
  amount: number;
  note?: string;
}): Promise<AdvisoryLaunchIntakeRow> {
  const rows = await rpcRows<any>('advisory_set_launch_quote', {
    p_intake_id: input.intakeId,
    p_amount: input.amount,
    p_note: input.note || null
  });
  if (!rows[0]) throw new Error('advisory_launch_quote_failed');
  return { ...rows[0], quote_amount: rows[0].quote_amount == null ? null : Number(rows[0].quote_amount) } as AdvisoryLaunchIntakeRow;
}

export async function convertAdvisoryLaunchIntake(intakeId: string): Promise<AdvisoryLaunchIntakeRow> {
  const rows = await rpcRows<any>('advisory_convert_launch_intake', { p_intake_id: intakeId });
  if (!rows[0]) throw new Error('advisory_launch_conversion_failed');
  return { ...rows[0], quote_amount: rows[0].quote_amount == null ? null : Number(rows[0].quote_amount) } as AdvisoryLaunchIntakeRow;
}

export async function setAdvisoryLaunchBillingRefs(input: {
  intakeId: string;
  receivableCustomerId?: string | null;
  invoiceId?: string | null;
}): Promise<AdvisoryLaunchIntakeRow> {
  const rows = await rpcRows<any>('advisory_set_launch_billing_refs', {
    p_intake_id: input.intakeId,
    p_receivable_customer_id: input.receivableCustomerId || null,
    p_invoice_id: input.invoiceId || null
  });
  if (!rows[0]) throw new Error('advisory_launch_billing_link_failed');
  return { ...rows[0], quote_amount: rows[0].quote_amount == null ? null : Number(rows[0].quote_amount) } as AdvisoryLaunchIntakeRow;
}
