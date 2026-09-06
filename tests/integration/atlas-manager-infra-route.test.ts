import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Manager infrastructure route contract', () => {
  it('binds /atlas/infra/status to the authenticated ATLAS infrastructure status service', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf-8'));
    const rewrite = (vercel.rewrites ?? []).find((entry: { source?: string }) => entry.source === '/atlas/infra/status');

    expect(rewrite).toBeDefined();
    expect(rewrite.destination).toBe('https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-infra-status');
  });

  it('preserves the existing extensionless /healthz production artifact', () => {
    const health = JSON.parse(readFileSync('apps/web/public/healthz', 'utf-8'));

    expect(health.status).toBe('ok');
    expect(health.service).toBe('atlas-enterprise-suite-web');
    expect(health.environment).toBe('production-artifact');
  });

  it('makes the production workflow create the Vercel project when it is missing', () => {
    const workflow = readFileSync('.github/workflows/production-deploy.yml', 'utf-8');

    expect(workflow).toContain('VERCEL_PROJECT_NAME: atlasenterprisesuite');
    expect(workflow).toContain('vercel project inspect "$VERCEL_PROJECT_NAME"');
    expect(workflow).toContain('https://api.vercel.com/v11/projects?slug=$VERCEL_SCOPE');
    expect(workflow).toContain('--project "$VERCEL_PROJECT_NAME"');
  });
});
