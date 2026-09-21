import { describe, expect, it } from 'vitest';
import type { ComplianceRequirement } from '../../packages/compliance/types';
import { canTransitionRideTrip, assertRideMoney } from '../../packages/ride/domain';
import { calculateRideReadiness } from '../../packages/ride/readiness';
import { describeRideRequirement, RIDE_REQUIREMENT_REGISTRY } from '../../packages/ride/requirements';

function requirement(overrides: Partial<ComplianceRequirement> = {}): ComplianceRequirement {
  return {
    id: 'req-1',
    tenantId: 'org-1',
    organizationId: 'org-1',
    subjectUserId: 'user-1',
    module: 'ride',
    subjectType: 'driver',
    requirementType: 'profile_photo',
    status: 'approved',
    requestedAt: '2026-09-21T00:00:00Z',
    dueAt: null,
    expiresAt: null,
    eligibilityEffect: 'none',
    reasonCode: null,
    reasonText: null,
    createdBy: null,
    createdAt: '2026-09-21T00:00:00Z',
    updatedAt: '2026-09-21T00:00:00Z',
    ...overrides
  };
}

describe('ATLAS Ride OS core contracts', () => {
  it('defines metadata without inventing persisted compliance state', () => {
    expect(Object.keys(RIDE_REQUIREMENT_REGISTRY)).toEqual(expect.arrayContaining([
      'profile_photo',
      'driver_license',
      'insurance',
      'vehicle_registration',
      'vehicle_inspection',
      'background_check'
    ]));
    expect(describeRideRequirement('profile_photo').actionPath).toBe('/ride/driver/compliance/documents/profile-photo');
    expect(describeRideRequirement('custom_org_requirement').actionPath).toBeNull();
  });

  it('fails readiness closed when there is no evidence', () => {
    expect(calculateRideReadiness([])).toMatchObject({
      state: 'unknown',
      eligibleForNewTrips: false,
      evaluatedRequirementCount: 0
    });
  });

  it('blocks expired or explicit block-new-activity requirements', () => {
    const expired = calculateRideReadiness([requirement({ id: 'expired', status: 'expired' })]);
    expect(expired.state).toBe('blocked');
    expect(expired.eligibleForNewTrips).toBe(false);

    const policyBlock = calculateRideReadiness([
      requirement({ id: 'license', status: 'action_required', eligibilityEffect: 'block_new_activity' })
    ]);
    expect(policyBlock.blockingRequirementIds).toContain('license');
  });

  it('preserves warning semantics without converting warnings into a block', () => {
    const result = calculateRideReadiness([
      requirement({ id: 'insurance', status: 'action_required', eligibilityEffect: 'warning' })
    ]);
    expect(result.state).toBe('warning');
    expect(result.eligibleForNewTrips).toBe(true);
  });

  it('uses an explicit canonical trip lifecycle', () => {
    expect(canTransitionRideTrip('requested', 'offered')).toBe(true);
    expect(canTransitionRideTrip('accepted', 'in_progress')).toBe(false);
    expect(canTransitionRideTrip('completed', 'requested')).toBe(false);
    expect(canTransitionRideTrip('completed', 'disputed')).toBe(true);
  });

  it('keeps authoritative money in integer minor units and ISO currency', () => {
    expect(assertRideMoney({ currency: 'USD', amountMinor: 1250 })).toEqual({ currency: 'USD', amountMinor: 1250 });
    expect(() => assertRideMoney({ currency: 'usd', amountMinor: 1250 })).toThrow('invalid_currency');
    expect(() => assertRideMoney({ currency: 'USD', amountMinor: 12.5 })).toThrow('invalid_money_amount');
  });
});
