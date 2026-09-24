export type ContentPlatform = 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';

export type CreatorProfile = {
  niche: string;
  objective: string;
  tone: string;
  platforms: ContentPlatform[];
  audience: string;
  language: string;
};

export type AudienceProfile = {
  summary: string;
  problems: string[];
  questions: string[];
  motivations: string[];
  fears: string[];
  interests: string[];
};

export type ContentIdea = {
  id: string;
  title: string;
  angle: string;
  audienceNeed: string;
  format: 'education' | 'story' | 'checklist' | 'myth-busting' | 'comparison' | 'case-study' | 'framework' | 'quick-win';
  score: number;
};

export type HookStyle = 'curiosity' | 'contrarian' | 'problem' | 'proof' | 'direct';

export type HookVariant = {
  id: string;
  style: HookStyle;
  text: string;
};

export type ContentDraft = {
  id: string;
  ideaId: string;
  hookId: string;
  title: string;
  introduction: string;
  bodyPoints: string[];
  cta: string;
  narration: string;
  language: string;
};

export type RepurposedVariant = {
  id: string;
  platform: ContentPlatform;
  format: string;
  content: string;
};

export type ContentReview = {
  overallScore: number;
  criteria: {
    clarity: number;
    structure: number;
    hookStrength: number;
    ctaPresence: number;
  };
  recommendations: string[];
};

export type ContentWorkspaceState = {
  id: string;
  title: string;
  profile: CreatorProfile;
  audienceSeed: string;
  audience: AudienceProfile | null;
  ideas: ContentIdea[];
  hooks: HookVariant[];
  selectedIdeaId: string | null;
  selectedHookId: string | null;
  draft: ContentDraft | null;
  variants: RepurposedVariant[];
  review: ContentReview | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_UUID = '00000000-0000-4000-8000-000000000000';

const emptyProfile = (): CreatorProfile => ({
  niche: '',
  objective: '',
  tone: '',
  platforms: [],
  audience: '',
  language: 'English'
});

function clean(value: string, fallback: string) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

function sentence(value: string) {
  const normalized = clean(value, '');
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, character => character.toUpperCase());
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createContentWorkspaceState(id = EMPTY_UUID): ContentWorkspaceState {
  const now = new Date(0).toISOString();
  return {
    id,
    title: 'Untitled content workspace',
    profile: emptyProfile(),
    audienceSeed: '',
    audience: null,
    ideas: [],
    hooks: [],
    selectedIdeaId: null,
    selectedHookId: null,
    draft: null,
    variants: [],
    review: null,
    version: 0,
    createdAt: now,
    updatedAt: now
  };
}

export function generateAudienceInsights(profile: CreatorProfile, audienceSeed: string): AudienceProfile {
  const audience = clean(profile.audience, 'the intended audience');
  const niche = clean(profile.niche, 'their topic');
  const objective = clean(profile.objective, 'make better decisions');
  const seed = clean(audienceSeed, `${audience} wants practical guidance about ${niche}`);

  return {
    summary: `${audience} is seeking useful, credible guidance about ${niche}. Source context: ${seed}`,
    problems: [
      `Too much complexity around ${niche} makes action harder.`,
      `Limited time makes it difficult for ${audience} to evaluate every option.`,
      `Unclear next steps can turn small mistakes into avoidable cost or delay.`
    ],
    questions: [
      `What should ${audience} do first about ${niche}?`,
      `Which mistakes matter most and how can they be avoided?`,
      `How can progress toward “${objective}” be measured simply?`
    ],
    motivations: [
      `Gain confidence before making a decision.`,
      `Save time by following a clear sequence.`,
      `Get a practical result without unnecessary complexity.`
    ],
    fears: [
      `Wasting money or time on the wrong step.`,
      `Missing an important requirement or warning sign.`,
      `Being overwhelmed by conflicting advice.`
    ],
    interests: [
      `Practical examples related to ${niche}.`,
      `Checklists, frameworks and quick diagnostics.`,
      `Clear comparisons that make trade-offs visible.`
    ]
  };
}

export function generateContentIdeas(profile: CreatorProfile, audience: AudienceProfile): ContentIdea[] {
  const niche = clean(profile.niche, 'your topic');
  const audienceName = clean(profile.audience, 'your audience');
  const firstProblem = clean(audience.problems[0], `Common confusion about ${niche}`);
  const firstQuestion = clean(audience.questions[0], `What should people know first about ${niche}?`);

  const candidates: ContentIdea[] = [
    {
      id: 'idea-1',
      title: `The 3-Step ${titleCase(niche)} Starter Framework`,
      angle: `Turn ${firstQuestion.toLowerCase()} into three concrete actions ${audienceName} can use immediately.`,
      audienceNeed: firstProblem,
      format: 'framework',
      score: 96
    },
    {
      id: 'idea-2',
      title: `5 ${titleCase(niche)} Mistakes That Cost More Than You Think`,
      angle: `Use the audience's fear of avoidable mistakes to teach preventive decisions without fearmongering.`,
      audienceNeed: audience.fears[0] || firstProblem,
      format: 'checklist',
      score: 93
    },
    {
      id: 'idea-3',
      title: `What Nobody Explains Clearly About ${titleCase(niche)}`,
      angle: `Resolve a high-friction point with plain-language explanation and a practical next step.`,
      audienceNeed: firstProblem,
      format: 'education',
      score: 90
    },
    {
      id: 'idea-4',
      title: `${titleCase(niche)}: Myth vs. Reality`,
      angle: `Challenge a common assumption and replace it with a useful decision rule.`,
      audienceNeed: audience.questions[1] || firstQuestion,
      format: 'myth-busting',
      score: 87
    },
    {
      id: 'idea-5',
      title: `Before vs. After: A Better ${titleCase(niche)} Workflow`,
      angle: `Compare an inefficient path with a simpler sequence and explain why the difference matters.`,
      audienceNeed: audience.motivations[1] || firstProblem,
      format: 'comparison',
      score: 84
    },
    {
      id: 'idea-6',
      title: `A Realistic ${titleCase(niche)} Decision Scenario`,
      angle: `Walk through a representative scenario and show the reasoning behind each decision.`,
      audienceNeed: audience.interests[0] || firstQuestion,
      format: 'case-study',
      score: 81
    },
    {
      id: 'idea-7',
      title: `One ${titleCase(niche)} Fix You Can Use Today`,
      angle: `Deliver one narrow improvement that creates visible progress in a few minutes.`,
      audienceNeed: audience.motivations[2] || firstProblem,
      format: 'quick-win',
      score: 78
    },
    {
      id: 'idea-8',
      title: `The ${titleCase(niche)} Story Behind a Better Outcome`,
      angle: `Use a beginning-problem-decision-result structure to make the lesson memorable.`,
      audienceNeed: audience.interests[2] || firstQuestion,
      format: 'story',
      score: 75
    }
  ];

  return candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function generateHookVariants(idea: ContentIdea, profile: CreatorProfile): HookVariant[] {
  const audience = clean(profile.audience, 'your audience');
  const topic = clean(profile.niche, 'this topic');
  return [
    { id: `${idea.id}-hook-curiosity`, style: 'curiosity', text: `Most people miss the one detail that changes how ${idea.title.toLowerCase()} works.` },
    { id: `${idea.id}-hook-contrarian`, style: 'contrarian', text: `The usual advice about ${topic} is incomplete—and it can make the next step harder.` },
    { id: `${idea.id}-hook-problem`, style: 'problem', text: `If ${audience} keeps getting stuck on ${topic}, this is the part to fix first.` },
    { id: `${idea.id}-hook-proof`, style: 'proof', text: `A clearer ${topic} process starts by making three decisions visible instead of guessing.` },
    { id: `${idea.id}-hook-direct`, style: 'direct', text: `${idea.title}: here is the simplest way to apply it today.` }
  ];
}

export function buildStructuredDraft(idea: ContentIdea, hook: HookVariant, profile: CreatorProfile): ContentDraft {
  const audience = clean(profile.audience, 'your audience');
  const objective = clean(profile.objective, 'make a better decision');
  const tone = clean(profile.tone, 'clear and practical');
  const language = clean(profile.language, 'English');

  const introduction = `${hook.text} ${sentence(idea.angle)}`;
  const bodyPoints = [
    `Start with the actual problem: ${sentence(idea.audienceNeed)}`,
    `Use one simple decision rule and explain why it matters for ${audience}.`,
    `End with a concrete next action that moves the audience toward “${objective}”.`
  ];
  const cta = `Choose one action from this framework and apply it today; then review what changed before adding more complexity.`;
  const narration = [introduction, ...bodyPoints, cta, `Tone: ${tone}.`].join('\n\n');

  return {
    id: `draft-${idea.id}`,
    ideaId: idea.id,
    hookId: hook.id,
    title: idea.title,
    introduction,
    bodyPoints,
    cta,
    narration,
    language
  };
}

export function repurposeDraft(draft: ContentDraft): RepurposedVariant[] {
  const body = draft.bodyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n');
  const compactBody = draft.bodyPoints.map(point => point.replace(/\.$/, '')).join(' • ');
  return [
    {
      id: `${draft.id}-instagram`,
      platform: 'instagram',
      format: 'Reel / carousel caption',
      content: `${draft.introduction}\n\n${body}\n\n${draft.cta}`
    },
    {
      id: `${draft.id}-tiktok`,
      platform: 'tiktok',
      format: 'Short-form script',
      content: `${draft.introduction}\n${compactBody}.\n${draft.cta}`
    },
    {
      id: `${draft.id}-youtube`,
      platform: 'youtube',
      format: 'Shorts description / script seed',
      content: `${draft.title}\n\n${draft.narration}`
    },
    {
      id: `${draft.id}-linkedin`,
      platform: 'linkedin',
      format: 'Professional post',
      content: `${draft.introduction}\n\n${body}\n\nPractical takeaway: ${draft.cta}`
    },
    {
      id: `${draft.id}-x`,
      platform: 'x',
      format: 'Thread seed',
      content: `${draft.title}\n\n${compactBody}.\n\n${draft.cta}`
    }
  ];
}

export function reviewDraft(draft: ContentDraft): ContentReview {
  const wordCount = draft.narration.split(/\s+/).filter(Boolean).length;
  const clarity = clampScore(wordCount <= 220 ? 92 : wordCount <= 320 ? 82 : 70);
  const structure = clampScore(draft.bodyPoints.length >= 3 ? 95 : 65);
  const hookStrength = clampScore(draft.introduction.length >= 45 && draft.introduction.length <= 280 ? 90 : 72);
  const ctaPresence = clampScore(draft.cta.trim().length >= 20 ? 100 : draft.cta.trim().length > 0 ? 75 : 0);
  const overallScore = clampScore((clarity + structure + hookStrength + ctaPresence) / 4);
  const recommendations: string[] = [];

  if (clarity < 80) recommendations.push('Shorten the narration or split complex sentences to improve clarity.');
  if (structure < 80) recommendations.push('Use at least three distinct body points so the argument has a visible progression.');
  if (hookStrength < 80) recommendations.push('Make the first sentence more specific to the audience problem or promised outcome.');
  if (ctaPresence < 80) recommendations.push('Add one concrete next action instead of ending with a general statement.');
  if (recommendations.length === 0) recommendations.push('The draft is structurally ready for governed production or publishing handoff.');

  return {
    overallScore,
    criteria: { clarity, structure, hookStrength, ctaPresence },
    recommendations
  };
}

export function createDirectorHandoff(draft: ContentDraft) {
  return {
    atlasContentHandoff: {
      title: draft.title,
      brief: `${draft.title}. ${draft.introduction} ${draft.bodyPoints.join(' ')}`,
      narration: draft.narration
    }
  };
}

export function createPublisherHandoff(variant: RepurposedVariant) {
  return {
    atlasContentHandoff: {
      caption: variant.content,
      platform: variant.platform
    }
  };
}
