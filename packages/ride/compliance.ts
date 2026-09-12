import type { EligibilityEffect } from '../compliance';

export const rideProfilePhotoRequirementType = 'profile_photo' as const;

export function describeRideEligibilityEffect(effect: EligibilityEffect | null) {
  if (effect === null || effect === 'none') return null;
  if (effect === 'warning') return 'Ride activity may be limited until this requirement is resolved.';
  return 'New Ride activity is blocked until this requirement is resolved.';
}
