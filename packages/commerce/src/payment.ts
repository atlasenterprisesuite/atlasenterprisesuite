export type PaymentAuthorizationInput = {
  amountMinor: bigint;
  currency: string;
  paymentMethodReference: string;
};

export type NormalizedPaymentResult = {
  state: 'authorized' | 'captured' | 'declined' | 'failed' | 'unknown';
  provider: string;
  providerReference: string | null;
  amountMinor: bigint;
  currency: string;
  recordedAt: string;
};

export type PaymentEvaluation =
  | { accepted: true; state: 'authorized' | 'captured'; code: null }
  | {
      accepted: false;
      state: 'declined' | 'failed' | 'reconciliation_required';
      code: 'PAYMENT_DECLINED' | 'PAYMENT_FAILED' | 'PAYMENT_RESULT_AMBIGUOUS';
    };

export class CommercePaymentError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'CommercePaymentError';
    this.code = code;
  }
}

export interface PaymentAdapter {
  authorize(input: PaymentAuthorizationInput): Promise<NormalizedPaymentResult>;
}

export class UnavailablePaymentAdapter implements PaymentAdapter {
  async authorize(_input: PaymentAuthorizationInput): Promise<NormalizedPaymentResult> {
    throw new CommercePaymentError('PAYMENT_PROVIDER_UNAVAILABLE');
  }
}

export function evaluatePaymentResult(
  result: NormalizedPaymentResult
): PaymentEvaluation {
  if (
    (result.state === 'authorized' || result.state === 'captured') &&
    result.providerReference?.trim()
  ) {
    return { accepted: true, state: result.state, code: null };
  }

  if (result.state === 'declined') {
    return { accepted: false, state: 'declined', code: 'PAYMENT_DECLINED' };
  }

  if (result.state === 'failed') {
    return { accepted: false, state: 'failed', code: 'PAYMENT_FAILED' };
  }

  return {
    accepted: false,
    state: 'reconciliation_required',
    code: 'PAYMENT_RESULT_AMBIGUOUS'
  };
}
