import { expect, it } from 'vitest';
import { getWorkTemplate } from '../../packages/execution/src/work-templates';

it('registers the Manager-owned OpenAI domain verification template', () => {
  const template = getWorkTemplate('manager.openai_domain_verification');
  expect(template).toBeTruthy();
  expect(template?.ownerModule).toBe('manager');
  expect(template?.defaults).toEqual({ executionMode: 'hybrid', autonomyLevel: 'guided', runtimePreference: 'auto', budgetLimit: 0 });
  expect(template?.requiredInputs).toEqual(['domain']);
  expect(template?.steps.map((step) => step.actionType)).toEqual([
    'observe_openai_verification_requirement',
    'resolve_authoritative_dns_provider',
    'inspect_dns_state',
    'prepare_dns_txt_mutation',
    'create_dns_txt',
    'verify_provider_dns_state',
    'verify_public_dns_txt',
    'open_openai_domain_verification',
    'click_openai_check',
    'verify_openai_domain_state',
    'record_completion_evidence'
  ]);
});

it('marks the DNS write as high-risk and evidence-backed', () => {
  const template = getWorkTemplate('manager.openai_domain_verification')!;
  const create = template.steps.find((step) => step.actionType === 'create_dns_txt')!;
  expect(create.permissionsRequired).toContain('execution.write');
  expect(create.sensitivity).toBe('high');
  expect(create.evidenceRequirement).toContain('dns_txt_write');
  expect(template.steps.find((step) => step.actionType === 'verify_public_dns_txt')?.evidenceRequirement).toContain('dns_public_txt');
  expect(template.steps.find((step) => step.actionType === 'verify_openai_domain_state')?.evidenceRequirement).toContain('openai_domain_verified');
});

it('contains no hard-coded verification value', () => {
  expect(JSON.stringify(getWorkTemplate('manager.openai_domain_verification'))).not.toContain('openai-domain-verification=');
});
