export type RideRequirementType =
  | 'profile_photo'
  | 'driver_license'
  | 'insurance'
  | 'vehicle_registration'
  | 'vehicle_inspection'
  | 'background_check';

export type RideRequirementDefinition = {
  type: RideRequirementType;
  label: string;
  category: 'identity' | 'driver' | 'vehicle' | 'screening';
  subjectType: 'driver' | 'vehicle';
  description: string;
  actionPath: string | null;
};

export const RIDE_REQUIREMENT_REGISTRY: Readonly<Record<RideRequirementType, RideRequirementDefinition>> = {
  profile_photo: {
    type: 'profile_photo',
    label: 'Profile Photo',
    category: 'identity',
    subjectType: 'driver',
    description: 'Private identity evidence reviewed through the governed Ride compliance lifecycle.',
    actionPath: '/ride/driver/compliance/documents/profile-photo'
  },
  driver_license: {
    type: 'driver_license',
    label: 'Driver License',
    category: 'driver',
    subjectType: 'driver',
    description: 'Driver credential with governed verification and expiration tracking.',
    actionPath: null
  },
  insurance: {
    type: 'insurance',
    label: 'Insurance',
    category: 'vehicle',
    subjectType: 'vehicle',
    description: 'Applicable vehicle insurance evidence and expiration tracking.',
    actionPath: null
  },
  vehicle_registration: {
    type: 'vehicle_registration',
    label: 'Vehicle Registration',
    category: 'vehicle',
    subjectType: 'vehicle',
    description: 'Vehicle registration evidence associated with the governed vehicle record.',
    actionPath: null
  },
  vehicle_inspection: {
    type: 'vehicle_inspection',
    label: 'Vehicle Inspection',
    category: 'vehicle',
    subjectType: 'vehicle',
    description: 'Inspection evidence and effective/expiration dates for an assigned vehicle.',
    actionPath: null
  },
  background_check: {
    type: 'background_check',
    label: 'Background Check',
    category: 'screening',
    subjectType: 'driver',
    description: 'Screening requirement whose status must come from manual review or an authorized provider.',
    actionPath: null
  }
};

export function describeRideRequirement(requirementType: string) {
  const known = RIDE_REQUIREMENT_REGISTRY[requirementType as RideRequirementType];
  if (known) return known;
  return {
    type: requirementType,
    label: requirementType.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase()),
    category: 'driver' as const,
    subjectType: 'driver' as const,
    description: 'Governed Ride compliance requirement configured by the active organization.',
    actionPath: null
  };
}
