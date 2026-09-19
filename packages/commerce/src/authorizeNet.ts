import {
  CommercePaymentError,
  type NormalizedPaymentResult,
  type PaymentAdapter,
  type PaymentAuthorizationInput
} from './payment';

export type AuthorizeNetEnvironment = 'sandbox' | 'production';

export type AuthorizeNetConfig = {
  apiLoginId: string;
  transactionKey: string;
  environment: AuthorizeNetEnvironment;
  currency?: string;
  duplicateWindowSeconds?: number;
  fetchImpl?: typeof fetch;
  now?: () => string;
};

type AuthorizeNetOpaqueData = {
  dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT';
  dataValue: string;
};

const ENDPOINTS: Record<AuthorizeNetEnvironment, string> = {
  sandbox: 'https://apitest.authorize.net/xml/v1/request.api',
  production: 'https://api.authorize.net/xml/v1/request.api'
};

function clean(value: unknown, max = 4096) {
  return String(value ?? '').trim().slice(0, max);
}

export function parseAuthorizeNetPaymentReference(reference: string): AuthorizeNetOpaqueData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reference);
  } catch {
    throw new CommercePaymentError('PAYMENT_METHOD_REFERENCE_INVALID');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CommercePaymentError('PAYMENT_METHOD_REFERENCE_INVALID');
  }

  const candidate = parsed as Record<string, unknown>;
  const dataDescriptor = clean(candidate.dataDescriptor, 80);
  const dataValue = clean(candidate.dataValue, 4096);

  if (
    dataDescriptor !== 'COMMON.ACCEPT.INAPP.PAYMENT' ||
    dataValue.length < 8
  ) {
    throw new CommercePaymentError('PAYMENT_METHOD_REFERENCE_INVALID');
  }

  return {
    dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT',
    dataValue
  };
}

function formatMinorUnits(amountMinor: bigint) {
  if (amountMinor <= 0n) {
    throw new CommercePaymentError('PAYMENT_AMOUNT_INVALID');
  }
  const whole = amountMinor / 100n;
  const fraction = (amountMinor % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

async function referenceId(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value.trim())
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 10)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function resultFromResponse(
  body: Record<string, any>,
  input: PaymentAuthorizationInput,
  recordedAt: string
): NormalizedPaymentResult {
  const transaction = body?.transactionResponse;
  const responseCode = clean(transaction?.responseCode, 10);
  const providerReference = clean(transaction?.transId, 80) || null;

  if (responseCode === '1' && providerReference) {
    return {
      state: 'captured',
      provider: 'authorize.net',
      providerReference,
      amountMinor: input.amountMinor,
      currency: input.currency.toUpperCase(),
      recordedAt
    };
  }

  if (responseCode === '2') {
    return {
      state: 'declined',
      provider: 'authorize.net',
      providerReference,
      amountMinor: input.amountMinor,
      currency: input.currency.toUpperCase(),
      recordedAt
    };
  }

  if (responseCode === '3') {
    return {
      state: 'failed',
      provider: 'authorize.net',
      providerReference,
      amountMinor: input.amountMinor,
      currency: input.currency.toUpperCase(),
      recordedAt
    };
  }

  return {
    state: 'unknown',
    provider: 'authorize.net',
    providerReference,
    amountMinor: input.amountMinor,
    currency: input.currency.toUpperCase(),
    recordedAt
  };
}

export class AuthorizeNetPaymentAdapter implements PaymentAdapter {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => string;
  private readonly currency: string;
  private readonly duplicateWindowSeconds: number;

  constructor(private readonly config: AuthorizeNetConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => new Date().toISOString());
    this.currency = (config.currency || 'USD').toUpperCase();
    this.duplicateWindowSeconds = Math.min(
      Math.max(config.duplicateWindowSeconds ?? 600, 0),
      28800
    );
  }

  async authorize(input: PaymentAuthorizationInput): Promise<NormalizedPaymentResult> {
    if (!this.config.apiLoginId.trim() || !this.config.transactionKey.trim()) {
      throw new CommercePaymentError('PAYMENT_PROVIDER_UNAVAILABLE');
    }

    if (input.currency.toUpperCase() !== this.currency) {
      throw new CommercePaymentError('PAYMENT_CURRENCY_UNSUPPORTED');
    }

    const opaqueData = parseAuthorizeNetPaymentReference(input.paymentMethodReference);
    const refId = await referenceId(input.idempotencyKey);

    const request = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: this.config.apiLoginId,
          transactionKey: this.config.transactionKey
        },
        ...(refId ? { refId } : {}),
        transactionRequest: {
          transactionType: 'authCaptureTransaction',
          amount: formatMinorUnits(input.amountMinor),
          currencyCode: input.currency.toUpperCase(),
          payment: { opaqueData },
          transactionSettings: {
            setting: [{
              settingName: 'duplicateWindow',
              settingValue: String(this.duplicateWindowSeconds)
            }]
          }
        }
      }
    };

    let response: Response;
    try {
      response = await this.fetchImpl(ENDPOINTS[this.config.environment], {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify(request)
      });
    } catch {
      throw new CommercePaymentError('PAYMENT_RESULT_AMBIGUOUS');
    }

    if (!response.ok) {
      throw new CommercePaymentError(
        response.status >= 500
          ? 'PAYMENT_RESULT_AMBIGUOUS'
          : 'PAYMENT_FAILED'
      );
    }

    let body: Record<string, any>;
    try {
      body = await response.json() as Record<string, any>;
    } catch {
      throw new CommercePaymentError('PAYMENT_RESULT_AMBIGUOUS');
    }

    return resultFromResponse(body, input, this.now());
  }
}
