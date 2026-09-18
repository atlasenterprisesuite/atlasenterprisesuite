export type CommerceIntegrationTarget =
  | 'inventory'
  | 'accounting'
  | 'crm'
  | 'analytics';

export type CommerceDeliveryState =
  | 'pending'
  | 'dispatched'
  | 'fulfilled'
  | 'retrying'
  | 'failed'
  | 'dead_lettered'
  | 'resolved';

export type CommerceIntegrationDeliveryRequest = {
  eventId: string;
  correlationId: string;
  target: CommerceIntegrationTarget;
  eventType: string;
  payload: Record<string, unknown>;
};

export type CommerceIntegrationDeliveryResult = {
  adapterReference: string | null;
};

export interface CommerceIntegrationAdapter {
  readonly target: CommerceIntegrationTarget;
  deliver(
    request: CommerceIntegrationDeliveryRequest
  ): Promise<CommerceIntegrationDeliveryResult>;
}

const UNAVAILABLE_CODES: Record<CommerceIntegrationTarget, string> = {
  inventory: 'INVENTORY_ADAPTER_UNAVAILABLE',
  accounting: 'ACCOUNTING_ADAPTER_UNAVAILABLE',
  crm: 'CRM_ADAPTER_UNAVAILABLE',
  analytics: 'ANALYTICS_ADAPTER_UNAVAILABLE'
};

export class CommerceIntegrationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super(code);
    this.name = 'CommerceIntegrationError';
    this.code = code;
    this.retryable = retryable;
  }
}

class UnavailableCommerceIntegrationAdapter
  implements CommerceIntegrationAdapter {
  constructor(readonly target: CommerceIntegrationTarget) {}

  async deliver(
    _request: CommerceIntegrationDeliveryRequest
  ): Promise<CommerceIntegrationDeliveryResult> {
    throw new CommerceIntegrationError(
      UNAVAILABLE_CODES[this.target],
      false
    );
  }
}

export function createDefaultCommerceIntegrationAdapters(): Record<
  CommerceIntegrationTarget,
  CommerceIntegrationAdapter
> {
  return {
    inventory: new UnavailableCommerceIntegrationAdapter('inventory'),
    accounting: new UnavailableCommerceIntegrationAdapter('accounting'),
    crm: new UnavailableCommerceIntegrationAdapter('crm'),
    analytics: new UnavailableCommerceIntegrationAdapter('analytics')
  };
}

const DELIVERY_TRANSITIONS: Record<
  CommerceDeliveryState,
  readonly CommerceDeliveryState[]
> = {
  pending: ['dispatched', 'failed'],
  dispatched: ['fulfilled', 'retrying', 'failed'],
  fulfilled: [],
  retrying: ['dispatched', 'failed', 'dead_lettered'],
  failed: ['retrying', 'dead_lettered', 'resolved'],
  dead_lettered: ['resolved'],
  resolved: []
};

export function transitionCommerceDelivery(
  current: CommerceDeliveryState,
  next: CommerceDeliveryState
): CommerceDeliveryState {
  if (!DELIVERY_TRANSITIONS[current].includes(next)) {
    throw new Error('invalid_delivery_transition');
  }
  return next;
}
