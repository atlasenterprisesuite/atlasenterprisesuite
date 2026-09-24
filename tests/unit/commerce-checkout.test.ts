import { describe, expect, it } from 'vitest';
import {
  UnavailablePaymentAdapter,
  evaluatePaymentResult,
  prepareCheckout
} from '../../packages/commerce/src';

describe('ATLAS Commerce checkout provider truth', () => {
  it('fails closed when payment is required and no live adapter exists', async () => {
    const adapter = new UnavailablePaymentAdapter();

    await expect(adapter.authorize({
      amountMinor: 1000n,
      currency: 'USD',
      paymentMethodReference: 'pm-ref'
    })).rejects.toMatchObject({
      code: 'PAYMENT_PROVIDER_UNAVAILABLE'
    });
  });

  it('recomputes server totals instead of accepting a browser total', () => {
    const checkout = prepareCheckout({
      currency: 'USD',
      clientTotalMinor: 1n,
      lines: [{ variantId: 'v1', quantity: 1, unitPriceMinor: 1000n }],
      adjustments: [],
      shippingMinor: 0n,
      taxMinor: 65n
    });

    expect(checkout.totalMinor).toBe(1065n);
    expect(checkout.totalMinor).not.toBe(1n);
  });

  it('marks ambiguous provider results for reconciliation instead of success', () => {
    expect(evaluatePaymentResult({
      state: 'unknown',
      provider: 'example',
      providerReference: null,
      amountMinor: 1065n,
      currency: 'USD',
      recordedAt: '2026-09-18T11:30:00Z'
    })).toEqual({
      accepted: false,
      state: 'reconciliation_required',
      code: 'PAYMENT_RESULT_AMBIGUOUS'
    });
  });

  it('accepts only an explicit provider authorization for a positive total', () => {
    expect(evaluatePaymentResult({
      state: 'authorized',
      provider: 'example',
      providerReference: 'auth-123',
      amountMinor: 1065n,
      currency: 'USD',
      recordedAt: '2026-09-18T11:30:00Z'
    })).toEqual({
      accepted: true,
      state: 'authorized',
      code: null
    });
  });
});
