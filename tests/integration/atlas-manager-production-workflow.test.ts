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

  it('watches Supabase control-plane source changes', () => {
    expect(workflow).toContain('- "supabase/functions/**"');
    expect(workflow).toContain('- "docs/architecture/ATLAS_MANAGER_SPEC.md"');
  });

  it('does not falsely claim Cloudflare deployment', () => {
    expect(workflow).toContain('Cloudflare production deployment: separate required stage; not claimed by this workflow');
    expect(workflow).toContain('Vercel: optional; not part of this gate');
  });
});
