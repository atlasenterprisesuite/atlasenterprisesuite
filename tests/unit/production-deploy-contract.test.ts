import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/production-deploy.yml', 'utf8');
const managerSpec = readFileSync('docs/architecture/ATLAS_MANAGER_SPEC.md', 'utf8');
const readme = readFileSync('README.md', 'utf8');

describe('ATLAS production deployment architecture contract', () => {
  it('targets the canonical Supabase v2 backend and Cloudflare production path', () => {
    expect(workflow).toContain('SUPABASE_PROJECT_REF: qawxltbplsxcjvwxdkes');
    expect(workflow).toContain('atlas_backend_gate');
    expect(workflow).toContain('wrangler@4 pages deploy apps/web/dist');
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN');
    expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).toContain('CLOUDFLARE_PAGES_PROJECT');
  });

  it('does not require Vercel for the approved production path', () => {
    expect(workflow).not.toContain('VERCEL_TOKEN');
    expect(workflow).not.toContain('vercel deploy');
    expect(managerSpec).toContain('GitHub → ATLAS Forge/CI → Supabase + Cloudflare → Production');
    expect(managerSpec).toContain('Vercel is legacy compatibility only');
    expect(readme).toContain('Vercel is legacy compatibility only');
  });

  it('fails closed instead of auto-pushing an incomplete Supabase v2 migration mirror', () => {
    expect(workflow).not.toContain('supabase db push');
    expect(managerSpec).toContain('MUST NOT perform an automatic `supabase db push`');
    expect(workflow).toContain('Database migrations are intentionally not auto-pushed here');
  });

  it('keeps build and production verification gates before completion', () => {
    expect(workflow).toContain('npm audit --audit-level=high');
    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm run test:unit');
    expect(workflow).toContain('npm run test:integration');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('/finance/accounting/accounts-payable');
    expect(workflow).toContain('/healthz');
  });
});
