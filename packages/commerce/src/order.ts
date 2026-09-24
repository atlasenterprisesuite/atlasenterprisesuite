export type CheckoutFingerprintLine = {
  variantId: string;
  sku: string;
  quantity: number;
  unitPriceMinor: bigint;
};

export type CheckoutFingerprintAdjustment = {
  code: string;
  source: string;
  amountMinor: bigint;
};

export type CheckoutFingerprintInput = {
  storefrontId: string;
  customerRef?: string | null;
  channel: string;
  currency: string;
  lines: readonly CheckoutFingerprintLine[];
  adjustments: readonly CheckoutFingerprintAdjustment[];
  shippingMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
};

function clean(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function canonicalCheckoutFingerprint(
  input: CheckoutFingerprintInput
): string {
  const lines = [...input.lines]
    .map((line) => ({
      variantId: clean(line.variantId),
      sku: clean(line.sku),
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor.toString()
    }))
    .sort((a, b) =>
      a.sku.localeCompare(b.sku) ||
      a.variantId.localeCompare(b.variantId) ||
      a.quantity - b.quantity ||
      a.unitPriceMinor.localeCompare(b.unitPriceMinor)
    );

  const adjustments = [...input.adjustments]
    .map((adjustment) => ({
      code: clean(adjustment.code),
      source: clean(adjustment.source),
      amountMinor: adjustment.amountMinor.toString()
    }))
    .sort((a, b) =>
      a.code.localeCompare(b.code) ||
      a.source.localeCompare(b.source) ||
      a.amountMinor.localeCompare(b.amountMinor)
    );

  return JSON.stringify({
    storefrontId: clean(input.storefrontId),
    customerRef: clean(input.customerRef),
    channel: clean(input.channel),
    currency: clean(input.currency).toUpperCase(),
    lines,
    adjustments,
    shippingMinor: input.shippingMinor.toString(),
    taxMinor: input.taxMinor.toString(),
    totalMinor: input.totalMinor.toString()
  });
}
