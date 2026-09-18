import { priceCart, type PriceCartInput, type PricedCart } from './pricing';

export type PrepareCheckoutInput = PriceCartInput & {
  clientTotalMinor?: bigint;
};

export type PreparedCheckout = PricedCart & {
  paymentRequired: boolean;
};

export function prepareCheckout(input: PrepareCheckoutInput): PreparedCheckout {
  const priced = priceCart(input);
  return {
    ...priced,
    paymentRequired: priced.totalMinor > 0n
  };
}
