import type { TenantScope } from '../../core/src';

export type CurrencyCode = string;

export type Money = {
  amountMinor: bigint;
  currency: CurrencyCode;
};

export type CommercePublicationState = 'draft' | 'published' | 'archived';
export type CommerceCartState = 'active' | 'converted' | 'abandoned' | 'expired';
export type CommerceCheckoutState =
  | 'draft'
  | 'validating'
  | 'payment_pending'
  | 'payment_processing'
  | 'completed'
  | 'failed'
  | 'expired';
export type CommerceOrderState =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'fulfilled'
  | 'cancelled';

export type CommerceScopedRecord = {
  scope: TenantScope;
  id: string;
};

export type CommerceProduct = CommerceScopedRecord & {
  title: string;
  slug: string;
  state: CommercePublicationState;
};

export type CommerceVariant = CommerceScopedRecord & {
  productId: string;
  sku: string;
  price: Money;
  state: CommercePublicationState;
};

export type CommerceCartLine = {
  variantId: string;
  quantity: number;
};

export type CommerceCart = CommerceScopedRecord & {
  storefrontId: string;
  currency: CurrencyCode;
  state: CommerceCartState;
  lines: readonly CommerceCartLine[];
};

export type CommerceCheckout = CommerceScopedRecord & {
  cartId: string;
  state: CommerceCheckoutState;
  total: Money;
};

export type CommerceOrder = CommerceScopedRecord & {
  checkoutId: string;
  state: CommerceOrderState;
  total: Money;
};
