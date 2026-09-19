import { describe, expect, it, vi } from 'vitest';
import {
  AuthorizeNetPaymentAdapter,
  parseAuthorizeNetPaymentReference
} from '../../packages/commerce/src';

const paymentReference = JSON.stringify({
  dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
  dataValue: 'opaque-test-token-12345'
});

describe('Authorize.net payment adapter', () => {
  it('accepts only Authorize.net opaque payment data and never raw bank fields', () => {
    expect(parseAuthorizeNetPaymentReference(paymentReference)).toEqual({
      dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
      dataValue: 'opaque-test-token-12345'
    });
    expect(() => parseAuthorizeNetPaymentReference(JSON.stringify({
      routingNumber: '011000015',
      accountNumber: '123456789'
    }))).toThrowError('PAYMENT_METHOD_REFERENCE_INVALID');
  });

  it('submits an authCaptureTransaction with provider credentials server-side', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.createTransactionRequest.merchantAuthentication).toEqual({
        name: 'login',
        transactionKey: 'secret'
      });
      expect(body.createTransactionRequest.transactionRequest.amount).toBe('12.34');
      expect(body.createTransactionRequest.transactionRequest.payment.opaqueData.dataValue)
        .toBe('opaque-test-token-12345');
      expect(body.createTransactionRequest.transactionRequest.transactionSettings.setting[0])
        .toEqual({ settingName: 'duplicateWindow', settingValue: '600' });
      return new Response(JSON.stringify({
        messages: { resultCode: 'Ok' },
        transactionResponse: { responseCode: '1', transId: '900000001' }
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const adapter = new AuthorizeNetPaymentAdapter({
      apiLoginId: 'login',
      transactionKey: 'secret',
      environment: 'sandbox',
      fetchImpl,
      now: () => '2026-09-18T20:20:00Z'
    });

    await expect(adapter.authorize({
      amountMinor: 1234n,
      currency: 'USD',
      paymentMethodReference: paymentReference,
      idempotencyKey: 'checkout-123'
    })).resolves.toEqual({
      state: 'captured',
      provider: 'authorize.net',
      providerReference: '900000001',
      amountMinor: 1234n,
      currency: 'USD',
      recordedAt: '2026-09-18T20:20:00Z'
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fails closed on network ambiguity', async () => {
    const adapter = new AuthorizeNetPaymentAdapter({
      apiLoginId: 'login',
      transactionKey: 'secret',
      environment: 'sandbox',
      fetchImpl: vi.fn(async () => { throw new Error('timeout'); }) as unknown as typeof fetch
    });

    await expect(adapter.authorize({
      amountMinor: 1000n,
      currency: 'USD',
      paymentMethodReference: paymentReference
    })).rejects.toMatchObject({ code: 'PAYMENT_RESULT_AMBIGUOUS' });
  });

  it('does not treat held or indeterminate results as paid', async () => {
    const adapter = new AuthorizeNetPaymentAdapter({
      apiLoginId: 'login',
      transactionKey: 'secret',
      environment: 'sandbox',
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        messages: { resultCode: 'Ok' },
        transactionResponse: { responseCode: '4', transId: '900000002' }
      }), { status: 200 })) as unknown as typeof fetch
    });

    await expect(adapter.authorize({
      amountMinor: 1000n,
      currency: 'USD',
      paymentMethodReference: paymentReference
    })).resolves.toMatchObject({ state: 'unknown', providerReference: '900000002' });
  });
});
