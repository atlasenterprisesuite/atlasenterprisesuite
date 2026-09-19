export type EventStatus = 'draft' | 'planning' | 'on_sale' | 'live' | 'settling' | 'closed' | 'cancelled';
export type EventRole = 'promoter' | 'producer' | 'venue' | 'artist' | 'vendor' | 'staff';

export interface EntertainmentEvent {
  id: string;
  organizationId: string;
  name: string;
  status: EventStatus;
  venueId?: string;
  startsAt?: string;
  capacity?: number;
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

export function canTransitionEvent(from: EventStatus, to: EventStatus) {
  return EVENT_STATUS_TRANSITIONS[from].includes(to);
}

export const EVENTS_EXTERNAL_BOUNDARIES = {
  ticketing: 'authorization_required',
  payments: 'authorization_required',
  artistBooking: 'authorization_required'
} as const;
