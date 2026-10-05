import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalogPath = 'data/commercial/catalog-v1.json';
const contractPath = 'packages/core/src/commercial.ts';
const registryPath = 'apps/web/src/modules/registry.ts';
const atlasMaxContractsPath = 'apps/web/src/services/atlas-max/contracts.ts';

const read = (path: string) => readFileSync(path, 'utf8');

const allowedCapabilityStates = [
  'SELLABLE',
  'PREVIEW',
  'EXTERNAL_GATED',
  'INTERNAL_ONLY',
  'NOT_FOR_SALE'
] as const;

function registryIds() {
  return new Set(Array.from(read(registryPath).matchAll(/\bid:\s*'([^']+)'/g), (match) => match[1]));
}

describe('ATLAS Commercial Release catalog', () => {
  it('adds one versioned commercial catalog and typed contract', () => {
    expect(existsSync(catalogPath)).toBe(true);
    expect(existsSync(contractPath)).toBe(true);
  });

  it('defines the three Enterprise Suite offers without reusing ATLAS MAX plan ids', () => {
    if (!existsSync(catalogPath)) return;
    const catalog = JSON.parse(read(catalogPath)) as {
      catalog_version?: string;
      effective_date?: string;
      offers?: Array<{ id: string }>;
    };
    const offerIds = catalog.offers?.map((offer) => offer.id) ?? [];

    expect(catalog.catalog_version).toBeTruthy();
    expect(catalog.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(offerIds).toEqual(['atlas-business', 'atlas-enterprise', 'atlas-custom']);
    expect(offerIds).not.toContain('core');
    expect(offerIds).not.toContain('pro');
    expect(offerIds).not.toContain('max');

    const atlasMaxContracts = read(atlasMaxContractsPath);
    expect(atlasMaxContracts).toContain("export type AtlasPlanId = 'core' | 'pro' | 'max'");
  });

  it('keeps commercial capability states explicit and tied to canonical module ids', () => {
    if (!existsSync(catalogPath)) return;
    const catalog = JSON.parse(read(catalogPath)) as {
      offers: Array<{
        capabilities: Array<{ module_id: string; state: string; evidence_policy_id?: string }>;
      }>;
    };
    const modules = registryIds();

    for (const offer of catalog.offers) {
      expect(offer.capabilities.length).toBeGreaterThan(0);
      for (const capability of offer.capabilities) {
        expect(modules.has(capability.module_id), capability.module_id).toBe(true);
        expect(allowedCapabilityStates).toContain(capability.state as (typeof allowedCapabilityStates)[number]);
        expect(capability.evidence_policy_id).toBeTruthy();
      }
    }
  });

  it('supports truthful negotiated pricing without inventing a numeric list price', () => {
    if (!existsSync(catalogPath)) return;
    const catalog = JSON.parse(read(catalogPath)) as {
      offers: Array<{
        id: string;
        pricing: {
          pricing_mode: string;
          currency: string;
          billing_period: string;
          minimum_term_months: number;
          base_price: number | null;
          discount_policy_id: string;
          support_tier: string;
        };
      }>;
    };

    const enterprise = catalog.offers.find((offer) => offer.id === 'atlas-enterprise');
    expect(enterprise?.pricing).toMatchObject({
      pricing_mode: 'negotiated',
      currency: 'USD',
      billing_period: 'annual',
      base_price: null
    });
    expect(enterprise?.pricing.minimum_term_months).toBeGreaterThan(0);
    expect(enterprise?.pricing.discount_policy_id).toBeTruthy();
    expect(enterprise?.pricing.support_tier).toBeTruthy();
  });

  it('does not silently sell regulated or provider-gated families in the initial catalog', () => {
    if (!existsSync(catalogPath)) return;
    const catalog = JSON.parse(read(catalogPath)) as {
      offers: Array<{ capabilities: Array<{ module_id: string; state: string }> }>;
    };
    const restrictedModuleIds = new Set(['pay', 'telecom', 'connect', 'insurance', 'health', 'tax']);

    for (const offer of catalog.offers) {
      for (const capability of offer.capabilities) {
        if (restrictedModuleIds.has(capability.module_id)) {
          expect(capability.state, `${offer.capabilities}:${capability.module_id}`).not.toBe('SELLABLE');
        }
      }
    }
  });

  it('defines fail-closed typed readers rather than UI-owned commercial truth', () => {
    if (!existsSync(contractPath)) return;
    const contract = read(contractPath);

    expect(contract).toContain("export type CommercialCapabilityState =");
    expect(contract).toContain("export type CommercialOfferId =");
    expect(contract).toContain('export function getCommercialCatalog');
    expect(contract).toContain('export function getCommercialOffer');
    expect(contract).toContain('Unknown commercial offer');
  });
});
