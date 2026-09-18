export type WebLaunchProfile = {
  brand: string;
  audience: string;
  competitors: string[];
  promise: string;
  proof: string;
  primaryAction: string;
  tone: string;
  language: string;
};

export type MasterPlan = {
  visualDirection: string;
  pageStructure: string[];
  scrollNarrative: string[];
  animationSystem: string[];
  technology: string[];
  buildOrder: string[];
};

export type HeroPlan = {
  title: string;
  subtitle: string;
  proofLine: string;
  primaryCta: string;
  secondaryCta: string;
  supportVisual: string;
  variants: string[];
};

export type MotionPlan = {
  entrance: string[];
  scroll: string[];
  interactions: string[];
  transitions: string[];
  neverMove: string[];
  mobileRules: string[];
};

export type CopyPlan = {
  awareness: string;
  objections: string[];
  headings: string[];
  blocks: string[];
  microcopy: string[];
  finalCta: string;
};

export type ConstructionPlan = {
  components: string[];
  folders: string[];
  breakpoints: string[];
  assetStrategy: string[];
  accessibility: string[];
  prelaunchChecklist: string[];
};

export type ConversionAudit = {
  frictionPoints: string[];
  confidenceSignals: string[];
  topChanges: string[];
  experiments: string[];
  successMetric: string;
};

export type LaunchPlan = {
  controlList: string[];
  weeklyCadence: string[];
  experiments: string[];
  metrics: string[];
  stopCriteria: string[];
};

export type WebLaunchBlueprint = {
  id: string;
  title: string;
  profile: WebLaunchProfile;
  masterPlan: MasterPlan | null;
  hero: HeroPlan | null;
  motion: MotionPlan | null;
  copy: CopyPlan | null;
  construction: ConstructionPlan | null;
  conversionAudit: ConversionAudit | null;
  launchPlan: LaunchPlan | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_UUID = '00000000-0000-4000-8000-000000000000';

const clean = (value: string, fallback: string) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};

const label = (value: string) => clean(value, 'the product');

export function createWebLaunchBlueprintState(id = EMPTY_UUID): WebLaunchBlueprint {
  const now = new Date(0).toISOString();
  return {
    id,
    title: 'Untitled web launch',
    profile: {
      brand: '',
      audience: '',
      competitors: [],
      promise: '',
      proof: '',
      primaryAction: '',
      tone: '',
      language: 'English'
    },
    masterPlan: null,
    hero: null,
    motion: null,
    copy: null,
    construction: null,
    conversionAudit: null,
    launchPlan: null,
    version: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function buildMasterPlan(profile: WebLaunchProfile): MasterPlan {
  const brand = label(profile.brand);
  const audience = clean(profile.audience, 'the intended audience');
  const promise = clean(profile.promise, 'a clear, measurable customer outcome');
  const competitorContext = profile.competitors.length
    ? `Use the supplied competitor references only as comparison context: ${profile.competitors.join(', ')}.`
    : 'No competitor research is inferred; add verified references before making competitor-specific claims.';

  return {
    visualDirection: `${brand}: premium, high-clarity visual system for ${audience}; prioritize trust, legibility, hierarchy and a strong first-screen promise.`,
    pageStructure: ['Hero', 'Trust / evidence', 'Problem', 'Solution', 'Capabilities', 'How it works', 'Proof', 'FAQ / objections', 'Final CTA'],
    scrollNarrative: [
      `State the promise immediately: ${promise}.`,
      'Prove credibility before adding detail.',
      'Move from the visitor problem to the product mechanism.',
      'Show the path to action with minimal friction.',
      'Close with one primary action and supporting reassurance.'
    ],
    animationSystem: ['Purposeful entrance reveals', 'Scroll progress only where it improves orientation', 'Micro-interactions on actionable controls', 'Reduced-motion fallback'],
    technology: ['React', 'TypeScript', 'Responsive CSS', 'Semantic HTML', 'Performance budget', 'Accessible interaction states'],
    buildOrder: ['Information architecture', 'Hero and CTA system', 'Reusable content sections', 'Responsive behavior', 'Motion and interaction', 'Accessibility', 'Analytics hooks', 'Launch verification', competitorContext]
  };
}

export function buildHeroPlan(profile: WebLaunchProfile): HeroPlan {
  const brand = label(profile.brand);
  const audience = clean(profile.audience, 'your audience');
  const promise = clean(profile.promise, 'get to the result faster with less complexity');
  const proof = clean(profile.proof, 'Verified proof should be added before publishing performance or customer claims.');
  const primaryAction = clean(profile.primaryAction, 'Start');

  return {
    title: `${brand}: ${promise}`,
    subtitle: `Built for ${audience}. Explain the outcome, mechanism and reason to trust the offer before asking for commitment.`,
    proofLine: proof,
    primaryCta: primaryAction,
    secondaryCta: 'See how it works',
    supportVisual: 'Use one authentic product, workflow or outcome visual. Reuse approved Creator Library assets before generating new media.',
    variants: [
      `${promise} — without the usual complexity.`,
      `A clearer path for ${audience} to ${promise.toLowerCase()}.`,
      `Turn the first visit into a confident next step: ${promise}.`
    ]
  };
}

export function buildMotionPlan(profile: WebLaunchProfile): MotionPlan {
  const tone = clean(profile.tone, 'precise and confident');
  return {
    entrance: ['Use short opacity/translate reveals for hierarchy, not decoration.', `Motion character: ${tone}.`],
    scroll: ['Keep navigation and progress orientation stable.', 'Animate only when new information enters the decision path.'],
    interactions: ['Hover/focus states on links, cards and CTAs.', 'Pressed, selected, loading, success, disabled and error states for actions.'],
    transitions: ['Use fast page/section transitions that preserve context.', 'Never delay primary actions for decorative animation.'],
    neverMove: ['Long-form body copy', 'Legal / pricing facts', 'Primary form labels', 'Critical status or error messages'],
    mobileRules: ['Prefer opacity over large transforms.', 'Disable expensive parallax.', 'Respect prefers-reduced-motion.', 'Protect input responsiveness and 60fps interaction targets where practical.']
  };
}

export function buildCopyPlan(profile: WebLaunchProfile): CopyPlan {
  const audience = clean(profile.audience, 'the visitor');
  const promise = clean(profile.promise, 'reach the desired outcome');
  const proof = clean(profile.proof, 'Add verified proof.');
  const action = clean(profile.primaryAction, 'Start');
  return {
    awareness: `Assume ${audience} understands the problem but still needs proof that this approach is credible and worth the effort.`,
    objections: ['Will this work for my situation?', 'How much time or effort will this take?', 'Why should I trust this solution?', 'What happens after I click?'],
    headings: ['A clear result, explained fast', 'Why this approach works', 'What you get', 'How it works', 'Proof before promises', 'Questions answered', action],
    blocks: [
      `Problem: describe the cost of the status quo in the visitor's language.`,
      `Solution: explain how the product helps ${promise.toLowerCase()} without unsupported claims.`,
      `Proof: ${proof}`,
      'Action: explain the next step, what it requires and what happens immediately afterward.'
    ],
    microcopy: ['No hidden next step.', 'You can review before submitting.', 'Required fields are marked.', 'Your organization permissions still apply.'],
    finalCta: `${action} — with the next step stated explicitly.`
  };
}

export function buildConstructionPlan(): ConstructionPlan {
  return {
    components: ['SiteShell', 'Header', 'Hero', 'TrustBar', 'ContentSection', 'FeatureGrid', 'ProofBlock', 'Faq', 'PrimaryCta', 'Footer'],
    folders: ['components/site', 'components/marketing', 'content', 'styles', 'lib/analytics', 'tests'],
    breakpoints: ['Mobile: < 680px', 'Tablet: 680–1050px', 'Desktop: > 1050px'],
    assetStrategy: ['Reuse Creator Library assets first.', 'Use responsive image sizes and lazy-loading below the fold.', 'Self-host or preload only critical fonts.', 'Do not ship unused media.'],
    accessibility: ['Semantic headings', 'Keyboard navigation', 'Visible focus', 'Reduced-motion support', 'Alt text', 'Form labels and validation', 'Contrast checks'],
    prelaunchChecklist: ['No empty links or placeholder actions', 'All forms validate and persist correctly', 'No 404/500 routes', 'Mobile navigation works', 'Critical Web Vitals checked', 'Analytics events validated', 'Production smoke test passes']
  };
}

export function auditConversion(blueprint: WebLaunchBlueprint): ConversionAudit {
  const profile = blueprint.profile;
  const missingProof = !profile.proof.trim();
  const missingAction = !profile.primaryAction.trim();
  const frictionPoints = [
    ...(missingProof ? ['No verified proof has been supplied for the primary promise.'] : []),
    ...(missingAction ? ['Primary action is not explicit.'] : []),
    'Any section that introduces a new concept before resolving the previous objection.',
    'Forms that ask for information not required for the immediate next step.'
  ];
  return {
    frictionPoints,
    confidenceSignals: [
      profile.proof.trim() || 'Add verified proof before publishing trust claims.',
      'Explain what happens after the primary CTA.',
      'Show privacy/security or organizational controls where relevant.'
    ],
    topChanges: [
      missingProof ? 'Add verified evidence close to the hero.' : 'Move the strongest verified proof closer to the hero.',
      missingAction ? 'Define one primary CTA.' : 'Repeat the same primary CTA language at key decision points.',
      'Shorten or remove any section that does not reduce uncertainty or support the action.'
    ],
    experiments: ['Hero promise variant A/B test', 'Proof placement test', 'CTA wording test'],
    successMetric: 'Primary CTA completion rate, supported by form completion, qualified activation and drop-off by step.'
  };
}

export function buildLaunchPlan(): LaunchPlan {
  return {
    controlList: ['Production origin', 'Critical routes', 'Deployment SHA/version', 'Forms', 'Analytics', 'Error monitoring', 'Mobile UX'],
    weeklyCadence: ['Week 1: defects and obvious friction', 'Week 2: hero/proof experiment', 'Week 3: CTA/form experiment', 'Week 4: consolidate learnings and freeze stable winners'],
    experiments: ['Hero promise', 'Proof placement', 'CTA or form friction'],
    metrics: ['Qualified visits', 'Primary CTA rate', 'Form completion rate', 'Activation/conversion', 'Error rate', 'Core Web Vitals'],
    stopCriteria: ['Stop changing a stable area without evidence.', 'Do not call a winner on tiny or biased samples.', 'Stop any experiment that harms accessibility, reliability or trust.', 'Keep the deployment gate fail-closed for the public domain and critical ATLAS Network routes.']
  };
}
