import { describe, expect, it } from 'vitest';
import { assessVersePreflight, parseVerseChecks, type VersePreflightInput } from '../../apps/web/src/modules/cloud/versePreflight';

const SHA = 'a'.repeat(40);
const base = (overrides: Partial<VersePreflightInput> = {}): VersePreflightInput => ({
  expectedSha: SHA,
  observedSha: SHA,
  environment: 'production',
  provider: 'cloudflare',
  deploymentId: 'cf-deploy-123',
  build: 'success',
  runtime: 'success',
  checks: [{ name: 'verify-build-readiness', required: true, state: 'success' }],
  ...overrides
});

describe('ATLAS Verse sovereign release preflight', () => {
  it('does not invent production verification even for fully green user-submitted evidence', () => {
    const result = assessVersePreflight(base());
    expect(result.status).toBe('candidate_only');
    expect(result.productionVerified).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.notice).toMatch(/no constituye verificación autenticada/i);
  });

  it('fails closed when a required check failed, even with green preview/build states', () => {
    const result = assessVersePreflight(base({
      checks: [{ name: 'github-security-baseline', required: true, state: 'failure' }]
    }));
    expect(result.status).toBe('blocked');
    expect(result.blockers.join(' ')).toMatch(/github-security-baseline/);
  });

  it('classifies failed legacy Vercel as advisory only if explicitly optional', () => {
    const result = assessVersePreflight(base({
      checks: [
        { name: 'verify-build-readiness', required: true, state: 'success' },
        { name: 'Vercel – atlas_enterprise_suite', required: false, state: 'failure' }
      ]
    }));
    expect(result.status).toBe('candidate_only');
    expect(result.warnings.join(' ')).toContain('Vercel – atlas_enterprise_suite');
    expect(result.productionVerified).toBe(false);
  });

  it('blocks a checklist that contains no required check evidence', () => {
    const result = assessVersePreflight(base({
      checks: [{ name: 'Vercel – atlas_enterprise_suite', required: false, state: 'success' }]
    }));
    expect(result.status).toBe('blocked');
    expect(result.blockers.join(' ')).toMatch(/verificaci[oó]n obligatoria/i);
  });

  it('rejects missing or mismatched SHA and refuses false readiness', () => {
    expect(assessVersePreflight(base({ observedSha: 'b'.repeat(40) })).status).toBe('blocked');
    expect(assessVersePreflight(base({ observedSha: '' })).status).toBe('blocked');
    expect(assessVersePreflight(base({ expectedSha: 'abcd' })).status).toBe('blocked');
  });

  it('never considers a Vercel deployment canonical Cloudflare production', () => {
    const result = assessVersePreflight(base({ provider: 'vercel' }));
    expect(result.status).toBe('blocked');
    expect(result.blockers.join(' ')).toMatch(/Cloudflare/i);
  });

  it('keeps preview status separate from production', () => {
    const result = assessVersePreflight(base({ environment: 'preview', provider: 'vercel' }));
    expect(result.status).toBe('candidate_only');
    expect(result.productionVerified).toBe(false);
    expect(result.notice).toMatch(/preview/i);
  });

  it('requires actual required checks, runtime, build and deployment evidence', () => {
    const result = assessVersePreflight(base({
      checks: [], build: 'pending', runtime: 'unknown', deploymentId: ''
    }));
    expect(result.status).toBe('blocked');
    expect(result.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it('parses check lines, rejects malformed or duplicate names, and never promotes unknown statuses', () => {
    const valid = parseVerseChecks('required|verify-build-readiness|success\noptional|Vercel – atlas_enterprise_suite|failure');
    expect(valid.errors).toEqual([]);
    expect(valid.checks).toEqual([
      { name: 'verify-build-readiness', required: true, state: 'success' },
      { name: 'Vercel – atlas_enterprise_suite', required: false, state: 'failure' }
    ]);
    const invalid = parseVerseChecks('required|verify|success\nrequired|verify|failure\noptional|check|magic');
    expect(invalid.errors.length).toBe(2);
    expect(assessVersePreflight(base({ checks: invalid.checks })).productionVerified).toBe(false);
  });
});
