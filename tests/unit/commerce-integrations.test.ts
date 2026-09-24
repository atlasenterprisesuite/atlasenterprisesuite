import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createDefaultCommerceIntegrationAdapters,
  transitionCommerceDelivery
} from '../../packages/commerce/src';

const dispatcherPath = 'supabase/functions/atlas-commerce-dispatch/index.ts';
const migrationPath = 'supabase/migrations/20260918120000_atlas_commerce_delivery_state.sql';
const dispatcher = existsSync(dispatcherPath) ? readFileSync(dispatcherPath, 'utf8') : '';
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('ATLAS Commerce downstream adapters', () => {
  it.each([
    ['inventory', 'INVENTORY_ADAPTER_UNAVAILABLE'],
    ['accounting', 'ACCOUNTING_ADAPTER_UNAVAILABLE'],
    ['crm', 'CRM_ADAPTER_UNAVAILABLE'],
    ['analytics', 'ANALYTICS_ADAPTER_UNAVAILABLE']
  ] as const)('fails closed for %s until a canonical writer exists', async (target, code) => {
    const adapters = createDefaultCommerceIntegrationAdapters();
    await expect(adapters[target].deliver({
      eventId: 'event-1',
      correlationId: 'corr-1',
      target,
      eventType: 'commerce.order.completed.v1',
      payload: { orderId: 'order-1' }
    })).rejects.toMatchObject({
      code,
      retryable: false
    });
  });

  it('allows only explicit delivery state transitions', () => {
    expect(transitionCommerceDelivery('pending', 'dispatched')).toBe('dispatched');
    expect(transitionCommerceDelivery('dispatched', 'failed')).toBe('failed');
    expect(() => transitionCommerceDelivery('fulfilled', 'pending'))
      .toThrow('invalid_delivery_transition');
  });
});

describe('ATLAS Commerce dispatcher persistence contract', () => {
  it('claims work with database locking and records durable exceptions', () => {
    expect(existsSync(dispatcherPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain('for update skip locked');
    expect(migration).toContain('commerce_claim_integration_deliveries');
    expect(dispatcher).toContain("rpc('commerce_claim_integration_deliveries'");
    expect(dispatcher).toContain("from('commerce_integration_exceptions')");
    expect(dispatcher).toContain("from('commerce_integration_deliveries')");
  });

  it('uses the canonical delivery states without changing completed orders', () => {
    for (const state of [
      'pending',
      'dispatched',
      'fulfilled',
      'retrying',
      'failed',
      'dead_lettered',
      'resolved'
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(dispatcher).not.toContain("from('commerce_orders')");
  });
});
