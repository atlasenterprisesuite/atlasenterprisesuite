import { describe, expect, it } from 'vitest';
import { getProviderManifest, listProviderManifests } from '../../supabase/functions/_shared/connected-apps/provider-registry';

const HUBSPOT_P0 = [
  'oauth',
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.objects.tickets.read'
];

describe('Connected Apps provider registry', () => {
  it('owns one unique manifest per provider with unique capabilities', () => {
    const manifests = listProviderManifests();
    expect(manifests.length).toBeGreaterThan(1);
    expect(new Set(manifests.map((item) => item.providerId)).size).toBe(manifests.length);
    for (const manifest of manifests) {
      const codes = manifest.capabilities.map((item) => item.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('reconciles HubSpot as runtime-ready using the existing P0 scope boundary', () => {
    const hubspot = getProviderManifest('hubspot');
    expect(hubspot).not.toBeNull();
    expect(hubspot?.runtimeStatus).toBe('ready');
    const scopes = new Set(hubspot?.capabilities.flatMap((item) => item.providerScopes));
    for (const scope of HUBSPOT_P0) expect(scopes.has(scope)).toBe(true);
  });

  it('keeps providers without a reconciled runtime adapter truthful', () => {
    const google = getProviderManifest('google');
    expect(google).not.toBeNull();
    expect(['catalog_only', 'ready']).toContain(google?.runtimeStatus);
    if (google?.runtimeStatus === 'catalog_only') expect(google.supportsReadinessProbe).toBe(false);
  });

  it('returns null for unknown providers', () => {
    expect(getProviderManifest('does-not-exist')).toBeNull();
  });
});
