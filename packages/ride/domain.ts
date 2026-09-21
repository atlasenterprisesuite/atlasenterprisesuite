export type RideDriverStatus = 'onboarding' | 'active' | 'suspended' | 'inactive';
export type RideDriverAvailability = 'offline' | 'online' | 'on_trip';

export type RideTripStatus =
  | 'requested'
  | 'offered'
  | 'accepted'
  | 'driver_en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'disputed';

export type RideMoney = {
  currency: string;
  amountMinor: number;
};

export type RideTrip = {
  id: string;
  organizationId: string;
  tenantId: string;
  requesterUserId: string | null;
  driverProfileId: string | null;
  vehicleId: string | null;
  status: RideTripStatus;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  quotedFare: RideMoney | null;
  finalFare: RideMoney | null;
  pricingPolicyReference: string | null;
  paymentReference: string | null;
  accountingReference: string | null;
  taxReference: string | null;
};

const TRIP_TRANSITIONS: Readonly<Record<RideTripStatus, readonly RideTripStatus[]>> = {
  requested: ['offered', 'cancelled'],
  offered: ['accepted', 'cancelled'],
  accepted: ['driver_en_route', 'cancelled'],
  driver_en_route: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'disputed'],
  completed: ['disputed'],
  cancelled: [],
  no_show: ['disputed'],
  disputed: []
};

export function canTransitionRideTrip(from: RideTripStatus, to: RideTripStatus) {
  return TRIP_TRANSITIONS[from].includes(to);
}

export function assertRideMoney(value: RideMoney) {
  if (!/^[A-Z]{3}$/.test(value.currency)) throw new Error('invalid_currency');
  if (!Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0) throw new Error('invalid_money_amount');
  return value;
}
