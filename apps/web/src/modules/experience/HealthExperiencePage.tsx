import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';
import { ResearchBadge } from '../../components/ResearchBadge';

const healthSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Health architecture',
    title: 'Research and wellbeing with explicit boundaries',
    description: 'The current Health surface exposes implemented research and wellbeing routes while clinical and hospital-system claims remain gated until real integrations exist.',
    cards: [
      {
        label: 'Research & Innovation',
        title: 'Health Frontiers',
        description: 'Evidence registry, Neural Graph, falsification and transparent disease-reconstruction models.',
        to: '/health/research'
      },
      {
        label: 'Wellbeing',
        title: 'Neuroplasticity Program',
        description: 'Build learning-readiness habits with visible non-clinical boundaries and governed plan state.',
        to: '/health/wellbeing/neuroplasticity'
      },
      {
        label: 'Clinical systems',
        title: 'Not configured',
        description: 'No EHR, FHIR, HL7 or patient workflow is represented as connected.',
        status: 'External clinical integration required'
      },
      {
        label: 'Hospital operations',
        title: 'No live connection',
        description: 'No census, bed, staffing, pharmacy or facility metric is shown without an authorized live source.',
        status: 'Live hospital source not configured'
      }
    ]
  },
  {
    eyebrow: 'Evidence',
    title: 'Research truth before clinical claims',
    description: 'ATLAS Health distinguishes research tooling, wellbeing support and clinical operations so evidence strength and system readiness remain visible.',
    cards: [
      {
        label: 'Research',
        title: 'Evidence-aware models',
        description: 'Health Frontiers keeps provenance, evidence levels, contradictions and falsification visible.'
      },
      {
        label: 'Safety',
        title: 'Non-clinical boundaries',
        description: 'Research and wellbeing experiences do not present themselves as diagnosis, treatment or autonomous clinical care.'
      },
      {
        label: 'Connectivity',
        title: 'No simulated connected state',
        description: 'Clinical and hospital integrations remain visibly gated until credentials, adapters and verification exist.'
      }
    ]
  }
];

export function HealthExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Health"
      title="Health"
      description="A governed smart-health, biomedical research and wellbeing ecosystem that exposes only verified capabilities."
      narrative="Health intelligence, research and wellbeing with explicit evidence boundaries."
      sections={healthSections}
      statusNote="ATLAS Health does not infer clinical readiness from design. Research, wellbeing, provider connectivity and hospital operations remain separate governed states."
    >
      <ResearchBadge />
    </ModuleExperiencePage>
  );
}
