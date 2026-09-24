import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const required = [
  '.gitignore',
  '.github/CODEOWNERS',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'docs/governance/MAIN_BRANCH_REQUIRED_POLICY.md'
];

describe('repository governance source of truth', () => {
  it('contains the required governance files', () => {
    for (const path of required) expect(existsSync(`${root}/${path}`), path).toBe(true);
  });

  it('defines enforceable main-branch expectations', () => {
    const policyPath = `${root}/docs/governance/MAIN_BRANCH_REQUIRED_POLICY.md`;
    const policy = existsSync(policyPath) ? readFileSync(policyPath, 'utf8') : '';
    expect(policy).toContain('pull request');
    expect(policy).toContain('ATLAS 3-of-3 Consensus');
    expect(policy).toContain('CodeQL');
    expect(policy).toContain('ATLAS Build + Production Readiness Gate');
    expect(policy).toContain('force push');
    expect(policy).toContain('deletion');
  });
});
