import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function workflow(path: string) {
  return readFileSync(`${root}/${path}`, 'utf8');
}

describe('GitHub Actions pull-request runner boundary', () => {
  it('does not execute pull_request validation on unconditional self-hosted runners', () => {
    const prWorkflows = [
      '.github/workflows/accounts-payable-ci.yml',
      '.github/workflows/ride-profile-photo-ci.yml'
    ];

    for (const path of prWorkflows) {
      const source = workflow(path);
      expect(source, path).toContain('pull_request:');
      expect(source, path).not.toMatch(/runs-on:\s*self-hosted/);
      expect(source, path).toMatch(/runs-on:\s*ubuntu-latest/);
    }
  });

  it('keeps explicitly self-hosted workflows off pull_request events', () => {
    const trustedOnly = [
      '.github/workflows/hospitality-self-hosted-ci.yml',
      '.github/workflows/atlas-director-self-hosted-ci.yml'
    ];

    for (const path of trustedOnly) {
      const source = workflow(path);
      expect(source, path).toMatch(/runs-on:\s*self-hosted/);
      expect(source, path).not.toContain('pull_request:');
    }
  });
});
