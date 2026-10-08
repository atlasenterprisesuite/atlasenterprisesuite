export type BillingEventType = 'activated' | 'suspended' | 'canceled';
export interface BillingLifecycleEvent { id: string; type: BillingEventType; verified: boolean; }
export interface BillingEventResult { applied: boolean; duplicate: boolean; reason?: string; }
const processed = new Set<string>();
export function processBillingEvent(event: BillingLifecycleEvent): BillingEventResult {
  if (processed.has(event.id)) return { applied: false, duplicate: true, reason: 'duplicate' };
  if (!event.verified) return { applied: false, duplicate: false, reason: 'unverified_event' };
  processed.add(event.id);
  return { applied: true, duplicate: false };
}
