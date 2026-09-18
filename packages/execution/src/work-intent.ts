import {
  parseAtlasWorkContext,
  type WorkAutonomyLevel,
  type WorkExecutionMode,
  type WorkRuntimePreference
} from './work-types';

export type WorkIntentInput = {
  intent: string;
  ownerModule: string;
  executionMode?: WorkExecutionMode;
  autonomyLevel?: WorkAutonomyLevel;
  runtimePreference?: WorkRuntimePreference;
  budgetLimit?: number | null;
  connectionRefs?: string[];
};

export type WorkPlanPreview = {
  status: 'draft';
  intent: string;
  ownerModule: string;
  executionMode: WorkExecutionMode;
  autonomyLevel: WorkAutonomyLevel;
  runtimePreference: WorkRuntimePreference;
  budgetLimit: number | null;
  connectionRefs: string[];
  successCriteria: string[];
};

const OPENAI_DOMAIN_VERIFICATION_INTENT = 'verify atlasenterprisesuite.com with openai';

const OPENAI_DOMAIN_SUCCESS_CRITERIA = [
  'DNS TXT exists',
  'public DNS returns the expected value',
  'OpenAI reports verified',
  'evidence persisted'
];

const GENERIC_SUCCESS_CRITERIA = [
  'requested outcome exists',
  'result independently verified',
  'evidence persisted'
];

export function compileWorkIntent(input: WorkIntentInput): WorkPlanPreview {
  const intent = String(input.intent ?? '').trim().slice(0, 2000);
  if (!intent) throw new Error('work_intent_required');

  const ownerModule = String(input.ownerModule ?? '').trim();
  if (!ownerModule) throw new Error('work_owner_module_required');

  const work = parseAtlasWorkContext({
    work: {
      executionMode: input.executionMode,
      autonomyLevel: input.autonomyLevel,
      runtimePreference: input.runtimePreference,
      budgetLimit: input.budgetLimit,
      connectionRefs: input.connectionRefs
    }
  });

  const successCriteria = intent.toLowerCase() === OPENAI_DOMAIN_VERIFICATION_INTENT
    ? OPENAI_DOMAIN_SUCCESS_CRITERIA
    : GENERIC_SUCCESS_CRITERIA;

  return {
    status: 'draft',
    intent,
    ownerModule: ownerModule.slice(0, 80),
    executionMode: work.executionMode,
    autonomyLevel: work.autonomyLevel,
    runtimePreference: work.runtimePreference,
    budgetLimit: work.budgetLimit,
    connectionRefs: work.connectionRefs,
    successCriteria: [...successCriteria]
  };
}
