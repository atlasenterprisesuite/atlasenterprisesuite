import type {
  CommerceCartState,
  CommerceCheckoutState,
  CommerceOrderState
} from './types';

const CART_TRANSITIONS: Record<CommerceCartState, readonly CommerceCartState[]> = {
  active: ['converted', 'abandoned', 'expired'],
  converted: [],
  abandoned: [],
  expired: []
};

const CHECKOUT_TRANSITIONS: Record<CommerceCheckoutState, readonly CommerceCheckoutState[]> = {
  draft: ['validating', 'expired'],
  validating: ['payment_pending', 'failed', 'expired'],
  payment_pending: ['payment_processing', 'failed', 'expired'],
  payment_processing: ['completed', 'failed'],
  completed: [],
  failed: [],
  expired: []
};

const ORDER_TRANSITIONS: Record<CommerceOrderState, readonly CommerceOrderState[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: []
};

function transition<State extends string>(
  current: State,
  next: State,
  allowed: Record<State, readonly State[]>,
  errorCode: string
): State {
  if (!allowed[current]?.includes(next)) throw new Error(errorCode);
  return next;
}

export function transitionCart(
  current: CommerceCartState,
  next: CommerceCartState
): CommerceCartState {
  return transition(current, next, CART_TRANSITIONS, 'invalid_cart_transition');
}

export function transitionCheckout(
  current: CommerceCheckoutState,
  next: CommerceCheckoutState
): CommerceCheckoutState {
  return transition(current, next, CHECKOUT_TRANSITIONS, 'invalid_checkout_transition');
}

export function transitionOrder(
  current: CommerceOrderState,
  next: CommerceOrderState
): CommerceOrderState {
  return transition(current, next, ORDER_TRANSITIONS, 'invalid_order_transition');
}
