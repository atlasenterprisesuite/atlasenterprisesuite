import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';
import {
  bootstrapAdvisoryFirm,
  listAdvisoryClients,
  type AdvisoryClientRow
} from './advisoryApi';

export type TaxReturnRow = {
  id: string;
  org_id: string;
  firm_id: string;
  client_id: string;
  engagement_id: string | null;
  tax_year: number;
  return_kind: '1040' | '1065' | '1120-S' | '1120' | '1041';
  jurisdiction: string;
  status:
    | 'organizer' | 'waiting_on_client' | 'preparation' | 'review' | 'signature'
    | 'ready_to_file' | 'transmitted' | 'accepted' | 'rejected' | 'extension'
    | 'amended' | 'closed' | 'archived';
  current_step_id: string;
  preparer_user_id: string | null;
  reviewer_user_id: string | null;
  revision: number;
  original_return_id: string | null;
  filed_at: string | null;
  accepted_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxReturnStepRow = {
  id: string;
  org_id: string;
  return_id: string;
  step_id: string;
  state: 'not_started' | 'in_progress' | 'review' | 'blocked' | 'complete';
  note: string | null;
  completed_by: string | null;
  completed_at: string | null;
  updated_at: string;
};

export type TaxSourceDocumentRow = {
  id: string;
  org_id: string;
  return_id: string;
  document_type: string;
  tax_year: number;
  issuer_name: string | null;
  correction_status: 'original' | 'corrected' | 'voided' | 'superseded';
  extraction_status: 'manual' | 'proposed' | 'reviewed' | 'verified' | 'rejected';
  external_asset_reference: string | null;
  source_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TaxFactRow = {
  id: string;
  org_id: string;
  return_id: string;
  tax_fact_key: string;
  jurisdiction: string;
  subject_key: string;
  value: unknown;
  unit: string | null;
  source_document_id: string | null;
  source_field: string | null;
  mapping_treatment: 'direct' | 'derived' | 'informational' | 'jurisdiction' | 'review' | 'override';
  rule_pack_version: string | null;
  evidence_reference: string | null;
  review_state: 'unreviewed' | 'review' | 'approved' | 'rejected' | 'overridden';
  version: number;
  is_current: boolean;
  supersedes_fact_id: string | null;
  created_at: string;
};

export type TaxLineMappingRow = {
  id: string;
  org_id: string;
  return_id: string;
  tax_fact_id: string;
  form_id: string;
  form_revision: string | null;
  destination_line: string | null;
  destination_field: string;
  contribution_role: 'input' | 'subtotal' | 'limit' | 'credit' | 'payment' | 'informational' | 'carryforward';
  mapped_value: unknown;
  calculation_reference: string | null;
  rule_pack_version: string | null;
  review_required: boolean;
  created_at: string;
};

export type TaxWorkpaperRow = {
  id: string;
  org_id: string;
  return_id: string;
  workpaper_key: string;
  workpaper_type: string;
  status: 'open' | 'reconciled' | 'review' | 'approved' | 'blocked';
  data: Record<string, unknown>;
  source_total: number | null;
  return_total: number | null;
  variance: number | null;
  evidence_reference: string | null;
  reviewed_at: string | null;
  updated_at: string;
};

export type TaxDiagnosticRow = {
  id: string;
  org_id: string;
  return_id: string;
  diagnostic_code: string;
  severity: 'info' | 'warning' | 'error' | 'fatal';
  blocking: boolean;
  source_reference: string | null;
  form_reference: string | null;
  message: string;
  status: 'open' | 'resolved' | 'accepted_override';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type TaxCarryforwardRow = {
  id: string;
  org_id: string;
  client_id: string;
  source_return_id: string;
  carryforward_key: string;
  source_tax_year: number;
  available_tax_year: number;
  expiration_tax_year: number | null;
  jurisdiction: string;
  value: unknown;
  status: 'available' | 'partially_used' | 'used' | 'expired' | 'superseded';
  consumed_by_return_id: string | null;
  rule_pack_version: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxSnapshotRow = {
  id: string;
  org_id: string;
  return_id: string;
  snapshot_kind: 'reviewed' | 'signature' | 'submission' | 'accepted' | 'amended_origin';
  return_revision: number;
  snapshot: Record<string, unknown>;
  snapshot_hash: string;
  authorization_reference: string | null;
  provider_reference: string | null;
  created_at: string;
};

export type TaxReturnWorkspaceData = {
  returnRow: TaxReturnRow;
  client: AdvisoryClientRow | null;
  steps: TaxReturnStepRow[];
  documents: TaxSourceDocumentRow[];
  facts: TaxFactRow[];
  mappings: TaxLineMappingRow[];
  workpapers: TaxWorkpaperRow[];
  diagnostics: TaxDiagnosticRow[];
  carryforwards: TaxCarryforwardRow[];
  snapshots: TaxSnapshotRow[];
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
    throw new Error(data.message || data.error_description || data.error || 'Tax request failed (' + response.status + ')');
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

async function orgId() {
  const organization = await getActiveAtlasOrganization();
  if (!organization.id) throw new Error('no_active_organization');
  return organization.id;
}

export async function listTaxReturns(): Promise<TaxReturnRow[]> {
  const organizationId = await orgId();
  const response = await authorizedAtlasFetch(
    '/rest/v1/tax_returns?org_id=eq.' + encodeURIComponent(organizationId) +
    '&select=*&order=updated_at.desc',
    { method: 'GET' }
  );
  return parseJson<TaxReturnRow[]>(response);
}

export async function createTaxReturn(input: {
  clientId: string;
  engagementId?: string | null;
  taxYear: number;
  returnKind: TaxReturnRow['return_kind'];
  jurisdiction?: string;
}): Promise<TaxReturnRow> {
  const firm = await bootstrapAdvisoryFirm();
  const rows = await rpcRows<TaxReturnRow>('tax_create_return', {
    p_firm_id: firm.id,
    p_client_id: input.clientId,
    p_engagement_id: input.engagementId || null,
    p_tax_year: input.taxYear,
    p_return_kind: input.returnKind,
    p_jurisdiction: input.jurisdiction || 'US-FED'
  });
  if (!rows[0]) throw new Error('tax_return_create_failed');
  return rows[0];
}

export async function listTaxReturnSteps(returnId: string): Promise<TaxReturnStepRow[]> {
  const organizationId = await orgId();
  const response = await authorizedAtlasFetch(
    '/rest/v1/tax_return_steps?org_id=eq.' + encodeURIComponent(organizationId) +
    '&return_id=eq.' + encodeURIComponent(returnId) +
    '&select=*&order=updated_at.asc',
    { method: 'GET' }
  );
  return parseJson<TaxReturnStepRow[]>(response);
}

export async function setTaxReturnStepState(input: {
  returnId: string;
  stepId: string;
  state: TaxReturnStepRow['state'];
  note?: string;
}): Promise<TaxReturnStepRow> {
  const rows = await rpcRows<TaxReturnStepRow>('tax_set_step_state', {
    p_return_id: input.returnId,
    p_step_id: input.stepId,
    p_state: input.state,
    p_note: input.note || null
  });
  if (!rows[0]) throw new Error('tax_step_update_failed');
  return rows[0];
}

export async function registerTaxSourceDocument(input: {
  returnId: string;
  documentType: string;
  taxYear: number;
  issuerName?: string;
  externalAssetReference?: string;
  sourceHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<TaxSourceDocumentRow> {
  const rows = await rpcRows<TaxSourceDocumentRow>('tax_register_source_document', {
    p_return_id: input.returnId,
    p_document_type: input.documentType,
    p_tax_year: input.taxYear,
    p_issuer_name: input.issuerName || null,
    p_external_asset_reference: input.externalAssetReference || null,
    p_source_hash: input.sourceHash || null,
    p_metadata: input.metadata || {}
  });
  if (!rows[0]) throw new Error('tax_document_register_failed');
  return rows[0];
}

export async function recordTaxFact(input: {
  returnId: string;
  taxFactKey: string;
  value: unknown;
  jurisdiction?: string;
  subjectKey?: string;
  unit?: string;
  sourceDocumentId?: string;
  sourceField?: string;
  mappingTreatment?: TaxFactRow['mapping_treatment'];
  rulePackVersion?: string;
  evidenceReference?: string;
  reviewState?: TaxFactRow['review_state'];
}): Promise<TaxFactRow> {
  const rows = await rpcRows<TaxFactRow>('tax_record_fact', {
    p_return_id: input.returnId,
    p_tax_fact_key: input.taxFactKey,
    p_value: input.value,
    p_jurisdiction: input.jurisdiction || 'US-FED',
    p_subject_key: input.subjectKey || 'primary',
    p_unit: input.unit || null,
    p_source_document_id: input.sourceDocumentId || null,
    p_source_field: input.sourceField || null,
    p_mapping_treatment: input.mappingTreatment || 'direct',
    p_rule_pack_version: input.rulePackVersion || null,
    p_evidence_reference: input.evidenceReference || null,
    p_review_state: input.reviewState || 'unreviewed'
  });
  if (!rows[0]) throw new Error('tax_fact_record_failed');
  return rows[0];
}


export async function importTaxSourceMapping(input: {
  returnId: string;
  documentType: string;
  taxYear: number;
  mappings: Array<Record<string, unknown>>;
  issuerName?: string;
  externalAssetReference?: string;
  sourceHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ document_id: string; mapping_count: number }> {
  const response = await authorizedAtlasFetch('/rest/v1/rpc/tax_import_source_mapping', {
    method: 'POST',
    body: JSON.stringify({
      p_return_id: input.returnId,
      p_document_type: input.documentType,
      p_tax_year: input.taxYear,
      p_mappings: input.mappings,
      p_issuer_name: input.issuerName || null,
      p_external_asset_reference: input.externalAssetReference || null,
      p_source_hash: input.sourceHash || null,
      p_metadata: input.metadata || {}
    })
  });
  return parseJson<{ document_id: string; mapping_count: number }>(response);
}

export async function recordTaxLineMapping(input: {
  returnId: string;
  taxFactId: string;
  formId: string;
  destinationField: string;
  destinationLine?: string;
  formRevision?: string;
  contributionRole?: TaxLineMappingRow['contribution_role'];
  mappedValue?: unknown;
  calculationReference?: string;
  rulePackVersion?: string;
  reviewRequired?: boolean;
}): Promise<TaxLineMappingRow> {
  const rows = await rpcRows<TaxLineMappingRow>('tax_record_line_mapping', {
    p_return_id: input.returnId,
    p_tax_fact_id: input.taxFactId,
    p_form_id: input.formId,
    p_destination_field: input.destinationField,
    p_destination_line: input.destinationLine || null,
    p_form_revision: input.formRevision || null,
    p_contribution_role: input.contributionRole || 'input',
    p_mapped_value: input.mappedValue ?? null,
    p_calculation_reference: input.calculationReference || null,
    p_rule_pack_version: input.rulePackVersion || null,
    p_review_required: Boolean(input.reviewRequired)
  });
  if (!rows[0]) throw new Error('tax_line_mapping_record_failed');
  return rows[0];
}

export async function upsertTaxWorkpaper(input: {
  returnId: string;
  workpaperKey: string;
  workpaperType: string;
  status: TaxWorkpaperRow['status'];
  data?: Record<string, unknown>;
  sourceTotal?: number | null;
  returnTotal?: number | null;
  evidenceReference?: string;
}): Promise<TaxWorkpaperRow> {
  const rows = await rpcRows<TaxWorkpaperRow>('tax_upsert_workpaper', {
    p_return_id: input.returnId,
    p_workpaper_key: input.workpaperKey,
    p_workpaper_type: input.workpaperType,
    p_status: input.status,
    p_data: input.data || {},
    p_source_total: input.sourceTotal ?? null,
    p_return_total: input.returnTotal ?? null,
    p_evidence_reference: input.evidenceReference || null
  });
  if (!rows[0]) throw new Error('tax_workpaper_upsert_failed');
  return rows[0];
}

export async function openTaxDiagnostic(input: {
  returnId: string;
  diagnosticCode: string;
  severity: TaxDiagnosticRow['severity'];
  blocking: boolean;
  message: string;
  sourceReference?: string;
  formReference?: string;
}): Promise<TaxDiagnosticRow> {
  const rows = await rpcRows<TaxDiagnosticRow>('tax_open_diagnostic', {
    p_return_id: input.returnId,
    p_diagnostic_code: input.diagnosticCode,
    p_severity: input.severity,
    p_blocking: input.blocking,
    p_message: input.message,
    p_source_reference: input.sourceReference || null,
    p_form_reference: input.formReference || null
  });
  if (!rows[0]) throw new Error('tax_diagnostic_open_failed');
  return rows[0];
}

export async function resolveTaxDiagnostic(input: {
  diagnosticId: string;
  resolutionNote: string;
  acceptOverride?: boolean;
}): Promise<TaxDiagnosticRow> {
  const rows = await rpcRows<TaxDiagnosticRow>('tax_resolve_diagnostic', {
    p_diagnostic_id: input.diagnosticId,
    p_resolution_note: input.resolutionNote,
    p_accept_override: Boolean(input.acceptOverride)
  });
  if (!rows[0]) throw new Error('tax_diagnostic_resolve_failed');
  return rows[0];
}

export async function createTaxCarryforward(input: {
  sourceReturnId: string;
  carryforwardKey: string;
  availableTaxYear: number;
  value: unknown;
  expirationTaxYear?: number | null;
  jurisdiction?: string;
  rulePackVersion?: string;
}): Promise<TaxCarryforwardRow> {
  const rows = await rpcRows<TaxCarryforwardRow>('tax_create_carryforward', {
    p_source_return_id: input.sourceReturnId,
    p_carryforward_key: input.carryforwardKey,
    p_available_tax_year: input.availableTaxYear,
    p_value: input.value,
    p_expiration_tax_year: input.expirationTaxYear ?? null,
    p_jurisdiction: input.jurisdiction || 'US-FED',
    p_rule_pack_version: input.rulePackVersion || null
  });
  if (!rows[0]) throw new Error('tax_carryforward_create_failed');
  return rows[0];
}

export async function lockTaxReturnSnapshot(input: {
  returnId: string;
  snapshotKind: TaxSnapshotRow['snapshot_kind'];
  snapshot: Record<string, unknown>;
  authorizationReference?: string;
  providerReference?: string;
}): Promise<TaxSnapshotRow> {
  const rows = await rpcRows<TaxSnapshotRow>('tax_lock_return_snapshot', {
    p_return_id: input.returnId,
    p_snapshot_kind: input.snapshotKind,
    p_snapshot: input.snapshot,
    p_authorization_reference: input.authorizationReference || null,
    p_provider_reference: input.providerReference || null
  });
  if (!rows[0]) throw new Error('tax_snapshot_lock_failed');
  return rows[0];
}

async function listByReturn<T>(table: string, returnId: string, order: string): Promise<T[]> {
  const organizationId = await orgId();
  const response = await authorizedAtlasFetch(
    '/rest/v1/' + table + '?org_id=eq.' + encodeURIComponent(organizationId) +
    '&return_id=eq.' + encodeURIComponent(returnId) +
    '&select=*&order=' + encodeURIComponent(order),
    { method: 'GET' }
  );
  return parseJson<T[]>(response);
}

export async function getTaxReturnWorkspace(returnId: string): Promise<TaxReturnWorkspaceData> {
  const organizationId = await orgId();
  const [returns, clients, steps, documents, facts, mappings, workpapers, diagnostics, snapshots] = await Promise.all([
    authorizedAtlasFetch(
      '/rest/v1/tax_returns?org_id=eq.' + encodeURIComponent(organizationId) +
      '&id=eq.' + encodeURIComponent(returnId) + '&select=*',
      { method: 'GET' }
    ).then(parseJson<TaxReturnRow[]>),
    listAdvisoryClients(),
    listTaxReturnSteps(returnId),
    listByReturn<TaxSourceDocumentRow>('tax_source_documents', returnId, 'created_at.desc'),
    listByReturn<TaxFactRow>('tax_facts', returnId, 'created_at.desc'),
    listByReturn<TaxLineMappingRow>('tax_line_mappings', returnId, 'created_at.desc'),
    listByReturn<TaxWorkpaperRow>('tax_workpapers', returnId, 'updated_at.desc'),
    listByReturn<TaxDiagnosticRow>('tax_diagnostics', returnId, 'created_at.desc'),
    listByReturn<TaxSnapshotRow>('tax_return_snapshots', returnId, 'created_at.desc')
  ]);
  const returnRow = returns[0];
  if (!returnRow) throw new Error('tax_return_not_found');

  const carryforwardResponse = await authorizedAtlasFetch(
    '/rest/v1/tax_carryforwards?org_id=eq.' + encodeURIComponent(organizationId) +
    '&client_id=eq.' + encodeURIComponent(returnRow.client_id) +
    '&select=*&order=available_tax_year.asc,created_at.desc',
    { method: 'GET' }
  );
  const carryforwards = await parseJson<TaxCarryforwardRow[]>(carryforwardResponse);

  return {
    returnRow,
    client: clients.find((item) => item.id === returnRow.client_id) || null,
    steps,
    documents,
    facts,
    mappings,
    workpapers,
    diagnostics,
    carryforwards,
    snapshots
  };
}
