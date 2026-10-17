import { trustError } from './errors.ts';

export type TrustPolicyRow = {
  id: string;
  policy_key: string;
  version: number;
  action_class: 'P0' | 'P1' | 'P2' | 'P3';
  minimum_assurance: 'authenticated' | 'aal2' | 'phishing_resistant';
  mode: 'shadow' | 'enforce';
  step_up_max_age_seconds: number;
  grant_ttl_seconds: number;
};

type AdminClient = {
  from(table: string): any;
};

async function newestPolicy(query: any): Promise<TrustPolicyRow | null> {
  const { data, error } = await query
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1);

  if (error) throw trustError('trust_not_configured', 503);
  return data?.[0] ? data[0] as TrustPolicyRow : null;
}

export async function loadTrustPolicy(
  admin: AdminClient,
  orgId: string,
  actionClass: TrustPolicyRow['action_class']
): Promise<TrustPolicyRow | null> {
  const fields = 'id,policy_key,version,action_class,minimum_assurance,mode,step_up_max_age_seconds,grant_ttl_seconds';

  const organizationPolicy = await newestPolicy(
    admin
      .from('atlas_trust_policies')
      .select(fields)
      .eq('organization_id', orgId)
      .eq('action_class', actionClass)
  );
  if (organizationPolicy) return organizationPolicy;

  return newestPolicy(
    admin
      .from('atlas_trust_policies')
      .select(fields)
      .is('organization_id', null)
      .eq('action_class', actionClass)
  );
}

export type TrustRiskEventInsert = {
  organization_id: string;
  user_id: string;
  session_id: string;
  action_type: string;
  resource_id: string | null;
  action_class: 'P0' | 'P1' | 'P2' | 'P3';
  risk_score: number;
  risk_band: 'low' | 'medium' | 'high' | 'critical';
  reason_codes: string[];
  policy_id: string | null;
  policy_version: number;
  decision: 'allow' | 'step_up_required' | 'temporary_hold' | 'deny';
  recommended_decision: 'allow' | 'step_up_required' | 'temporary_hold' | 'deny';
  mode: 'shadow' | 'enforce';
  correlation_id: string;
};

export async function appendTrustRiskEvent(admin: AdminClient, event: TrustRiskEventInsert) {
  const { error } = await admin
    .from('atlas_trust_risk_events')
    .insert(event);

  if (error) throw trustError('trust_not_configured', 503);
}
