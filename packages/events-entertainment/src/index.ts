export type EventStatus = 'draft' | 'planning' | 'on_sale' | 'live' | 'settling' | 'closed' | 'cancelled';
export type EventRole =
  | 'events_admin'
  | 'promoter'
  | 'producer'
  | 'venue'
  | 'artist'
  | 'vendor'
  | 'staff'
  | 'finance'
  | 'box_office'
  | 'security';

export type BookingStatus = 'draft' | 'sent' | 'negotiating' | 'accepted' | 'rejected' | 'expired' | 'contracted';
export type SettlementStatus = 'draft' | 'calculated' | 'review' | 'approved' | 'payable' | 'paid' | 'reconciled';

export interface EntertainmentEvent {
  id: string;
  organizationId: string;
  name: string;
  status: EventStatus;
  venueId?: string;
  startsAt?: string;
  capacity?: number;
}

export interface EventApproval {
  organizationId: string;
  eventId: string;
  action: 'contract' | 'budget_change' | 'refund' | 'settlement' | 'payment';
  requestedBy: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
}

export const EVENT_STATUS_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['on_sale', 'cancelled'],
  on_sale: ['live', 'cancelled'],
  live: ['settling'],
  settling: ['closed'],
  closed: [],
  cancelled: []
};

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  draft: ['sent'],
  sent: ['negotiating', 'accepted', 'rejected', 'expired'],
  negotiating: ['accepted', 'rejected', 'expired'],
  accepted: ['contracted'],
  rejected: [],
  expired: [],
  contracted: []
};

export const SETTLEMENT_STATUS_TRANSITIONS: Record<SettlementStatus, readonly SettlementStatus[]> = {
  draft: ['calculated'],
  calculated: ['review'],
  review: ['approved'],
  approved: ['payable'],
  payable: ['paid'],
  paid: ['reconciled'],
  reconciled: []
};

export function canTransitionEvent(from: EventStatus, to: EventStatus) {
  return EVENT_STATUS_TRANSITIONS[from].includes(to);
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus) {
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

export function canTransitionSettlement(from: SettlementStatus, to: SettlementStatus) {
  return SETTLEMENT_STATUS_TRANSITIONS[from].includes(to);
}

export const EVENTS_EXTERNAL_BOUNDARIES = {
  ticketing: 'authorization_required',
  payments: 'authorization_required',
  artistBooking: 'authorization_required',
  accessControl: 'authorization_required'
} as const;

export const EVENTS_APPROVAL_GATES = {
  contract: true,
  budget_change: true,
  refund: true,
  settlement: true,
  payment: true
} as const;
