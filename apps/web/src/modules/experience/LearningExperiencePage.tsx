import { ModuleExperiencePage, type ModuleExperienceSection } from '../../components/ModuleExperiencePage';

const learningSections: ModuleExperienceSection[] = [
  {
    eyebrow: 'Practice Lab',
    title: 'Learning routines with visible boundaries',
    description: 'ATLAS Learning combines approved instructor-led course delivery with the existing neuroplasticity practice program while keeping learning evidence and clinical boundaries explicit.',
    cards: [
      {
        label: 'Course Library',
        title: 'Approved instructor-led courses',
        description: 'Open complete courses generated from governed knowledge. Only explicitly approved Course Forge packages appear in this library.',
        to: '/learning/courses'
      },
      {
        label: 'Course Forge',
        title: 'Create a course from ChatGPT or ATLAS knowledge',
        description: 'Turn a conversation, research pack or approved Knowledge record into lesson scripts, exercises, assessments and an instructor package.',
        to: '/knowledge/course-studio'
      },
      {
        label: 'Practice Lab',
        title: 'Neuroplasticity Program',
        description: 'Build a structured daily practice plan, track completion and preserve the program’s existing safety boundaries.',
        to: '/learning/neuroplasticity'
      },
      {
        label: 'Method',
        title: 'Deliberate practice',
        description: 'The active program uses focused practice activities rather than claiming neurological change from completion alone.',
        status: 'Available inside Practice Lab'
      },
      {
        label: 'Progress',
        title: 'Activity completion',
        description: 'Progress reflects completed program activities, not a medical or neurological outcome.',
        status: 'Measured inside Practice Lab'
      }
    ]
  },
  {
    eyebrow: 'Safety boundary',
    title: 'Learning support is not clinical care',
    description: 'The learning experience keeps educational practice separate from diagnosis, treatment and medical outcome claims.',
    cards: [
      {
        label: 'Clinical boundary',
        title: 'Clinical diagnosis & treatment',
        description: 'ATLAS Learning does not diagnose, prescribe treatment or represent activity completion as evidence of neurological change.',
        status: 'Not a Learning capability'
      },
      {
        label: 'Guidance',
        title: 'Professional guidance',
        description: 'The existing program surfaces professional-guidance recommendations when user-selected conditions require that boundary.',
        status: 'Safety gate preserved'
      },
      {
        label: 'Persistence',
        title: 'Governed save state',
        description: 'Program persistence remains dependent on the existing authenticated and configured Supabase environment.',
        status: 'Configuration dependent'
      }
    ]
  }
];

export function LearningExperiencePage() {
  return (
    <ModuleExperiencePage
      eyebrow="ATLAS Learning"
      title="Learning"
      description="Approved courses, instructor-ready teaching packages, structured practice and measurable activity progress inside the governed ATLAS ecosystem."
      narrative="Knowledge becomes teachable curriculum; approved curriculum becomes structured learning and measurable practice."
      visualReference="modules"
      sections={learningSections}
      statusNote="ATLAS Learning reports practice activity and program state only. It does not convert educational engagement into a clinical or neurological claim."
    />
  );
}
