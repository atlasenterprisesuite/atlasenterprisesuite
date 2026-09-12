import { describe, expect, it } from 'vitest';
import {
  canTransitionRequirement,
  canTransitionSubmission,
  hasCompliancePermission,
  requireRejectionReason,
  validateComplianceImageMetadata
} from '../../packages/compliance';
import { describeRideEligibilityEffect, rideProfilePhotoRequirementType } from '../../packages/ride/compliance';

describe('ATLAS Ride compliance domain', () => {
  it('never treats submission as approval', () => {
    expect(canTransitionRequirement('action_required', 'submitted')).toBe(true);
    expect(canTransitionRequirement('submitted', 'approved')).toBe(false);
    expect(canTransitionSubmission('submitted', 'approved')).toBe(false);
    expect(canTransitionSubmission('under_review', 'approved')).toBe(true);
  });

  it('requires a rejection reason', () => {
    expect(() => requireRejectionReason('   ')).toThrow('rejection_reason_required');
    expect(requireRejectionReason('Face is not clearly visible')).toBe('Face is not clearly visible');
  });

  it('fails closed on permissions', () => {
    expect(hasCompliancePermission(['ride.compliance.read'], 'ride.compliance.submit')).toBe(false);
    expect(hasCompliancePermission(['ride.compliance.manage'], 'ride.compliance.review')).toBe(true);
  });

  it('accepts only governed image metadata', () => {
    expect(validateComplianceImageMetadata({ mimeType: 'image/jpeg', sizeBytes: 1024 })).toEqual({ ok: true });
    expect(validateComplianceImageMetadata({ mimeType: 'application/pdf', sizeBytes: 1024 })).toEqual({ ok: false, error: 'unsupported_image_type' });
    expect(validateComplianceImageMetadata({ mimeType: 'image/png', sizeBytes: 10 * 1024 * 1024 + 1 })).toEqual({ ok: false, error: 'image_too_large' });
    expect(validateComplianceImageMetadata({ mimeType: 'image/webp', sizeBytes: 0 })).toEqual({ ok: false, error: 'empty_image' });
  });

  it('defines the Ride profile-photo requirement without inventing eligibility', () => {
    expect(rideProfilePhotoRequirementType).toBe('profile_photo');
    expect(describeRideEligibilityEffect(null)).toBeNull();
    expect(describeRideEligibilityEffect('block_new_activity')).toBe('New Ride activity is blocked until this requirement is resolved.');
  });
});
