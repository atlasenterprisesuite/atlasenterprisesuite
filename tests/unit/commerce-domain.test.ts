import { describe, expect, it } from 'vitest';
import { hasPermission } from '../../packages/core/src';
import { transitionCart, transitionCheckout, transitionOrder } from '../../packages/commerce/src';

describe('ATLAS Commerce domain foundation', () => {
  it('keeps Commerce admin inside the Commerce namespace', () => {
    expect(hasPermission(['commerce.admin'], 'commerce.orders.manage')).toBe(true);
    expect(hasPermission(['commerce.admin'], 'accounting.post')).toBe(false);
  });

  it('allows only declared cart transitions', () => {
    expect(transitionCart('active', 'converted')).toBe('converted');
    expect(() => transitionCart('expired', 'active')).toThrow('invalid_cart_transition');
  });

  it('allows only declared checkout transitions', () => {
    expect(transitionCheckout('draft', 'validating')).toBe('validating');
    expect(() => transitionCheckout('completed', 'payment_processing')).toThrow('invalid_checkout_transition');
  });

  it('allows only declared order transitions', () => {
    expect(transitionOrder('pending', 'confirmed')).toBe('confirmed');
    expect(() => transitionOrder('fulfilled', 'pending')).toThrow('invalid_order_transition');
  });
});
