import rawCommercialCatalog from '../../../data/commercial/catalog-v1.json';

export type CommercialCapabilityState =
  | 'SELLABLE'
  | 'PREVIEW'
  | 'EXTERNAL_GATED'
  | 'INTERNAL_ONLY'
  | 'NOT_FOR_SALE';

export type CommercialOfferId =
  | 'atlas-business'
  | 'atlas-enterprise'
  | 'atlas-custom';

export type CommercialPricingMode = 'negotiated' | 'fixed';
export type CommercialBillingPeriod = 'monthly' | 'annual' | 'custom';

export type CommercialPricing = {
  pricing_mode: CommercialPricingMode;
  currency: string;
  billing_period: CommercialBillingPeriod;
  minimum_term_months: number;
  base_price: number | null;
  implementation_fee_mode: 'negotiated' | 'fixed' | 'included';
  overage_policy: string;
  discount_policy_id: string;
  support_tier: string;
};

export type CommercialCapability = {
  module_id: string;
  state: CommercialCapabilityState;
  evidence_policy_id: string;
};

export type CommercialOffer = {
  id: CommercialOfferId;
  name: string;
  description: string;
  pricing: CommercialPricing;
  capabilities: CommercialCapability[];
};

export type CommercialCatalog = {
  catalog_version: string;
  effective_date: string;
  currency_policy: string;
  evidence_freshness_hours: number;
  offers: CommercialOffer[];
};

const CAPABILITY_STATES = new Set<CommercialCapabilityState>([
  'SELLABLE',
  'PREVIEW',
  'EXTERNAL_GATED',
  'INTERNAL_ONLY',
  'NOT_FOR_SALE'
]);
const OFFER_IDS = new Set<CommercialOfferId>([
  'atlas-business',
  'atlas-enterprise',
  'atlas-custom'
]);
const PRICING_MODES = new Set<CommercialPricingMode>(['negotiated', 'fixed']);
const BILLING_PERIODS = new Set<CommercialBillingPeriod>(['monthly', 'annual', 'custom']);
const IMPLEMENTATION_FEE_MODES = new Set<CommercialPricing['implementation_fee_mode']>([
  'negotiated',
  'fixed',
  'included'
]);

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid commercial ${label}`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid commercial ${label}`);
  }
  return value.trim();
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`Invalid commercial ${label}`);
  }
  return Number(value);
}

function parsePricing(value: unknown): CommercialPricing {
  const input = requireRecord(value, 'pricing');
  const pricingMode = requireString(input.pricing_mode, 'pricing mode') as CommercialPricingMode;
  const billingPeriod = requireString(input.billing_period, 'billing period') as CommercialBillingPeriod;
  const implementationFeeMode = requireString(
    input.implementation_fee_mode,
    'implementation fee mode'
  ) as CommercialPricing['implementation_fee_mode'];

  if (!PRICING_MODES.has(pricingMode)) throw new Error('Invalid commercial pricing mode');
  if (!BILLING_PERIODS.has(billingPeriod)) throw new Error('Invalid commercial billing period');
  if (!IMPLEMENTATION_FEE_MODES.has(implementationFeeMode)) {
    throw new Error('Invalid commercial implementation fee mode');
  }
  if (input.base_price !== null && (typeof input.base_price !== 'number' || input.base_price < 0)) {
    throw new Error('Invalid commercial base price');
  }

  return {
    pricing_mode: pricingMode,
    currency: requireString(input.currency, 'currency'),
    billing_period: billingPeriod,
    minimum_term_months: requirePositiveInteger(input.minimum_term_months, 'minimum term'),
    base_price: input.base_price as number | null,
    implementation_fee_mode: implementationFeeMode,
    overage_policy: requireString(input.overage_policy, 'overage policy'),
    discount_policy_id: requireString(input.discount_policy_id, 'discount policy'),
    support_tier: requireString(input.support_tier, 'support tier')
  };
}

function parseCapability(value: unknown): CommercialCapability {
  const input = requireRecord(value, 'capability');
  const state = requireString(input.state, 'capability state') as CommercialCapabilityState;
  if (!CAPABILITY_STATES.has(state)) throw new Error('Invalid commercial capability state');

  return {
    module_id: requireString(input.module_id, 'module id'),
    state,
    evidence_policy_id: requireString(input.evidence_policy_id, 'evidence policy id')
  };
}

function parseOffer(value: unknown): CommercialOffer {
  const input = requireRecord(value, 'offer');
  const id = requireString(input.id, 'offer id') as CommercialOfferId;
  if (!OFFER_IDS.has(id)) throw new Error(`Unknown commercial offer: ${id}`);
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error(`Invalid commercial capabilities for ${id}`);
  }

  return {
    id,
    name: requireString(input.name, 'offer name'),
    description: requireString(input.description, 'offer description'),
    pricing: parsePricing(input.pricing),
    capabilities: input.capabilities.map(parseCapability)
  };
}

function parseCatalog(value: unknown): CommercialCatalog {
  const input = requireRecord(value, 'catalog');
  if (!Array.isArray(input.offers) || input.offers.length === 0) {
    throw new Error('Invalid commercial offers');
  }

  const catalog: CommercialCatalog = {
    catalog_version: requireString(input.catalog_version, 'catalog version'),
    effective_date: requireString(input.effective_date, 'effective date'),
    currency_policy: requireString(input.currency_policy, 'currency policy'),
    evidence_freshness_hours: requirePositiveInteger(
      input.evidence_freshness_hours,
      'evidence freshness hours'
    ),
    offers: input.offers.map(parseOffer)
  };

  const ids = new Set(catalog.offers.map((offer) => offer.id));
  for (const requiredId of OFFER_IDS) {
    if (!ids.has(requiredId)) throw new Error(`Missing commercial offer: ${requiredId}`);
  }
  if (ids.size !== catalog.offers.length) throw new Error('Duplicate commercial offer');

  return catalog;
}

const COMMERCIAL_CATALOG = parseCatalog(rawCommercialCatalog);

export function getCommercialCatalog(): CommercialCatalog {
  return COMMERCIAL_CATALOG;
}

export function getCommercialOffer(id: CommercialOfferId): CommercialOffer {
  const offer = COMMERCIAL_CATALOG.offers.find((candidate) => candidate.id === id);
  if (!offer) throw new Error(`Unknown commercial offer: ${id}`);
  return offer;
}
