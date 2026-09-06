export type NeuroplasticityGoal = 'memory' | 'focus' | 'language' | 'professional' | 'motor';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface NeuroplasticityProfile {
  goal: NeuroplasticityGoal;
  minutesPerDay: number;
  experienceLevel: ExperienceLevel;
  sleepHours: number;
  exerciseDaysPerWeek: number;
  hasNeurologicalCondition: boolean;
}

export interface PracticeBlock {
  id: string;
  title: string;
  minutes: number;
  purpose: string;
  instruction: string;
  owner: 'health' | 'learning';
}

export interface NeuroplasticityPlan {
  version: 'v1';
  totalMinutes: number;
  reviewDays: number[];
  blocks: PracticeBlock[];
  professionalReviewRecommended: boolean;
  safetyMessage: string;
}

const goalPractice: Record<NeuroplasticityGoal, string> = {
  memory: 'Study a small set of facts, then recall them without looking.',
  focus: 'Complete one distraction-free task and record each attention reset.',
  language: 'Listen, repeat aloud, then produce five sentences without looking.',
  professional: 'Solve one work-relevant problem, then explain the method from memory.',
  motor: 'Practice a new movement slowly with accurate form and gradual difficulty.'
};

export function validateProfile(profile: NeuroplasticityProfile): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(profile.minutesPerDay) || profile.minutesPerDay < 15 || profile.minutesPerDay > 120) {
    errors.push('Daily practice must be between 15 and 120 minutes.');
  }
  if (!Number.isFinite(profile.sleepHours) || profile.sleepHours < 0 || profile.sleepHours > 24) {
    errors.push('Sleep hours must be between 0 and 24.');
  }
  if (!Number.isInteger(profile.exerciseDaysPerWeek) || profile.exerciseDaysPerWeek < 0 || profile.exerciseDaysPerWeek > 7) {
    errors.push('Exercise days must be a whole number between 0 and 7.');
  }
  return errors;
}

export function buildNeuroplasticityPlan(profile: NeuroplasticityProfile): NeuroplasticityPlan {
  const errors = validateProfile(profile);
  if (errors.length) throw new Error(errors.join(' '));

  const learningMinutes = Math.max(8, Math.round(profile.minutesPerDay * 0.5));
  const recallMinutes = Math.max(5, Math.round(profile.minutesPerDay * 0.2));
  const attentionMinutes = Math.max(2, Math.round(profile.minutesPerDay * 0.1));
  const remaining = Math.max(0, profile.minutesPerDay - learningMinutes - recallMinutes - attentionMinutes);

  const blocks: PracticeBlock[] = [
    {
      id: 'deliberate-practice',
      title: 'Deliberate practice',
      minutes: learningMinutes,
      purpose: 'Novelty and progressive challenge',
      instruction: goalPractice[profile.goal],
      owner: 'learning'
    },
    {
      id: 'active-recall',
      title: 'Active recall',
      minutes: recallMinutes,
      purpose: 'Strengthen retrieval',
      instruction: 'Close the material and explain or write what you remember, then correct errors.',
      owner: 'learning'
    },
    {
      id: 'attention-reset',
      title: 'Attention reset',
      minutes: attentionMinutes,
      purpose: 'Train attentional control',
      instruction: 'Focus on slow breathing; when distracted, label it and gently return.',
      owner: 'health'
    }
  ];

  if (remaining > 0) {
    blocks.push({
      id: 'movement-recovery',
      title: 'Movement and recovery',
      minutes: remaining,
      purpose: 'Support sleep, mood and learning readiness',
      instruction: profile.exerciseDaysPerWeek < 3
        ? 'Use comfortable walking or mobility work and increase gradually.'
        : 'Use today’s planned movement or a short recovery walk.',
      owner: 'health'
    });
  }

  const professionalReviewRecommended = profile.hasNeurologicalCondition;
  return {
    version: 'v1',
    totalMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
    reviewDays: [1, 3, 7, 14],
    blocks,
    professionalReviewRecommended,
    safetyMessage: professionalReviewRecommended
      ? 'Use this plan only as general education. A neurologist or rehabilitation professional should tailor practice after stroke, brain injury, neurological disease or significant memory change.'
      : 'This is a general wellbeing and learning plan, not diagnosis, treatment or proof of brain change.'
  };
}

export function nextReviewDate(startDate: string, reviewDay: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isInteger(reviewDay) || reviewDay < 0) {
    throw new Error('A valid start date and non-negative review day are required.');
  }
  const date = new Date(`${startDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('A valid start date is required.');
  date.setUTCDate(date.getUTCDate() + reviewDay);
  return date.toISOString().slice(0, 10);
}

export function completionPercent(completedIds: string[], blocks: PracticeBlock[]): number {
  if (blocks.length === 0) return 0;
  const validIds = new Set(blocks.map((block) => block.id));
  const uniqueCompleted = new Set(completedIds.filter((id) => validIds.has(id)));
  return Math.round((uniqueCompleted.size / blocks.length) * 100);
}
