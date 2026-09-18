import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type ProviderCallLoggingMode = 'disabled' | 'per_call' | 'all' | 'selected_modules';

export type AtlasAiDataPolicy = {
  org_id: string;
  audit_logging_enabled: true;
  provider_call_logging_mode: ProviderCallLoggingMode;
  selected_modules: string[];
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AtlasAiDataPolicyAudit = {
  id: string;
  action: 'insert' | 'update';
  previous_policy: Record<string, unknown> | null;
  resulting_policy: Record<string, unknown>;
  actor_user_id: string | null;
  created_at: string;
};

export type AtlasAiGovernanceState = {
  role: string;
  canManage: boolean;
  policy: AtlasAiDataPolicy;
  audit: AtlasAiDataPolicyAudit[];
};

export const DEFAULT_PROVIDER_CALL_LOGGING_MODE: ProviderCallLoggingMode = 'disabled';
export const SENSITIVE_ATLAS_AI_MODULES = ['health', 'payroll', 'hr', 'finance', 'accounting', 'lawyer'] as const;

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && ('message' in data || 'error' in data)
      ? String((data as { message?: unknown; error?: unknown }).message || (data as { error?: unknown }).error)
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

function defaultPolicy(orgId: string): AtlasAiDataPolicy {
  return {
    org_id: orgId,
    audit_logging_enabled: true,
    provider_call_logging_mode: DEFAULT_PROVIDER_CALL_LOGGING_MODE,
    selected_modules: [],
    updated_by: null,
    created_at: null,
    updated_at: null
  };
}

function canManageRole(role: string) {
  return role === 'owner' || role === 'admin';
}

export async function getAtlasAiGovernanceState(): Promise<AtlasAiGovernanceState> {
  const organization = await getActiveAtlasOrganization();
  const orgFilter = encodeURIComponent(`eq.${organization.id}`);
  const [policyResponse, auditResponse] = await Promise.all([
    authorizedAtlasFetch(
      `/rest/v1/atlas_ai_data_policies?org_id=${orgFilter}&select=org_id,audit_logging_enabled,provider_call_logging_mode,selected_modules,updated_by,created_at,updated_at&limit=1`,
      { method: 'GET' }
    ),
    authorizedAtlasFetch(
      `/rest/v1/atlas_ai_data_policy_audit?org_id=${orgFilter}&select=id,action,previous_policy,resulting_policy,actor_user_id,created_at&order=created_at.desc&limit=20`,
      { method: 'GET' }
    )
  ]);

  const policies = await parseResponse<AtlasAiDataPolicy[]>(policyResponse);
  const audit = await parseResponse<AtlasAiDataPolicyAudit[]>(auditResponse);
  return {
    role: organization.role,
    canManage: canManageRole(organization.role),
    policy: policies?.[0] || defaultPolicy(organization.id),
    audit: Array.isArray(audit) ? audit : []
  };
}

export async function saveAtlasAiDataPolicy(
  mode: ProviderCallLoggingMode,
  selectedModules: string[]
): Promise<AtlasAiDataPolicy> {
  const organization = await getActiveAtlasOrganization();
  if (!canManageRole(organization.role)) throw new Error('security_manage_permission_required');

  const sensitive = new Set<string>(SENSITIVE_ATLAS_AI_MODULES);
  const normalizedSelected = [...new Set(selectedModules.map((value) => value.trim().toLowerCase()).filter(Boolean))]
    .filter((module) => !sensitive.has(module));

  const response = await authorizedAtlasFetch('/rest/v1/atlas_ai_data_policies?on_conflict=org_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      audit_logging_enabled: true,
      provider_call_logging_mode: mode,
      selected_modules: normalizedSelected
    })
  });
  const rows = await parseResponse<AtlasAiDataPolicy[]>(response);
  if (!rows?.[0]) throw new Error('policy_not_returned');
  return rows[0];
}
