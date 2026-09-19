import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';
import {
  EVENT_STATUS_TRANSITIONS,
  EVENTS_EXTERNAL_BOUNDARIES
} from '../../../../../packages/events-entertainment/src';

const transitionCount = Object.values(EVENT_STATUS_TRANSITIONS)
  .reduce((total, transitions) => total + transitions.length, 0);

const sections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Event lifecycle',
    title: 'Promote, produce and settle under one governed event state',
    description: 'ATLAS Events exposes the implemented lifecycle contract without inventing live events, ticket counts or provider connectivity.',
    cards: [
      {
        label: 'Planning',
        title: 'Draft → planning',
        description: 'Structure an event before commercial activation while preserving an auditable lifecycle boundary.',
        status: 'Lifecycle contract active'
      },
      {
        label: 'Commercial',
        title: 'On sale → live',
        description: 'Commercial states are represented in the domain, while ticketing remains gated until an authorized provider is connected.',
        status: 'Ticketing authorization required'
      },
      {
        label: 'Settlement',
        title: 'Settling → closed',
        description: 'Close-out is modeled as an explicit lifecycle transition instead of an implicit status change.',
        status: 'Settlement workflow foundation active'
      }
    ]
  },
  {
    eyebrow: 'Entertainment network',
    title: 'Talent, venues, vendors and staff share one organization boundary',
    description: 'The domain supports promoter, producer, venue, artist, vendor and staff roles while external execution remains permission-bound.',
    cards: [
      {
        label: 'Talent',
        title: 'Artist & booking boundary',
        description: 'Artist booking is not represented as connected until an authorized booking source is configured.',
        status: EVENTS_EXTERNAL_BOUNDARIES.artistBooking
      },
      {
        label: 'Commerce',
        title: 'Ticketing boundary',
        description: 'Ticket inventory and sales remain unavailable until the organization authorizes a ticketing provider.',
        status: EVENTS_EXTERNAL_BOUNDARIES.ticketing
      },
      {
        label: 'Money',
        title: 'Payments boundary',
        description: 'Event settlement cannot execute external payment movement without an authorized payment provider.',
        status: EVENTS_EXTERNAL_BOUNDARIES.payments
      }
    ]
  },
  {
    eyebrow: 'Governance',
    title: 'No fabricated event state',
    description: 'ATLAS Events remains organization-scoped and only exposes operational claims backed by implemented contracts or authorized sources.',
    cards: [
      {
        label: 'State machine',
        title: 'Lifecycle integrity',
        description: `${transitionCount} governed event-status transitions are currently defined by the Events domain.`
      },
      {
        label: 'Identity',
        title: 'Authenticated workspace',
        description: 'The Events surface inherits ATLAS Identity, organization context and the shared audited shell.'
      },
      {
        label: 'Providers',
        title: 'Fail closed',
        description: 'Ticketing, booking and payments remain visibly gated until real provider authorization exists.'
      }
    ]
  }
];

export function EventsHomePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Events & Entertainment"
      title="Events"
      description="Governed live-entertainment operations for promoters, producers, venues, talent, vendors and settlement workflows."
      narrative="Plan the event, connect authorized providers, execute under one ATLAS organization."
      sections={sections}
      statusNote="The Events domain and lifecycle contract are active. No live event inventory, ticketing, booking or payment connection is claimed until authorized provider data exists."
    />
  );
}
