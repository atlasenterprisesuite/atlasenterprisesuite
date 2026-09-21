import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';
import { RideSubnav } from './RideSubnav';

const rideSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Mobility architecture',
    title: 'Driver readiness before trip execution',
    description: 'ATLAS Ride exposes authenticated compliance and server-derived readiness, with a canonical Driver/Vehicle/Trip foundation while dispatch, pricing and external providers remain gated until their operational services are verified.',
    cards: [
      {
        label: 'People & readiness',
        title: 'Driver / Partner',
        description: 'Open onboarding and compliance requirements for the authenticated Ride participant.',
        to: '/ride/driver'
      },
      {
        label: 'Readiness',
        title: 'Driver & Vehicle Readiness',
        description: 'Evaluate the new-trip gate from persisted compliance requirements for the active organization.',
        to: '/ride/readiness'
      },
      {
        label: 'Compliance',
        title: 'Compliance',
        description: 'Review the governed compliance workspace and current evidence requirements.',
        to: '/ride/driver/compliance'
      },
      {
        label: 'Evidence',
        title: 'Documents & Credentials',
        description: 'Manage supported identity and compliance evidence through the existing protected route graph.',
        to: '/ride/driver/compliance/documents'
      },
      {
        label: 'Dispatch & Trips',
        title: 'Not active',
        description: 'Canonical Trip persistence now exists, but dispatch, pricing, live GPS, payment execution and external rideshare provider operations remain gated until their services are implemented and verified.',
        status: 'Mobility execution not yet active'
      }
    ]
  },
  {
    eyebrow: 'Governance',
    title: 'Evidence before eligibility',
    description: 'Ride readiness remains tied to authenticated identity, governed compliance state and explicit policy boundaries rather than visual status alone.',
    cards: [
      {
        label: 'Identity',
        title: 'Authenticated participant',
        description: 'Ride routes remain inside the existing ATLAS identity boundary.'
      },
      {
        label: 'Compliance',
        title: 'Governed evidence',
        description: 'Documents and profile-photo evidence continue through the existing compliance workflow and protected storage model.'
      },
      {
        label: 'Safety',
        title: 'No implied activation',
        description: 'The interface does not claim a driver, dispatch provider, pricing engine or fleet integration is active without verified backend state.'
      }
    ]
  }
];

export function RideHomePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Mobility"
      title="ATLAS Ride"
      description="Governed mobility operations beginning with driver identity, compliance and evidence."
      narrative="Driver readiness, compliance evidence and governed mobility operations."
      sections={rideSections}
      statusNote="Trip dispatch, pricing, fleet connectivity and external rideshare provider connections are not represented as active in this slice."
    >
      <RideSubnav />
    </ModuleExperiencePage>
  );
}
