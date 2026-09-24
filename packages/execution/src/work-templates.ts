import type { WorkAutonomyLevel, WorkExecutionMode, WorkRuntimePreference } from './work-types';
import type { WorkActionSensitivity } from './work-policy';

export type WorkTemplateStep = {
  title: string;
  actionType: string;
  completionCriteria: string[];
  evidenceRequirement: string[];
  permissionsRequired: string[];
  sensitivity: WorkActionSensitivity;
  mutation: boolean;
  safeEnvelopeHints?: { allowedDomains?: string[]; allowedActions?: string[] };
};

export type WorkTemplateDefinition = {
  id: string;
  title: string;
  description: string;
  ownerModule: string;
  requiredInputs: string[];
  defaults: {
    executionMode: WorkExecutionMode;
    autonomyLevel: WorkAutonomyLevel;
    runtimePreference: WorkRuntimePreference;
    budgetLimit: number | null;
  };
  steps: WorkTemplateStep[];
};

const OPENAI_DOMAIN_STEPS: WorkTemplateStep[] = [
  {
    title: 'Observe current OpenAI verification requirement',
    actionType: 'observe_openai_verification_requirement',
    completionCriteria: ['current OpenAI domain verification requirement observed from an authorized session'],
    evidenceRequirement: [], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false,
    safeEnvelopeHints: { allowedDomains: ['openai.com', 'chatgpt.com'], allowedActions: ['navigate', 'read_text'] }
  },
  {
    title: 'Resolve authoritative DNS provider', actionType: 'resolve_authoritative_dns_provider',
    completionCriteria: ['authoritative DNS provider resolved with evidence'], evidenceRequirement: [], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false
  },
  {
    title: 'Inspect current DNS state', actionType: 'inspect_dns_state',
    completionCriteria: ['current TXT state inspected before mutation'], evidenceRequirement: [], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false
  },
  {
    title: 'Prepare exact DNS TXT mutation', actionType: 'prepare_dns_txt_mutation',
    completionCriteria: ['exact hostname type and current verification value prepared server-side'], evidenceRequirement: [], permissionsRequired: ['execution.write'], sensitivity: 'high', mutation: false
  },
  {
    title: 'Create exact DNS TXT record', actionType: 'create_dns_txt',
    completionCriteria: ['exact approved TXT record exists at authoritative provider'], evidenceRequirement: ['dns_txt_write'], permissionsRequired: ['execution.write'], sensitivity: 'high', mutation: true,
    safeEnvelopeHints: { allowedActions: ['create_dns_txt'] }
  },
  {
    title: 'Verify provider DNS state', actionType: 'verify_provider_dns_state',
    completionCriteria: ['authoritative provider readback contains the exact TXT record'], evidenceRequirement: [], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false
  },
  {
    title: 'Verify public DNS TXT', actionType: 'verify_public_dns_txt',
    completionCriteria: ['public resolver returns the exact TXT value'], evidenceRequirement: ['dns_public_txt'], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false
  },
  {
    title: 'Open OpenAI domain verification', actionType: 'open_openai_domain_verification',
    completionCriteria: ['OpenAI verification surface is open for the target domain'], evidenceRequirement: [], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false,
    safeEnvelopeHints: { allowedDomains: ['openai.com', 'chatgpt.com'], allowedActions: ['navigate', 'read_text'] }
  },
  {
    title: 'Invoke OpenAI Check', actionType: 'click_openai_check',
    completionCriteria: ['OpenAI Check invoked for the current target domain'], evidenceRequirement: [], permissionsRequired: ['execution.write'], sensitivity: 'high', mutation: true,
    safeEnvelopeHints: { allowedDomains: ['openai.com', 'chatgpt.com'], allowedActions: ['click_openai_check'] }
  },
  {
    title: 'Verify OpenAI domain state', actionType: 'verify_openai_domain_state',
    completionCriteria: ['OpenAI reports verified for the target domain'], evidenceRequirement: ['openai_domain_verified'], permissionsRequired: ['execution.read'], sensitivity: 'medium', mutation: false,
    safeEnvelopeHints: { allowedDomains: ['openai.com', 'chatgpt.com'], allowedActions: ['read_text'] }
  },
  {
    title: 'Record completion evidence', actionType: 'record_completion_evidence',
    completionCriteria: ['required verified evidence is persisted without raw verification value'], evidenceRequirement: [], permissionsRequired: ['execution.write'], sensitivity: 'medium', mutation: false
  }
];

export const WORK_TEMPLATES: WorkTemplateDefinition[] = [
  {
    id: 'manager.openai_domain_verification',
    title: 'Verify a domain with OpenAI',
    description: 'Observe the current OpenAI requirement, create only the exact approved TXT record, verify public DNS, and confirm OpenAI verified state.',
    ownerModule: 'manager',
    requiredInputs: ['domain'],
    defaults: { executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto', budgetLimit: 0 },
    steps: OPENAI_DOMAIN_STEPS
  }
];

export function getWorkTemplate(id: string) {
  return WORK_TEMPLATES.find((template) => template.id === id) ?? null;
}
