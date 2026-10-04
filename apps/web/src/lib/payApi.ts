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

export type AtlasPaySnapshot = {
  source: 'supabase_rls_live';
  organizationId: string;
  loadedAt: string;
  providers: AtlasPayProviderConnectionRow[];
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

  const [providers, instrumentIntents, payoutIntents] = await Promise.all([
    readRows<AtlasPayProviderConnectionRow>(
      'atlas_pay_provider_connections',
      'id,provider_key,provider_kind,environment,authorization_state,regulatory_coverage_state,capabilities,currencies,credentials_verified_at,last_verified_at,created_at',
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
    instrumentIntents,
    payoutIntents
  };
}
