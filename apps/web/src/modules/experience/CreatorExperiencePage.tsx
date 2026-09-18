import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';

const creatorSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Creative engines',
    title: 'One Studio, multiple governed creation modes',
    description: 'ATLAS Studio keeps content, image, video, music and voice workflows inside the same organization and execution boundary.',
    cards: [
      {
        label: 'Intelligence',
        title: 'Content Intelligence',
        description: 'Turn creator context into audience insights, ranked ideas, hooks, structured drafts, channel variants and governed handoffs.',
        to: '/studio/content'
      },
      {
        label: 'Image',
        title: 'Image Lab',
        description: 'Compose image requests while keeping provider authorization and verified result boundaries explicit.',
        to: '/studio/create?type=image'
      },
      {
        label: 'Video',
        title: 'ATLAS Director',
        description: 'Plan productions, scenes, shots, continuity and provider-aware generation through the existing Director workspace.',
        to: '/studio/create?type=video'
      },
      {
        label: 'Music',
        title: 'Music Lab',
        description: 'Prepare governed music requests without presenting unconfigured generation as live.',
        to: '/studio/create?type=music'
      },
      {
        label: 'Voice',
        title: 'Voice & Agents',
        description: 'Continue into the identity-gated ATLAS Voice workspace.',
        to: '/studio/voice'
      },
      {
        label: 'Presentation',
        title: 'Smart Teleprompter',
        description: 'Record with camera and microphone while the script follows your spoken pace, with authorized private recording storage.',
        to: '/studio/teleprompter'
      }
    ]
  },
  {
    eyebrow: 'Creative operations',
    title: 'Assets, provenance and provider readiness',
    description: 'Studio operations separate saved organization media from provider connectivity so readiness remains auditable.',
    cards: [
      {
        label: 'Library',
        title: 'Creator Library',
        description: 'Search authorized productions and assets with organization scope, versioning and provenance.',
        to: '/studio/library'
      },
      {
        label: 'Providers',
        title: 'Provider readiness',
        description: 'Inspect verified server-side provider state without inferring connectivity from browser configuration.',
        to: '/studio/providers'
      },
      {
        label: 'Storage',
        title: 'Organization media',
        description: 'Generated and uploaded assets appear only after they are saved through an authorized storage connection.',
        status: 'Authorized storage required'
      }
    ]
  },
  {
    eyebrow: 'Governance',
    title: 'Creation must remain verifiable',
    description: 'ATLAS distinguishes local planning from external generation and never reports media as generated before a verified provider returns a result.',
    cards: [
      {
        label: 'Execution',
        title: 'Verified generation only',
        description: 'Provider-backed execution stays disabled when compatible provider configuration or authorization is missing.'
      },
      {
        label: 'Audit',
        title: 'Traceable creative state',
        description: 'Production state, provider selection and saved assets retain auditable organization context.'
      },
      {
        label: 'Privacy',
        title: 'Consent-aware intelligence',
        description: 'Sensitive capabilities such as visual location estimation require explicit authorized initiation, confidence and visible limitations.'
      }
    ]
  }
];

export function CreatorExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Studio"
      title="Create beyond the prompt."
      description="Content intelligence, imagery, video, sound and voice share one governed creative workspace connected to ATLAS Identity and organization context."
      narrative="One governed creative operating system for content, media, voice and provider-aware execution."
      actions={[
        { label: 'Open Smart Teleprompter', to: '/studio/teleprompter' },
        { label: 'Start with Content Intelligence', to: '/studio/content', variant: 'secondary' },
        { label: 'Browse saved media', to: '/studio/library', variant: 'secondary' }
      ]}
      sections={creatorSections}
      statusNote="External generation remains unavailable until verified provider readiness, organization authorization and the required storage boundary are present. Local planning remains available without fabricating provider output."
    />
  );
}
