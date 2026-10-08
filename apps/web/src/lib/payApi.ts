import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type AtlasPayProviderConnectionRow = {
  id: string;
  provider_key: string;
  provider_kind: string;
  environment: 'sandbox' | 'production';
  authorization_state: 'unverified' | 'authorized' | 'revoked' | 'blocked';
  regulatory_coverage_state: 'unverified' | 'verified' | 'blocked';
  capabilities: string[];
  currencies: string[];
  credentials_verified_at: string | null;
  last_verified_at: string | null;
};

export type AtlasPayIntentSummary = {
  id: string;
  state: string;
  created_at: string;
};

export type AtlasPayAccountRow = {
  id: string;
  account_key: string;
  display_label: string;
  account_kind: 'person' | 'organization' | 'brand' | 'creator' | 'external';
  state: 'active' | 'suspended' | 'archived';
  created_at: string;
};

export type AtlasPayBalanceEvidenceRow = {
  id: string;
  account_id: string;
  provider_connection_id: string | null;
  balance_kind: 'wallet' | 'earnings' | 'rewards' | 'credits';
  amount_minor_text: string;
  currency: string;
  state: 'available' | 'pending' | 'held' | 'unavailable';
  source_kind: 'atlas_control_plane' | 'external_provider' | 'manual_evidence';
  source_reference: string;
  observed_at: string;
  expires_at: string | null;
  created_at: string;
};

export type AtlasPaySnapshot = {
  source: 'supabase_rls_live';
  organizationId: string;
  loadedAt: string;
  providers: AtlasPayProviderConnectionRow[];
  accounts: AtlasPayAccountRow[];
  balanceEvidence: AtlasPayBalanceEvidenceRow[];
  instrumentIntents: AtlasPayIntentSummary[];
  payoutIntents: AtlasPayIntentSummary[];
};

async function readRows<T>(
  table: string,
  select: string,
  organizationId: string
): Promise<T[]> {
  const params = new URLSearchParams({
    select,
    org_id: `eq.${organizationId}`,
    order: 'created_at.desc'
  });

  const response = await authorizedAtlasFetch(`/rest/v1/${table}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`${table}_http_${response.status}`);
  }

  const body = await response.json();
  return Array.isArray(body) ? body as T[] : [];
}

export async function loadAtlasPaySnapshot(): Promise<AtlasPaySnapshot> {
  const organization = await getActiveAtlasOrganization();

  const [providers, accounts, balanceEvidence, instrumentIntents, payoutIntents] = await Promise.all([
    readRows<AtlasPayProviderConnectionRow>(
      'atlas_pay_provider_connections',
      'id,provider_key,provider_kind,environment,authorization_state,regulatory_coverage_state,capabilities,currencies,credentials_verified_at,last_verified_at,created_at',
      organization.id
    ),
    readRows<AtlasPayAccountRow>(
      'atlas_pay_accounts',
      'id,account_key,display_label,account_kind,state,created_at',
      organization.id
    ),
    readRows<AtlasPayBalanceEvidenceRow>(
      'atlas_pay_balance_evidence',
      'id,account_id,provider_connection_id,balance_kind,amount_minor_text,currency,state,source_kind,source_reference,observed_at,expires_at,created_at',
      organization.id
    ),
    readRows<AtlasPayIntentSummary>(
      'atlas_pay_instrument_intents',
      'id,state,created_at',
      organization.id
    ),
    readRows<AtlasPayIntentSummary>(
      'atlas_pay_payout_intents',
      'id,state,created_at',
      organization.id
    )
  ]);

  return {
    source: 'supabase_rls_live',
    organizationId: organization.id,
    loadedAt: new Date().toISOString(),
    providers,
    accounts,
    balanceEvidence,
    instrumentIntents,
    payoutIntents
  };
}
