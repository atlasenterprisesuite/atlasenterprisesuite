export type CareEligibilityStatus = 'pending' | 'eligible' | 'ineligible' | 'review';
export type CaregiverAuthorizationStatus = 'pending' | 'authorized' | 'suspended';
export type CaregiverCertificationStatus = 'pending' | 'verified' | 'expired';
export type CarePlanStatus = 'draft' | 'active' | 'paused' | 'closed';
export type CareTimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export type CareValidationInput = {
  eligibilityStatus: CareEligibilityStatus;
  caregiverAuthorizationStatus: CaregiverAuthorizationStatus;
  caregiverCertificationStatus: CaregiverCertificationStatus;
  planStatus: CarePlanStatus;
  requestedMinutes: number;
  authorizedMinutesRemaining: number;
  overlapsExistingEntry: boolean;
};

export function evaluateCareTimeEntry(input: CareValidationInput): string[] {
  const failures: string[] = [];
  if (input.eligibilityStatus !== 'eligible') failures.push('participant_not_eligible');
  if (input.caregiverAuthorizationStatus !== 'authorized') failures.push('caregiver_not_authorized');
  if (input.caregiverCertificationStatus !== 'verified') failures.push('caregiver_certification_not_verified');
  if (input.planStatus !== 'active') failures.push('care_plan_not_active');
  if (!Number.isFinite(input.requestedMinutes) || input.requestedMinutes <= 0) failures.push('invalid_minutes');
  if (input.requestedMinutes > input.authorizedMinutesRemaining) failures.push('authorized_minutes_exceeded');
  if (input.overlapsExistingEntry) failures.push('overlapping_time_entry');
  return failures;
}
