export type HospitalityEventState =
  | 'inquiry'
  | 'tentative'
  | 'confirmed'
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'cancelled'
  | 'postponed'
  | 'on_hold';

const EVENT_TRANSITIONS: Record<HospitalityEventState, readonly HospitalityEventState[]> = {
  inquiry: ['tentative', 'cancelled', 'on_hold'],
  tentative: ['confirmed', 'cancelled', 'postponed', 'on_hold'],
  confirmed: ['planning', 'cancelled', 'postponed', 'on_hold'],
  planning: ['ready', 'cancelled', 'postponed', 'on_hold'],
  ready: ['in_progress', 'planning', 'cancelled', 'postponed', 'on_hold'],
  in_progress: ['completed', 'on_hold'],
  completed: ['closed'],
  closed: [],
  cancelled: [],
  postponed: ['tentative', 'confirmed', 'planning', 'cancelled'],
  on_hold: ['tentative', 'confirmed', 'planning', 'ready', 'cancelled']
};

export function transitionHospitalityEvent(current: HospitalityEventState, next: HospitalityEventState) {
  if (!EVENT_TRANSITIONS[current]?.includes(next)) throw new Error('invalid_event_transition');
  return next;
}

export type HospitalityEventImpactDomain =
  | 'banquets'
  | 'culinary'
  | 'staffing'
  | 'inventory'
  | 'billing'
  | 'av'
  | 'engineering'
  | 'housekeeping'
  | 'security'
  | 'front_office';

export type HospitalityEventImpact = {
  level: 'low' | 'medium' | 'high' | 'critical' | 'review';
  affectedDomains: HospitalityEventImpactDomain[];
};

export function classifyEventChange(change: { type: string; before: unknown; after: unknown }): HospitalityEventImpact {
  if (change.type === 'guest_count') {
    return { level: 'high', affectedDomains: ['banquets', 'culinary', 'staffing', 'inventory', 'billing'] };
  }
  if (change.type === 'event_time') {
    return { level: 'high', affectedDomains: ['banquets', 'culinary', 'staffing', 'av', 'engineering', 'housekeeping', 'security', 'front_office'] };
  }
  if (change.type === 'menu' || change.type === 'dietary_requirement') {
    return { level: 'high', affectedDomains: ['culinary', 'banquets', 'inventory', 'billing'] };
  }
  if (change.type === 'av_requirement') {
    return { level: 'medium', affectedDomains: ['av', 'engineering', 'billing'] };
  }
  if (change.type === 'room_setup' || change.type === 'venue') {
    return { level: 'high', affectedDomains: ['banquets', 'engineering', 'housekeeping', 'security'] };
  }
  return { level: 'review', affectedDomains: [] };
}
