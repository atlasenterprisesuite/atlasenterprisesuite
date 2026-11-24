/** Pure USD planning calculations. No provider, persistence or authorization effects. */
export type CampaignEconomicsInput = {
  spendCents: number;
  clicks: number;
  leads: number;
  customers: number;
  attributedRevenueCents: number;
};

export function parseUsdCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('invalid_usd_amount');
  const [whole, fraction = ''] = value.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('invalid_usd_amount');
  return Number(cents);
}

export function calculateCampaignEconomics(input: CampaignEconomicsInput) {
  for (const key of ['spendCents', 'clicks', 'leads', 'customers', 'attributedRevenueCents'] as const) {
    if (!Number.isSafeInteger(input[key]) || input[key] < 0) throw new Error('invalid_campaign_input');
  }
  const per = (count: number) => count === 0 ? null : input.spendCents / count;
  return {
    mode: 'simulation' as const,
    cpcCents: per(input.clicks),
    costPerLeadCents: per(input.leads),
    adCostPerCustomerCents: per(input.customers),
    roas: input.spendCents === 0 ? null : input.attributedRevenueCents / input.spendCents
  };
}
