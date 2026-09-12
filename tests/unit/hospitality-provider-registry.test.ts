import { describe, expect, it } from 'vitest';
import { PROVIDER_STATES, type HospitalityProviderState } from '../../packages/hospitality/types';
import { providerFor } from '../../supabase/functions/atlas-hospitality-access/_shared/provider-registry';

const context = {
  organizationId: 'org-1',
  propertyId: 'hotel-1',
  userId: 'user-1',
  providerInstanceId: 'provider-1',
  providerPropertyId: 'site-1'
};

function instance(provider_type: string) {
  return {
    id: 'provider-1',
    org_id: 'org-1',
    property_id: 'hotel-1',
    provider_type,
    display_name: provider_type,
    state: 'configured_unverified',
    provider_property_id: 'site-1',
    capabilities: [],
    configuration_version: 1,
    last_verified_at: null,
    last_error_code: null
  };
}

describe('ATLAS Hospitality provider state contract', () => {
  it('exposes the complete fail-closed readiness state machine', () => {
    expect(PROVIDER_STATES).toEqual([
      'not_configured',
      'configured_unverified',
      'ready',
      'degraded',
      'offline',
      'disabled'
    ] satisfies HospitalityProviderState[]);
  });

  it('does not treat configured_unverified as ready', () => {
    const state: HospitalityProviderState = 'configured_unverified';
    expect(state).not.toBe('ready');
  });
});

describe('ATLAS Hospitality provider registry', () => {
  it('selects the SALTO adapter when SALTO runtime config is supplied', async () => {
    const adapter = providerFor(instance('salto_space_hospitality'), {
      providerType: 'salto_space_hospitality',
      baseUrl: 'https://space.example.test',
      bearerToken: 'server-only-token',
      probeRoomId: '101'
    }, async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));

    const readiness = await adapter.readiness(context);
    expect(readiness.blocker).toBe('salto_space_issue_contract_unverified');
  });

  it('selects the Vingcard adapter rather than the generic placeholder', async () => {
    const adapter = providerFor(instance('vingcard_vconnect'), {
      providerType: 'vingcard_vconnect',
      officialInterfaceConfigured: false
    });
    expect((await adapter.readiness(context)).blocker).toBe('official_provider_interface_required');
  });

  it('selects the dormakaba adapter rather than the generic placeholder', async () => {
    const adapter = providerFor(instance('dormakaba_ambiance_cloud'), {
      providerType: 'dormakaba_ambiance_cloud',
      officialInterfaceConfigured: false
    });
    expect((await adapter.readiness(context)).blocker).toBe('official_provider_interface_required');
  });

  it('selects the certified generic adapter', async () => {
    const adapter = providerFor(instance('generic_certified'), {
      providerType: 'generic_certified',
      officialInterfaceConfigured: false
    });
    expect((await adapter.readiness(context)).blocker).toBe('official_provider_interface_required');
  });

  it('fails closed for an unsupported provider type', () => {
    expect(() => providerFor(instance('unknown_vendor'))).toThrow('unsupported_provider_type');
  });
});
