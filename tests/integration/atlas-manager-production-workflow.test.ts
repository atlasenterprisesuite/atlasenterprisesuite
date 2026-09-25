import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');

describe('ATLAS Supabase-first production workflow', () => {
  it('is a build and readiness gate rather than a Vercel deployment', () => {
    expect(workflow).toContain('name: ATLAS Build + Production Readiness Gate');
    expect(workflow).not.toContain('VERCEL_TOKEN');
    expect(workflow).not.toContain('vercel deploy');
    expect(workflow).not.toContain('Install Vercel CLI');
  });

  it('runs the complete readiness gate before merge and again for every merged main SHA', () => {
    expect(workflow).toMatch(/pull_request:\s*\n\s+branches: \["main"\]/);
    expect(workflow).toMatch(/push:\s*\n\s+branches: \["main"\]/);
    expect(workflow).toContain('Pull requests to main must prove full repository readiness before merge');
    expect(workflow).toContain('Every merged main SHA must then receive fresh readiness evidence again');
    expect(workflow).not.toContain('    paths:');
  });

  it('does not falsely claim Cloudflare or Vercel deployment', () => {
    expect(workflow).toContain('Cloudflare production deployment: separate required stage; not claimed by this workflow');
    expect(workflow).toContain('Vercel: optional legacy adapter; not part of this gate');
  });
});
