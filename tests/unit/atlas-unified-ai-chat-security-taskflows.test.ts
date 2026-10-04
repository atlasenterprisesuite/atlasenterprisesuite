import { describe, expect, it } from 'vitest';
import {
  SECURITY_TASKFLOW_CLASSES,
  normalizeSecurityFinding,
  verifySecurityFinding,
} from '../../supabase/functions/atlas-copilot/security-taskflows.mjs';

describe('ATLAS evidence-producing agentic security taskflows', () => {
  it('covers the approved initial vulnerability investigation classes', () => {
    expect(SECURITY_TASKFLOW_CLASSES).toEqual([
      'auth_session',
      'tenant_isolation',
      'ssrf_url_handling',
      'injection_unsafe_parsing',
      'webhook_signature_replay',
      'ci_trust_boundary',
      'secret_unsafe_logging',
    ]);
  });

  it('keeps a high-severity model finding as a hypothesis without reproducible evidence', () => {
    const finding = normalizeSecurityFinding({
      organization_id: 'org-1', trace_id: 'trace-1', taskflow_class: 'tenant_isolation',
      title: 'Cross-tenant read may be possible', severity: 'critical',
      model_claim: 'Confirmed vulnerability', chain_of_thought: 'private reasoning',
    });
    expect(finding).toMatchObject({ state: 'hypothesis', severity: 'critical', organization_id: 'org-1', trace_id: 'trace-1' });
    expect(finding).not.toHaveProperty('chain_of_thought');
    expect(finding).not.toHaveProperty('model_claim');
  });

  it('does not verify a finding with an unsupported or unscoped evidence type', () => {
    const finding = normalizeSecurityFinding({
      organization_id: 'org-1', trace_id: 'trace-1', taskflow_class: 'ssrf_url_handling', title: 'Possible SSRF', severity: 'high',
    });
    const result = verifySecurityFinding({
      finding,
      evidence: { kind: 'model_opinion', reference: 'agent-output-1', organization_id: 'org-1', trace_id: 'trace-1' },
    });
    expect(result.state).toBe('hypothesis');
    expect(result.verification).toMatchObject({ verified: false, reason: 'unsupported_evidence_kind' });
  });

  it('requires tenant and trace scope to match before reproducible evidence can verify a finding', () => {
    const finding = normalizeSecurityFinding({
      organization_id: 'org-1', trace_id: 'trace-1', taskflow_class: 'webhook_signature_replay', title: 'Replay accepted', severity: 'high',
    });
    const result = verifySecurityFinding({
      finding,
      evidence: { kind: 'failing_test', reference: 'tests/replay.test.ts#rejects-replay', organization_id: 'org-2', trace_id: 'trace-1' },
    });
    expect(result.state).toBe('hypothesis');
    expect(result.verification).toMatchObject({ verified: false, reason: 'evidence_scope_mismatch' });
  });

  it('promotes only allowlisted reproducible evidence to verified without hidden reasoning', () => {
    const finding = normalizeSecurityFinding({
      organization_id: 'org-1', trace_id: 'trace-1', taskflow_class: 'auth_session', title: 'Expired token accepted', severity: 'critical',
    });
    const result = verifySecurityFinding({
      finding,
      evidence: {
        kind: 'reproducible_http', reference: 'evidence://auth/expired-token-401-contract',
        organization_id: 'org-1', trace_id: 'trace-1', chain_of_thought: 'do not retain this', raw_secret: 'secret-value',
      },
    });
    expect(result.state).toBe('verified');
    expect(result.verification).toMatchObject({
      verified: true,
      reason: 'reproducible_evidence',
      evidence: { kind: 'reproducible_http', reference: 'evidence://auth/expired-token-401-contract' },
    });
    expect(JSON.stringify(result)).not.toContain('do not retain this');
    expect(JSON.stringify(result)).not.toContain('secret-value');
  });
});
