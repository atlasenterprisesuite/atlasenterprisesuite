export type PricingLine = {
  variantId: string;
  quantity: number;
  unitPriceMinor: bigint;
};

export type PricingAdjustment = {
  code: string;
  amountMinor: bigint;
  source: string;
};

export type PriceCartInput = {
  currency: string;
  sourceCurrency?: string;
  lines: readonly PricingLine[];
  adjustments: readonly PricingAdjustment[];
  shippingMinor: bigint;
  taxMinor: bigint;
};

export type PricedCart = {
  currency: string;
  subtotalMinor: bigint;
  adjustmentMinor: bigint;
  shippingMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
};

function assertMinorAmount(value: bigint, code: string) {
  if (typeof value !== 'bigint') throw new Error(code);
}

export function priceCart(input: PriceCartInput): PricedCart {
  const currency = input.currency.trim().toUpperCase();
  if (!currency) throw new Error('currency_required');

  if (
    input.sourceCurrency &&
    input.sourceCurrency.trim().toUpperCase() !== currency
  ) {
    throw new Error('currency_mismatch');
  }

  let subtotalMinor = 0n;
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('invalid_quantity');
    }
    assertMinorAmount(line.unitPriceMinor, 'invalid_unit_price');
    if (line.unitPriceMinor < 0n) throw new Error('invalid_unit_price');
    subtotalMinor += line.unitPriceMinor * BigInt(line.quantity);
  }

  let adjustmentMinor = 0n;
  for (const adjustment of input.adjustments) {
    if (!adjustment.code.trim() || !adjustment.source.trim()) {
      throw new Error('invalid_adjustment');
    }
    assertMinorAmount(adjustment.amountMinor, 'invalid_adjustment');
    adjustmentMinor += adjustment.amountMinor;
  }

  assertMinorAmount(input.shippingMinor, 'invalid_shipping');
  assertMinorAmount(input.taxMinor, 'invalid_tax');
  if (input.shippingMinor < 0n) throw new Error('invalid_shipping');
  if (input.taxMinor < 0n) throw new Error('invalid_tax');

  const totalMinor =
    subtotalMinor + adjustmentMinor + input.shippingMinor + input.taxMinor;
  if (totalMinor < 0n) throw new Error('negative_total');

  return {
    currency,
    subtotalMinor,
    adjustmentMinor,
    shippingMinor: input.shippingMinor,
    taxMinor: input.taxMinor,
    totalMinor
  };
}
