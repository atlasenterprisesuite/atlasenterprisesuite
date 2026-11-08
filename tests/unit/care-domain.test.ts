import { describe, expect, it } from 'vitest';
import { evaluateCareTimeEntry } from '../../packages/care/types';

describe('ATLAS Care domain validation', () => {
  it('accepts an authorized, non-overlapping entry inside the care plan allowance', () => {
    expect(evaluateCareTimeEntry({
      eligibilityStatus: 'eligible',
      caregiverAuthorizationStatus: 'authorized',
      caregiverCertificationStatus: 'verified',
      planStatus: 'active',
      requestedMinutes: 180,
      authorizedMinutesRemaining: 600,
      overlapsExistingEntry: false
    })).toEqual([]);
  });

  it('fails closed when eligibility, credentials, plan state, allowance or overlap is invalid', () => {
    expect(evaluateCareTimeEntry({
      eligibilityStatus: 'review',
      caregiverAuthorizationStatus: 'pending',
      caregiverCertificationStatus: 'expired',
      planStatus: 'paused',
      requestedMinutes: 700,
      authorizedMinutesRemaining: 600,
      overlapsExistingEntry: true
    })).toEqual(expect.arrayContaining([
      'participant_not_eligible',
      'caregiver_not_authorized',
      'caregiver_certification_not_verified',
      'care_plan_not_active',
      'authorized_minutes_exceeded',
      'overlapping_time_entry'
    ]));
  });
});
