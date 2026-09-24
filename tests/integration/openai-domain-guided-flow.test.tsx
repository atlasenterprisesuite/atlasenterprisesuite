import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateTaskCompletion } from '../../packages/execution/src/state-machine';

const source = readFileSync('supabase/functions/atlas-execution/openai-domain.ts', 'utf8');

describe('OpenAI domain guided completion contract', () => {
  it('cannot complete before OpenAI verified evidence exists', () => {
    const withoutOpenAi = evaluateTaskCompletion({
      steps: [
        { id: 'dns-write', status: 'completed', evidenceRequirement: ['dns_txt_write'] },
        { id: 'dns-public', status: 'completed', evidenceRequirement: ['dns_public_txt'] },
        { id: 'openai', status: 'completed', evidenceRequirement: ['openai_domain_verified'] }
      ],
      evidence: [
        { id: 'e1', kind: 'dns_txt_write', verified: true },
        { id: 'e2', kind: 'dns_public_txt', verified: true }
      ],
      approvals: [{ status: 'approved', payloadVersion: 2, payloadDigest: 'a'.repeat(64) }],
      unresolvedDependencies: []
    });
    expect(withoutOpenAi.eligible).toBe(false);
    expect(withoutOpenAi.reasons).toContain('missing_evidence:openai_domain_verified');
  });

  it('requires verified evidence and canonical completion helpers', () => {
    expect(source).toContain("'dns_txt_write'");
    expect(source).toContain("'dns_public_txt'");
    expect(source).toContain("'openai_domain_verified'");
    expect(source).toContain('verified: true');
    expect(source).toContain('valueDigest');
    expect(source).toContain('completePilotTaskIfEligible');
    expect(source).toContain('evaluateTaskCompletion');
    expect(source).toContain('completeWorkWorkflowIfEligible');
    expect(source).toContain("action: 'execution.workflow.completed'");
  });

  it('never stores a literal verification value in evidence references', () => {
    expect(source).not.toMatch(/reference:\s*JSON\.stringify\([^\n]*value[^D]/i);
    expect(source).not.toContain('openai-domain-verification=');
  });
});
