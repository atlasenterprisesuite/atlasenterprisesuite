import type { NetworkLaunchPrice, NetworkPriceBookEntry } from './types';

export const ATLAS_NETWORK_LAUNCH_PRICES = [
  { sku: 'atlas-free', productName: 'ATLAS Free', billing: 'monthly', unit: 'user', amountMinor: 0, currency: 'USD', floorPrice: false },
  { sku: 'atlas-core-monthly', productName: 'ATLAS Core', billing: 'monthly', unit: 'user', amountMinor: 2900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-core-annual', productName: 'ATLAS Core', billing: 'annual', unit: 'user', amountMinor: 29000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-pro-monthly', productName: 'ATLAS Pro', billing: 'monthly', unit: 'user', amountMinor: 5900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-pro-annual', productName: 'ATLAS Pro', billing: 'annual', unit: 'user', amountMinor: 59000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-business-monthly', productName: 'ATLAS Business', billing: 'monthly', unit: 'organization', amountMinor: 14900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-business-annual', productName: 'ATLAS Business', billing: 'annual', unit: 'organization', amountMinor: 149000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-enterprise-monthly', productName: 'ATLAS Enterprise', billing: 'monthly', unit: 'organization', amountMinor: 99900, currency: 'USD', floorPrice: true },
  { sku: 'atlas-enterprise-annual', productName: 'ATLAS Enterprise', billing: 'annual', unit: 'organization', amountMinor: 999000, currency: 'USD', floorPrice: true },
  { sku: 'atlas-business-seat', productName: 'Business additional seat', billing: 'monthly', unit: 'seat', amountMinor: 3900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-business-seat-annual', productName: 'Business additional seat', billing: 'annual', unit: 'seat', amountMinor: 39000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-enterprise-seat', productName: 'Enterprise additional seat', billing: 'monthly', unit: 'seat', amountMinor: 2900, currency: 'USD', floorPrice: false },
  { sku: 'atlas-enterprise-seat-annual', productName: 'Enterprise additional seat', billing: 'annual', unit: 'seat', amountMinor: 29000, currency: 'USD', floorPrice: false },
  { sku: 'atlas-network-partner', productName: 'ATLAS Network Partner', billing: 'enrollment', unit: 'partner', amountMinor: 0, currency: 'USD', floorPrice: false }
] as const satisfies readonly NetworkLaunchPrice[];

export function validatePriceBookEntry(entry: NetworkPriceBookEntry): void {
  if (!/^[A-Z]{3}$/.test(entry.currency)) throw new Error('currency must be an uppercase ISO-style three-letter code');
  if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor < 0) throw new Error('amountMinor must be a non-negative safe integer');
  if (!Number.isSafeInteger(entry.baseUsdAmountMinor) || entry.baseUsdAmountMinor < 0) throw new Error('baseUsdAmountMinor must be a non-negative safe integer');
  if (entry.productCommissionCapBps != null && (!Number.isInteger(entry.productCommissionCapBps) || entry.productCommissionCapBps < 0 || entry.productCommissionCapBps > 2000)) throw new Error('product commission cap must be between 0 and 2000 bps');
  if (!entry.productKey.trim() || !entry.taxCode.trim()) throw new Error('productKey and taxCode are required');
}
