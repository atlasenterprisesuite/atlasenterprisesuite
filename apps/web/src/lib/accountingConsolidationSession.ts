import {
  mapAccountingEntity,
  mapConsolidationAdjustment,
  mapConsolidationGroup,
  mapConsolidationMember,
  mapIntercompanyCandidate,
  mapIntercompanyMatch,
  type AccountingEntityRecord,
  type AccountingEntityRow,
  type ConsolidatedTrialBalanceRow,
  type ConsolidationAdjustmentRecord,
  type ConsolidationAdjustmentRow,
  type ConsolidationGroupRecord,
  type ConsolidationGroupRow,
  type ConsolidationMemberRecord,
  type ConsolidationMemberRow,
  type IntercompanyCandidateRecord,
  type IntercompanyCandidateRow,
  type IntercompanyMatchRecord,
  type IntercompanyMatchRow,
} from '../../../../packages/accounting/src';
import { getActiveAtlasOrganization, getAtlasAccessToken, type AtlasOrganization } from './atlasSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type AccountingConsolidationWorkspace = {
  source: 'supabase_rls_live';
  organization: AtlasOrganization;
  entities: AccountingEntityRecord[];
  groups: ConsolidationGroupRecord[];
  members: ConsolidationMemberRecord[];
  matches: IntercompanyMatchRecord[];
  adjustments: ConsolidationAdjustmentRecord[];
  loadedAt: string;
};

type ConsolidationRpcName =
  | 'create_accounting_consolidation_group'
  | 'add_accounting_consolidation_member'
  | 'match_accounting_intercompany_lines'
  | 'create_accounting_intercompany_elimination'
  | 'create_accounting_consolidation_adjustment'
  | 'set_accounting_consolidation_group_status'
  | 'get_accounting_intercompany_candidates'
  | 'get_accounting_consolidated_trial_balance';

function requireEnvironment() {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new Error('supabase_environment_not_configured');
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'invalid_response' };
  }
  if (!response.ok) {
    const payload = data as { message?: string; error_description?: string; error?: string };
    throw new Error(payload.message || payload.error_description || payload.error || `Request failed (${response.status})`);
  }
  return data;
}

async function authenticatedFetch(path: string, init: RequestInit = {}) {
  requireEnvironment();
  let token = getAtlasAccessToken();
  if (!token) throw new Error('authentication_required');

  const request = (accessToken: string) => fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let response = await request(token);
  if (response.status === 401) {
    await getActiveAtlasOrganization();
    token = getAtlasAccessToken();
    if (!token) throw new Error('session_expired');
    response = await request(token);
  }
  return response;
}

async function rpc<T>(functionName: ConsolidationRpcName, args: Record<string, unknown>) {
  const response = await authenticatedFetch(`/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    body: JSON.stringify(args),
  });
  return parseResponse(response) as Promise<T>;
}

export async function getAccountingConsolidationWorkspace(): Promise<AccountingConsolidationWorkspace> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const entitySelect = encodeURIComponent('id,org_id,code,legal_name,jurisdiction,functional_currency,reporting_currency,active');
  const groupSelect = encodeURIComponent('id,org_id,parent_entity_id,name,reporting_currency,status,created_by,created_at,updated_at');
  const memberSelect = encodeURIComponent('id,org_id,group_id,entity_id,consolidation_method,ownership_pct,effective_from,effective_to,created_by,created_at,updated_at');
  const matchSelect = encodeURIComponent('id,org_id,group_id,match_reference,source_line_id,counterparty_line_id,source_entity_id,counterparty_entity_id,reporting_currency,source_reporting_amount,counterparty_reporting_amount,difference,tolerance,status,created_by,created_at,updated_at');
  const adjustmentSelect = encodeURIComponent('id,org_id,group_id,source_match_id,adjustment_date,reference,reason,status,created_by,posted_by,posted_at,created_at,updated_at');

  const [entityResponse,groupResponse,memberResponse,matchResponse,adjustmentResponse] = await Promise.all([
    authenticatedFetch(`/rest/v1/accounting_entities?org_id=${orgFilter}&select=${entitySelect}&order=code.asc`, { method: 'GET' }),
    authenticatedFetch(`/rest/v1/accounting_consolidation_groups?org_id=${orgFilter}&select=${groupSelect}&order=created_at.desc`, { method: 'GET' }),
    authenticatedFetch(`/rest/v1/accounting_consolidation_members?org_id=${orgFilter}&select=${memberSelect}&order=effective_from.desc`, { method: 'GET' }),
    authenticatedFetch(`/rest/v1/accounting_intercompany_matches?org_id=${orgFilter}&select=${matchSelect}&order=created_at.desc`, { method: 'GET' }),
    authenticatedFetch(`/rest/v1/accounting_consolidation_adjustments?org_id=${orgFilter}&select=${adjustmentSelect}&order=adjustment_date.desc,created_at.desc`, { method: 'GET' }),
  ]);

  const [entities,groups,members,matches,adjustments] = await Promise.all([
    parseResponse(entityResponse),parseResponse(groupResponse),parseResponse(memberResponse),parseResponse(matchResponse),parseResponse(adjustmentResponse),
  ]);
  if (![entities,groups,members,matches,adjustments].every(Array.isArray)) throw new Error('Consolidation workspace returned an invalid payload');

  return {
    source: 'supabase_rls_live',
    organization,
    entities: (entities as AccountingEntityRow[]).map(mapAccountingEntity),
    groups: (groups as ConsolidationGroupRow[]).map(mapConsolidationGroup),
    members: (members as ConsolidationMemberRow[]).map(mapConsolidationMember),
    matches: (matches as IntercompanyMatchRow[]).map(mapIntercompanyMatch),
    adjustments: (adjustments as ConsolidationAdjustmentRow[]).map(mapConsolidationAdjustment),
    loadedAt: new Date().toISOString(),
  };
}

export async function getIntercompanyCandidates(groupId: string, startDate: string | null, endDate: string | null) {
  const organization = await getActiveAtlasOrganization();
  const rows = await rpc<IntercompanyCandidateRow[]>('get_accounting_intercompany_candidates', {
    organization_uuid: organization.id,
    group_uuid: groupId,
    start_date_value: startDate,
    end_date_value: endDate,
  });
  if (!Array.isArray(rows)) throw new Error('Intercompany candidates returned an invalid payload');
  return rows.map(mapIntercompanyCandidate);
}

export async function getConsolidatedTrialBalance(groupId: string, asOfDate: string) {
  const organization = await getActiveAtlasOrganization();
  const rows = await rpc<ConsolidatedTrialBalanceRow[]>('get_accounting_consolidated_trial_balance', {
    organization_uuid: organization.id,
    group_uuid: groupId,
    as_of_date_value: asOfDate,
  });
  if (!Array.isArray(rows)) throw new Error('Consolidated trial balance returned an invalid payload');
  return rows.map((row) => ({
    accountId: row.account_id,
    accountNumber: row.account_number,
    accountName: row.account_name,
    debit: Number(row.debit),
    credit: Number(row.credit),
    balance: Number(row.balance),
    reportingCurrency: row.reporting_currency,
  }));
}

export async function createConsolidationGroup(input: {
  organizationId: string;
  name: string;
  reportingCurrency: string;
  parentEntityId: string | null;
}) {
  return rpc<string>('create_accounting_consolidation_group', {
    organization_uuid: input.organizationId,
    group_name: input.name,
    reporting_currency_value: input.reportingCurrency,
    parent_entity_uuid: input.parentEntityId,
  });
}

export async function addConsolidationMember(input: {
  organizationId: string;
  groupId: string;
  entityId: string;
  consolidationMethod: 'full' | 'proportional';
  ownershipPct: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}) {
  return rpc<string>('add_accounting_consolidation_member', {
    organization_uuid: input.organizationId,
    group_uuid: input.groupId,
    entity_uuid: input.entityId,
    consolidation_method_value: input.consolidationMethod,
    ownership_pct_value: input.ownershipPct,
    effective_from_value: input.effectiveFrom,
    effective_to_value: input.effectiveTo,
  });
}

export async function matchIntercompanyLines(input: {
  organizationId: string;
  groupId: string;
  reference: string;
  sourceLineId: string;
  counterpartyLineId: string;
  tolerance: number;
}) {
  return rpc<string>('match_accounting_intercompany_lines', {
    organization_uuid: input.organizationId,
    group_uuid: input.groupId,
    match_reference_value: input.reference,
    source_line_uuid: input.sourceLineId,
    counterparty_line_uuid: input.counterpartyLineId,
    tolerance_value: input.tolerance,
  });
}

export async function createIntercompanyElimination(input: {
  organizationId: string;
  matchId: string;
  adjustmentDate: string;
  reference: string;
  reason: string;
  roundingAccountId: string | null;
}) {
  return rpc<string>('create_accounting_intercompany_elimination', {
    organization_uuid: input.organizationId,
    match_uuid: input.matchId,
    adjustment_on: input.adjustmentDate,
    adjustment_reference: input.reference,
    adjustment_reason: input.reason,
    rounding_account_uuid: input.roundingAccountId,
  });
}

export async function createManualConsolidationAdjustment(input: {
  organizationId: string;
  groupId: string;
  adjustmentDate: string;
  reference: string;
  reason: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
}) {
  return rpc<string>('create_accounting_consolidation_adjustment', {
    organization_uuid: input.organizationId,
    group_uuid: input.groupId,
    adjustment_on: input.adjustmentDate,
    adjustment_reference: input.reference,
    adjustment_reason: input.reason,
    debit_account_uuid: input.debitAccountId,
    credit_account_uuid: input.creditAccountId,
    adjustment_amount: input.amount,
  });
}

export async function setConsolidationGroupStatus(organizationId: string, groupId: string, status: 'locked' | 'archived') {
  return rpc<string>('set_accounting_consolidation_group_status', {
    organization_uuid: organizationId,
    group_uuid: groupId,
    status_value: status,
  });
}
