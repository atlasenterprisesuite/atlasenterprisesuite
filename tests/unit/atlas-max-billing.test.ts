import { describe, expect, it } from 'vitest';
import { processBillingEvent } from '../../apps/web/src/services/atlas-max/billing';
describe('ATLAS MAX billing', () => {
  it('rejects redirect-only activation', () => expect(processBillingEvent({ id:'1', type:'activated', verified:false })).toMatchObject({ applied:false }));
  it('accepts verified activation', () => expect(processBillingEvent({ id:'2', type:'activated', verified:true })).toMatchObject({ applied:true }));
  it('is idempotent for duplicate events', () => { const e={ id:'dup', type:'activated' as const, verified:true }; processBillingEvent(e); expect(processBillingEvent(e).duplicate).toBe(true); });
});