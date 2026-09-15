import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';

const hospitalitySections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Access operations',
    title: 'Property access with provider truth',
    description: 'The existing Hospitality access workspace remains the operational surface for provider readiness, room mappings, credential lifecycle and audit evidence.',
    cards: [
      {
        label: 'Operations',
        title: 'Room Access',
        description: 'Open the live readiness dashboard without replacing its authenticated provider checks or fail-closed behavior.',
        to: '/hospitality/access'
      },
      {
        label: 'Providers',
        title: 'Provider Readiness',
        description: 'Inspect configured property provider instances and their verified readiness states.',
        to: '/hospitality/access/providers'
      },
      {
        label: 'Rooms',
        title: 'Room Mappings',
        description: 'Review governed mappings between ATLAS rooms and authorized provider resources.',
        to: '/hospitality/access/rooms'
      },
      {
        label: 'Credentials',
        title: 'Credential Lifecycle',
        description: 'Issue or revoke credential references only when existing provider capability and authorization gates permit it.',
        to: '/hospitality/access/credentials'
      },
      {
        label: 'Audit',
        title: 'Access Evidence',
        description: 'Review property-scoped issuance, revocation, failure and reconciliation evidence.',
        to: '/hospitality/access/audit'
      }
    ]
  },
  {
    eyebrow: 'Provider governance',
    title: 'No simulated hotel connectivity',
    description: 'Hospitality integration state is derived from the existing authenticated readiness service; design alone never upgrades a provider to ready.',
    cards: [
      {
        label: 'Readiness',
        title: 'Fail-closed operations',
        description: 'Credential operations remain blocked when no verified provider capability is available.'
      },
      {
        label: 'Secrets',
        title: 'Server-side provider credentials',
        description: 'Browser users are not asked to enter lock master keys, private keys or provider secrets.'
      },
      {
        label: 'Scope',
        title: 'Organization & property boundaries',
        description: 'Operational evidence stays constrained to authenticated organization and property context.'
      }
    ]
  }
];

export function HospitalityExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Hospitality"
      title="Hospitality"
      description="Governed hotel access operations across authorized properties and verified provider integrations."
      narrative="Property operations, room access and audit evidence under one enterprise context."
      actions={[{ label: 'Open Room Access', to: '/hospitality/access' }]}
      sections={hospitalitySections}
      statusNote="Provider states remain authoritative. ATLAS does not claim a lock, property or credential provider is connected until the existing readiness service verifies it."
    />
  );
}
